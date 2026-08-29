# Production OCPI Security and Session-to-Wallet Linking

## Security architecture

OCPI uses HTTPS and a credentials token in the `Authorization: Token ...` header. The current OCPI transport specification describes server-side TLS plus token authentication; it does not require client certificates for the protocol itself.[1] Relay Rider should nevertheless support optional **mutual TLS (mTLS)** whenever a roaming provider requires or offers it, because mTLS provides an additional node-to-node identity control.

The production deployment should separate three credential classes:

| Secret | Owner | Storage | Rotation |
|---|---|---|---|
| OCPI credentials token received from provider | Relay Rider integration worker | Managed secrets service or envelope-encrypted database column | Rotate on provider schedule and immediately on suspected compromise |
| Relay Rider credentials token sent to provider | Relay Rider integration service | Managed secrets service; never in source control or browser state | Rotate with overlap window so both old and new tokens can be accepted briefly |
| mTLS private key | Relay Rider integration worker | HSM/KMS-backed certificate manager or mounted secret with filesystem mode `0600` | Automated certificate renewal with dual-certificate overlap |

The web application should not hold provider credentials, client certificates, private keys, or raw driver authorization tokens. A dedicated integration worker or backend adapter should perform OCPI calls. The worker should receive an internal `partnerId`, load secrets by reference, and emit only normalized station, session, CDR, and settlement events.

Token records should contain `partnerId`, `tokenVersion`, `ciphertextRef`, `fingerprint`, `validFrom`, `validTo`, `status`, and `lastUsedAt`. Store a SHA-256 fingerprint for lookup and audit, but do not assume a fingerprint can replace the secret for outbound authentication. Encrypt the token using envelope encryption: the application obtains a data-encryption key from KMS, decrypts only in process memory, and never logs the plaintext.

## mTLS configuration

Use a certificate whose subject or SAN is registered with the roaming provider. The provider’s integration guide determines whether Relay Rider must supply a client certificate, validate a private CA, send a specific SNI name, or use a certificate chain. Do not disable TLS verification in production and do not use `rejectUnauthorized: false` as a workaround.

### Node.js fetch client

The existing `OcpiClient` accepts an injected `fetchImpl`, so a production adapter can provide a fetch implementation backed by an mTLS agent. With Node.js and `undici`, the shape is:

```js
import fs from 'node:fs'
import { Agent, fetch } from 'undici'
import { OcpiClient } from './src/ocpi/ocpiClient.js'
import { InMemoryOcpiCredentialStore } from './src/ocpi/credentialStore.js'

const dispatcher = new Agent({
  connect: {
    cert: fs.readFileSync(process.env.OCPI_MTLS_CERT_PATH),
    key: fs.readFileSync(process.env.OCPI_MTLS_KEY_PATH),
    ca: fs.readFileSync(process.env.OCPI_MTLS_CA_PATH),
    rejectUnauthorized: true,
    servername: process.env.OCPI_MTLS_SERVER_NAME,
  },
})

const mtlsFetch = (url, options = {}) => fetch(url, { ...options, dispatcher })
const store = new InMemoryOcpiCredentialStore()
const client = new OcpiClient({
  versionsUrl: process.env.OCPI_PROVIDER_VERSIONS_URL,
  partnerId: process.env.OCPI_PARTNER_ID,
  store,
  fetchImpl: mtlsFetch,
})
```

In the production version, replace the file reads with a certificate-manager or KMS integration. If the private key is mounted as a file, run the worker under a dedicated user, set `0600` permissions, keep the certificate and key outside the container image, and ensure logs cannot print request TLS options.

### Python equivalent

The same separation can be implemented with `httpx` and an `ssl.SSLContext`:

```python
import os
import ssl
import httpx

context = ssl.create_default_context(cafile=os.environ["OCPI_MTLS_CA_PATH"])
context.load_cert_chain(
    certfile=os.environ["OCPI_MTLS_CERT_PATH"],
    keyfile=os.environ["OCPI_MTLS_KEY_PATH"],
)

client = httpx.AsyncClient(
    verify=context,
    timeout=15.0,
    headers={"Accept": "application/json"},
)

response = await client.get(
    os.environ["OCPI_PROVIDER_VERSIONS_URL"],
    headers={"Authorization": "Token " + provider_credentials_token},
)
response.raise_for_status()
```

The Python client should use a long-lived `AsyncClient`, close it during worker shutdown, and rotate the certificate by constructing a new client before retiring the old one. The provider may require an intermediate CA bundle rather than the root CA; use the exact chain supplied by the provider.

## Linking Sessions and CDRs to wallet redemptions

The safest linkage is a two-key strategy:

1. When Relay Rider approves a redemption, it creates a short-lived OCPI driver token and an `authorizationReference` that identifies the wallet redemption internally.
2. The token is published to the eMSP/CPO path using the OCPI Tokens module. When the charging command or real-time authorization supports an authorization reference, Relay Rider sends the same opaque reference.
3. The CPO’s Session and final CDR are matched first by `authorization_reference`, then by `session_id`, then by the opaque OCPI token UID. A match must resolve to one and only one active redemption.
4. The CDR is stored immutably, validated, and settled exactly once. A CDR that cannot be matched is retained and routed to `REVIEW_REQUIRED`; it must never consume a wallet credit automatically.

This design uses the OCPI token UID as an opaque correlation handle, not as a carbon certificate or a financial instrument. The wallet’s internal redemption token should be a random identifier with no embedded participant data. If the program later issues certified environmental attributes, store those as a distinct registry/claim identifier and keep them separate from the charging authorization token.

The Session object is the live operational projection. It may be updated with `PUT` or `PATCH` while active, and the final state is `COMPLETED`.[2] The CDR is the sealed billing artifact and the only billing-relevant object; it is sent after the session ends and cannot be replaced. Corrections require a credit CDR referencing the original CDR.[3]

```text
CreditIssuance
  └── RedemptionRequest
        ├── AuthorizationReference (opaque, unique)
        ├── DriverToken (opaque OCPI token UID)
        ├── Session (mutable operational projection)
        └── CDR (immutable settlement artifact)
              └── WalletLedgerEntry (DEBIT / REVERSAL)
```

### Matching precedence

| Priority | Match key | Requirement |
|---|---|---|
| 1 | `authorization_reference` | Exact match to one approved redemption and partner |
| 2 | `session_id` | Exact partner-scoped session already linked to a redemption |
| 3 | `cdr_token.uid` | Active token mapping resolves to one redemption |
| 4 | None | Route to manual review and do not debit |

The match must also validate partner, country code, party ID, EVSE/location eligibility, time window, token validity, and whether the redemption has already been settled. If a CDR is a credit CDR, apply a `REVERSAL` or `ADJUSTMENT` ledger entry against `credit_reference_id`; never mutate the original settled CDR.

## Settlement rules

The wallet service should calculate covered quantity from the approved entitlement and the validated CDR. For an energy-based program, use `total_energy` and retain the CDR’s charging periods and tariff IDs. For a money-based subsidy, use `total_cost` and explicitly define whether taxes, parking, reservation fees, and roaming fees are eligible. Any amount above the approved cap becomes participant overage or a review exception according to program policy.

A successful settlement should atomically create the debit, release any remaining hold, mark the redemption `FULFILLED`, and record the CDR ID, session ID, provider, tariff snapshot, and calculation version. If the database transaction fails, the inbound event can be retried safely because the event ID and CDR composite key are idempotent.

## Relevant implementation files

The JavaScript implementation is in `src/ocpi/sessionCdr.js`. It validates OCPI-shaped Sessions and CDRs, stores Sessions as replaceable projections, stores CDRs immutably, deduplicates inbound events, resolves redemptions by authorization reference or token UID, and delegates the final ledger operation to a wallet interface. The framework-neutral handlers can be mounted in Express, Fastify, Hono, or another Node.js server.

The wallet adapter supplied to `SessionCdrRedemptionService` must implement:

```js
{
  findByAuthorizationReference(reference),
  findByTokenUid(tokenUid),
  settleCdr({ redemptionId, cdr, session }),
}
```

`settleCdr` must be implemented as a database transaction in production. The current repository’s in-memory store is intentionally suitable only for local tests and prototype development.

## References

[1]: https://github.com/ocpi/ocpi/blob/2.3.0/release/core/transport_and_format.asciidoc "OCPI 2.3.0 transport, TLS, credentials-token authentication, and pull/push behavior"
[2]: https://github.com/ocpi/ocpi/blob/2.3.0/release/core/mod_sessions.asciidoc "OCPI 2.3.0 Sessions module"
[3]: https://github.com/ocpi/ocpi/blob/2.3.0/release/core/mod_cdrs.asciidoc "OCPI 2.3.0 CDRs module"

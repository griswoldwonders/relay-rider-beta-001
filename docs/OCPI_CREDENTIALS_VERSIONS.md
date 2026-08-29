# OCPI Versions and Credentials Module

This repository now includes a dependency-free Node.js implementation of the OCPI Versions and Credentials exchange under `src/ocpi/`. It is framework-agnostic so it can be mounted in Express, Fastify, Hono, or the backend framework selected for the production application.

## Files

| File | Responsibility |
|---|---|
| `src/ocpi/ocpiValidation.js` | OCPI status codes, endpoint identifiers, URL/party/version validation, response envelopes, and payload validation |
| `src/ocpi/credentialStore.js` | In-memory credential store for development and tests; production should replace it with encrypted database or secret-manager storage |
| `src/ocpi/ocpiClient.js` | Provider Versions discovery, version-detail retrieval, version negotiation, Credentials exchange, token rotation, timeout handling, and authenticated requests |
| `src/ocpi/ocpiServer.js` | Framework-neutral Versions and Credentials handlers plus an Express-style response adapter |
| `test/ocpi.test.js` | Native Node test coverage for client negotiation, credential exchange, safe token storage, validation, and server authentication |

## Client bootstrap

```js
import {
  OcpiClient,
  createOcpiCredentialsRequest,
} from './src/ocpi/ocpiClient.js'
import { InMemoryOcpiCredentialStore } from './src/ocpi/credentialStore.js'

const store = new InMemoryOcpiCredentialStore()
const client = new OcpiClient({
  versionsUrl: process.env.OCPI_PROVIDER_VERSIONS_URL,
  partnerId: 'hubject-or-provider-id',
  store,
  timeoutMs: 15_000,
})

const result = await client.bootstrap({
  preferredVersions: ['2.2.1', '2.3.0'],
  credentials: createOcpiCredentialsRequest({
    countryCode: 'US',
    partyId: 'RRD',
    role: 'EMSP',
    token: process.env.OCPI_RELAY_TOKEN,
    url: process.env.OCPI_RELAY_CREDENTIALS_URL,
  }),
})

console.log({
  selectedVersion: result.version,
  credentialsEndpoint: result.credentialsEndpoint,
  providerRoles: result.providerCredentials.roles,
})
```

The client performs the following sequence:

1. `GET` the provider’s versions URL.
2. Select the preferred mutually supported version, falling back to the provider’s last advertised version.
3. `GET` the selected version detail URL.
4. Locate the advertised `credentials` endpoint.
5. `POST` Relay Rider’s credentials payload to the provider.
6. Validate the provider’s response and store the provider token without exposing it through public serialization.

The OCPI credentials payload emitted by the helper uses the standard fields `token`, `url`, and `roles`. Module endpoint URLs are discovered from the Versions response and should not be placed in the credentials payload unless a provider explicitly documents a vendor extension.

## Server wiring

The server factory returns handlers rather than registering routes directly. This keeps the protocol code independent from a web framework.

```js
import express from 'express'
import {
  createExpressStyleOcpiRouter,
} from './src/ocpi/ocpiServer.js'
import { createOcpiCredentialsHandlers } from './src/ocpi/ocpiServer.js'

const app = express()
app.use(express.json({ type: 'application/json' }))

const handlers = createOcpiCredentialsHandlers({
  expectedInboundToken: process.env.OCPI_PROVIDER_TOKEN,
  versions: [
    { version: '2.2.1', url: 'https://api.relayrider.example/ocpi/2.2.1' },
  ],
  versionDetails: {
    version: '2.2.1',
    credentialsUrl: 'https://api.relayrider.example/ocpi/2.2.1/credentials',
    endpoints: [
      {
        identifier: 'credentials',
        role: 'EMSP',
        url: 'https://api.relayrider.example/ocpi/2.2.1/credentials',
      },
      {
        identifier: 'sessions',
        role: 'EMSP',
        url: 'https://api.relayrider.example/ocpi/2.2.1/sessions',
      },
      {
        identifier: 'cdrs',
        role: 'EMSP',
        url: 'https://api.relayrider.example/ocpi/2.2.1/cdrs',
      },
    ],
  },
  async onCredentials(credentials, context) {
    // Persist the provider identity and token in an encrypted store here.
    console.log('Received provider credentials', context.method, credentials.roles)
    return credentials
  },
})

const router = createExpressStyleOcpiRouter(handlers)
app.get('/ocpi/versions', router.versions)
app.get('/ocpi/2.2.1', router.versionDetails)
app.post('/ocpi/2.2.1/credentials', router.postCredentials)
app.put('/ocpi/2.2.1/credentials', router.putCredentials)
```

The sample uses `express` only as an illustration; Express is not added as a dependency by this change. The production application should use its chosen server framework and keep the handler behavior unchanged.

## Security requirements before production

Replace `InMemoryOcpiCredentialStore` with encrypted persistence or a managed secret store. Use separate credentials for sandbox and production, rotate both local and provider tokens, redact tokens from logs, and restrict the credentials endpoint to HTTPS. The current server handler validates the `Token` authorization scheme and an expected token; production should add request replay protection, rate limiting, audit logging, and mutual TLS or provider signature verification where the roaming provider supports it.

The implementation validates URLs, country codes, party IDs, roles, OCPI versions, response envelopes, and required credentials fields. It does not yet implement provider-specific OAuth, mTLS, signature schemes, database persistence, or OCPI module authorization beyond the Credentials exchange; those belong in the selected partner adapter.

## Commands

```bash
npm test
npm run lint
npm run build
```

The test suite uses Node’s built-in `node:test` runner and does not require an additional testing dependency.

## Protocol sources

The endpoint and envelope assumptions are based on the official OCPI project’s module overview and the EVRoaming Foundation’s description of OCPI.[1] The exact URL paths, supported version, authentication scheme, and direction of push/pull operations must always be confirmed against the selected roaming provider’s implementation guide.

[1]: https://github.com/ocpi/ocpi "Official OCPI repository"

# Relay Rider eMSP / OCPI Endpoint Contract

## Scope and versioning

This contract assumes Relay Rider acts as an **eMSP-side application** for a charging-benefit program. The selected roaming provider or CPO remains the source of truth for station operations, charging sessions, meter values, tariffs, and charge detail records. Relay Rider remains the source of truth for EV Charge Credit issuance, holds, debits, approvals, and participant-facing status.

The official OCPI repository currently lists the core modules as Locations, Sessions, CDRs, Tariffs, Tokens, Commands, Charging Profiles, Hub Client Info, and Invoice Reconciliation.[1] For the first direct-redemption integration, Relay Rider needs Credentials/Versions, Locations, Tariffs, Tokens, Commands, Sessions, and CDRs. Charging Profiles and Invoice Reconciliation can be deferred unless the commercial partner requires them.

The endpoint paths below are **OCPI route templates**, not a provider’s literal hostname. The provider’s Versions response supplies the version URL, and the Credentials exchange supplies the authenticated endpoint URLs and tokens. The implementation must therefore store `baseUrl`, `version`, `countryCode`, `partyId`, and module URLs per partner rather than hard-code one global path.

## 1. Provider connection and capability discovery

| Purpose | Direction | OCPI endpoint template | Required behavior |
|---|---|---|---|
| Discover supported OCPI versions | Relay Rider -> provider | `GET {versionsEndpoint}/versions` | Select the mutually supported version, preferably the provider’s certified 2.2.1 or 2.3.0 profile. |
| Read module endpoint URLs | Relay Rider -> provider | `GET {versionUrl}` | Store module identifiers and URLs for Locations, Tariffs, Tokens, Commands, Sessions, CDRs, and optional modules. |
| Exchange credentials | Relay Rider <-> provider | Provider-specific credentials endpoint, commonly `POST {credentialsEndpoint}/credentials` | Exchange party identity, country code, party ID, roles, endpoint URL, and authorization token. |
| Health and capability check | Relay Rider -> provider | `GET` each advertised module root or provider health endpoint | Record availability, latency, HTTP status, and last successful sync. |

The adapter should expose one internal operation, `connectPartner()`, that performs version discovery, credentials exchange, endpoint registration, token rotation, and capability validation. Credentials must be stored encrypted and never returned to the browser.

## 2. Station discovery: Locations and Tariffs

Relay Rider needs a locally cached station catalog so the participant can search without making every screen load dependent on the partner. The provider should be treated as the source of truth and Relay Rider as a normalized read model.

| Purpose | Direction | OCPI endpoint template | Typical method |
|---|---|---|---|
| Initial station synchronization | Relay Rider <- provider | `{locationsUrl}/locations` | `GET` with pagination and date filters where supported |
| Incremental station synchronization | Relay Rider <- provider | `{locationsUrl}/locations/{countryCode}/{partyId}/{locationId}` | `GET` changed locations or receive provider push updates if offered |
| EVSE and connector detail | Relay Rider <- provider | Same location resource | Read `evses[]` and `connectors[]` including status, capabilities, power, and formats |
| Tariff synchronization | Relay Rider <- provider | `{tariffsUrl}/tariffs` and `{tariffsUrl}/tariffs/{countryCode}/{partyId}/{tariffId}` | `GET` |
| Eligibility quote | Relay Rider internal service | `POST /api/redemptions/quote` | Calculate covered quantity, overage, taxes/fees treatment, and expiration from cached tariff data |

The normalized station model should retain both the provider’s raw identifier and Relay Rider’s internal ID. A location may contain multiple EVSEs, and an EVSE may contain multiple connectors. Do not flatten these levels into one record because authorization and session identifiers may be attached to the EVSE rather than the site.

```json
{
  "id": "hub_internal_123",
  "partnerId": "roaming_partner_01",
  "externalLocationId": "LOC-123",
  "countryCode": "US",
  "partyId": "ABC",
  "name": "Downtown Charging Hub",
  "address": "100 Main St",
  "city": "Austin",
  "postalCode": "78701",
  "coordinates": { "latitude": 30.2672, "longitude": -97.7431 },
  "timeZone": "America/Chicago",
  "operatorName": "Partner CPO",
  "status": "AVAILABLE",
  "isPublic": true,
  "evses": [
    {
      "uid": "EVSE-123-A",
      "evseId": "*ABC123456789*",
      "status": "AVAILABLE",
      "capabilities": ["REMOTE_START_STOP_CAPABLE"],
      "connectors": [
        {
          "id": "1",
          "standard": "IEC_62196_T2_COMBO",
          "format": "CABLE",
          "powerType": "DC",
          "maxVoltage": 1000,
          "maxAmperage": 500,
          "maxElectricPower": 250000,
          "tariffIds": ["TARIFF-FAST-01"]
        }
      ]
    }
  ],
  "sourceEvidence": "provider_verified",
  "lastSyncedAt": "2026-08-27T18:00:00Z"
}
```

A tariff should be normalized into energy, time, parking, flat, reservation, tax, and roaming components. The quote service must preserve the raw tariff and its effective period. If the tariff is ambiguous, expired, or missing, the station should be displayed but marked `verification_required`, not silently treated as eligible.

```json
{
  "id": "tariff_internal_01",
  "partnerId": "roaming_partner_01",
  "externalTariffId": "TARIFF-FAST-01",
  "currency": "USD",
  "elements": [
    {
      "priceComponents": [
        { "type": "ENERGY", "price": 0.42, "vat": 8.25, "stepSize": 1, "unit": "KWH" },
        { "type": "TIME", "price": 0.25, "vat": 8.25, "stepSize": 60, "unit": "MINUTE" }
      ],
      "restrictions": { "startTime": "00:00", "endTime": "23:59" }
    }
  ],
  "effectiveFrom": "2026-08-01T00:00:00Z",
  "effectiveTo": null,
  "rawPayloadHash": "sha256:..."
}
```

## 3. Authorization identity: Tokens

The eMSP normally supplies an authorization token that the CPO or roaming hub can recognize at the charger. Relay Rider should not use the participant’s email, phone number, Tesla identifier, or vehicle VIN as the charging token. It should create a revocable, opaque token mapped internally to a redemption request.

| Purpose | Direction | OCPI endpoint template | Typical method |
|---|---|---|---|
| Publish participant authorization token | Relay Rider -> provider | `{tokensUrl}/tokens/{countryCode}/{partyId}/{tokenUid}` | `PUT` or provider-defined token update |
| Update token status or validity | Relay Rider -> provider | Same token resource | `PUT` |
| Revoke a token | Relay Rider -> provider | Same token resource with `valid=false` or provider-specific delete/revoke operation | `PUT`/provider-specific |
| Provider token lookup | Provider -> Relay Rider | Relay Rider’s token endpoint exposed in credentials exchange | Provider `GET` or token authorization callback, depending on profile |

The token record needs an internal mapping to exactly one active redemption or participant wallet policy. A token should have a narrow scope, an expiration, and a status. A reusable long-lived participant token is convenient but increases leakage and misuse risk; for the first pilot I would use a short-lived redemption-scoped token where the partner supports it.

```json
{
  "uid": "RR-RED-01-7F5A",
  "type": "APP_USER",
  "contractId": "RR-RED-01-7F5A",
  "issuer": "RRD",
  "visualNumber": "•••• 7F5A",
  "valid": true,
  "whitelist": "ALLOWED",
  "language": "en",
  "countryCode": "US",
  "lastUpdated": "2026-08-27T18:05:00Z",
  "internalRedemptionId": "red_01"
}
```

## 4. Starting and stopping a charging session: Commands

If the provider supports remote commands, Relay Rider sends a start command after the redemption has passed approval and the credit hold has been created. The command is asynchronous. The command response is not proof that the charger started; the authoritative result is a subsequent session event or command-result callback.

| Purpose | Direction | OCPI endpoint template | Internal endpoint |
|---|---|---|---|
| Start a session | Relay Rider -> provider | `{commandsUrl}/START_SESSION` | `POST /api/redemptions/{id}/authorize` |
| Stop a session | Relay Rider -> provider | `{commandsUrl}/STOP_SESSION` | `POST /api/charging-sessions/{id}/stop` |
| Unlock connector, if supported | Relay Rider -> provider | `{commandsUrl}/UNLOCK_CONNECTOR` | Admin/exception-only operation |
| Receive command result | Provider -> Relay Rider | Relay Rider callback URL registered by provider | `POST /api/integrations/{partner}/commands/callback` |

A command request should include the external token, location ID, EVSE UID, and optional connector ID. The response should be normalized as `ACCEPTED`, `REJECTED`, `TIMEOUT`, or `UNKNOWN`. `ACCEPTED` creates an `authorization_pending` state, not `session_active`.

```json
{
  "redemptionId": "red_01",
  "partnerId": "roaming_partner_01",
  "locationId": "LOC-123",
  "evseUid": "EVSE-123-A",
  "connectorId": "1",
  "tokenUid": "RR-RED-01-7F5A",
  "requestedAt": "2026-08-27T18:06:00Z",
  "idempotencyKey": "red_01:start:v1"
}
```

## 5. Live session lifecycle: Sessions

Sessions are the operational record for an in-progress charge. Relay Rider should ingest them asynchronously and also poll for recovery when a callback is delayed. The system must support sessions that start outside Relay Rider, because a participant may use an app, RFID token, Plug & Charge, or a roaming credential.

| Purpose | Direction | OCPI endpoint template | Internal endpoint |
|---|---|---|---|
| Receive session start/update/stop | Provider -> Relay Rider | Relay Rider’s Sessions endpoint advertised in credentials | `POST /api/integrations/{partner}/ocpi/sessions` or provider-defined `PUT` resource |
| Retrieve a session for recovery | Relay Rider -> provider | `{sessionsUrl}/sessions/{countryCode}/{partyId}/{sessionId}` | `GET /api/partner-sessions/{partner}/{externalSessionId}` |
| List active or recent sessions | Relay Rider -> provider | `{sessionsUrl}/sessions` | Background reconciliation job |
| Participant session view | Client -> Relay Rider | N/A | `GET /api/redemptions/{id}/session` |

```json
{
  "id": "sess_internal_01",
  "redemptionId": "red_01",
  "partnerId": "roaming_partner_01",
  "externalSessionId": "SESSION-987",
  "locationId": "LOC-123",
  "evseUid": "EVSE-123-A",
  "connectorId": "1",
  "tokenUid": "RR-RED-01-7F5A",
  "status": "ACTIVE",
  "startDateTime": "2026-08-27T18:08:12Z",
  "lastUpdated": "2026-08-27T18:15:00Z",
  "meterStartWh": 120450,
  "meterCurrentWh": 126880,
  "energyKwh": 6.43,
  "powerKw": 120.4,
  "currency": "USD",
  "grossAmount": null,
  "coveredAmount": null,
  "rawPayloadHash": "sha256:..."
}
```

Session ingestion must be idempotent. Use the provider’s external session ID plus version or `lastUpdated` value as the deduplication key. Do not debit the wallet from a live session update; create or update a hold only, then wait for the final CDR or an approved fallback rule.

## 6. Final settlement: CDRs

The CDR is the principal settlement artifact. Relay Rider should accept the CDR, validate that it belongs to the expected participant and redemption, calculate the covered portion under the approved entitlement, and produce a ledger debit. The raw CDR should be retained for audit.

| Purpose | Direction | OCPI endpoint template | Internal endpoint |
|---|---|---|---|
| Receive completed CDR | Provider -> Relay Rider | Relay Rider’s CDR endpoint advertised in credentials | `POST /api/integrations/{partner}/ocpi/cdrs` or provider-defined `PUT` resource |
| Retrieve a CDR for recovery | Relay Rider -> provider | `{cdrsUrl}/cdrs/{countryCode}/{partyId}/{cdrId}` | `GET /api/partner-cdrs/{partner}/{externalCdrId}` |
| List recent CDRs | Relay Rider -> provider | `{cdrsUrl}/cdrs` | Scheduled reconciliation |
| Match and settle CDR | Relay Rider internal | N/A | `POST /api/internal/cdrs/{id}/settle` |

```json
{
  "id": "cdr_internal_01",
  "redemptionId": "red_01",
  "partnerId": "roaming_partner_01",
  "externalCdrId": "CDR-987",
  "externalSessionId": "SESSION-987",
  "countryCode": "US",
  "partyId": "ABC",
  "startDateTime": "2026-08-27T18:08:12Z",
  "endDateTime": "2026-08-27T18:42:51Z",
  "meterId": "METER-123",
  "totalEnergyKwh": 28.77,
  "totalTimeSeconds": 2080,
  "totalParkingSeconds": 0,
  "currency": "USD",
  "totalCostExcludingTax": 12.08,
  "totalTax": 1.00,
  "totalCostIncludingTax": 13.08,
  "tariffs": ["TARIFF-FAST-01"],
  "settlementStatus": "PENDING",
  "rawPayloadHash": "sha256:..."
}
```

The settlement service should calculate at least these values: `eligibleEnergyKwh`, `eligibleAmount`, `participantOverage`, `taxTreatment`, `holdReleased`, and `ledgerDebit`. A CDR that cannot be matched, has contradictory dates/meters, exceeds approved limits, or uses a non-eligible tariff should enter `verification_required` instead of being automatically paid.

## 7. Relay Rider internal API surface

The frontend should call only Relay Rider endpoints. It should never call an eMSP or CPO directly.

| Internal endpoint | Purpose |
|---|---|
| `GET /api/charging/locations?lat=&lng=&radiusKm=&connector=&partner=` | Search normalized eligible locations |
| `GET /api/charging/locations/{id}` | Show EVSE, connector, tariff, and redemption capability |
| `POST /api/redemptions/quote` | Quote entitlement coverage and participant overage |
| `POST /api/redemptions` | Create an idempotent redemption request and credit hold |
| `POST /api/redemptions/{id}/approve` | Admin approval and authorization preparation |
| `POST /api/redemptions/{id}/deny` | Admin denial with required reason and hold release |
| `POST /api/redemptions/{id}/authorize` | Issue token and send start command if supported |
| `GET /api/redemptions/{id}` | Participant and admin status view |
| `POST /api/charging-sessions/{id}/stop` | Request stop, if supported and authorized |
| `POST /api/integrations/{partner}/webhooks` | Receive provider callbacks where supported |
| `POST /api/integrations/{partner}/ocpi/sessions` | Receive or normalize session updates |
| `POST /api/integrations/{partner}/ocpi/cdrs` | Receive final CDRs |
| `POST /api/internal/cdrs/{id}/settle` | Perform ledger settlement after validation |
| `GET /api/admin/reconciliation?partner=&from=&to=` | Show unmatched sessions, CDR variance, stale holds, and failed callbacks |

## 8. Redemption and settlement state machine

```text
ISSUED
  -> REDEMPTION_REQUESTED
  -> APPROVED
  -> CREDIT_HELD
  -> TOKEN_PUBLISHED
  -> AUTHORIZATION_PENDING
  -> SESSION_ACTIVE
  -> SESSION_COMPLETED
  -> CDR_RECEIVED
  -> SETTLED

REDEMPTION_REQUESTED -> DENIED
CREDIT_HELD -> EXPIRED -> HOLD_RELEASED
AUTHORIZATION_PENDING -> PARTNER_ERROR -> REVIEW_REQUIRED
CDR_RECEIVED -> REVIEW_REQUIRED when unmatched, invalid, or over limit
SETTLED -> DISPUTED -> ADJUSTED or REVERSED
```

The wallet ledger should use append-only entries. The minimum entry types are `ISSUANCE`, `HOLD`, `HOLD_RELEASE`, `DEBIT`, `REFUND`, `ADJUSTMENT`, and `REVERSAL`. A redemption request should contain an `idempotencyKey`; every inbound provider event should contain `externalEventId`, `payloadHash`, and `receivedAt`.

## 9. Webhook, retry, and reconciliation contract

Provider callbacks should be accepted only after signature or mutual-TLS verification where offered. The endpoint should persist the raw body and headers, calculate a payload hash, reject replays outside the provider’s allowed window, and return a fast success response after durable enqueueing. Processing should happen asynchronously so a provider does not retry because settlement took too long.

The reconciliation job should run at least daily and compare Relay Rider’s active sessions and settled CDRs with the partner’s recent Sessions and CDR collections. It should flag missing CDRs, duplicate CDRs, sessions with no redemption, redemption holds older than the policy threshold, tariff changes, meter discontinuities, and amount variances. This is deterministic background processing and belongs in the application’s persistent backend job system rather than in the browser.

## 10. Partner acceptance checklist

Before enabling participant redemptions, the selected provider must confirm the supported OCPI version, the exact endpoint URLs and methods, whether Relay Rider is operating as an eMSP or through a hub, token publication semantics, remote-command support, session push behavior, CDR push or pull behavior, tariff precision, taxes and fees, refunds, dispute handling, webhook authentication, rate limits, sandbox credentials, and settlement-file availability.

The most important commercial question is whether the provider supports **direct credit sponsorship or partner settlement**. If it does not, Relay Rider should use the pay-and-reimburse mode rather than pretending that an OCPI station directory alone can make a session free.

## References

[1]: https://github.com/ocpi/ocpi "OCPI official repository and module overview"
[2]: https://evroaming.org/ "EVRoaming Foundation — OCPI and EV roaming"
[3]: https://www.hubject.com/intercharge-overview "Hubject — intercharge roaming, authorization, and settlement"
[4]: https://developer.tesla.com/docs/fleet-api/authentication/overview "Tesla Fleet API — authentication and charging-management scopes"

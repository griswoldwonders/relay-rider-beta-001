# OCPI and Green Wallet integration in Relay Rider beta

## What was integrated

The reusable OCPI implementation from `relay-rider-green-wallet` now lives under `src/lib/ocpi/` in this repository. The public TypeScript entrypoint is `src/lib/ocpi/index.ts`; it re-exports the framework-neutral JavaScript modules for validation, Credentials and Versions exchange, Session/CDR handling, and the development credential store.

The copied implementation is intentionally not mounted directly into the browser wallet flow. OCPI credentials, mTLS private keys, Session ingestion, and CDR settlement belong in a server-side connector boundary. The beta frontend continues to use `src/lib/greenWalletApi.ts`, `src/flows/EVChargeCreditRedemptionFlow.tsx`, `src/screens/WalletScreen.tsx`, and `src/screens/WalletAdminScreen.tsx` for the participant and administrator experience.

## Recommended runtime boundary

```text
Relay Rider beta frontend
  -> Django authenticated redemption API
  -> OCPI connector service / background worker
  -> eMSP or roaming provider
  -> normalized Session/CDR events
  -> Django wallet ledger and review queue
```

Do not import `ocpiClient.js` or `credentialStore.js` into browser components in production. The browser must never receive provider credentials, mTLS private keys, Vault tokens, or raw provider CDR payloads.

## Current file mapping

| Green Wallet source | Beta destination | Role |
|---|---|---|
| `src/ocpi/ocpiValidation.js` | `src/lib/ocpi/ocpiValidation.js` | OCPI envelopes and payload validation |
| `src/ocpi/credentialStore.js` | `src/lib/ocpi/credentialStore.js` | Development credential abstraction |
| `src/ocpi/ocpiClient.js` | `src/lib/ocpi/ocpiClient.js` | Versions, Credentials, and provider requests |
| `src/ocpi/ocpiServer.js` | `src/lib/ocpi/ocpiServer.js` | Framework-neutral inbound handlers |
| `src/ocpi/sessionCdr.js` | `src/lib/ocpi/sessionCdr.js` | Session/CDR ingestion and redemption linking |
| `docs/openapi.yaml` | `docs/openapi-ocpi.yaml` | OCPI and Redemption contract |

The original beta Green Wallet API remains authoritative for the current Django persistence scaffold. The OCPI module should call a server-side adapter that translates normalized CDR settlement decisions into the beta’s `RedemptionRequest` and future immutable wallet-ledger models.

## Example server-side import

```js
import {
  InMemoryOcpiCredentialStore,
  OcpiClient,
  SessionCdrRedemptionService,
  createExpressStyleSessionCdrRouter,
} from './src/lib/ocpi/index.ts';

// In production, replace the in-memory stores and inject a database-backed
// wallet adapter. Keep provider credentials and mTLS paths server-side.
```

The current `index.ts` facade exists to keep imports stable while the protocol implementation remains plain JavaScript. A future Django/Node connector service can import the same modules directly, or the logic can be ported behind an internal service boundary with equivalent tests.

## What still needs implementation

The beta backend must add authenticated and authorized OCPI connector endpoints, tenant/provider mapping, database-backed Session and CDR models, immutable ledger entries, idempotency constraints, and an atomic settlement transaction. It must also wire Vault/cert-manager-delivered mTLS certificate files into the connector runtime. The existing `ModelViewSet` wallet endpoints are explicitly documented as a research-beta persistence scaffold and should not be used as the production OCPI authorization boundary without these controls.

## Safe migration sequence

First, keep the copied module behind an internal feature flag and run it against provider sandbox data. Next, implement a Django adapter that accepts only normalized settlement results and records unmatched CDRs for review. Then add database uniqueness and transaction tests before enabling any automatic fulfillment. Finally, configure one closed, controlled pilot tenant and retain administrator review until legal, insurance, privacy, accessibility, regulatory, and operational review is complete.

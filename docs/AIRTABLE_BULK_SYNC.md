# Airtable bulk synchronization

Relay Rider can bulk-sync existing local Django records to Airtable with the `sync_airtable` management command. The command runs on the backend only and never exposes the Airtable token to the frontend.

## Configuration

Set the Airtable credentials and the table ID for each resource that should be synchronized:

```bash
export AIRTABLE_API_KEY=pat_your_server_side_token
export AIRTABLE_BASE_ID=app_your_base_id
export AIRTABLE_PARTICIPANTS_TABLE_ID=tbl_participants
export AIRTABLE_CREDITS_TABLE_ID=tbl_green_route_credits
export AIRTABLE_CHARGING_HUBS_TABLE_ID=tbl_charging_hubs
export AIRTABLE_REDEMPTION_REQUESTS_TABLE_ID=tbl_redemption_requests
```

The token should be scoped to the target base with permission to read and write records. Keep these values in the production secret manager or backend environment, not in React environment variables.

## Safe first run

Always inspect a limited dry run before writing to Airtable:

```bash
python backend/manage.py sync_airtable --dry-run --resource all --limit 10
```

A dry run prints the mapped records and performs no network requests. To sync one resource after reviewing the output:

```bash
python backend/manage.py sync_airtable --resource participants --limit 10
```

For a single participant and related credit/redemption records:

```bash
python backend/manage.py sync_airtable --profile-id 123 --resource all
```

Use `--retries` and `--retry-delay` to control transient network failures. The command continues past individual failures by default and exits non-zero if any record failed. Add `--fail-fast` when investigating a controlled test failure.

## Idempotency

Each record is upserted using a stable `External ID` field. The values are:

| Resource | External ID |
|---|---|
| Participant | `participant:<profile id>` |
| Green route credit | `credit:<credit id>` |
| Charging hub | `hub:<hub id>` |
| Redemption request | `redemption:<request id>` |

Create an `External ID` field in each Airtable table. Re-running the command updates the matching record instead of creating a duplicate.

## Resource mappings

The command maps `Profile` records to `Participants`, `GreenRouteCredit` records to `Green Route Credits`, `ChargingHub` records to `Charging Hubs`, and `RedemptionRequest` records to `Redemption Requests`. The field names in Airtable should match the names emitted by the command. Airtable single-select fields should contain the values used by the local models, or the table must permit typecasting.

The command converts decimal values to JSON numbers and timestamps to ISO 8601 strings. Empty optional values are sent as empty strings. No browser-side code is involved.

## Operational safeguards

The command skips a resource when its table ID is not configured. It requires `AIRTABLE_API_KEY` and `AIRTABLE_BASE_ID` for non-dry runs. It retries failed requests, reports created, updated, skipped, and failed counts, and returns a non-zero exit status if any record remains failed.

Run the command from a controlled deployment environment, keep logs free of Airtable credentials, and verify a sample of records in both the local database and Airtable after the first production sync. If a request times out after Airtable has accepted it, the stable external ID makes a subsequent run converge on the same record rather than intentionally duplicating it.

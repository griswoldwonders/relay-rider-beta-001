# Green Wallet browser verification

The integrated Relay Rider beta preview was verified at `?screen=wallet`.

## Verified states

The Wallet screen renders inside the Relay Rider host application with the existing brand header, available Green Route Credits, under-review credits, redeemed credits, an EV Charge Credit benefit card, recent activity, and a program disclosure.

Opening the EV Charge Credit card launches a four-step flow: eligible benefit details, Charging Hub selection, confirmation with acknowledgement, and submitted administrative review. The flow renders `Campus West Garage` as a verified demo hub and additional candidate locations with explicit availability limitations.

The confirmation step disables submission until the participant acknowledges that the request does not activate, reserve, or guarantee access to a charger. After submission, the flow generates a request reference such as `RR-EV-548897`, shows `Pending review`, and states that no credits have been deducted and no live charging network is connected.

## Remaining validation

The administrator route is wired as `?screen=wallet-admin` and should be tested with a request created in the same session. The current flow is session-memory only; durable Django persistence is scaffolded separately and is not yet wired to the frontend.

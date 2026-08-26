# EV Charge Credit end-to-end simulation

## Scope

This test used the integrated Relay Rider beta preview with session-memory demo data. It did not process money, reserve a charger, start a charging session, or call a live charging network.

## Steps completed

1. Opened the Wallet screen with an approved demo credit of 120 Green Route Credits.
2. Opened the EV Charge Credit benefit.
3. Advanced to Charging Hub selection.
4. Selected the verified demo hub `Campus West Garage`.
5. Reviewed the request summary: 120 Green Route Credits, Campus West Garage, administrator review required.
6. Acknowledged the no-reservation/no-payment disclosure.
7. Submitted the request.
8. Verified the generated request reference `RR-EV-561986` and `Pending review` state.
9. Opened the administrator preview with `?screen=wallet-admin&demo=success`.
10. Verified the seeded pending request in the admin queue.
11. Approved the request.
12. Verified the queue changed to zero open requests and the request displayed `Status: fulfilled` with the note `Approved by program administrator.`

## Result

The participant submission and administrator approval state transition completed successfully in the prototype. The flow preserves the explicit operational boundary that fulfillment is a program decision only and is not live charging-network settlement.

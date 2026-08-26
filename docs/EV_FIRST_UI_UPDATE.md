# EV-first UI update

This update re-centers the Relay Rider beta Overview screen around EV commuter participation and institution-sponsored incentives rather than ride-share language.

## Changes in this pass

- Renamed the Overview heading from `Campus commute` to `EV commuter program`.
- Made Green Wallet the primary first-visit action.
- Reframed the hero around earning benefits from existing commute behavior.
- Changed the first feature card to `Incentives`.
- Changed the second feature card to `EV options`.
- Changed the third feature card to `Connections`, with planned-route language rather than on-demand ride language.
- Reframed the returning-user hero around the EV program and made incentives the primary action.
- Reordered returning-user metrics so credits appear before EV options and connections.
- Updated the best-next-step panel to direct participants to review and request benefits.
- Updated the Explore section to use `Charging & Access`, `EV options`, `Participation`, and `Green Wallet` labels.
- Preserved all existing research-beta guardrails and navigation callbacks.

## Product boundary

This is a hierarchy and language update. It does not activate live transportation, ride booking, charger reservation, payment processing, or partner-network settlement. Planned-route connections remain research previews, and Green Route Credits remain non-monetary program benefits.

## Rewind point

The pre-change state is preserved at:

- Local branch: `backup/pre-ev-first-ui`
- Local tag: `pre-ev-first-ui`
- Commit: `f0adfd6` (`Add Green Wallet deployment guide`)

To restore locally before the UI update:

```bash
git switch main
git reset --hard pre-ev-first-ui
```

To restore the remote branch after the update, use a reviewed force push only with explicit approval:

```bash
git push --force-with-lease origin pre-ev-first-ui:main
```

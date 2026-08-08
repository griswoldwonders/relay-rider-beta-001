# Relay Rider — College Commuter Coordination Prototype

Relay Rider is a mobile-first research-beta prototype for comparing **planned shared-route options, local transit, Access Points, EV/hybrid participation, and commuter incentives** for institution-sponsored mobility programs.

Relay Rider is **not** a taxi, ride-hailing, live dispatch, instant-pickup, or guaranteed transportation service.

## Current prototype direction

The participant experience is intentionally simple:

- **I need a commute option** — submit a commute need, campus affiliation, schedule, transit preferences, Access Point preferences, and incentive interests.
- **I already drive an EV/hybrid route** — register a route the participant already plans to travel, including schedule and detour comfort.

The earlier organization and browsing roles have been removed from the participant onboarding flow.

## College commuter model

Relay Rider planned-route participation is shown as **$0 for eligible college participants** in this prototype. There is no rider bid, proposed fare, or payment marketplace in the participant experience.

Third-party transit fares are separate from Relay Rider. Student fareless access depends on the school and transit agency. The prototype surfaces eligibility-oriented language for programs such as GoPass but directs users to verify eligibility with the school or agency.

## Commute options

The **Commute Options** screen compares two categories:

### Relay Rider planned-route previews

- Existing planned routes only
- EV/hybrid-first participation
- Compatibility score and match explanation
- Modeled detour impact
- Public Access Point fit
- Administrative review status
- $0 college-program cost for eligible participants
- No live route activation in the research beta

### Local transit

The prototype includes examples and official verification links for:

- LA Metro Bus Line 180
- LA Metro A Line
- Pasadena Transit
- Glendale Beeline

Transit entries are external transportation options, not Relay Rider-operated services. Schedules, fares, service changes, and student eligibility must be verified with the transit operator.

## Incentives

Relay Rider includes **Green Route Credits** as capped promotional participation benefits. They may be used in the prototype to recognize activities such as:

- Completing a qualified commute profile
- Sustainable commute challenges
- Transit participation
- Access Point feedback
- EV/clean-route participation or recognition

Green Route Credits are **not cash, wages, fares, guaranteed payments, certified carbon offsets, LCFS credits, or direct charging reimbursements**.

## Core screens

- Role Selection
- Home
- Commute Options
- Corridor Map
- Commute Activity
- Profile / Incentives
- Commute Need Intake
- Planned EV/Hybrid Route Registration
- Privacy Center
- Security Center
- Review Gates

## Corridor map

The prototype uses Leaflet and OpenStreetMap to display real public locations and EV charging infrastructure across the Pasadena–Eagle Rock–Glendale corridor. Candidate Access Points are research signals only and require site-rule, visibility, lighting, accessibility, partner, legal, insurance, and field review before controlled program use.

## Technology

- React 19
- TypeScript
- Vite
- Tailwind CSS
- Material Web
- Leaflet / OpenStreetMap
- Framer Motion
- React Hook Form + Zod

## Local development

```bash
npm install
npm run check
npm run build
npm run dev
```

## Research-beta guardrails

The prototype must not imply:

- Guaranteed transportation
- Live dispatch
- Instant pickup
- Automatic payment
- Driver earnings
- Public ride-hailing
- Unreviewed school transportation
- Guaranteed safety
- Guaranteed emissions reductions

Future operational activation requires legal, insurance, privacy, accessibility, safety, program-rule, and operational review.

## Data handling

Sensitive prototype state is held in session memory. Earlier persisted sensitive records are cleared at startup. The Supabase directory is a backend blueprint and must not be treated as deployed until reviewed, applied, and tested in the intended project.

See `SECURITY.md` and `docs/SECURITY_ARCHITECTURE.md` for the current security foundation.

## License

Repository licensing and public-source status should be reviewed before production use. Common Pathways Technologies retains responsibility for product, legal, regulatory, and operational decisions.

# Relay Rider Design System Roadmap

## Purpose

This document locks the current commuter-product design direction and implementation order so future screens extend one coherent system instead of introducing isolated visual patterns.

## North-star rule

**No new screen gets its own spacing, card geometry, colors, or motion rules. It must use the Relay Rider design system.**

Visual variety should come from hierarchy, card size, content, and semantic color — not inconsistent spacing.

---

## 1. Design-system foundation

Create and maintain shared tokens for spacing, section rhythm, card geometry, typography, semantic colors, shadows, icon sizing, touch targets, motion, safe areas, and reduced-motion behavior.

### Spacing tokens

Use an 8-point-based system:

- `8px` — icon/text gaps and tight inline spacing
- `12px` — chips, labels, and compact control gaps
- `16px` — default card-to-card gap and compact tile padding
- `20px` — default screen edge padding and standard card padding
- `24px` — related-card grouping and larger internal separation
- `32px` — major section-to-section gap
- `48px` — hero-to-content or major page transition only

Recommended CSS variables:

```css
--space-xs: 8px;
--space-sm: 12px;
--space-md: 16px;
--space-card: 20px;
--space-lg: 24px;
--space-xl: 32px;
--space-2xl: 48px;

--screen-padding: 20px;
--card-padding: 20px;
--card-gap: 16px;
--section-gap: 32px;
```

### Section rhythm

Every mobile content section should follow this pattern:

```text
Section label
12px
Section title
16px
Section content/cards
24px
Related content

32px

Next section
```

### Card geometry

- Primary card: `28px` radius
- Standard card: `22px` radius
- Compact metric tile / chip surface: `18px` radius
- Default card padding: `20px`
- Compact metric tile padding: `16px`
- Default card gap: `16px`

### Typography

- Body text: minimum `16px`
- Secondary captions: minimum `14px`
- Avoid using tiny legal/disclaimer text as a substitute for progressive disclosure
- Strong headings should preserve hierarchy without oversized SaaS-dashboard typography

### Semantic colors

Core brand:

- Parchment: `#fffef0`
- Deep Lagoon: `#004449`
- Electric Iris: `#483cff`
- Mint Wash: `#d7ffc2`

Recommended semantic mapping:

- Relay Rider primary / dominant CTA: Electric Iris
- Planned EV route: Mint
- Metro rail: Lavender
- Bus: Soft yellow
- Walking / bike: Pale mint
- Access Point: Peach
- Incentives / Green Route Credits: Mint / lime accent
- Warning / review required: Warm yellow
- Administrative state: Neutral parchment / warm neutral
- Privacy / security: Deep Lagoon

Do not use color as the only indicator of state.

### Motion rules

Use 3D motion only where it has a clear conceptual purpose.

- Onboarding: `rotateY + translateX + scale` with spring transition
- Matches: horizontal drag + subtle `rotateY`
- Normal screen transitions: opacity and small vertical translation only
- Buttons: subtle press scale such as `0.98`
- Do not introduce 3D rotation on wallet cards, map panels, settings, standard transit cards, or dashboards
- Respect reduced-motion preferences

### Accessibility baseline

- Minimum 44×44px interactive targets
- Visible keyboard focus states
- No required swipe-only interactions
- Buttons / dots must duplicate swipe navigation
- Screen-reader labels for icon-only controls
- Body-text contrast should meet WCAG AA expectations
- Avoid pale text on pastel surfaces
- Maintain logical reading order
- Respect platform safe areas

---

## 2. Simplify Home

Home should stop acting as a catch-all dashboard.

Primary structure:

### Your commute

Show the current corridor and schedule, for example:

`Eagle Rock → Pasadena City College`

`Arrive around 8:00 AM`

Primary CTA: **Plan commute**

### Today

Compact summary row:

- Options
- Matches
- Green Route Credits

### Continue

Show one or two context-aware next actions only.

Move detailed activity, incentive history, EV-route registration, map exploration, and administrative explanation deeper into their respective screens.

---

## 3. Polish 3D onboarding

Treat the rotating onboarding deck as the definitive first-time commuter setup.

Flow:

1. Campus / institution
2. Approximate starting area
3. Schedule
4. Mobility preferences
5. Benefits + consent
6. Personalized Commute Options as the immediate payoff

Required interaction rules:

- Campus-first value framing
- Approximate area before any precise location
- Back and Continue buttons always available
- Swipe is optional, never required
- Consistent spacing and card geometry from the shared token system
- Consent appears where the profile is submitted, not buried at app launch
- Answers map into the existing commute profile / route-signal model

---

## 4. Visually separate Plan vs Matches

### Plan

Plan answers: **What are my best ways to make this commute?**

Visual language should be structured and analytical:

- provider / mode
- duration
- walking
- transfers
- schedule fit
- recommendation score
- benefit / fare context
- explanation factors

Use list and comparison cards. Do not use swipe as the primary Plan interaction.

### Matches

Matches answers: **Which compatible planned routes exist around my commute?**

Visual language should be tactile and exploratory:

- swipe deck
- compatibility score
- planned route
- EV / PHEV / hybrid type
- route overlap
- estimated detour
- Access Point
- schedule window
- Save
- Why this match?
- Review match

Swiping is browse-only and must not imply acceptance, dispatch, payment, contact, or guaranteed transportation.

---

## 5. Design Green Route Wallet in Figma first

Do not implement the wallet in the Netlify app until the mobile screens are visually approved.

Required Figma screens:

1. Wallet onboarding — Get rewarded for participating
2. Wallet onboarding — No mystery points
3. Wallet onboarding — Program benefits vary
4. Wallet home
5. Challenges
6. Impact
7. Benefit detail / eligibility

Wallet design principles:

- Must look like Relay Rider, not a separate fintech app
- Show **Green Route Credits**, never a dollar-equivalent account balance unless a formal program establishes one
- Separate approved and pending credits
- Clearly show why credits were issued
- Clearly show sponsor / program context when applicable
- Green Route Credits remain promotional or program benefits, not cash, wages, fares, guaranteed payments, or certified carbon credits
- Charging-linked benefits remain future/program-configurable unless formally established

Suggested information architecture:

### Wallet

Credits, status, activity, benefits

### Challenges

Institution-sponsored or employer-sponsored mobility activities

### Impact

Estimated mobility outcomes and participation metrics

---

## 6. Implement Wallet only after visual approval

After Figma approval:

- translate the approved layouts directly into the Netlify prototype
- reuse shared spacing, radii, typography, semantic colors, and motion tokens
- do not introduce a new wallet-specific design system
- keep reward-engine behavior clearly separated from future charging/payment integrations

---

## 7. Extend the same system to administrator / TDM views

Only after the commuter experience is stable, extend the shared visual system to:

- employer / campus dashboard
- corridor intelligence
- parking pressure
- participation
- EV / hybrid analysis
- incentive management
- Access Point review
- administrative review workflows
- reporting
- comparisons across sites, corridors, and time periods

Admin screens may be denser than commuter screens, but they should still inherit the same typography, semantic colors, spacing rhythm, status language, and accessibility rules.

---

## Product hierarchy

```text
Onboarding
  ↓
Home
  ↓
Plan      → multimodal commute options
Matches   → planned-route compatibility previews
Map       → Access Points / transit / EV infrastructure
Wallet    → Green Route Credits / challenges / benefits / impact
Profile   → privacy / preferences / account
```

## Implementation order

1. Formalize design tokens
2. Simplify Home
3. Polish 3D onboarding
4. Differentiate Plan vs Matches
5. Design Green Route Wallet in Figma
6. Implement Wallet after approval
7. Extend system to administrator / TDM views

This order is intentional. Do not skip ahead by building Wallet or administrator screens with ad hoc visual rules before the shared system is stable.

# Relay Rider - EV/Hybrid Commuter Route Coordination Platform
## Research Beta Prototype

A mobile-first React application for collecting commuter route-interest signals and EV/hybrid route patterns to validate corridor demand for future sustainable transportation pilots.

---

## Project Overview

**Relay Rider** is a **closed-pilot research-beta platform** (not a rideshare or ride-hailing service) that:

- Collects **route-interest signals** from commuters seeking sustainable corridor options
- Gathers **EV/hybrid route patterns** from existing vehicle operators
- Identifies **Relay Zone candidates** (public, visible Access Points)
- Calculates **corridor fit scores** based on overlap, time compatibility, and detour tolerance
- Provides **Green Route Credits** (promotional beta rewards, not fares or driver earnings)
- Maintains strict **research-beta framing** throughout the experience

---

## Key Features

### 1. **Multi-Role User Experience**
- **Route Need Users**: Submit commute requirements and preferences
- **EV/Hybrid Participants**: Share existing route patterns and vehicle info
- **Organization Partners**: Access corridor insights and research packages
- **Explorers**: Browse without submitting personal information

### 2. **Route Signal Flows**
- **Route Need Flow** (6 steps): Corridor, timing, Relay Zone preference, route-bid signal, EV preference, privacy settings
- **EV Participant Flow** (5 steps): Vehicle info, route pattern, detour tolerance, Relay Zone types, review willingness

### 3. **Relay Zone Management**
- Browse candidate Access Points by corridor and type
- View review status (candidate, needs partner, needs safety, needs property, needs legal)
- Track suggestion counts and required reviews
- Filter by corridor and zone type

### 4. **Green Wallet System**
- Track promotional beta credits (not fares, wages, or carbon offsets)
- View pending, approved, redeemed, and expired credits
- Display credit rules and restrictions
- Manual approval workflow

### 5. **Research-Beta Framing**
- Consistent disclaimers on all forms
- Clear messaging that this is NOT live transportation
- No payment processing, live dispatch, or driver activation
- Emphasis on data collection for pilot planning

### 6. **Partner Console**
- Corridor demand snapshots
- Route signal analysis
- Relay Zone suggestions overview
- Parking pressure indicators
- EV/hybrid participation metrics
- Research package offerings

---

## Project Structure

```
relay_rider_user_app/
├── src/
│   ├── App.tsx                          # Main app router and state management
│   ├── main.tsx                         # React entry point
│   ├── index.css                        # Global styles and design tokens
│   ├── types.ts                         # TypeScript interfaces
│   │
│   ├── components/                      # Reusable UI components
│   │   ├── BottomNav.tsx               # Mobile bottom navigation
│   │   ├── Header.tsx                  # Page header with back button
│   │   ├── ResearchBetaBanner.tsx      # Research beta disclaimer
│   │   ├── StatusBadge.tsx             # Status indicator badge
│   │   └── RouteCard.tsx               # Route signal card
│   │
│   ├── screens/                         # Full-page screens
│   │   ├── RoleSelectionScreen.tsx     # Initial role selection
│   │   ├── HomeScreen.tsx              # Main dashboard
│   │   ├── RoutesScreen.tsx            # View submitted signals
│   │   ├── MapScreen.tsx               # Relay Zone browser
│   │   ├── WalletScreen.tsx            # Green Route Credits
│   │   ├── ProfileScreen.tsx           # User account & preferences
│   │   ├── PrivacyCenterScreen.tsx     # Privacy controls
│   │   ├── ReviewGatesScreen.tsx       # Pilot readiness checklist
│   │   └── PartnerConsoleScreen.tsx    # Organization dashboard
│   │
│   ├── flows/                           # Multi-step form flows
│   │   ├── RouteNeedFlowScreen.tsx     # 6-step route interest form
│   │   └── EVParticipantFlowScreen.tsx # 5-step EV route form
│   │
│   ├── context/                         # React context & state
│   │   └── AppContext.tsx              # Global app state management
│   │
│   └── data/                            # Demo data
│       └── demoData.ts                 # Sample corridors, zones, signals
│
├── index.html                           # HTML entry point
├── package.json                         # Dependencies
├── tsconfig.json                        # TypeScript config
├── vite.config.ts                       # Vite build config
├── tailwind.config.js                   # Tailwind CSS config
├── postcss.config.js                    # PostCSS config
└── .npmrc                               # NPM config
```

---

## Design System

### Color Palette
- **Navy** (`#0f2a3d`): Primary brand color, institutional trust
- **Mobility Green** (`#1f8a5b`): Sustainable action, primary CTA
- **Light Green** (`#e7f5ee`): Background for positive states
- **Light Blue** (`#eaf3f8`): Background for informational states
- **Soft Gray** (`#f5f7f8`): Neutral backgrounds
- **Warning Yellow** (`#fff7d6`): Important disclaimers

### Typography
- **Headlines**: Poppins (600, 700, 800 weight) - bold, distinctive
- **Body**: Inter (400, 500, 600, 700) - readable, professional

### Components
- **Buttons**: Primary (green), Secondary (gray), Outline (navy)
- **Cards**: Soft shadows, rounded corners, consistent spacing
- **Status Badges**: Color-coded (active, pending, research, inactive)
- **Forms**: Full-width inputs, clear labels, validation feedback

---

## Installation & Setup

### Prerequisites
- Node.js 22.x
- pnpm 10.x

### Steps

```bash
# 1. Extract the archive
tar -xzf relay_rider_prototype.tar.gz
cd relay_rider_user_app

# 2. Install dependencies
pnpm install

# 3. Start development server
pnpm dev

# 4. Open in browser
# Navigate to http://localhost:5173
```

### Build for Production

```bash
pnpm build
pnpm preview
```

---

## Key Screens & Flows

### 1. Role Selection Screen
Users choose their participation type:
- Route Need (submit commute requirements)
- EV/Hybrid Participant (share existing route)
- Organization (view corridor insights)
- Exploring (browse without data submission)

### 2. Home Screen
Main dashboard with:
- Research beta notice
- Three main CTAs (Share Route Need, Share EV/Hybrid Route, Suggest Relay Zone)
- Example route signals
- Quick access to Green Wallet and Partner Console

### 3. Route Need Flow (6 Steps)
1. **Corridor & Area**: Select corridor and starting/destination areas
2. **Timing**: Choose days of week, time window, travel pattern
3. **Relay Zones**: Select preferred zone types
4. **Route-Bid Signal**: Indicate willingness-to-participate price range
5. **Preferences**: EV preference, walking distance, privacy settings
6. **Review & Submit**: Confirm details and consent

### 4. EV Participant Flow (5 Steps)
1. **Vehicle Info**: Type, make, model, year
2. **Route Pattern**: Starting area, destination, days, time window
3. **Detour Comfort**: Max detour tolerance, preferred zone types
4. **Review Willingness**: Which background/insurance reviews are acceptable
5. **Submit**: Confirm and submit signal

### 5. Map Screen (Relay Zones)
- Browse candidate Access Points
- Filter by corridor and zone type
- View review status and requirements
- See suggestion counts and notes

### 6. Wallet Screen (Green Route Credits)
- View pending/approved/redeemed/expired credits
- See activity history with dates
- Display credit rules and restrictions
- No cash-out, no route activation

### 7. Partner Console
- Corridor demand overview
- Route signal analysis
- Relay Zone suggestions
- Parking pressure data
- EV/hybrid participation metrics
- Research package pricing

---

## State Management

### AppContext
Provides global state for:
- `userRole`: Current user type
- `userProfile`: User account info
- `routeSignals`: Submitted route-interest signals
- `evParticipantSignals`: Submitted EV/hybrid routes
- `greenRouteCredits`: Credit activity history

Sensitive prototype state is held in memory for the current page session. Earlier
`localStorage` records are removed at startup. A protected backend is not connected,
so only mock or non-sensitive demonstration information should be entered.

Security foundations are documented in `SECURITY.md` and
`docs/SECURITY_ARCHITECTURE.md`. The Supabase migration is a backend blueprint and
must not be treated as deployed until it is reviewed, applied, and tested in the
intended project.

### Demo Data
Sample corridors, Relay Zones, and route signals are included in `src/data/demoData.ts` for testing.

---

## Important Terminology

### ✓ Use These Terms
- Route participant
- Co-commuter
- Planned route
- Route-join request
- Safe Relay Point / Relay Zone
- Corridor match
- Research beta
- Partner dashboard
- Green Route Credit (promotional beta reward)

### ✗ Avoid These Terms
- Book a ride
- Fare
- Driver earnings
- Go online
- Ride request
- Live dispatch
- Taxi
- Uber / Lyft
- Passenger fare
- On-demand pickup
- Rideshare

---

## Research-Beta Framing

All screens include clear messaging that:
- This is **NOT a live transportation service**
- No payments, fares, or driver compensation
- No live route activation or dispatch
- Data collection for **pilot-readiness planning only**
- Future controlled pilots require legal, insurance, safety, privacy, accessibility, and operational review

---

## Development Notes

### Adding New Screens
1. Create component in `src/screens/`
2. Add route handler in `App.tsx`
3. Update navigation as needed
4. Follow existing styling patterns

### Modifying Demo Data
Edit `src/data/demoData.ts` to:
- Add/remove corridors
- Update Relay Zone suggestions
- Modify sample route signals

### Styling
- Use Tailwind utilities from `index.css`
- Reference design tokens (colors, spacing, typography)
- Keep mobile-first approach
- Test on 375px viewport width

---

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

---

## Future Enhancements

- Backend API integration for data persistence
- Real map integration (Google Maps API)
- User authentication (Manus OAuth)
- Notification system
- Admin review panel for signal moderation
- Export/reporting for partners
- Accessibility improvements (WCAG 2.1 AA)

---

## License

Proprietary - Common Pathways Technologies

---

## Support

For questions or issues, contact the development team at Common Pathways Technologies.

# Relay Rider Product Inspiration Roadmap

This document adapts four useful open-source references into Relay Rider planning guidance:

- Fleetbase
- openrouteservice
- Open Mobility Foundation
- awesome-transit

It is a roadmap aid, not implementation debt.

## Relay Rider

### Borrow

- dispatch-first operations model
- driver / vehicle / assignment separation
- live vehicle and task status views
- route planning primitives
- travel-time matrices and accessibility planning
- standards-first integration boundaries
- transit ecosystem discovery

### Avoid

- delivery or warehouse semantics that do not fit commuter mobility
- making the routing engine the whole product
- hiding core commuter flows behind standards language
- assuming every transit tool is current or production-ready

## Venue Relay

### Borrow

- surge/event-day dispatch concepts
- operational control center views
- route planning for shuttles and peak flows
- accessibility and service-area planning
- partner and agency coordination patterns
- multi-operator boundaries

### Avoid

- logistics assumptions that do not fit events
- overfocusing on route math without live operations
- turning the UX into a policy document
- copying transit tooling without adapting it to venue workflows

## Shared architectural guidance

- keep routing replaceable
- keep standards and integrations at the edge
- keep live operations distinct from analytics
- use ecosystem repos as reference material, not templates
- keep the research-beta guardrails intact until legal and operational review

## Suggested implementation order

1. core ops console
2. live map
3. routing service interface
4. assignment and task model
5. coverage and matrix tools
6. partner/admin access model

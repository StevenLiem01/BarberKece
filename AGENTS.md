# AGENTS.md — BarberKece

## 1. Purpose

This file defines mandatory implementation and working rules for coding agents working on **BarberKece**.

BarberKece already has comprehensive product, UX/UI, and technical specifications. `AGENTS.md` is an **execution guardrail**, not a replacement for those specifications.

Its purpose is to preserve locked decisions, prevent unsafe shortcuts, enforce architecture boundaries, preserve business invariants, define ambiguity/conflict handling, and keep implementation consistent across coding agents.

Do not redesign product behavior, UX, architecture, database semantics, security boundaries, or the locked stack unless explicitly instructed.

---

## 2. Canonical Project Documents

Authority is divided by concern:

```text
PRODUCT REQUIREMENTS
→ BarberKece PRD

UX / UI / INTERACTION DESIGN
→ BarberKece UX/UI Specification

TECHNICAL ARCHITECTURE & IMPLEMENTATION DESIGN
→ BarberKece Technical Design STEP 1–23

CODING AGENT EXECUTION RULES
→ AGENTS.md

CURRENT IMPLEMENTATION STATE
→ Repository code
```

These documents complement each other. Absence of a detailed rule from `AGENTS.md` does not remove that rule from its canonical specification.

---

## 3. Authority by Concern

- **Product behavior / Release 1 scope / roles / journeys / business capabilities:** PRD.
- **Interaction / visual hierarchy / responsive behavior / loading, error and empty states:** UX/UI Specification.
- **Architecture / database / transactions / Reservation / Recommendation / Virtual Try-On / Marketplace / API / security / tests / stack / repository / implementation order:** Technical Design STEP 1–23.
- **How coding agents must work, forbidden shortcuts, implementation discipline, ambiguity handling:** AGENTS.md.

---

## 4. Conflict Resolution

General precedence:

```text
1. Explicit latest user instruction
2. Canonical specification for the affected concern
   ├── PRD
   ├── UX/UI Specification
   └── Technical Design STEP 1–23
3. AGENTS.md execution rules
4. Existing repository implementation
5. Engineering judgment
```

A newer explicit user decision overrides an older decision. Do not interpret casual wording as permission to redesign unrelated areas.

If canonical specifications appear to conflict, identify the exact conflict and determine whether a later locked decision resolves it. If security, privacy, authorization, money, inventory, booking, payment, database integrity, transaction semantics, or public API behavior is affected, do not silently invent behavior. Preserve the safest existing invariant and surface the conflict.

---

## 5. Specification Completeness and Locked Decisions

`AGENTS.md` summarizes many rules but does not reproduce every detail of STEP 1–23.

If Technical Design contains a detailed rule, that detail remains authoritative even when this file only contains a short invariant.

Decisions explicitly marked **LOCKED** are implementation requirements. Do not change them because another approach is cleaner, easier for a library, more fashionable, or preferred by the agent.

A locked decision changes only when the user explicitly changes it or implementation evidence proves it infeasible and the change is explicitly reviewed.

---

## 6. Technical Design Coverage

```text
STEP 1–12  Core architecture and system design
STEP 13    Database Schema
STEP 14    Reservation Engine Specification
STEP 15    Recommendation Engine Specification
STEP 16    Virtual Hair Filter Technical Design
STEP 17    Marketplace Technical Specification
STEP 18    API Specification
STEP 19    Security & Privacy Specification
STEP 20    Test Plan
STEP 21    Final Tech Stack
STEP 22    Repository & Code Architecture
STEP 23    Implementation Plan
```

Consult the relevant section for implementation details.

---

## 7. Context Loading Rule

Read the minimum authoritative context required for the task, but read every directly affected specification for cross-domain work.

Examples:

```text
Button change
→ AGENTS.md + relevant UX/UI section

ConfirmBooking
→ AGENTS.md + STEP 13 + STEP 14 + STEP 18 + relevant STEP 19/20

PlaceOrder
→ AGENTS.md + STEP 13 + STEP 17 + STEP 18 + relevant STEP 19/20

Virtual Try-On tracking
→ AGENTS.md + STEP 16 + relevant UX/UI + STEP 19/20
```

Do not reconstruct an existing canonical specification from memory, summaries, code, or generic best practices.

---

## 8. Existing Code and Engineering Judgment

Existing code is implementation state, not authority. When code conflicts with a locked requirement, confirm the canonical requirement, fix the implementation, update tests, and update migrations where necessary.

Engineering judgment is welcome for intentionally open implementation details. It must not silently redefine business rules, authorization, database invariants, API semantics, payment semantics, booking behavior, recommendation scoring, privacy boundaries, or Release 1 scope.

Meaningful intentional deviations must update canonical documentation or be recorded as an architecture decision.

---

## 9. Product Identity and Release 1

Project name: **BarberKece**.

Primary loop:

```text
Discover → Visualize → Decide → Book → Experience → Learn → Maintain
```

Core differentiators:

- Haircut Knowledge & Recommendation System
- Real-Time Virtual Hairstyle Filter
- Smart Reservation
- Hair History / Personalization
- Personalized Marketplace

Release 1:

- responsive web application;
- mobile-first customer experience;
- single physical barbershop location;
- single-store Marketplace;
- Bahasa Indonesia primary UI;
- CUSTOMER, BARBER, ADMIN roles.

Do not introduce multi-location or multi-vendor architecture unless explicitly requested.

---

## 10. Architecture

Use **Modular Monolith + Client-Side Computer Vision**.

Do not introduce microservices or distributed infrastructure without demonstrated need.

Mandatory dependency direction:

```text
Framework / Infrastructure
        ↓
Application
        ↓
Domain
```

Forbidden:

```text
Domain → Next.js
Domain → React
Domain → Drizzle
Domain → R2
Domain → Resend
```

Domain code contains business rules, state transitions, pure calculations, policies, and domain errors. It must not perform HTTP, React rendering, SQL, environment access, email, object storage, or analytics.

Application use cases orchestrate explicit operations such as `ConfirmBooking`, `RescheduleAppointment`, `CancelAppointment`, `PlaceOrder`, `VerifyManualPayment`, `AdjustInventory`, and `GenerateRecommendation`.

Use ports/adapters where replacement risk is meaningful. Avoid abstraction for abstraction's sake.

---

## 11. Final Tech Stack

Use the locked STEP 21 stack and version policy. Core choices include TypeScript, Node.js LTS, Next.js App Router, React, Tailwind CSS, Radix/shadcn-style primitives, Lucide, React Hook Form, Zod, TanStack Query, PostgreSQL, Drizzle ORM/Kit, Argon2id, S3-compatible storage, MinIO locally, Cloudflare R2 production direction, Sharp, Resend/Mailpit, PostgreSQL-backed worker/outbox, MediaPipe Face Landmarker behind an adapter, Canvas 2D primary R1 rendering, Vitest, Testing Library, Playwright, axe-core, Pino, pnpm, Docker Compose, and GitHub Actions.

Do not casually replace stack components.

Do not introduce without explicit approval: microservices, Kubernetes, Redis, BullMQ, Kafka, RabbitMQ, Elasticsearch/Meilisearch, GraphQL, tRPC as canonical API, Firebase, MongoDB, vector DB, LLM/ML recommendation, cloud vision inference, Python backend, GPU server, WebSocket infrastructure, full 3D hair engine, or blockchain.

---

## 12. Database and Persistence

PostgreSQL is the source of truth.

Use UUID primary keys (UUIDv7 preferred per STEP 21), TIMESTAMPTZ for instants, DATE/TIME for local business schedules, and integer Rupiah for money. Never use floating point for currency.

Database naming is plural `snake_case`; TypeScript/API DTOs use `camelCase`.

Persistence models are not automatically domain/API models.

Defend simple and concurrency-critical invariants in PostgreSQL where possible. Parameterized raw SQL is allowed and encouraged for `FOR UPDATE`, `FOR UPDATE SKIP LOCKED`, `tstzrange`, GiST exclusion constraints, partial indexes, and other PostgreSQL-specific correctness.

Do not sacrifice correctness for ORM purity.

Every schema change includes a versioned migration, relevant tests, and fixture/seed updates where necessary. Do not use production `db push` as a migration substitute.

Critical use cases own transaction boundaries. Avoid generic repositories for critical domains.

---

## 13. Authentication and Authorization

Use server-managed sessions. Do not store long-lived auth credentials in localStorage, sessionStorage, or IndexedDB.

Session cookies are HttpOnly, Secure in production, and SameSite=Lax. Raw session tokens are never stored; store hashes only.

Passwords use Argon2id. Reset/invitation tokens are cryptographically random, hashed at rest, single-use, and expiring.

Public registration creates only CUSTOMER.

Authorization evaluates role + ownership + assignment/context + state + business policy. UI visibility is never a security boundary.

Every private resource lookup must protect against IDOR, especially appointments, orders, Hair History, saved previews, payment proofs, and private media. UUID secrecy is not authorization.

---

## 14. API, Validation, and Idempotency

Use HTTP JSON APIs with camelCase DTOs and stable machine-readable error codes.

Critical mutations use explicit action endpoints/use cases rather than generic status PATCH operations.

Route handlers should parse request, resolve actor, validate transport DTO, call application use case, map result/error, and return HTTP. Do not place business logic or large SQL queries directly in routes.

Use Zod for transport validation; domain/application layers enforce business rules.

Never mass-assign request bodies to persistence. Client input must not control server-owned fields such as role, status, customerId, price, stock, verifiedBy, or paymentStatus.

Use `Idempotency-Key` for critical commands including Confirm Booking, Place Order, Payment Approval, Refund, and Inventory Adjustment. Same actor + operation + key + request returns the same logical result; reuse with different payload fails.

---

## 15. Reservation Invariants

Mandatory principle:

> Availability is a calculation. Confirmation is a transaction.

Availability:

```text
Business Hours
∩ Barber Working Schedule
∩ Service Eligibility
− Existing Appointments
− Recurring Breaks
− Time Off
− Blocked Time
```

Special dates override recurring hours. Booking drafts do not reserve slots.

Use half-open `[start, end)` intervals and canonical overlap:

```text
existing.start < candidate.end
AND existing.end > candidate.start
```

Server derives `endsAt` from service duration. Client never controls authoritative price, status, customerId, end time, or final ANY barber assignment.

ANY_AVAILABLE final assignment occurs during confirmation using the locked STEP 14 fairness algorithm:

1. lowest booked service minutes that business-local day;
2. longest since last auto-assignment;
3. stable deterministic ID order.

No randomness.

Confirmation uses application validation + PostgreSQL transaction + row locking + final revalidation + GiST exclusion constraints. Specific-barber conflict never silently switches barber. Customer overlap is DB-protected.

Reschedule is atomic. Never release/cancel the old appointment first. Failure preserves the old booking.

Use exact STEP 14 lifecycle and cutoff policies.

---

## 16. Recommendation Invariants

Recommendation is deterministic, knowledge-based, weighted, explainable, non-ML, and non-LLM.

Locked weights:

```text
Face Shape       25%
Hair Type        20%
Hair Density     15%
Current Length   15%
Maintenance      10%
Style Preference 15%
```

Compatibility:

```text
POOR       = 0.00
ACCEPTABLE = 0.50
GOOD       = 0.75
EXCELLENT  = 1.00
```

Missing/NOT_SURE values are ignored through dynamic normalization.

Use exact STEP 15 rules for length feasibility, asymmetric maintenance compatibility, style tags, deterministic tie-break, near-score diversification, reason/caution generation, input completeness, knowledge versioning, and publication validation.

Same normalized input + engine version + knowledge version must produce the same candidate set, scores, order, and reason codes.

Generating recommendations never silently overwrites Hair Profile. Hair History does not silently train or alter R1 scoring. Do not use LLM-generated recommendation explanations.

---

## 17. Virtual Try-On Invariants

Continuous camera processing happens locally in the browser. Never upload or persist by default camera streams, continuous frames, landmarks, face geometry, embeddings, or identity templates. No face recognition.

Use STEP 16 architecture:

```text
TryOnController
CameraController
FaceTracker
PoseEstimator
TransformSolver
Smoother
AssetManager
Renderer
PerformanceManager
CaptureManager
CapabilityDetector
```

Provider-specific MediaPipe objects remain behind `FaceTracker`.

High-frequency state stays outside React/TanStack/global UI state. Heavy CV/model code is dynamically loaded and must not enter homepage bundles.

Implement explicit runtime states, adaptive quality, and complete lifecycle cleanup. Do not launch parallel inference floods.

Performance target: sustained >=20 FPS baseline on mid-range mobile, 30+ preferred, approximately <=150 ms visual response.

Capture, save, and share are separate explicit actions.

Before polished Try-On, pass the technical prototype gate: camera → tracker → landmarks → dummy hairstyle → stable anchoring → mobile performance → clean lifecycle. If provider performance fails, optimize or replace it behind the adapter instead of weakening product requirements.

---

## 18. Hair History

Completed appointments may create Hair History according to the locked specification. Preserve historical snapshots for hairstyle, barber, service, date, result, rating/feedback, and optional consented photo.

Hair History is private. Barber access is contextual and limited. Do not silently use history to retrain R1 recommendations.

---

## 19. Marketplace, Cart, and Checkout

R1 Marketplace is single-store, not multi-vendor.

Canonical hierarchy:

```text
ProductCategory → Product → ProductVariant → Inventory
```

ProductVariant is the sellable stock/price authority. Out-of-stock is derived from inventory.

Principle:

> Cart is intent, not commitment.

Cart does not reserve stock and does not own authoritative price. Guest carts use opaque tokens with server-side hashes. Login merge is deterministic. Do not silently clamp requested quantities to stock; preserve intent and require action.

Checkout review is server-authoritative and returns current items, prices, stock, totals, payment methods, and checkout fingerprint.

If authoritative inputs changed, return `CHECKOUT_CHANGED`. Never silently charge a changed amount.

---

## 20. PlaceOrder and Inventory

PlaceOrder is one PostgreSQL transaction following STEP 17.

Lock inventory rows in stable variant-ID order. Revalidate lifecycle, stock, prices, fulfillment/payment eligibility, and checkout fingerprint.

Create order snapshots/items, decrement stock, append inventory ledger, create fulfillment/payment, convert cart, write histories/outbox/audit, then commit.

Success is returned only after commit. Multi-item orders are all-or-nothing.

Inventory uses authoritative current quantity plus append-only adjustment ledger. No generic direct stock overwrite. Inventory may never become negative.

---

## 21. Order, Payment, Refund, and Fulfillment

Order statuses:

```text
PLACED
AWAITING_PAYMENT
PROCESSING
READY_FOR_PICKUP
OUT_FOR_DELIVERY
COMPLETED
CANCELLED
```

Payment statuses:

```text
UNPAID
AWAITING_VERIFICATION
PAID
REJECTED
FAILED
PARTIALLY_REFUNDED
REFUNDED
```

Keep order and payment lifecycles separate.

Manual-transfer proof is private evidence, not payment truth. Verification is explicit and audited. Default manual-transfer expiration direction is 24 hours, configurable. Stock release/restock occurs exactly once when required.

Refunds use dedicated records; successful refunds may never exceed paid amount. Refund does not imply restock and restock does not imply refund.

R1 minimum fulfillment is PICKUP. Optional local delivery must not delay R1.

---

## 22. Media, Privacy, and Consent

Use:

```text
upload intent
→ direct signed object upload
→ finalize
→ attach business resource
```

Do not send large images as base64 JSON.

Media visibility is PUBLIC, PRIVATE, or TEMPORARY. Private media requires authorization before short-lived signed access.

Upload intents define purpose, allowed MIME, size, visibility, owner, and expiry. Validate actual signature/decode/dimensions/size; do not trust extension alone. User SVG upload is prohibited in R1. Strip unnecessary EXIF, especially GPS/device metadata. Never log signed URLs.

Collect only data required by the product. Do not add birth date in R1 without concrete need. Delivery address is collected only for delivery use.

Treat camera permission, capture, save preview, share preview, and save final haircut photo as separate consent actions.

Saved Try-On previews are private by default and shared contextually, preferably through appointment relations rather than a global visibility flag.

---

## 23. Web Security, Logging, and Audit

Use appropriate production CSP, HSTS, X-Content-Type-Options, Referrer-Policy, and Permissions-Policy.

Cookie-authenticated mutations require CSRF defense. GET never mutates.

Render user-authored content as escaped text by default. Avoid arbitrary `dangerouslySetInnerHTML`.

Use structured logging with safe metadata. Never log passwords, raw tokens, signed URLs, payment-proof bytes, camera frames, landmarks, or full sensitive profiles.

Business audit is separate from ordinary logs. Audit critical price/policy changes, barber deactivation, admin appointment changes, inventory adjustments, payment verification, refunds, filter publication, and recommendation-knowledge publication.

---

## 24. Worker and Outbox

Worker handles outbox processing, notifications, payment/order expiration, temporary media cleanup, and integrity checks.

Worker must invoke application/domain use cases rather than bypass business rules with raw status updates.

Core commands must not fail merely because email/analytics providers fail.

Use past-tense domain event names.

---

## 25. Frontend and UX Guardrails

State ownership:

```text
URL             → navigation/shareable state
TanStack Query  → interactive client-side server state
React Hook Form → form state
local React     → ephemeral UI
Try-On runtime  → high-frequency mutable state
```

Prefer Server Components by default. Use Client Components where browser interactivity requires them. Server Components should use application/query layers directly rather than calling the same application's localhost HTTP API without need.

Follow the canonical UX/UI Specification.

Visual identity:

```text
Modern Editorial Grooming × Clean Technology
70% Editorial Grooming + 30% Clean Technology
Warm Neutral × Ink Black × Acid Lime
```

Use locked colors, Barlow Condensed + Inter, Lucide icons, and design tokens.

Avoid generic purple SaaS styling, random gradients, excessive glassmorphism, meaningless metric cards, or generic AI-dashboard aesthetics.

Customer and Barber are mobile-first. Admin is desktop-first but remains functional on smaller screens.

---

## 26. Accessibility

Core UI supports keyboard use, visible focus, semantic labels, error association, sufficient contrast, screen-reader names, zoom, and reduced motion where relevant.

Do not use color as the only state indicator.

Follow STEP 20 accessibility and responsive QA requirements.

---

## 27. Testing and CI

Test business invariants first and implementation details second.

Critical domains require appropriate unit/domain tests, real PostgreSQL integration, concurrency tests, API/security tests, E2E, accessibility tests, and real-device Try-On tests.

Never use SQLite as proof of PostgreSQL row locking, GiST constraints, partial indexes, or transaction semantics.

Use injectable `Clock` for time-dependent domain tests.

Mandatory critical coverage includes Reservation races/reschedule preservation, Recommendation golden vectors, Marketplace last-unit and payment/refund races, IDOR matrices, private media authorization, and Try-On coordinate/lifecycle/device tests.

Critical bugs should receive regression tests.

PR gates include lint, typecheck, relevant tests, build, and selected critical E2E as defined in STEP 20. Flaky tests are defects; do not rerun until green.

---

## 28. Definition of Done

A feature is not done until:

1. business behavior is implemented;
2. server authorization is implemented;
3. expected error states are handled;
4. critical rules are tested;
5. responsive behavior is checked;
6. accessibility is checked;
7. observability exists where relevant;
8. sensitive logging is absent;
9. migrations are included where required;
10. API/docs are updated where required.

---

## 29. Implementation Order

Follow STEP 23 dependency-aware vertical slices:

```text
M0  Repository Running
M1  Authenticated User
M2  Configured Services/Barbers
M3  Customer Booking
M4  Barber Operational Workflow
M5  Hairstyle Recommendation
M6  Virtual Try-On Prototype
M7  Recommendation → Try-On → Booking
M8  Hair History
M9  Marketplace Catalogue + Cart
M10 Transaction-Safe Orders
M11 Payment + Pickup
M12 Operational Admin
M13 Security / QA
M14 Production Release
```

Do not build every major subsystem simultaneously.

---

## 30. Scope Reduction and Kill Switches

Under deadline pressure, cut optional scope before integrity.

Cut first: local delivery, extra hairstyles/products, advanced animation/analytics, PWA polish.

Never cut authorization, transaction correctness, concurrency control, private-media protection, stock integrity, or payment integrity.

Support server-enforced kill switches where specified, including booking, Virtual Try-On, Marketplace checkout, and manual transfer. Failure of Try-On must not break recommendation/booking; Marketplace failure must not break booking.

---

## 31. No Fake Success, Availability, or Scarcity

Never return/display authoritative success before transaction commit.

Resolve ambiguous critical-write responses through idempotency.

Do not calculate authoritative booking availability solely on the client.

Do not show unsupported scarcity/popularity claims such as “Only 1 left”, “Trending”, “Best Seller”, or “Selling Fast”. No hidden fees or preselected paid add-ons.

---

## 32. Secrets and Client Boundaries

Never commit database/session/storage/email/monitoring secrets, private API keys, or production `.env`.

Use `.env.example` with placeholders.

Client Components must never import database packages, password hashing, server env, storage credentials, email providers, or private logging configuration.

---

## 33. Dependency and Code Discipline

New dependencies must solve a concrete problem. Do not add packages because they are fashionable.

Prefer readable, explicit, typed TypeScript. Avoid clever metaprogramming, unnecessary abstraction, compressed business logic, generic naming, and mystery constants.

Comments explain why, invariants, concurrency reasoning, provider workarounds, or non-obvious tradeoffs.

Critical correctness TODOs cannot silently ship.

Apply strongest architectural rigor to Authentication, Reservation, Inventory, Payment, Checkout/Order, and Private Media. Do not force complex DDD patterns on simple catalogue CRUD.

---

## 34. Agent Work Discipline

Before editing a major domain:

```text
1. inspect relevant canonical specifications
2. inspect existing module structure
3. identify locked invariants
4. identify affected tests
5. make the smallest coherent change
6. run relevant tests
7. run type/lint/build checks where appropriate
```

Before schema changes, inspect migration history, constraints/indexes, foreign keys, and compatibility.

Do not rewrite unrelated modules merely for consistency.

---

## 35. Domain-Specific Agent Discipline

### Reservation

Preserve half-open intervals, server-derived end time, final transactional revalidation, barber/customer overlap protection, specific-barber semantics, ANY fairness, and atomic reschedule. Changes touching these require concurrency tests.

### Marketplace

Preserve server-authoritative prices, cart-no-reservation, checkout fingerprint, stable inventory locks, all-or-nothing order creation, inventory ledger, order/payment separation, and idempotency. Stock/payment changes require real PostgreSQL tests.

### Recommendation

Keep deterministic, versioned, explainable, and non-ML. Do not use LLM-generated explanations.

### Virtual Try-On

Do not upload camera frames, persist landmarks, run per-frame React state, spread provider-specific types through UI, or load CV runtime globally.

### Security

Never solve authorization by hiding UI, expose permanent private-storage URLs, trust client-computed money/status, or disable security controls for convenience.

---

## 36. Regression and Architectural Change Rules

When a bug is found in booking, inventory, payment, authorization, private media, or recommendation ranking, add a regression test where feasible.

Do not casually replace locked foundations such as PostgreSQL, Drizzle, server sessions, FaceTracker/provider direction, Next.js architecture, or the outbox/worker model.

A major architectural change requires explicit rationale and user approval. If implementation evidence proves a choice infeasible, document what failed, evidence, alternatives, tradeoffs, recommended change, and migration impact before changing architecture.

---

## 37. Final Release 1 Principle

BarberKece Release 1 prioritizes:

```text
correctness
security
privacy
clear product value
usable mobile experience
explainable personalization
transactional integrity
```

over:

```text
scale theater
AI buzzwords
framework experimentation
feature quantity
```

When choosing between a clever shortcut and an explicit implementation that preserves a locked BarberKece invariant, choose the explicit invariant-preserving implementation.

The architecture exists to make BarberKece trustworthy, explainable, secure, and maintainable.

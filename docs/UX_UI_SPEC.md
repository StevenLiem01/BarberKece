# BarberKece — UX/UI Specification

**Document:** `BarberKece_UX_UI_SPEC.md`  
**Status:** Release 1 UX/UI Baseline — Locked  
**Product:** BarberKece  
**Primary Platform:** Responsive mobile-first web application  
**Primary Language:** Bahasa Indonesia  
**Purpose:** Single source of truth for BarberKece UX/UI direction, information architecture, flows, page/state inventory, wireframe logic, component behavior, design tokens, and responsive rules.

---

# 1. Product UX/UI Positioning

BarberKece is a **Personalized Digital Barbershop Platform** built around the lifecycle:

> **Discover → Visualize → Decide → Book → Experience → Learn → Maintain**

BarberKece is not designed as a generic booking website, generic CRUD dashboard, static hairstyle catalogue, detached marketplace, beauty-salon template, or marketplace super-app.

Its primary experience is centered on:

1. Discovering hairstyles.
2. Receiving personalized hairstyle recommendations.
3. Trying hairstyles through real-time Virtual Try-On.
4. Booking a haircut with minimal friction.
5. Building Hair History after completed appointments.
6. Using that history to improve future decisions.
7. Maintaining the selected look through contextual product recommendations and Marketplace.

Users who already know what they want must be able to skip recommendation and Virtual Try-On and proceed directly to booking.

---

# 2. Final Visual Direction

## 2.1 Brand Direction

> **BARBERKECE — MODERN GROOMING EDITORIAL SYSTEM**

Visual identity:

> **Modern Editorial Grooming × Clean Technology**

Brand-level balance:

- ~70% Editorial Grooming
- ~30% Clean Technology

The balance changes by surface:

| Surface | Editorial | Functional / Clean Tech |
|---|---:|---:|
| Homepage | 75% | 25% |
| Styles | 70% | 30% |
| Hairstyle Detail | 65% | 35% |
| Find My Style | 45% | 55% |
| Recommendations | 60% | 40% |
| Virtual Filter | 20% | 80% |
| Booking | 20% | 80% |
| Shop Home | 60% | 40% |
| Product Detail | 50% | 50% |
| Cart / Checkout | 10% | 90% |
| Customer Overview | 35% | 65% |
| Hair History | 60% | 40% |
| Barber Area | 15% | 85% |
| Admin Area | 5–10% | 90–95% |

## 2.2 Brand Character

BarberKece should feel:

- confident, not loud;
- modern, not futuristic;
- stylish, not pretentious;
- masculine-neutral, not macho cliché;
- technological, not cyberpunk;
- premium, not luxury-for-luxury’s-sake;
- helpful, not know-it-all;
- young, not childish.

BarberKece must not look like:

- vintage barbershop;
- luxury gentleman's club;
- cyberpunk AI startup;
- generic SaaS dashboard;
- marketplace super-app;
- beauty salon;
- streetwear brand;
- TikTok clone;
- clinical hair analysis tool.

## 2.3 Anti-Cliché Rules

Avoid as dominant brand language:

- barber pole;
- scissors logo cliché;
- moustache icon;
- brick-wall aesthetic;
- vintage badges;
- black-and-gold-everywhere;
- leather texture;
- old-school serif overload.

---

# 3. Moodboard & Art Direction

## 3.1 Final Mood

> **Warm Neutral × Ink Black × Acid Lime**

Visual proportion:

- 85–90% neutral surfaces;
- 10–15% accent maximum.

Final mood words:

> EDITORIAL · CONFIDENT · YOUTHFUL · CLEAN · TACTILE · HAIR-FIRST · CONTROLLED · MODERN · TECH-AWARE · NOT TECH-BRAGGING

Final one-line art direction:

> **BarberKece combines the confidence of contemporary men's grooming editorial with the clarity of a modern digital product, using hair-first photography, oversized typography, warm neutrals, deep ink surfaces, and a restrained acid-lime accent.**

## 3.2 Photography Direction

### Hairstyle photography

Purpose: editorial but informative.

Priorities:

1. hair;
2. person;
3. barber action;
4. product;
5. interior.

Preferred hairstyle views:

- 3/4 primary;
- side secondary;
- front supporting;
- back supporting;
- texture/detail close-up.

Photography should use:

- neutral / warm-gray / charcoal backgrounds;
- directional light sufficient to show silhouette, texture, volume, and fade;
- natural skin tone;
- slightly warm grading;
- moderate contrast;
- controlled saturation;
- tight head/shoulder crop.

Acid lime must not be baked into photography as a recurring visual gimmick.

### Product photography

Mood:

> Functional object meets grooming ritual.

Use:

- clean packshots;
- consistent angles;
- neutral background;
- minimal shadows;
- contextual ritual imagery where helpful;
- texture close-ups.

Suggested materials:

- stone;
- brushed steel;
- glass;
- paper;
- dark textile;
- wood only in moderation.

Avoid rustic wood overload.

---

# 4. Design Principles

The following principles are locked and apply throughout the product.

## 4.1 Core Principles

1. **Show the haircut before explaining it.** Visual interest comes first; structured knowledge follows.
2. **Give value before asking for identity.** Guests can explore, get recommendations, try styles, browse products, and build a cart before account gating is necessary.
3. **Preserve context across the journey.** Choices should travel forward: Recommendation → Try → Book → Appointment → Hair History → Shop.
4. **Quiet the interface as intent increases.** Discovery can be expressive; transactions should become calm and focused.
5. **Explain personalization.** Recommendations must state why they fit using structured metadata.
6. **Never pretend certainty.** Prefer Strong Match / Great Match / Grow-Out Option over claims of perfect suitability.
7. **Hide technology, show benefit.** Users should not need to understand MediaPipe, WebGL, ONNX, or model internals.
8. **Use human language, not system language.**
9. **Preserve progress through failure.** Failure should cost the system, not the user.
10. **Every error offers a next move.** Explain what happened, what was preserved, and what the user can do next.
11. **Turn dead ends into alternatives.** No availability, no match, or out-of-stock states should offer useful next options.
12. **Do not ask users to configure what the system can derive.**
13. **Defaults reduce friction; they must never manipulate.**
14. **Trust over dark patterns.** No fake urgency, hidden fees, preselected paid add-ons, fabricated scarcity, or deceptive upsell.
15. **Hair History creates continuity, not surveillance.**
16. **User-generated imagery requires explicit control.** Capture ≠ Save. Save Style ≠ Save Preview.
17. **Personalization remains user-controllable.** Inferred preferences can be suggested; users decide what becomes profile truth.
18. **Separate inspiration from transaction.**
19. **Keep summaries visible before commitment.**
20. **Use proportionate friction for destructive actions.**
21. **Operational interfaces prioritize exceptions.** Barber sees what matters today; Admin sees what requires attention.
22. **Role visibility follows responsibility.**
23. **Same brand, different density.** Consistency is systemic, not identical layouts.
24. **Photography communicates; it is not decoration.**
25. **Hair is the hero.**
26. **Asymmetry is allowed only when storytelling improves.** It must remain grid-disciplined.
27. **Whitespace is hierarchy.**
28. **Cards are containers, not decoration.**
29. **Status must be readable without relying on color.**
30. **Mobile is recomposed, not shrunk.**
31. **Design for the primary device per role.** Customer mobile-first, Barber strongly mobile-first, Admin desktop-first.
32. **Reduce choices at the moment of action.**
33. **One primary action per state.**
34. **Recommendation and commerce remain distinct.** Advice must stay valuable even if no purchase occurs.
35. **Barber recommendation is expertise, not promotion.**
36. **Avoid false precision.** Match language is primary; percentage is secondary.
37. **Use progressive disclosure instead of dumping complexity.**
38. **Critical interactions should be conventional even if surfaces are distinctive.**
39. **Avoid unnecessary feature gravity.**
40. **A feature must strengthen the core BarberKece loop.**
41. **BarberKece remembers momentum.** Returning users should continue from useful context rather than restart.
42. **Trustworthy availability beats optimistic promises.**
43. **Do not expose internal complexity unless actionable.**
44. **Design meaningful states, not only the happy path.**
45. **Voice is confident, concise, and useful.**
46. **Do not explain obvious UI.**
47. **Accessibility is part of visual quality.**
48. **Performance is part of UX.**
49. **Consistency beats novelty.**
50. **Every new design decision must support action, context, trust, role fit, accessibility, and the core loop.**

## 4.2 Twelve Principles to Carry Into Implementation

1. SHOW THE HAIRCUT FIRST.
2. GIVE VALUE BEFORE IDENTITY.
3. PRESERVE CONTEXT.
4. QUIET THE UI AS INTENT INCREASES.
5. EXPLAIN PERSONALIZATION.
6. NEVER PRETEND CERTAINTY.
7. HIDE TECHNOLOGY, SHOW BENEFIT.
8. PRESERVE PROGRESS THROUGH FAILURE.
9. TURN DEAD ENDS INTO NEXT OPTIONS.
10. TRUST OVER CONVERSION TRICKS.
11. SAME SYSTEM, DIFFERENT DENSITY.
12. COMPLEXITY MUST STRENGTHEN THE CORE LOOP.

---

# 5. Information Architecture

## 5.1 Top-Level Product Structure

```text
BARBERKECE
├── PUBLIC EXPERIENCE
├── AUTHENTICATION
├── CUSTOMER AREA
├── BARBER AREA
└── ADMIN AREA
```

Core IA principle:

> **One product, three role spaces, one consistent navigation logic.**

## 5.2 Public Navigation

Desktop primary navigation:

```text
BarberKece | Styles | Find My Style | Try | Book | Shop | Account
```

Mobile public menu:

```text
BARBERKECE [menu]

Styles
Find My Style
Try Hairstyles
Book
Shop
Account / Sign In
```

No app-style bottom navigation for the public experience in Release 1.

## 5.3 Public Routes

```text
/
├── /styles
│   └── /styles/[slug]
├── /find-my-style
├── /recommendations
├── /try-hairstyle
├── /book
│   └── /book/confirmation/[ref]
├── /barbers
│   └── /barbers/[slug]
├── /shop
│   ├── /shop/category/[slug]
│   └── /shop/product/[slug]
├── /cart
├── /checkout
│   └── /checkout/confirmation/[ref]
├── /about
├── /location
├── /booking-policy
├── /privacy
└── /terms
```

Authentication routes:

```text
/sign-in
/sign-up
/forgot-password
/reset-password
```

`/verify-email` is optional depending on authentication implementation.

## 5.4 Customer Routes

```text
/account
├── /account/appointments
│   └── /account/appointments/[id]
├── /account/hair-profile
├── /account/hair-history
│   └── /account/hair-history/[id]
├── /account/saved-styles
├── /account/saved-previews
│   └── /account/saved-previews/[id]   (optional route; modal/gallery acceptable)
├── /account/orders
│   └── /account/orders/[id]
└── /account/settings
```

Do not duplicate global experiences such as `/recommendations`, `/styles`, `/try-hairstyle`, `/book`, or `/shop` inside `/account`.

## 5.5 Barber Routes

```text
/barber
├── /barber/schedule
├── /barber/appointments
│   └── /barber/appointments/[id]
├── /barber/customers
│   └── /barber/customers/[id]
└── /barber/profile
```

`/barber` is the Today view.

## 5.6 Admin Routes

```text
/admin
├── /admin/reservations
│   └── /admin/reservations/[id]
├── /admin/barbers
│   └── /admin/barbers/[id]
├── /admin/schedules
├── /admin/services
│   └── /admin/services/[id]
├── /admin/customers
│   └── /admin/customers/[id]
├── /admin/hairstyles
│   └── /admin/hairstyles/[id]
├── /admin/filter-assets
│   └── /admin/filter-assets/[id]
├── /admin/products
│   └── /admin/products/[id]
├── /admin/categories
├── /admin/inventory
├── /admin/orders
│   └── /admin/orders/[id]
├── /admin/payments
│   └── /admin/payments/[id]
├── /admin/feedback
├── /admin/analytics
└── /admin/settings
```

Suggested grouped admin navigation:

```text
OVERVIEW
- Overview

OPERATIONS
- Reservations
- Barbers
- Schedules
- Services
- Customers

CONTENT
- Hairstyles
- Virtual Filter Assets

SHOP
- Products
- Categories
- Inventory
- Orders
- Payments

INSIGHTS
- Feedback
- Analytics

SYSTEM
- Settings
```

Modules that are disabled by configuration should not appear as empty unusable navigation destinations.

## 5.7 IA Mental Model

```text
PUBLIC  = "I want to discover or do something."
ACCOUNT = "I want to manage my relationship with BarberKece."
BARBER  = "I need to perform today's work."
ADMIN   = "I need to operate the business."
```

Critical loop:

> **Style ↔ Filter ↔ Booking ↔ Hair History ↔ Product**

---

# 6. User Flow Specification

## 6.1 Golden Flow — First-Time Customer

```text
Homepage
→ Find My Style
→ Hair Profile Questions
→ Recommendations
→ View Best Match
→ Try Hairstyle
→ Select Style
→ Book
→ Sign In / Create Account
→ Revalidate Slot
→ Confirm Booking
→ Appointment Confirmed
```

Guests must receive recommendation value before authentication is required.

## 6.2 Direct Booking

```text
Home / Nav
→ Book
→ Service
→ Barber Preference
→ Date
→ Time
→ Review
→ Authenticate if guest
→ Atomic slot validation
→ Confirm
→ Success
```

Entry points may prefill context:

- hairstyle detail → styleId;
- Virtual Try-On → selected styleId;
- barber profile → barberId;
- Hair History → previous style/service/barber context.

Prefilled values remain editable.

## 6.3 Booking Conflict Recovery

If the selected time is taken during final validation:

```text
Confirm Booking
→ Conflict
→ Preserve style/service/barber/date/note
→ Offer nearest valid slots
→ User selects replacement
→ Review
→ Confirm
```

Never restart the entire booking flow.

## 6.4 Reschedule

```text
Appointment Detail
→ Reschedule
→ Booking engine in reschedule mode
→ Select new slot
→ Review Change
→ Secure new slot atomically
→ Release old slot
→ Success
```

The old booking must remain valid unless the new booking is successfully secured.

## 6.5 Cancellation

```text
Appointment Detail
→ Cancel Appointment
→ Policy Check
→ Consequence / Confirmation
→ Cancel
→ Success
```

No dark pattern, hidden option, or deliberately confusing confirmation.

## 6.6 Recommendation Flow

```text
/find-my-style
→ Face Shape
→ Hair Type
→ Density
→ Current Length
→ Maintenance
→ Personal Style
→ Review
→ /recommendations
```

`I'm Not Sure` is a valid answer and never blocks progress.

Results prioritize Top 3 recommendations.

## 6.7 Virtual Try-On Flow

```text
Try / Recommendation / Style Detail
→ Privacy Explanation
→ Camera Permission
→ Load Tracking
→ Detect Face
→ Live Hairstyle Preview
→ Switch Styles
→ Select Style
→ Book / View Details / Keep Trying
```

Capture flow:

```text
Live Camera
→ Capture
→ Preview
→ Retake / Save Preview / Select This Style
```

Capture does not imply save. Saving imagery must require explicit user action.

## 6.8 Marketplace Flow

```text
Shop
→ Browse / Search / Filter
→ Product Detail
→ Add to Cart
→ Cart
→ Authenticate before checkout if guest
→ Fulfillment
→ Payment
→ Review
→ Atomic stock validation
→ Place Order
→ Confirmation
```

Contextual commerce flows:

```text
Hairstyle Detail → STYLE IT RIGHT → Product
Hair History → Shop This Look → Product
Recommendation → Matching Products → Product
```

Cart does not reserve stock.

## 6.9 Post-Haircut Continuity

```text
Appointment Completed
→ Hair History Created
→ Optional photo with consent
→ Optional Barber Notes
→ Feedback
→ Future recommendation refinement
→ Book Again / Try Similar / Shop This Look
```

## 6.10 Barber Flow

```text
Login
→ Today
→ Current / Next Appointment
→ Appointment Context
→ Checked In
→ In Service
→ Complete
→ Barber Note
→ Optional Product Recommendation
→ Optional Photo with Consent
→ Completed
```

## 6.11 Admin Flow

Admin defaults to exceptions requiring action:

```text
Login
→ Overview
→ Needs Attention
→ Resolve Reservation / Payment / Stock / Schedule Issue
```

The admin interface should not be a vanity-metric dashboard.

## 6.12 Cross-Flow Rules

- Authentication preserves draft and returns the user to the exact task.
- Back navigation preserves state and scroll/context where possible.
- Context travels across related experiences.
- Booking confirmation only appears after server-side success.
- Order confirmation only appears after successful order creation.
- Offline mode never fakes booking/order success.
- Dead ends must provide alternatives.
- One primary action per state.
- Users can exit guided flows without losing reasonable recoverable progress.

---

# 7. Page & State Inventory

The design system must treat pages as **stateful experiences**, not static routes.

## 7.1 Public / Discovery

### `/`

Required states:

- guest homepage;
- returning customer personalization;
- image loading;
- partial content unavailable.

Core sections:

1. Navigation
2. Hero
3. Discover / Try / Book / Maintain strip
4. Find My Style
5. Hairstyle Editorial
6. Virtual Try-On
7. How It Works
8. Smart Booking
9. Meet the Barbers
10. Maintain the Look / Marketplace
11. Trust / social proof
12. Final CTA
13. Footer

### `/styles`

States:

- default discovery;
- personalized For You;
- filter applied;
- search results;
- search no results;
- filter no results;
- loading;
- error.

### `/styles/[slug]`

States / variants:

- guest;
- customer with Hair Profile;
- customer without Hair Profile;
- saved / unsaved;
- filter asset available / unavailable;
- product recommendations available / unavailable;
- image loading / missing.

### `/find-my-style`

States:

- intro;
- existing Hair Profile;
- resume draft;
- Face Shape;
- Hair Type;
- Density;
- Current Length;
- Maintenance;
- Personal Style;
- Review;
- validation;
- Not Sure;
- processing;
- processing error.

### `/recommendations`

States:

- guest results;
- customer results;
- strong matches;
- partial matches;
- grow-out options;
- no strong matches;
- error.

### `/try-hairstyle`

States:

- privacy explanation;
- permission pending;
- permission granted;
- permission denied;
- previously blocked;
- no camera;
- unsupported browser/device;
- model loading;
- asset loading;
- camera initializing;
- face detected;
- no face;
- multiple faces;
- tracking lost;
- low light;
- reduced quality/performance;
- offline while active;
- capture preview;
- selected style summary.

### `/barbers` and `/barbers/[slug]`

Include:

- active barbers;
- no active barbers;
- public barber detail;
- specialties;
- example cuts;
- services;
- next availability;
- no availability in horizon.

### Information pages

- `/about`
- `/location`
- `/booking-policy`
- `/privacy`
- `/terms`

Long-form policy content should remain readable and free of marketing clutter.

## 7.2 Booking & Authentication

### `/book`

Modes:

- new booking;
- style prefilled;
- barber prefilled;
- Book Again;
- reschedule;
- restored draft.

Steps and states:

1. Service
2. Barber Preference
3. Date
4. Time
5. Review

Additional states:

- no services;
- no eligible barbers;
- no dates;
- no slots;
- availability loading;
- availability changed;
- conflict;
- authentication gate;
- final validation failure;
- reschedule review;
- cancellation confirmation/policy block.

### `/book/confirmation/[ref]`

- success;
- appointment summary;
- booking reference;
- Add to Calendar;
- View Appointment.

### Auth

Required screens/states:

- sign in;
- invalid credentials;
- sign up;
- validation;
- existing email;
- password recovery request;
- request sent;
- reset password;
- invalid/expired reset link;
- success redirect with context restoration.

## 7.3 Customer Area

### `/account`

Possible content states:

- new account;
- upcoming appointment;
- active order;
- current look;
- missing Hair Profile;
- pending feedback;
- mature returning customer.

### `/account/appointments`

- upcoming;
- past;
- empty states;
- loading/error.

### `/account/appointments/[id]`

Status variants:

- Confirmed;
- Checked In;
- In Service;
- Completed;
- Cancelled by Customer;
- Cancelled by Barbershop;
- No Show.

### `/account/hair-profile`

- missing;
- incomplete;
- complete;
- outdated;
- update suggested.

### `/account/hair-history`

- timeline;
- first-use empty;
- loading.

### `/account/hair-history/[id]`

Variants:

- with/without photo;
- with/without Barber Notes;
- feedback pending/submitted;
- product recommendations present/absent.

Actions:

- Book Again;
- Try Similar Styles;
- Shop This Look;
- Leave Feedback.

### Saved Styles / Saved Previews

Include:

- collection;
- empty;
- loading;
- remove with Undo where low-risk;
- preview delete confirmation where imagery is permanently removed.

### Orders

List and detail states must represent the actual order lifecycle.

### Settings

Sections:

- Personal Information;
- Security;
- Notifications;
- Privacy.

## 7.4 Marketplace

### `/shop`

States:

- guest;
- personalized customer;
- no Hair Profile;
- no current style;
- loading.

### Catalogue / Category

- default;
- category;
- search;
- filters;
- sort;
- no results;
- loading;
- error.

### Product detail

- in stock;
- low stock;
- out of stock;
- variant unavailable;
- personalized reason;
- generic;
- price changed after load.

### Cart

- guest cart;
- account cart;
- empty;
- item unavailable;
- quantity exceeds stock;
- price changed;
- loading/error.

### Checkout

Steps:

1. Contact
2. Fulfillment
3. Payment
4. Review

States:

- authentication required;
- stock conflict;
- price conflict;
- network error;
- placing order;
- pickup-only;
- optional delivery;
- manual transfer;
- awaiting verification.

## 7.5 Barber Area

### `/barber`

States:

- normal day;
- no appointments;
- appointment in progress;
- next appointment;
- day complete;
- offline/data unavailable.

### Appointment detail

Sections:

- customer;
- appointment;
- hairstyle reference;
- Hair Profile;
- previous Hair History;
- customer note;
- current lifecycle state;
- valid next action.

### Completion

- hairstyle confirmed or changed;
- optional notes;
- optional products;
- optional photo with consent;
- validation/error;
- success.

## 7.6 Admin Area

Required page families:

- Overview
- Reservations
- Reservation Detail
- Barbers
- Barber Detail
- Schedules
- Services
- Customers
- Hairstyle List
- Hairstyle Editor
- Filter Assets
- Product List
- Product Editor
- Categories
- Inventory
- Orders
- Payments
- Feedback
- Analytics
- Settings

Critical non-happy-path states include:

- schedule change affecting bookings;
- incomplete hairstyle publishing;
- filter asset testing/failure;
- low/out-of-stock inventory;
- manual payment rejection;
- order status exceptions;
- unsaved changes;
- permissions/unauthorized.

## 7.7 Global System States

Must have reusable patterns for:

- 404;
- unauthorized;
- session expired;
- offline;
- toast;
- modal confirmation;
- destructive confirmation;
- unsaved changes;
- skeleton loading;
- first-use empty;
- search empty;
- filter empty;
- operational clear state;
- unavailable state;
- local inline error;
- page-blocking error.

---

# 8. Wireframe Direction

BarberKece uses approximately ten recurring page skeletons rather than dozens of unrelated layouts.

## 8.1 Core Template Families

1. Editorial Landing
2. Editorial Discovery
3. Editorial Detail
4. Guided Questionnaire
5. Recommendation Result
6. Immersive Camera
7. Transactional Wizard
8. Commerce Catalogue / Detail
9. Personal Hub
10. Operational Application

## 8.2 Editorial Landing

Use for Homepage and selected public landings.

Principles:

- oversized editorial idea first;
- photography directly on canvas where appropriate;
- sections should not all use 50/50 layouts;
- no feature-card wall;
- controlled asymmetry;
- strong whitespace.

Mobile becomes a linear narrative.

## 8.3 Styles Discovery

Desktop:

- editorial intro;
- search/filter controls;
- controlled asymmetric hairstyle grid.

Mobile:

- one-column dominant visual feed;
- Filter + Sort actions;
- predictable image sizing.

## 8.4 Hairstyle Detail

Recommended content order:

1. editorial hero;
2. primary actions;
3. multi-angle gallery;
4. compatibility;
5. personalized match;
6. Barber Notes;
7. what to tell your barber;
8. Virtual Try-On;
9. Style It Right products;
10. booking CTA;
11. related styles.

## 8.5 Find My Style

One question per focused state.

Question dominates screen; options are visual and large; progress is visible but secondary.

Mobile uses a stable bottom Back / Continue area where appropriate.

## 8.6 Recommendations

Recommendation #1 visually dominates.

#2 and #3 are secondary. Grow-out options live in their own section.

Do not render three equal cards at the top.

## 8.7 Virtual Try-On

Desktop:

- camera ~60–70%;
- control panel ~30–40%.

Mobile:

- near-fullscreen camera;
- minimal top controls;
- style selector and actions near bottom;
- selected-style confirmation via bottom sheet.

No global navigation inside the live camera experience.

## 8.8 Booking & Checkout

Desktop:

- active step on left;
- persistent summary on right.

Mobile:

- single column;
- compact/collapsible summary;
- reachable primary CTA.

One decision per step.

## 8.9 Customer Area

Desktop:

- lightweight left rail;
- dynamic personal content.

Mobile:

- no persistent sidebar;
- prioritized vertical modules.

It should feel like a grooming relationship hub, not a SaaS dashboard.

## 8.10 Barber Area

Mobile-first Today view:

- current appointment;
- next appointment;
- day timeline.

Appointment detail prioritizes hairstyle reference, customer Hair Profile, previous cut, note, and lifecycle action.

## 8.11 Admin Area

Desktop-first operational shell:

- grouped persistent sidebar;
- attention queue before charts;
- tables/calendars where appropriate;
- drawers for quick entity inspection;
- editor shells for complex management.

Status transitions are actions, not arbitrary dropdown edits.

## 8.12 Overlay Selection Rules

### Modal

Use for:

- confirmation;
- destructive action;
- short focused input.

### Drawer

Use for:

- preserving list/calendar context;
- entity inspection;
- medium operational editing.

### Bottom Sheet

Use primarily on mobile for:

- filters;
- sort;
- compact selectors;
- selected Virtual Try-On style;
- Adjust Fit;
- cart.

### Full page

Use when:

- sustained attention is required;
- task is multi-step;
- URL/history context matters.

---

# 9. Component Direction

## 9.1 Navigation Families

Separate navigation contexts exist for:

- Public;
- Customer;
- Barber;
- Admin.

They share brand tokens but do not share identical layout.

## 9.2 Button Hierarchy

Only the following major variants should exist:

- Primary
- Secondary
- Tertiary
- Danger
- Icon Button

Arrow `→` is a signature for forward/discovery navigation, not transactional confirmation.

Examples with arrow:

- Find My Style →
- Explore Style →
- Try This Style →

Examples without arrow:

- Confirm Booking
- Place Order
- Save Changes
- Complete Appointment

## 9.3 Selection Components

Use distinct semantic components:

- Visual Choice Card
- Text Choice
- Chip
- Radio
- Checkbox
- Time Slot
- Date Cell

Selection must never rely on color alone.

## 9.4 Domain Components

Use semantic domain components instead of one generic Card component with dozens of modes.

Examples:

- `HairstyleTile`
- `RecommendationResult`
- `ProductCard`
- `AppointmentCard`
- `ServiceOption`
- `BarberOption`
- `HairHistoryEntry`
- `OrderRow`
- `AttentionItem`

Shared visual primitives can still exist underneath.

## 9.5 Recommendation Components

Core vocabulary:

- Strong Match
- Great Match
- Good Match
- Explore Option
- Grow-Out Option

The primary pattern is:

```text
STRONG MATCH
92%

WHY IT WORKS FOR YOU
✓ ...
✓ ...
△ ...
```

Match label is primary; percentage is secondary.

## 9.6 Form Anatomy

Every field uses visible labels:

```text
Label
[ Input ]
Helper / Error
```

Never use placeholder-only labeling.

## 9.7 Feedback Components

Standard families:

- Status Badge
- Inline Alert
- Banner
- Toast
- Progress Indicator
- Validation Message

Status labels must be textual and consistently mapped to semantic tokens.

## 9.8 Commerce Components

Required reusable components include:

- Product Card
- Price
- Variant Selector
- Quantity Stepper
- Cart Item
- Order Summary
- Stock Indicator
- Routine / Shop This Look module.

No fake sale pricing or manufactured scarcity.

## 9.9 Operational Components

Required:

- Barber Timeline
- Admin Resource Calendar
- Table
- Attention Item
- Audit Entry
- Status Action Bar
- Editor Shell
- Inventory Adjustment

Important rule:

> **State transitions are actions, not arbitrary status field edits.**

## 9.10 Interaction States

Every interactive component must define, where applicable:

- Default
- Hover
- Focus
- Pressed
- Selected
- Disabled
- Loading
- Error

Critical functionality must work without hover.

---

# 10. Design System

## 10.1 Core Colors

### Brand/Foundation

```text
Canvas / Bone       #F3F0E8
Surface / Paper     #FAF8F3
Ink                 #11110F
Charcoal            #22231F
Stone               #D8D4CA
Muted Text          #6E6C65
Acid Lime           #C9F23B
```

### Neutral Scale

```text
neutral-0     #FFFFFF
neutral-50    #FAF8F3
neutral-100   #F3F0E8
neutral-200   #E7E3DA
neutral-300   #D8D4CA
neutral-400   #B7B3AA
neutral-500   #8F8C84
neutral-600   #6E6C65
neutral-700   #4B4A45
neutral-800   #2E2F2B
neutral-900   #22231F
neutral-950   #11110F
```

### Lime Scale

```text
lime-50      #F7FFD9
lime-100     #EDFFAC
lime-200     #E2FF7A
lime-300     #D7FA50
lime-400     #C9F23B
lime-500     #B4DB29
lime-600     #8EAF1D
lime-700     #6F8918
lime-800     #566A17
lime-900     #465718
```

Acid lime is a **brand accent**, not the semantic success color.

## 10.2 Semantic Colors

```text
Success     #2F7D4A
Warning     #A66A16
Error       #B63D37
Info        #3E667D
```

Semantic states must always include readable labels/icons where needed.

## 10.3 Default Color Roles

```text
color-bg-canvas       neutral-100
color-bg-surface      neutral-50
color-bg-inverse      neutral-950
color-text-primary    neutral-950
color-text-secondary  neutral-600
color-text-inverse    neutral-50
color-border-subtle   neutral-200
color-border-default  neutral-300
color-border-strong   neutral-700/950
color-brand-accent    lime-400
```

## 10.4 Typography

### Display font

> **Barlow Condensed**

Recommended weights:

- 600
- 700
- 800

### UI font

> **Inter**

### Desktop Display Scale

```text
display-2xl  96px / 0.90 / 700
display-xl   72px / 0.92 / 700
display-lg   56px / 0.95 / 700
display-md   44px / 1.00 / 700
display-sm   36px / 1.00 / 700
```

Recommended tracking: `-0.02em` to `-0.03em`.

### Mobile Display Scale

```text
display-xl   56px
display-lg   48px
display-md   40px
display-sm   32px
```

### UI Scale

```text
heading-xl   32 / 40 / 600–700
heading-lg   28 / 36 / 600–700
heading-md   24 / 32 / 600–700
heading-sm   20 / 28 / 600–700
body-lg      18 / 28 / 400
body-md      16 / 24 / 400
body-sm      14 / 20 / 400
label-lg     14 / 20 / 600
label-md     13 / 18 / 600
caption      12 / 16 / 500
```

Editorial labels such as `STYLES / 01` use 12–14px uppercase, 600 weight, approximately 0.08–0.12em tracking.

## 10.5 Spacing Scale

8px base system with a 4px half-step:

```text
space-0    0
space-1    4px
space-2    8px
space-3    12px
space-4    16px
space-5    24px
space-6    32px
space-7    40px
space-8    48px
space-9    64px
space-10   80px
space-11   96px
space-12   128px
space-13   160px
```

Typical use:

- control internals: 8–16px;
- cards: 16–24px;
- related blocks: 24–32px;
- major sections desktop: 64–128px;
- major sections mobile: 48–80px.

## 10.6 Grid & Containers

### Large/Desktop

- 12 columns;
- 24px gutter;
- primary content max: ~1280px;
- editorial media may extend to ~1440–1600px;
- page gutters: ~48–64px.

### Tablet

- 8 columns;
- 24px gutter;
- ~32px page margin.

### Mobile

- 4 columns;
- 16px gutter;
- ~20px page margin;
- absolute minimum safe outer padding: 16px.

Form/guided flow content should generally stay around 640–760px on larger screens.

## 10.7 Content Width Tokens

```text
content-xs   480px
content-sm   640px
content-md   760px
content-lg   960px
content-xl   1280px
```

## 10.8 Radius

```text
radius-none   0
radius-xs     2px
radius-sm     4px
radius-md     8px
radius-lg     12px
radius-xl     16px
radius-full   999px
```

Usage:

- editorial imagery: 0–4px;
- buttons: 4–8px;
- inputs: 6–8px;
- functional cards: 8–12px;
- pills only for semantically pill-shaped elements.

## 10.9 Borders

Preferred over shadows.

```text
Default  1px solid neutral-300
Subtle   1px solid neutral-200
Strong   1px solid neutral-700 / neutral-950
Selected 1.5–2px neutral-950 + optional small lime marker
```

## 10.10 Elevation

Minimal system:

```text
elevation-0  none
elevation-1  subtle local separation
elevation-2  drawer / popover
elevation-3  modal
```

Suggested direction:

```text
elevation-1: 0 2px 8px rgba(17,17,15,0.06)
elevation-2: 0 12px 32px rgba(17,17,15,0.12)
elevation-3: 0 24px 64px rgba(17,17,15,0.18)
```

## 10.11 Control Sizes

```text
control-sm   36px
control-md   44px
control-lg   52px
```

Touch environments should target at least 44px.

### Buttons

- desktop standard: 44px;
- prominent/mobile transactional: 52px;
- horizontal padding: roughly 20–24px;
- default radius: ~6px.

### Inputs

- desktop: ~44px;
- touch-heavy mobile: ~48px;
- textarea minimum: ~96–120px.

## 10.12 Icon System

Recommended family:

> **Lucide**

Sizes:

```text
icon-sm  16px
icon-md  20px
icon-lg  24px
```

Do not mix multiple unrelated icon libraries or emoji in functional UI.

## 10.13 Image Ratios

### Hairstyle

- discovery portrait: 4:5;
- detail hero: 4:5 or 3:4;
- editorial landscape: 3:2;
- secondary/detail: 1:1 or 4:5.

### Product

- catalogue: 1:1;
- product hero: 1:1;
- optional editorial imagery: 4:5 / 3:2.

### Barber portrait

- 4:5.

Hair images generally use `object-fit: cover` with crop discipline. Product packshots generally use `object-fit: contain` on a controlled background.

## 10.14 Motion

```text
motion-fast     120ms
motion-base     180ms
motion-medium   240ms
motion-slow     320ms
```

Suggested easing:

```text
standard cubic-bezier(0.2, 0, 0, 1)
enter    cubic-bezier(0, 0, 0.2, 1)
exit     cubic-bezier(0.4, 0, 1, 1)
```

No bouncy motion by default.

Respect `prefers-reduced-motion`.

## 10.15 Focus & Accessibility

Target baseline:

> **WCAG AA**

Requirements:

- body text contrast ≥ 4.5:1;
- large text contrast ≥ 3:1;
- visible focus;
- touch targets ≥44×44px;
- no status communicated by color alone;
- semantic labels on icon-only controls;
- meaningful alternative text on content-bearing images;
- keyboard-operable desktop UI.

Suggested focus treatment:

```text
2px lime-400 ring
2px offset
```

On lime surfaces, use a strong contrasting neutral ring.

## 10.16 Z-Index

```text
z-base      0
z-sticky    100
z-dropdown  200
z-overlay   300
z-drawer    400
z-modal     500
z-toast     600
```

Avoid arbitrary high values per component.

## 10.17 Navigation Dimensions

- public desktop header: ~72–80px;
- public mobile header: ~64px;
- customer rail: ~220–240px;
- admin sidebar: ~240–256px;
- collapsed admin rail: ~64–72px.

## 10.18 Design Token Naming

Prefer semantic naming:

```text
--color-bg-canvas
--color-bg-surface
--color-bg-inverse
--color-text-primary
--color-text-secondary
--color-text-inverse
--color-border-subtle
--color-border-default
--color-border-strong
--color-accent
--color-success
--color-warning
--color-error
--color-info
```

Do not expose ambiguous names such as `gray1`, `green3`, or `dark2` as the main implementation contract.

---

# 11. Responsive Rules

## 11.1 Breakpoints

Baseline layout thresholds:

```text
Mobile         0–639px
Tablet         640–1023px
Desktop        1024–1439px
Large Desktop  1440px+
```

These are layout thresholds, not hard device categories. Components may adapt earlier/later if content requires.

## 11.2 Core Responsive Rule

> **Recompose; do not simply shrink.**

Responsive behavior must preserve information hierarchy, touchability, role context, and state.

## 11.3 Public Experience

### Desktop

- full editorial composition;
- controlled asymmetry;
- large type;
- wider image layouts.

### Tablet

- reduce asymmetry;
- simplify composition;
- maintain clear visual hierarchy.

### Mobile

- linear narrative;
- no forced desktop overlap;
- image and content reordered for reading sequence.

## 11.4 Styles

- Large Desktop: controlled asymmetric editorial grid.
- Desktop: simplified editorial grid.
- Tablet: mostly 2-column.
- Mobile: 1-column dominant visual feed.

Hair readability takes priority over novelty.

Mobile filters use Filter + Sort bottom sheets.

## 11.5 Hairstyle Detail

Desktop may use text/media split and asymmetric multi-angle gallery.

Mobile becomes:

1. Title
2. Hero image
3. Description
4. Try / Book / Save
5. Gallery
6. Compatibility
7. Your Match
8. Barber Notes
9. Try-On
10. Products
11. Booking CTA
12. Related Styles

## 11.6 Questionnaire

- single-column core across devices;
- desktop options may use 3–4 columns;
- tablet uses 2–3;
- mobile uses 1–2 based on option type;
- mobile Back / Continue can be sticky.

## 11.7 Recommendations

- #1 remains dominant at every breakpoint;
- desktop: split hero;
- tablet: full-width primary recommendation;
- mobile: stacked.

## 11.8 Virtual Try-On

### Desktop

Approximate layout:

```text
Camera 65% | Controls 35%
```

### Tablet

Camera remains dominant; portrait tablet may move controls beneath the camera.

### Mobile

- near/fullscreen camera;
- no global nav;
- bottom control region;
- safe-area-aware controls;
- selected style via sheet.

Portrait is primary. Landscape must still function but should not be forced.

Virtual Try-On is capability-aware, not width-aware only. Detect camera/browser/rendering support and degrade honestly.

## 11.9 Booking / Checkout

### Desktop

```text
Active Step 65–70% | Summary 30–35%
```

Summary may remain sticky.

### Tablet

Retain split layout where comfortable; otherwise collapse summary.

### Mobile

- single-column;
- compact/collapsible summary;
- full-width 52px primary CTA where appropriate.

Do not squeeze desktop right panels into mobile.

## 11.10 Marketplace

### Shop

Desktop retains editorial opening. Mobile surfaces products sooner.

### Product Grid

Recommended:

- Large Desktop: 4 columns;
- Desktop: 3–4;
- Tablet: 2–3;
- Mobile: 2;
- very narrow screens: 1–2 based on readability.

### Product Detail

Desktop:

```text
Gallery ~55–60% | Purchase ~40–45%
```

Mobile:

1. Gallery
2. Product name
3. Price
4. Variant
5. Quantity
6. Add to Cart / Buy Now
7. Details
8. Personalization
9. Related styles/products

Purchase controls must not be buried under long storytelling on mobile.

## 11.11 Customer Area

### Desktop

- lightweight left rail;
- content workspace.

### Tablet

- reduced rail or compact navigation.

### Mobile

- no persistent sidebar;
- account menu / contextual navigation;
- prioritized vertical modules.

## 11.12 Hair History

- desktop: editorial timeline;
- tablet: simplified timeline;
- mobile: chronological vertical feed.

No alternating-left-right timeline gimmick on mobile.

## 11.13 Barber Area

Barber mobile is the primary reference experience.

Recommended stable mobile navigation:

```text
Today
Schedule
Appointments
Customers
Profile
```

A bottom navigation pattern is acceptable here because these are repeated operational destinations.

Desktop expands the same mental model rather than inventing a new product.

## 11.14 Admin Area

Admin desktop is the primary operating environment.

### Navigation

- desktop: 240–256px sidebar;
- tablet: 64–72px compact rail;
- mobile: navigation drawer.

### Overview

- desktop: multi-column operations;
- tablet: 2-column;
- mobile: single prioritized list.

### Resource Calendar

- desktop: time × barber grid;
- landscape tablet: reduced grid acceptable;
- portrait tablet/mobile: grouped day list.

Do not force a giant horizontally scrolling calendar on a phone.

### Tables

Every table defines column priority:

- P1 — always visible;
- P2 — tablet and above;
- P3 — desktop only.

Mobile usually transforms rows into structured list items rather than preserving full table geometry.

### Editors

- desktop: section rail + form;
- tablet: condensed navigation;
- mobile: single-column sections + jump navigation.

Complex workflows may be desktop-preferred without being completely blocked on mobile.

## 11.15 Sticky Layer Rules

Priority:

1. critical task CTA;
2. role navigation;
3. temporary feedback;
4. context summary.

Avoid more than two persistent bottom layers simultaneously.

## 11.16 Responsive State Persistence

Viewport/orientation changes should not reset:

- questionnaire answers;
- booking draft;
- selected hairstyle;
- Virtual Try-On style selection where session remains valid;
- cart;
- account task context.

## 11.17 Minimum Responsive QA Matrix

Recommended test widths / viewports:

```text
360 × 800
390 × 844
430 × 932
768 × 1024
820 × 1180
1024 × 768
1280 × 800
1440 × 900
1920 × 1080
```

Also test browser zoom around 200%.

---

# 12. UX Writing Direction

Primary production language: **Bahasa Indonesia**.

The examples in design exploration may use English for art direction, but final product copy should be localized intentionally.

Tone:

- concise;
- confident;
- casual-professional;
- human;
- not stiff;
- not slang-heavy;
- not pseudo-AI language.

Avoid:

- “AI-powered” labels where not useful;
- overly technical explanations;
- fake certainty;
- manipulative urgency;
- repetitive instructional copy.

Example intent translations should preserve the visual confidence of phrases such as:

- FIND YOUR CUT.
- WE FOUND YOUR CUTS.
- YOUR MATCH.
- YOU'RE BOOKED.
- MAINTAIN THE LOOK.

Final Bahasa Indonesia wording should be determined during content design/localization without changing the interaction model.

---

# 13. Error, Empty, Loading & Recovery Rules

## 13.1 Error Formula

Every significant failure should answer:

1. **What happened?**
2. **What was preserved?**
3. **What can the user do next?**

Example booking conflict:

```text
That time is no longer available.
Your service, barber preference, date, and style are still selected.
Choose one of the closest available times.
```

## 13.2 Empty State Types

Differentiate:

- First-use empty
- Search empty
- Filter empty
- Operational clear state
- Temporarily unavailable

Do not reuse one generic illustration/message for all meanings.

## 13.3 Loading Patterns

Use:

- skeleton for content geometry;
- inline spinner for local submission;
- explicit progress state for camera/model/recommendation processing;
- optimistic feedback only for low-risk reversible actions.

Never fabricate a fake AI progress percentage or intentional loading delay.

---

# 14. Trust, Privacy & Accessibility UX

## 14.1 Camera Privacy

Before requesting camera permission:

- explain why camera access is needed;
- clarify expected processing behavior;
- explain that imagery is not persisted by default;
- never imply identity recognition.

No background recording.

## 14.2 Saved Image Consent

- Capture ≠ Save
- Save Style ≠ Save Preview
- Saving a final haircut photo requires explicit customer consent.

## 14.3 Commerce Trust

Marketplace UI must not use:

- fake scarcity;
- fake discounts;
- hidden charges;
- preselected paid options;
- misleading stock levels;
- deceptive cancellation paths.

## 14.4 Accessibility

Accessibility is part of Release 1 design quality, not a later patch.

At minimum:

- keyboard support;
- visible focus;
- semantic controls;
- readable contrast;
- 44px touch targets;
- non-color status differentiation;
- reduced-motion support;
- responsive reflow under zoom.

---

# 15. Anti-AI-Slop / Visual Guardrails

Explicitly avoid:

- random gradient blobs;
- purple/blue AI gradients;
- excessive glassmorphism;
- cyberpunk glow;
- every section inside a card;
- everything rounded 24–32px;
- shadows on every object;
- generic hero dashboard mockup;
- repeated three-column feature grids;
- meaningless “AI” badges;
- icon boxes for every feature;
- fake statistics;
- fabricated “Trusted by 10,000+” claims;
- mixed random icon libraries;
- marketplace UI copied from Shopee/Tokopedia patterns without adapting to BarberKece;
- Material-style booking flow that visually disconnects from the brand;
- TikTok-clone camera chrome;
- generic Tailwind admin aesthetic with no BarberKece system continuity.

BarberKece should remain recognizable because of its system, not because of decorative effects.

---

# 16. Signature BarberKece Components

The following are product-defining components and deserve exceptional design quality:

1. **Hairstyle Tile** — hair-first editorial exploration.
2. **Recommendation Explanation** — Strong Match + Why It Works.
3. **Virtual Try-On Shell** — camera + hairstyle selection + decision.
4. **Booking Context Summary** — persistent continuity across booking steps.
5. **Hair History Entry** — actual haircut becomes future personalization context.
6. **Shop This Look / Routine** — hairstyle maintenance connected to product knowledge.
7. **Barber Appointment Context** — style + Hair Profile + previous cut at point of service.
8. **Admin Attention Item** — business operation based on exceptions, not vanity metrics.

---

# 17. Final Responsive Surface Matrix

| Surface | Mobile | Tablet | Desktop |
|---|---|---|---|
| Homepage | Linear editorial | Reduced editorial | Full editorial |
| Styles | 1-col dominant | 2-col | Controlled asymmetry |
| Find My Style | Primary | Strong | Strong |
| Recommendations | Stacked hierarchy | Full-width #1 | Split hero #1 |
| Virtual Filter | **Primary** | Strong | Split camera/control |
| Booking | **Primary** | Strong | Step + summary |
| Shop | **Primary** | Strong | Editorial + catalogue |
| Product Detail | Purchase-first stack | Adaptive | Gallery + purchase |
| Customer | **Primary** | Strong | Rail + content |
| Barber | **Primary** | Strong | Expanded operation |
| Admin | Essential operations | Strong | **Primary** |

---

# 18. Final Decision Test

Before approving any new UX/UI decision, ask:

1. Does this help the user's current goal?
2. Does it preserve context?
3. Is the interface quiet enough for the user's current level of intent?
4. Is personalization explainable?
5. Are we asking for information the system could derive?
6. If it fails, is progress preserved and recovery obvious?
7. Does the user retain control over privacy and irreversible actions?
8. Does this fit the responsibility and primary device of the current role?
9. Does it use the existing design system rather than inventing unnecessary variants?
10. Does this strengthen Discover → Visualize → Decide → Book → Experience → Learn → Maintain?

If the answer is no, redesign before implementation.

---

# 19. Locked UX/UI Baseline Summary

```text
PRODUCT
Personalized Digital Barbershop Platform

VISUAL DIRECTION
Modern Editorial Grooming × Clean Technology

BRAND RATIO
~70% Editorial / ~30% Clean Tech overall

COLOR
Warm Neutral + Ink Black + restrained Acid Lime

CORE COLORS
Canvas       #F3F0E8
Surface      #FAF8F3
Ink          #11110F
Accent Lime  #C9F23B

TYPOGRAPHY
Display      Barlow Condensed
UI           Inter

GRID
12 / 8 / 4 columns

SPACING
8px base + 4px half-step

RADIUS
Restrained: mostly 0–12px

BORDERS
Preferred over shadows

MOTION
120–320ms, restrained

ACCESSIBILITY
WCAG AA target

PUBLIC
Hair-first, editorial, expressive

FUNCTIONAL FLOWS
Quiet, focused, minimal

CUSTOMER
Personal grooming hub

BARBER
Today-first, strongly mobile-first

ADMIN
Attention-first, desktop-first operations

CORE UX RULE
Value before identity

CORE CONTINUITY RULE
Recommendation → Try → Book → Hair History → Shop

CORE FAILURE RULE
Preserve progress and provide next options

CORE TRUST RULE
No dark patterns, fake certainty, fake scarcity, or hidden behavior
```

---

# 20. Document Status

The UX/UI direction represented in this document is the **locked BarberKece Release 1 baseline** produced from the completed design process:

```text
STEP 1  — Visual Research                 COMPLETE
STEP 2  — Final Visual Direction          LOCKED
STEP 3  — BarberKece Moodboard            LOCKED
STEP 4  — Design Principles               LOCKED
STEP 5  — Information Architecture        LOCKED
STEP 6  — User Flow                       LOCKED
STEP 7  — Page Inventory                  LOCKED
STEP 8  — Wireframe Direction             LOCKED
STEP 9  — Component Direction             LOCKED
STEP 10 — Design System                   LOCKED
STEP 11 — Responsive Rules                LOCKED
STEP 12 — UX/UI Specification             COMPLETE
```

Future design decisions may extend this system, but should not contradict its principles without an explicit product-level revision.


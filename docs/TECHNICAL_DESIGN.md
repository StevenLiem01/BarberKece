# BarberKece — Technical Design

**Document:** BarberKece Technical Design  
**Version:** 1.0  
**Status:** Consolidated / Locked for Phase 3  
**Product:** BarberKece  
**Architecture Direction:** Modular Monolith + Client-Side Computer Vision  
**Primary Platform:** Responsive Mobile-First Web Application  
**Primary Database:** PostgreSQL  
**Primary Language:** Bahasa Indonesia  
**Release Scope:** Single physical barbershop location, Release 1  

---

# 1. Purpose

Dokumen ini mengonsolidasikan keputusan teknis BarberKece yang telah dikunci pada Technical Design STEP 1–11.

Dokumen ini bukan PRD, bukan Database Schema detail, bukan API contract detail, dan bukan implementation guide per-file. Dokumen ini berfungsi sebagai arsitektur teknis tingkat sistem yang menjadi source of truth sebelum masuk ke desain teknis yang lebih spesifik.

Dokumen ini menjadi handoff utama untuk:

1. Database Schema
2. Reservation Engine Specification
3. Recommendation Engine Specification
4. Virtual Hair Filter Technical Specification
5. Marketplace Technical Specification
6. API Specification
7. Security & Privacy Specification
8. Test Plan
9. Final Tech Stack
10. Repository & Code Architecture
11. Implementation Plan
12. AGENTS.md

---

# 2. Product Context

BarberKece adalah **Personalized Digital Barbershop Platform** berbasis responsive web application dengan mobile-first UX.

Core customer loop:

**Discover → Visualize → Decide → Book → Experience → Learn → Maintain**

Core differentiated capabilities:

1. Haircut Knowledge & Recommendation System
2. Real-Time Virtual Hairstyle Filter
3. Smart Reservation
4. Hair History / Personalization
5. Marketplace sebagai supporting commerce layer

Marketplace termasuk Release 1, tetapi bukan core differentiator utama.

---

# 3. Architectural Goals

Prioritas arsitektur BarberKece:

1. Correctness
2. Security & Privacy
3. Usability
4. Virtual Filter Performance
5. Maintainability
6. Reliability
7. Observability
8. Scalability without overengineering

Arsitektur Release 1 harus cukup sederhana untuk dikembangkan dan dioperasikan oleh tim kecil, tetapi tetap memiliki boundary yang sehat agar dapat berkembang tanpa rewrite besar.

---

# 4. Architecture Style

## 4.1 Primary Architecture

BarberKece menggunakan:

> **Modular Monolith + Client-Side Computer Vision**

BarberKece tidak menggunakan microservices pada Release 1.

Alasan utama:

- domain sangat saling berkaitan;
- deployment lebih sederhana;
- transaksi lintas domain lebih mudah dijaga;
- single-location business belum membutuhkan distributed systems complexity;
- debugging dan testing lebih mudah;
- biaya infrastruktur lebih rendah.

BarberKece secara eksplisit tidak membutuhkan pada R1:

- Kubernetes
- service mesh
- Kafka
- Elasticsearch
- cloud GPU inference
- mandatory Redis
- distributed transaction coordinator

---

# 5. One Application, Three Protected Role Spaces

BarberKece menggunakan satu aplikasi dan satu domain utama.

Role spaces:

```text
/         → Public Experience
/account  → Customer
/barber   → Barber
/admin    → Admin / Owner
```

Tidak diperlukan subdomain terpisah pada Release 1.

Shared across role spaces:

- authentication
- authorization
- design system
- domain models
- business rules
- API layer
- database
- validation
- observability
- deployment lifecycle

Frontend separation tidak menggantikan server-side authorization.

---

# 6. Domain Modules

Logical backend modules:

```text
Identity
Customer
Barber
Hairstyle
Recommendation
VirtualTryOn
Reservation
HairHistory
Marketplace
Inventory
Payment
Media
Notification
Analytics
Admin
```

Masing-masing module memiliki ownership terhadap business rules dan write boundary-nya.

Admin dan Barber bukan dumping-ground module.

Mereka adalah role-facing application surfaces yang tetap menggunakan domain modules yang sama.

---

# 7. Domain Boundary Summary

## 7.1 Identity

Responsible for:

- User
- Authentication
- Session
- Role
- Authorization
- Password
- Account lifecycle

Roles:

```text
CUSTOMER
BARBER
ADMIN
```

Release 1 menggunakan satu primary role per account.

---

## 7.2 Customer

`User` identity dipisahkan dari:

```text
CustomerProfile
HairProfile
```

Hair Profile bukan bagian wajib saat signup.

---

## 7.3 Hairstyle Knowledge

Hairstyle bukan sekadar CMS record.

Hairstyle knowledge memuat data terstruktur seperti:

- name
- slug
- media
- face shape compatibility
- hair type compatibility
- hair density compatibility
- minimum/current length constraints
- maintenance level
- style tags
- barber notes
- filter assets
- related products
- publishing status

Hairstyle knowledge dipakai oleh:

- recommendation
- style detail
- Virtual Try-On
- booking context
- barber appointment context
- Hair History
- Marketplace recommendations

---

## 7.4 Recommendation

Release 1 menggunakan:

> **Knowledge-Based Weighted Scoring**

Default dimensions:

- Face Shape Match — 25%
- Hair Type Match — 20%
- Hair Thickness Match — 15%
- Current Length Feasibility — 15%
- Maintenance Match — 10%
- Style Preference Match — 15%

Missing atau `Not Sure` values diabaikan melalui normalization.

Recommendation engine tidak membutuhkan external AI API.

Core pipeline:

```text
Hair Profile
→ Candidate Styles
→ Hard Constraints
→ Weighted Scoring
→ Ranking
→ Explanation
→ Top Recommendations
```

Result default: Top 3.

Explainability berasal dari metadata dan rule logic, bukan generic AI prose.

---

## 7.5 Reservation

Reservation domain berdiri sendiri dan menangani:

- Service
- Barber Eligibility
- Business Hours
- Working Schedule
- Break
- Leave
- Blocked Time
- Availability
- Appointment
- Any Available Barber Assignment
- Reschedule
- Cancellation

Availability adalah derived data, bukan permanent slot table sebagai source of truth.

Displayed slot tidak menjamin final booking.

Final booking selalu server-revalidated.

---

## 7.6 Hair History

Appointment dan Hair History dipisahkan.

Appointment adalah operational record.

Hair History adalah customer grooming memory.

Completed appointment dapat menghasilkan HairHistoryEntry yang berisi:

- actual hairstyle
- barber
- barber notes
- customer feedback
- rating
- optional haircut photo with consent
- optional product recommendation

---

## 7.7 Virtual Try-On

Real-time hairstyle filter terutama berjalan di browser.

Pipeline:

```text
Camera
→ Face Detection
→ Landmarks
→ Head Pose
→ Hairstyle Transform
→ Rendering
→ User Interaction
```

Server bertanggung jawab untuk:

- filter asset metadata
- filter manifest
- model version/config
- calibration metadata
- asset publishing

Camera frames tidak dikirim ke server secara default.

---

## 7.8 Marketplace

Marketplace Release 1 adalah single-store commerce module.

Bukan multi-vendor.

Subdomain:

```text
Catalogue
Product
Variant
Cart
Checkout
Order
Payment
Fulfillment
Inventory
```

Marketplace mendukung personalized product recommendation melalui curated metadata.

---

## 7.9 Inventory

Inventory dipisahkan dari Product.

Inventory menggunakan:

```text
current_quantity
+
append-only InventoryAdjustment ledger
```

Stock mutation harus auditable.

---

## 7.10 Payment

Payment memiliki lifecycle terpisah dari Order.

Release 1 mendukung:

- Pay at Barbershop
- Manual Bank Transfer jika diaktifkan

Future payment gateway dapat ditambahkan melalui adapter tanpa mengubah core payment domain.

---

# 8. Backend Architecture

## 8.1 Layered Domain Architecture

Setiap backend module mengikuti konsep:

```text
Domain
Application
Infrastructure
Interface
```

### Domain

Berisi:

- entities
- value objects
- invariants
- policies
- state transition rules

Domain tidak mengetahui:

- HTTP
- cookies
- React
- SQL details
- email provider
- object storage SDK

### Application

Berisi use cases.

Contoh:

```text
ConfirmBooking
RescheduleAppointment
CancelAppointment
CompleteHaircut
GenerateRecommendations
PlaceOrder
VerifyPayment
AdjustInventory
PublishHairstyle
```

Application layer menjalankan orchestration.

### Infrastructure

Berisi implementation untuk:

- PostgreSQL repositories
- object storage
- email
- analytics
- worker
- clock
- ID generation
- external provider adapters

### Interface

Berisi:

- HTTP handlers
- controllers/routes
- request parsing
- request schema validation
- authentication context resolution
- error mapping

Route handler harus thin.

---

# 9. Backend Dependency Direction

Dependency direction:

```text
Interface
    ↓
Application
    ↓
Domain
```

Infrastructure mengimplementasikan dependency contracts.

Domain tidak boleh import framework, ORM, provider SDK, atau storage SDK.

---

# 10. Lightweight CQRS

BarberKece menggunakan lightweight CQRS.

Tidak ada separate database atau heavyweight CQRS infrastructure.

Commands mutate state.

Examples:

```text
ConfirmBooking
CancelBooking
RescheduleBooking
PlaceOrder
VerifyPayment
AdjustInventory
```

Queries read state.

Examples:

```text
GetAvailableSlots
GetCustomerAppointments
GetAdminReservationCalendar
GetProductCatalogue
GetHairHistory
```

Read model boleh berbeda dari write entity.

---

# 11. Transaction Boundaries

Transaction mengikuti business transaction.

## 11.1 Booking

Conceptual:

```text
BEGIN

validate service
validate barber eligibility
re-check schedule
resolve Any Available Barber if needed
check conflict
insert appointment
write required audit/outbox records

COMMIT
```

Jika conflict atau validation gagal:

```text
ROLLBACK
```

---

## 11.2 Reschedule

Reschedule harus atomic.

New slot harus aman sebelum old slot dilepas.

Jika new slot gagal, existing appointment tetap valid.

---

## 11.3 Place Order

Conceptual:

```text
BEGIN

validate products
validate variants
load latest price
validate stock
calculate totals
create order
snapshot order items
adjust inventory
create payment state
write inventory ledger
write required outbox/audit

COMMIT
```

---

# 12. State Machines

Critical state transitions tidak menggunakan arbitrary status PATCH.

## 12.1 Appointment

```text
Confirmed
→ Checked In
→ In Service
→ Completed
```

Alternative terminal states:

```text
Cancelled by Customer
Cancelled by Barbershop
No Show
```

---

## 12.2 Order

Supported lifecycle:

```text
Placed
Awaiting Payment
Paid
Processing
Ready for Pickup
Out for Delivery
Completed
Cancelled
Refunded
```

Exact allowed transitions akan dikunci pada Marketplace Technical Specification.

---

## 12.3 Payment

```text
Unpaid
Awaiting Verification
Paid
Payment Failed
Refunded
Partially Refunded
```

Payment status tidak sama dengan Order status.

---

# 13. Historical Snapshots

Current catalogue changes tidak boleh menulis ulang transaction history.

## 13.1 Appointment Snapshot

Appointment dapat menyimpan:

```text
service_id
service_name_snapshot
service_duration_snapshot
service_price_snapshot
```

dan historical display fields yang diperlukan.

---

## 13.2 OrderItem Snapshot

OrderItem wajib menyimpan:

```text
product_id
variant_id
product_name_snapshot
variant_name_snapshot
sku_snapshot
unit_price_snapshot
quantity
line_total
```

Editing product tidak boleh mengubah order lama.

---

# 14. Frontend Architecture

Frontend menggunakan:

> **Feature-Oriented Frontend Architecture**

Conceptual structure:

```text
src/
├── app/
├── features/
├── components/
├── lib/
├── hooks/
├── types/
└── styles/
```

Feature boundaries:

```text
auth
hairstyles
recommendations
virtual-try-on
booking
hair-history
marketplace
customer
barber
admin
```

---

# 15. Frontend Layout Families

Main layouts:

```text
Public Layout
Customer Layout
Barber Layout
Admin Layout
```

Specialized layouts:

```text
Virtual Try-On Layout
Booking Focus Layout
Checkout Focus Layout
```

---

# 16. Rendering Strategy

BarberKece menggunakan:

> **Server-first rendering, client-side interactivity only where needed.**

Good server-rendered candidates:

- Homepage
- Styles
- Style Detail
- Barbers
- Shop
- Product Detail

Client-heavy features:

- Find My Style
- Virtual Try-On
- Booking Wizard
- Cart
- Checkout
- Barber lifecycle actions
- Admin Calendar

Client boundaries harus kecil.

---

# 17. Frontend State Ownership

State dibedakan menjadi:

## Server State

```text
hairstyles
products
appointments
orders
history
schedules
inventory
```

## URL State

```text
filters
sorting
search
shareable navigation state
```

## Local UI State

```text
drawer
modal
gallery
accordion
selected tab
```

## Flow State

```text
recommendation draft
booking draft
checkout flow
```

## Persistent Client State

```text
guest cart
temporary safe drafts
```

## Device State

```text
camera
model
tracking
FPS
orientation
renderer capability
```

Global state adalah exception, bukan default.

---

# 18. Critical Frontend Mutation Rule

Critical transactions tidak boleh optimistic-confirmed.

Never optimistic-confirm:

- booking
- order
- payment
- inventory
- appointment completion

Optimistic UI hanya untuk low-risk reversible operations.

---

# 19. Booking Draft

BookingDraft dapat berisi:

```text
hairstyleId
serviceId
barberPreference
date
time
notes
origin
```

BookingDraft bukan Appointment.

Appointment baru ada setelah server commit.

---

# 20. Guest-to-Authenticated Continuity

Authentication tidak boleh mereset task.

Guest state yang harus dipertahankan bila aman:

- Booking Draft
- Cart
- Selected Hairstyle
- Recommendation Context
- Find My Style Draft

Principle:

> **Authentication is an interruption, not a reset.**

---

# 21. Authentication Strategy

Release 1 menggunakan:

> **Server-managed session-based authentication**

Default browser authentication:

```text
Secure Session Cookie
→ BarberKece Server
→ Session Persistence
→ User
```

Long-lived auth tokens tidak disimpan di `localStorage`.

---

# 22. Authentication Cookie

Default properties:

```text
HttpOnly = true
Secure = true
SameSite = Lax
Path = /
```

Exact framework implementation diputuskan pada Final Tech Stack.

---

# 23. User Model Direction

Conceptual:

```text
User
├── id
├── email
├── password_hash
├── role
├── status
├── email_verified_at
├── created_at
├── updated_at
└── last_login_at
```

Statuses:

```text
ACTIVE
SUSPENDED
DISABLED
PENDING
```

---

# 24. Account Provisioning

## Customer

Public self-registration selalu menghasilkan:

```text
CUSTOMER
```

Client tidak boleh memilih role.

## Barber

BARBER tidak boleh public self-register.

Provisioning melalui admin-controlled invitation.

## Admin

ADMIN tidak boleh public self-register.

Initial admin dibuat melalui secure bootstrap.

Additional admin melalui authorized admin flow.

---

# 25. Password Security

Password disimpan menggunakan secure modern password hashing.

Direction:

> **Argon2id or equivalent secure modern algorithm**

Tidak menggunakan reversible encryption, MD5, atau SHA1.

Reset dan invitation token harus:

- high entropy
- short-lived
- single-use
- hashed at rest jika feasible

---

# 26. Session Model

Conceptual:

```text
Session
├── id
├── user_id
├── created_at
├── last_seen_at
├── expires_at
├── revoked_at
└── user_agent_summary
```

Multi-device sessions diperbolehkan.

Current and all-device revocation harus didukung.

---

# 27. Authorization

Base RBAC:

```text
CUSTOMER
BARBER
ADMIN
```

Tetapi role check tidak cukup.

Authorization harus mempertimbangkan:

```text
actor
action
resource
ownership
scope
resource state
```

---

# 28. Authorization Policies

Recommended policy direction:

```text
canViewAppointment(actor, appointment)
canCancelAppointment(actor, appointment)
canCompleteAppointment(actor, appointment)
canViewCustomerContext(actor, customer)
canAdjustInventory(actor)
canVerifyPayment(actor, payment)
canAccessPrivateMedia(actor, media)
```

Business authorization tidak boleh tersebar sebagai random role checks.

---

# 29. Barber Data Scope

Barber hanya boleh melihat data customer yang relevan dengan pelayanan.

Allowed examples:

- assigned appointment
- selected hairstyle
- relevant Hair Profile
- relevant recent Hair History
- service notes

Not automatically allowed:

- unrelated private previews
- payment proofs
- account security data
- complete marketplace/payment history

---

# 30. Admin Privilege

Admin memiliki broad operational privileges tetapi tidak boleh bypass domain invariants.

Admin tetap tidak boleh:

- create conflicting booking
- create negative stock
- perform invalid state transition
- mark payment twice without idempotent handling
- silently overwrite stale resources

---

# 31. CSRF and Browser Security Direction

Karena session menggunakan cookie, mutating requests harus memiliki CSRF defense.

Direction:

- SameSite cookie
- Origin/Referer validation
- framework CSRF mechanism/token where needed
- GET must not mutate state

Exact implementation mengikuti final framework.

---

# 32. Primary Persistence Architecture

BarberKece menggunakan:

> **PostgreSQL sebagai primary transactional source of truth.**

PostgreSQL menyimpan structured business data.

Object storage menyimpan media bytes.

Cache hanya acceleration.

---

# 33. Storage Separation

```text
PostgreSQL
→ structured business truth

Object Storage
→ binary/media truth

Cache
→ non-authoritative acceleration
```

Media tidak disimpan sebagai DB blob secara default.

---

# 34. Identifier Strategy

Internal primary identifiers menggunakan opaque non-sequential IDs.

Preferred direction:

> UUIDv7 or equivalent sortable opaque IDs

Human-facing references dipisahkan.

Examples:

```text
BKG-8F3K2Q
ORD-7PK2MA
```

Reference tidak menjadi security boundary.

---

# 35. Time Strategy

Technical timestamps disimpan sebagai UTC.

Business scheduling memakai configured business timezone.

Default R1:

```text
Asia/Jakarta
```

Use semantic types:

```text
DATE        → local business date
TIME        → recurring business clock time
TIMESTAMPTZ → actual instant
```

Server clock authoritative untuk policy.

---

# 36. Data Lifecycle

Deletion tidak menggunakan universal soft delete.

Use domain-specific lifecycle.

Archivable content:

```text
Hairstyle
Product
Service
Barber
Category
FilterAsset
```

Transactional data tidak normally deleted:

```text
Appointment
Order
Payment
InventoryAdjustment
AuditLog
```

Privacy deletion menggunakan governed anonymization/retention workflow.

---

# 37. Foreign Keys and Constraints

Core relational integrity dijaga database.

Use:

- foreign keys
- unique constraints
- non-negative constraints
- constrained states
- appropriate delete restrictions

`ON DELETE CASCADE` tidak digunakan secara global.

---

# 38. Availability Persistence Rule

Available slots tidak disimpan sebagai canonical permanent rows.

Source of truth:

```text
Business Hours
Barber Working Schedule
Service Eligibility
Existing Appointments
Breaks
Leave
Blocked Time
Service Duration
```

Availability dihitung dari source tersebut.

---

# 39. Concurrency Strategy

BarberKece menggunakan kombinasi:

```text
Database Constraints
Transaction Locking
Optimistic Concurrency
Idempotency
```

berdasarkan domain.

---

# 40. Booking Concurrency

Final booking:

- server revalidates
- critical rows/resources protected as needed
- conflict checked inside transaction
- insert only if still valid
- commit atomically

Exact PostgreSQL mechanism dikunci pada Reservation Engine Specification.

Possible mechanisms include:

- exclusion constraints
- advisory/row locking
- transaction locking
- hybrid strategy

---

# 41. Inventory Concurrency

Stock mutation harus atomic.

Conceptual:

```text
BEGIN
lock/atomically validate inventory
check quantity
decrement
write InventoryAdjustment
COMMIT
```

Actual stock tidak boleh menjadi negative.

---

# 42. Cart and Booking Draft Reservation Rule

Cart tidak reserve stock.

Booking draft tidak reserve appointment slot.

Release 1 tidak menggunakan temporary booking hold system secara default.

Final authority selalu Place Order / Confirm Booking transaction.

---

# 43. Inventory Timing

Untuk marketplace order, inventory consumed/reserved saat Order successfully placed.

Tidak menunggu manual payment verification.

Cancellation/refund dapat mengembalikan inventory sesuai policy.

---

# 44. Inventory Model

Hybrid model:

```text
Inventory.current_quantity
+
InventoryAdjustment ledger
```

InventoryAdjustment conceptual:

```text
id
variant_id
delta
reason
source_type
source_id
actor_id
created_at
note
```

---

# 45. Payment Persistence

Payment bukan sekadar field di Order.

Conceptual PaymentRecord:

```text
order_id
method
amount
status
proof_media_id
submitted_at
verified_at
verified_by
reason
```

Future multi-payment/refund behavior tetap memungkinkan.

---

# 46. Status History

Important lifecycle dapat menggunakan:

```text
current status on main row
+
append-style status history
```

Ini memberi efficient reads + auditability.

BarberKece tidak menggunakan full event sourcing pada Release 1.

---

# 47. Transactional Outbox

Secondary asynchronous effects menggunakan transactional outbox.

Conceptual:

```text
OutboxEvent
├── id
├── event_type
├── aggregate_type
├── aggregate_id
├── payload
├── created_at
├── processed_at
├── retry_count
└── last_error
```

Outbox record ditulis pada transaction yang sama dengan business mutation.

---

# 48. Audit Persistence

Business audit terpisah dari technical logging.

Conceptual:

```text
AuditLog
├── actor_id
├── action
├── resource_type
├── resource_id
├── relevant_before
├── relevant_after
├── reason
└── timestamp
```

Sensitive values harus redacted.

---

# 49. JSONB Usage

JSONB digunakan secara controlled.

Good candidates:

- small flexible configuration
- filter calibration metadata
- technical event payload
- audit summary

Core domain tidak disimpan sebagai giant JSON blobs.

---

# 50. Money Representation

Currency disimpan sebagai integer whole Rupiah.

Example:

```text
40000
```

Tidak menggunakan floating-point currency.

---

# 51. Search Direction

R1 menggunakan PostgreSQL search capability jika diperlukan.

Candidates:

- ILIKE
- pg_trgm
- full-text search

Tidak membutuhkan Elasticsearch atau Algolia sebagai hard dependency.

---

# 52. Database Migrations

Semua schema change melalui version-controlled migrations.

Environment databases terpisah.

Migration production tidak dilakukan manual tanpa record.

Preferred migration strategy:

```text
Expand
→ Deploy compatible code
→ Contract later
```

---

# 53. Media Architecture

Binary media berada di object storage.

PostgreSQL menyimpan metadata.

Visibility classes:

```text
PUBLIC
PRIVATE
TEMPORARY
```

Optional future:

```text
INTERNAL
```

---

# 54. Media Categories

```text
PUBLIC CONTENT
├── Hairstyle Photos
├── Product Images
├── Barber Portraits
└── Brand / Editorial Assets

FILTER ASSETS
├── Hairstyle Overlay Assets
├── Calibration Metadata
└── Supporting Technical Assets

PRIVATE CUSTOMER MEDIA
├── Saved Preview
├── Haircut Result Photo
└── Customer Reference Media

PRIVATE OPERATIONAL MEDIA
└── Payment Proof
```

---

# 55. Private Media Access

Private media tidak memiliki permanent public URL.

Preferred flow:

```text
Authenticated Request
→ Server Authorization
→ Short-Lived Signed Access
→ Object Storage
```

Client menggunakan media ID.

Client tidak boleh request arbitrary storage key.

---

# 56. Media Upload Pattern

Preferred:

> Direct-to-object-storage upload using short-lived upload authorization.

Flow:

```text
Browser
→ Request Upload Intent
→ Server validates use case
→ Short-lived upload authorization
→ Browser uploads to object storage
→ Finalize
→ Validate/process
→ Attach to business entity
```

Server-proxied upload tetap valid fallback.

---

# 57. Upload Validation

Validate:

- declared MIME
- actual file signature
- allowed file type
- size
- dimensions
- image decode
- use-case limit

User filename tidak menjadi trusted storage key.

Arbitrary user-uploaded SVG tidak didukung by default.

---

# 58. Image Processing

Pipeline:

```text
decode
→ validate
→ normalize orientation
→ strip unnecessary EXIF
→ resize
→ compress
→ generate variants
→ mark READY
```

Customer media harus menghilangkan EXIF sensitif yang tidak diperlukan, termasuk GPS metadata.

---

# 59. Image Variants

Conceptual:

```text
thumbnail
small
medium
large
original (optional)
```

Responsive delivery dipilih berdasarkan screen.

Original multi-megabyte file tidak dikirim ke cards/grid.

---

# 60. Hairstyle Media Semantics

Hairstyle media dapat memiliki semantic angle:

```text
front
three-quarter
side
back
texture/detail
```

Relation juga dapat menyimpan:

```text
sort_order
is_primary
alt_text
```

---

# 61. Virtual Filter Assets

Virtual filter assets diperlakukan sebagai technical media.

Metadata dapat mencakup:

```text
asset_id
hairstyle_id
version
format
anchor points
reference scale
rotation calibration
offsets
supported orientations
render layer
calibration version
status
```

Exact schema diputuskan di Virtual Hair Filter Specification.

---

# 62. Filter Asset Versioning

Published filter assets bersifat versioned/immutable.

Asset tidak dioverwrite in-place ketika version berubah.

Cache invalidation dilakukan melalui new version/key.

---

# 63. Camera Privacy

Camera stream adalah transient device data.

Default:

```text
Camera Frame
→ Local Processing
→ Render
→ Discard
```

Tidak ada continuous upload.

Tidak ada background recording.

---

# 64. Capture vs Save

Capture dan Save berbeda.

Capture dapat tetap device-local.

Save berarti explicit upload ke BarberKece account.

Tidak ada silent cloud saving.

---

# 65. Haircut Photo Consent

Haircut Result Photo:

- optional
- private by default
- consent-based
- associated with Hair History

Consent metadata harus tersimpan.

---

# 66. Payment Proof Media

Payment proof:

- private
- scoped to payment/order
- short-lived authorized access
- never permanent public URL
- never exposed in analytics/logging

---

# 67. Media Cleanup

Temporary/orphan media harus dibersihkan oleh background job.

Failed processing dan abandoned uploads tidak dibiarkan menumpuk.

Deletion logically:

```text
Revoke accessibility
→ detach/remove relation
→ delete storage object
→ finalize metadata state
```

---

# 68. External Integration Architecture

External providers diisolasi menggunakan adapter boundary.

Core domain tidak import vendor SDK langsung.

Examples:

```text
NotificationPort
AnalyticsPort
StoragePort
PaymentProviderPort
```

Implementations hidup di infrastructure layer.

---

# 69. Email Integration

Email digunakan untuk:

- account invitation
- password reset
- booking confirmation
- booking cancellation
- booking reschedule
- order confirmation
- payment verification result
- order ready for pickup

Email adalah asynchronous side effect.

Email failure tidak boleh rollback booking/order.

---

# 70. Notification Processing

Business event:

```text
AppointmentConfirmed
```

dapat menghasilkan:

```text
Notification
→ Email Channel
→ Provider Adapter
```

Notification retries harus bounded dan idempotent.

---

# 71. Analytics

Frontend analytics untuk interaction events.

Backend analytics untuk trusted transaction events.

Examples:

Frontend:

```text
style_viewed
filter_opened
product_viewed
checkout_started
```

Backend:

```text
booking_confirmed
order_placed
payment_verified
appointment_completed
```

Analytics failure tidak boleh block core product.

---

# 72. Analytics Privacy

Analytics tidak menerima:

- private images
- camera frames
- payment proofs
- password
- private notes

PII diminimalkan.

---

# 73. Manual Bank Transfer

Release 1 flow:

```text
Order
→ Bank Transfer
→ Customer Uploads Proof
→ AWAITING_VERIFICATION
→ Admin Review
→ Approve / Reject
```

Payment proof bukan payment truth.

Internal payment state hanya berubah melalui authorized Payment use case.

---

# 74. Future Payment Gateway

Future gateway support melalui provider adapter.

Webhook architecture:

```text
Provider
→ Webhook Endpoint
→ Signature Verification
→ Idempotency Check
→ Map Provider Event
→ Internal Payment Transition
```

Provider-specific statuses dipetakan ke canonical BarberKece payment states.

---

# 75. Integration Secrets

Secrets:

- never in browser bundle
- never committed
- never logged
- environment-managed

Examples:

```text
DATABASE_URL
SESSION_SECRET
EMAIL_API_KEY
STORAGE_SECRET
FUTURE_PAYMENT_SECRET
```

---

# 76. Performance Architecture

Principle:

> **Cache for speed, database for truth.**

Performance classes:

```text
Public Content
Transactional
Operational
Device-Heavy
```

---

# 77. Public Content Caching

Cache-friendly:

- Homepage
- Styles
- Style Detail
- Barbers
- Shop
- Product Detail
- public media
- filter assets
- CV models

Immutable/versioned technical assets dapat long-cache.

---

# 78. Non-Authoritative Cache

Never authoritative:

- final booking availability
- checkout stock
- payment status
- authorization
- account status
- order creation

Final mutation selalu validate live.

---

# 79. Redis Decision

Redis bukan mandatory dependency untuk Release 1.

Start with:

- browser cache
- CDN
- framework/server caching
- client server-state cache
- optimized PostgreSQL

Tambahkan distributed cache hanya berdasarkan measurement.

---

# 80. Availability Query Performance

Tidak ada one-query-per-slot.

Good conceptual strategy:

```text
Load business schedule
Load eligible barber schedules
Load relevant conflicts for requested window
Compute candidate slots in memory
```

Calendar summary dan detailed times dipisahkan.

---

# 81. N+1 Prevention

N+1 query adalah explicit anti-pattern.

Read models harus menggunakan:

- joins
- batch preloading
- projections
- query-specific DTOs

List endpoints tidak mengirim giant nested graphs.

---

# 82. Pagination

Growing collections harus paginated.

Examples:

- Orders
- Appointments
- Hair History
- Customers
- Inventory Adjustments
- Audit Logs

Offset dan cursor dipilih berdasarkan query semantics.

---

# 83. Feature-Level Code Splitting

Heavy features tidak masuk initial public bundle.

Especially:

```text
Virtual Filter CV runtime
WebGL renderer
Admin calendar
Operational admin code
```

Virtual Filter code load hanya saat feature dibutuhkan.

---

# 84. Virtual Filter Performance

Locked baseline:

```text
Target ≥ 20 FPS
Target visual response latency ≤ 150 ms
Preferred ~30 FPS on capable devices
```

Stability lebih penting daripada 60 FPS.

---

# 85. Adaptive Virtual Filter Quality

Potential modes:

```text
HIGH
STANDARD
LOW
```

May adjust:

- inference resolution
- inference frequency
- model complexity
- render resolution
- effect complexity

High-frequency landmarks/render loop tidak boleh berjalan melalui React/global state.

---

# 86. Virtual Filter Resource Cleanup

Saat keluar dari filter:

- stop camera tracks
- cancel animation frames
- dispose textures
- dispose model/runtime if needed
- release canvas resources
- remove event listeners

Background tab dapat pause/reduce processing.

---

# 87. Image Performance

Use:

- responsive image variants
- lazy loading below the fold
- eager/high-priority hero media
- known aspect ratio
- CDN public delivery

Layout space harus reserved untuk meminimalkan CLS.

---

# 88. Performance Telemetry

Key performance signals:

```text
LCP
INP
CLS
booking_availability_latency
booking_confirmation_latency
checkout_place_order_latency
filter_model_load_time
filter_first_tracking_time
```

Virtual Filter harus diuji di realistic mobile devices/network.

---

# 89. Error Architecture

Known failures menggunakan stable machine-readable error code.

Conceptual response:

```json
{
  "error": {
    "code": "BOOKING_SLOT_UNAVAILABLE",
    "message": "Slot tidak lagi tersedia.",
    "requestId": "..."
  }
}
```

Frontend tidak parse message untuk logic.

---

# 90. Error Categories

```text
Validation
Authentication
Authorization
Not Found
Business Rule
Conflict
Rate Limit
External Dependency
Infrastructure
Unexpected Internal
```

Known conflict tidak boleh jadi generic `500`.

---

# 91. Conflict Recovery

Examples:

```text
BOOKING_SLOT_UNAVAILABLE
PRODUCT_OUT_OF_STOCK
PRODUCT_PRICE_CHANGED
RESOURCE_VERSION_CONFLICT
```

UX harus:

- menjelaskan apa yang berubah
- mempertahankan valid progress
- reset hanya invalid state
- menawarkan next step

---

# 92. Critical Mutation Idempotency

Critical actions membutuhkan duplicate-request protection.

Examples:

- Confirm Booking
- Place Order
- Verify Payment
- Refund
- Inventory Adjustment

Network timeout tidak boleh menghasilkan duplicated transaction saat client retry.

---

# 93. Ambiguous Outcome Handling

Scenario:

```text
Server committed
→ response lost
```

Client tidak boleh menganggap success atau failure.

Client harus resolve authoritative outcome melalui:

- same idempotency key retry
- operation/result lookup
- transaction reference

---

# 94. No Fake Success

Success UI muncul hanya setelah authoritative server confirmation.

Examples:

```text
You're Booked
Order Placed
Payment Verified
```

tidak boleh muncul berdasarkan optimistic assumption.

---

# 95. Background Job Reliability

Jobs menggunakan:

- bounded retry
- backoff
- idempotent handler
- final-failure state
- observability

Infinite retry tidak diperbolehkan.

Outbox processing mengasumsikan at-least-once delivery.

---

# 96. Dependency Failure Isolation

Examples:

Email down:

```text
Booking ✅
Order ✅
```

Analytics down:

```text
Core product ✅
```

Storage down:

```text
Booking without media ✅
Saved Preview upload ❌
Payment Proof upload ❌
```

Filter asset unavailable:

```text
Try-On degraded
Styles/Booking still usable
```

---

# 97. Offline Behavior

BarberKece bukan offline-first.

Allowed:

- preserve local cart/draft
- indicate offline
- retry safe reads

Not allowed:

- silently queue booking for future submission
- silently queue Place Order while offline

Transactional action harus revalidate after reconnect.

---

# 98. Server Clock Authority

Client clock tidak dipercaya untuk:

- cancellation cutoff
- reschedule cutoff
- booking horizon
- payment deadline
- other policy-sensitive timing

Server/business timezone is authoritative.

---

# 99. Graceful Degradation

If Recommendation unavailable:

```text
Browse Styles
```

If Virtual Filter unsupported:

```text
Style Gallery
Recommendation
Booking
```

If related product recommendation fails:

```text
Marketplace catalogue still works
```

Critical core paths harus tetap tersedia selama possible.

---

# 100. Observability Architecture

BarberKece memisahkan:

```text
Logs
Metrics
Traces
Product Analytics
Business Audit
```

Masing-masing punya purpose berbeda.

---

# 101. Structured Logging

Production logs structured.

Conceptual fields:

```text
timestamp
level
request_id
correlation_id
module
operation
actor_id?
resource_id?
error_code
duration_ms
result
release
environment
```

---

# 102. Sensitive Logging Policy

Never log:

- password
- session token
- reset/invite token
- cookie raw value
- private signed URL
- payment proof URL/content
- saved preview bytes
- haircut photos
- camera frames
- provider secrets

Central redaction required.

---

# 103. Request and Correlation IDs

Every request memiliki request ID.

Async workflows mempertahankan correlation melalui:

```text
request
→ use case
→ transaction
→ outbox
→ worker
→ provider
```

Debugging critical transaction harus traceable.

---

# 104. Technical Metrics

Track:

```text
HTTP count/error/latency
DB query latency
DB connection pool usage
transaction failures
lock waits/deadlocks
background queue depth
background failures
provider latency/failure
media processing failures
```

---

# 105. Booking Reliability Metrics

Track:

```text
booking_attempts
booking_confirmed
booking_conflicts
booking_validation_failures
booking_transaction_failures
booking_confirmation_latency
```

Double-book invariant breach harus dianggap highest severity incident.

---

# 106. Marketplace Reliability Metrics

Track:

```text
checkout_attempts
orders_placed
stock_conflicts
price_change_conflicts
order_transaction_failures
payment_verification_failures
```

Actual negative stock expected = 0.

---

# 107. Virtual Filter Telemetry

Privacy-safe signals:

```text
camera_permission_result
model_load_duration
first_tracking_time
tracking_loss_count
FPS bucket
low_performance_state
unsupported_device
asset_load_failure
```

Tidak ada per-frame telemetry atau raw camera data.

---

# 108. Audit vs Technical Log

Business audit harus berada di authoritative persistence.

Technical logs boleh gagal tanpa menggagalkan booking/order.

Critical audit yang menjadi invariant dapat ditulis dalam business transaction yang sama.

---

# 109. Alerts

Alert hanya untuk actionable conditions.

Severity direction:

```text
SEV-1 → transactional/data-integrity risk
SEV-2 → major feature degraded
SEV-3 → non-critical subsystem issue
SEV-4 → informational
```

Examples SEV-1:

- DB unavailable broadly
- double-book invariant breach
- negative inventory actual state
- duplicated orders
- payment corruption

---

# 110. Health Checks

Application supports liveness/readiness concept.

Readiness considers critical dependencies such as DB.

Email/analytics outage tidak otomatis membuat whole app unready.

Startup harus fail clearly jika required secrets/config hilang.

---

# 111. Deployment Architecture

Production topology:

```text
Internet
  ↓
HTTPS / CDN / Edge
  ↓
BarberKece Web Application
  ├── PostgreSQL
  ├── Object Storage
  └── Outbox
        ↓
      Worker
        ├── Email
        ├── Media Processing
        ├── Cleanup
        └── Secondary Jobs
```

---

# 112. Runtime Process Types

Single codebase dapat memiliki:

```text
web
worker
migration
```

Ini bukan microservices.

`web` handles HTTP.

`worker` handles async jobs.

`migration` performs schema migration and exits.

---

# 113. Repository Direction

R1 menggunakan single repository.

Frontend, backend, worker, migrations, tests, shared contracts, dan config hidup dalam one coherent codebase.

Exact repository structure akan dikunci pada Repository & Code Architecture.

---

# 114. Environments

Minimum:

```text
LOCAL
TEST
STAGING
PRODUCTION
```

Setiap environment memiliki isolated data/storage.

Transactional database tidak pernah dibagi antar environment.

---

# 115. Local Development

Local development harus dapat berjalan tanpa production cloud credentials.

Default lightweight direction:

```text
Native Node.js LTS
pnpm
BarberKece Web Application
BarberKece Worker
Native PostgreSQL
Local filesystem storage adapter for early development
Development email / console adapter
Debug analytics
```

Docker tidak digunakan sebagai default maupun requirement local development BarberKece.

Developer tidak boleh diwajibkan meng-install Docker Desktop atau menjalankan Docker Compose untuk menjalankan project.

PostgreSQL dijalankan secara native pada development machine. Web app dan worker berjalan langsung sebagai Node.js processes.

Production storage tetap menggunakan abstraction S3-compatible; local filesystem adapter hanya development implementation dan tidak boleh bocor ke Domain/Application layer.

Development email dapat menggunakan lightweight console/test adapter. Production email tetap melalui provider adapter.

Docker/containerization hanya boleh menjadi optional convenience atau future deployment artifact jika kemudian diminta secara eksplisit.

---

# 116. Staging

Staging strongly recommended untuk:

- migration testing
- media pipeline
- E2E booking/order
- auth
- Virtual Filter asset delivery
- deployment smoke testing

Staging menggunakan synthetic data.

Production customer data/private media tidak disalin casually ke staging.

---

# 117. Production Security

Production requires:

- HTTPS
- Secure cookies
- restricted DB access
- least-privilege storage credentials
- server-side secrets
- controlled infrastructure access

Browser tidak menerima broad cloud credentials.

---

# 118. Same-Origin Direction

Frontend/backend same-origin preferred.

Benefits:

- cookie auth simpler
- CSRF simpler
- less CORS complexity
- fewer environment mistakes

Logical API dapat berada di `/api/*`.

---

# 119. Stateless Application Processes

Persistent business data tidak disimpan di local application disk.

Durable state:

```text
PostgreSQL
Object Storage
```

Local filesystem hanya temporary jika diperlukan.

---

# 120. Initial Production Scale

Reasonable R1 baseline:

```text
1 web runtime
1 worker runtime
1 PostgreSQL database
1 object storage
```

Scale berdasarkan measured bottlenecks.

Tidak berdasarkan enterprise convention.

---

# 121. CI Pipeline

Minimum CI:

```text
Install Dependencies
→ Lint
→ Type Check
→ Unit Tests
→ Integration Tests
→ Build
```

Targeted E2E/migration/security checks dapat ditambahkan.

Main branch sebaiknya tetap deployable.

---

# 122. Branch Strategy

Simple workflow:

```text
main
feature/*
fix/*
```

Short-lived branches.

Heavy GitFlow tidak diperlukan.

---

# 123. Deployment and Migration

Migration dikontrol deployment pipeline.

Jangan run migrations independently dari setiap web instance startup.

Preferred production change:

```text
compatible migration
→ deploy compatible application
→ later remove deprecated structure
```

---

# 124. Rollback Strategy

Application rollback harus didukung.

Database rollback tidak diasumsikan selalu aman.

Backward-compatible migrations penting agar previous app version dapat tetap compatible ketika rollback diperlukan.

Destructive migrations harus carefully planned.

---

# 125. Backups and Restore

Production database harus memiliki automated backup.

Jika provider mendukung, point-in-time recovery preferred.

Backup policy harus termasuk:

> tested restore procedure

Restore diuji ke isolated environment.

---

# 126. Object Storage Recovery

Database backup tidak cukup jika media hilang.

Public first-party assets harus recoverable.

Private media mengikuti privacy/retention policy.

---

# 127. Feature Flags and Kill Switches

Useful for risky capabilities:

```text
virtual_try_on_enabled
manual_transfer_enabled
marketplace_enabled
```

Feature flags tidak boleh menggantikan proper authorization.

Critical mutation disable harus juga enforced server-side.

---

# 128. Deployment Runbook

Production operations harus memiliki documented procedure untuk:

- deploy
- migrate
- rollback app
- pause/resume worker
- maintenance mode
- restore DB
- rotate secrets
- bootstrap admin
- investigate worker backlog
- recover bad media jobs

---

# 129. Explicit Architectural Invariants

The following invariants are locked for BarberKece Release 1.

## Core Architecture

1. One application, three protected role spaces.
2. Modular monolith for Release 1.
3. Explicit domain boundaries.
4. Relational persistence is primary transactional truth.
5. Browser is never authoritative for permissions, prices, stock, or final availability.
6. Admin uses the same business rules rather than bypassing domains.

## Frontend

7. Frontend is feature-oriented.
8. Server rendering preferred for public/content surfaces.
9. Client-heavy boundaries only where interaction/device APIs require them.
10. Global state is exceptional.
11. Critical transactions are never optimistic-confirmed.
12. Virtual Try-On high-frequency state is isolated from normal React/global state.
13. Responsive design may recompose markup.
14. Guest task state survives authentication where safe.

## Authentication & Authorization

15. Session-based authentication is the R1 default.
16. Long-lived auth credentials are never stored in localStorage.
17. Public signup always creates CUSTOMER.
18. BARBER and ADMIN are provisioned/invited.
19. One primary role per account in R1.
20. Resource ownership/scope is checked in addition to role.
21. Barber access to customer data is contextual and minimal.
22. Privilege changes revoke/refresh sessions.
23. Authentication endpoints are rate limited.
24. Authorization policy is explicit, not scattered.

## Data

25. PostgreSQL is primary transactional source of truth.
26. Binary media lives in object storage.
27. Internal IDs are opaque and non-sequential.
28. Human booking/order references are separate.
29. Absolute timestamps use UTC.
30. Business scheduling uses configured local timezone.
31. Availability is derived, not persisted as canonical permanent slot rows.
32. Historical transaction data stores required snapshots.
33. Foreign keys/constraints are final integrity defense.
34. Inventory is auditable.
35. Payment is separate from Order.
36. Money is integer Rupiah.
37. Schema changes are migration-controlled.

## Reservation & Marketplace

38. Displayed availability is not a guarantee.
39. Booking is revalidated inside final transaction.
40. Cart does not reserve stock.
41. Booking draft does not reserve slot.
42. Checkout revalidates latest price and stock.
43. Order placement is transaction-safe.
44. Inventory must never become negative.
45. State transitions are explicit actions, not arbitrary PATCH.
46. Critical mutations are idempotency-aware.

## Media & Privacy

47. Private media never relies on permanent public URLs.
48. Private media access requires authorization.
49. Client uses media ID, not arbitrary storage key.
50. Camera streams remain local/transient by default.
51. Capturing a preview does not imply cloud saving.
52. Saved previews require explicit action.
53. Haircut photos require consent.
54. Payment proofs remain private.
55. Temporary/orphan media is cleaned automatically.
56. Object storage is not authority for ownership/consent.

## Integrations

57. External vendors are hidden behind adapters.
58. Email and analytics are secondary effects.
59. Secondary failures do not invalidate committed core transactions.
60. Transactional outbox is preferred for async effects.
61. Retries are bounded and idempotent.
62. Webhooks require verification and idempotency.
63. Vendor statuses map to BarberKece canonical domain states.
64. Recommendation has no required external AI API.
65. Virtual Try-On has no required cloud GPU inference.

## Performance

66. Cache accelerates but does not define truth.
67. Public immutable assets can be aggressively cached.
68. Booking, stock, payment, and authorization validate live.
69. Redis is not mandatory for R1.
70. Availability is calculated in batches.
71. N+1 query behavior is prohibited.
72. Heavy features are code-split.
73. Virtual Filter target is at least 20 FPS.
74. Virtual Filter target visual response latency is at most approximately 150 ms.
75. Virtual Filter adapts to device capability.
76. Camera/model/render resources are explicitly released.

## Reliability

77. BarberKece never displays transactional success before authoritative server confirmation.
78. Known failures have stable error codes.
79. Recoverable failures preserve progress.
80. Critical writes are never blindly retried.
81. Ambiguous outcomes resolve against server truth.
82. Background handlers assume at-least-once delivery.
83. Client clock is not policy authority.
84. Strong consistency is required at booking/inventory/order/payment mutation boundaries.
85. Business audits and technical logs are separate.
86. Production supports health checks and graceful shutdown.

## Observability

87. Logs, metrics, traces, analytics, and audit are separate concerns.
88. Production logs are structured.
89. Every request has a request ID.
90. Async workflows remain correlatable.
91. Sensitive images/tokens/private URLs are never logged.
92. Metrics use low-cardinality dimensions.
93. Booking/order/inventory/payment reliability have dedicated metrics.
94. Critical invariant breaches receive highest severity.
95. Observability provider failure does not block core transactions.

## Deployment

96. Local, test, staging, and production are isolated.
97. Production requires HTTPS.
98. Same-origin frontend/backend preferred for R1.
99. Application processes are stateless for durable business state.
100. Production secrets are environment-managed.
101. CI verifies code before deployment.
102. Database migration is deployment-controlled.
103. Backward-compatible migrations are preferred.
104. App rollback is supported; DB rollback is not assumed safe.
105. Backup strategy includes tested restore.
106. No mandatory Kubernetes, Redis, Kafka, Elasticsearch, or GPU server infrastructure for R1.
107. Scaling follows observed bottlenecks.
108. Deployment/recovery procedures are documented.

---

# 130. Explicitly Deferred Decisions

The following decisions are intentionally deferred to downstream technical artifacts.

## Database Schema

Deferred:

- exact table names
- exact column names
- exact foreign keys
- exact indexes
- exact unique constraints
- exact enum representation
- exact audit/status-history schema
- exact module schema grouping

---

## Reservation Engine Specification

Deferred:

- exact overlap prevention mechanism
- exclusion constraint vs lock/advisory strategy
- exact slot-generation implementation
- exact Any Available Barber algorithm implementation
- exact cancellation/reschedule policy calculations
- schedule conflict modeling edge cases
- appointment overlap database strategy

---

## Recommendation Engine Specification

Deferred:

- exact normalized score formula
- exact missing-value normalization implementation
- exact hard constraints
- exact tie-breaking
- recommendation metadata structure
- explanation generator structure
- recommendation session persistence behavior

---

## Virtual Hair Filter Specification

Deferred:

- exact face landmark model
- exact CV runtime
- exact renderer
- exact asset representation
- exact anchor/calibration system
- exact smoothing/interpolation
- exact worker/offscreen rendering strategy
- exact device capability detection
- exact adaptive-quality thresholds

---

## Marketplace Technical Specification

Deferred:

- exact order state transition matrix
- exact payment verification states
- exact cancellation/refund stock restoration policy
- exact fulfillment schema
- exact manual transfer timeout/expiration
- exact inventory reservation semantics around unpaid orders
- exact marketplace recommendation data model

---

## API Specification

Deferred:

- endpoint names
- request/response schemas
- pagination format
- error details contract
- endpoint-level authorization
- idempotency header format
- versioning strategy
- media upload contract

---

## Security & Privacy Specification

Deferred:

- exact data retention periods
- exact session expiry numbers
- exact admin re-auth rules
- exact password policy
- account deletion/anonymization procedure
- privacy access logging
- audit retention
- private media retention
- security headers
- abuse/rate-limit thresholds

---

## Final Tech Stack

Deferred:

- frontend framework
- backend framework
- ORM/query layer
- auth library
- database provider
- object storage provider
- email provider
- analytics provider
- observability provider
- deployment platform
- image processing library
- CV runtime
- testing framework selection

Architecture must not prematurely depend on one provider until this decision is finalized.

---

# 131. Cross-Domain Flow — Recommendation to Booking

```text
Customer
→ Find My Style
→ Recommendation Engine
→ Recommended Hairstyle
→ Style Detail / Virtual Try-On
→ Select Hairstyle
→ Booking Draft
→ Service
→ Barber Preference
→ Date
→ Time
→ Review
→ Authenticate if required
→ Server Revalidates
→ Transaction
→ Appointment Confirmed
→ Outbox
→ Notification / Analytics
```

Important:
- recommendation result does not guarantee service/barber availability;
- selected hairstyle context persists into booking;
- auth preserves booking draft;
- success shown only after commit.

---

# 132. Cross-Domain Flow — Booking to Hair History

```text
Appointment Confirmed
→ Checked In
→ In Service
→ Completed
→ Haircut Completion Data
→ Optional HairHistoryEntry
→ Optional Barber Notes
→ Optional Customer Feedback
→ Optional Consented Final Photo
→ Optional Product Recommendation
```

Appointment remains operational record.

Hair History remains personal grooming record.

---

# 133. Cross-Domain Flow — Hair History to Marketplace

```text
Hair History
→ Current / Past Look
→ "Shop This Look"
→ Curated Product Recommendation
→ Product Detail
→ Cart
→ Checkout
→ Place Order
→ Order + Inventory Transaction
→ Payment
→ Fulfillment
```

Product recommendation remains rule-based curated metadata on R1.

---

# 134. Cross-Domain Flow — Virtual Try-On

```text
Hairstyle Context
→ Try Hairstyle
→ Load CV Runtime
→ Request Camera Permission
→ Load Model
→ Load Selected Filter Asset
→ Face Tracking
→ Local Rendering
→ User Switches Style
→ Optional Capture
→ Optional Explicit Save
→ Optional Select This Style
→ Booking Context
```

No camera frame upload by default.

---

# 135. Cross-Domain Flow — Manual Transfer

```text
Place Order
→ Order Created
→ Inventory Consumed/Reserved
→ Payment = Awaiting/Unpaid
→ Customer Selects Manual Transfer
→ Upload Payment Proof
→ Payment = Awaiting Verification
→ Admin Reviews
→ Verify / Reject
→ Payment State Transition
→ Order State Transition
→ Audit + Outbox
```

Payment proof is evidence, not automatic truth.

---

# 136. Reliability Boundaries by Feature

## Booking

If email fails:
- booking stays confirmed.

If analytics fails:
- booking stays confirmed.

If DB fails:
- booking cannot be confirmed.

If availability display is stale:
- final transaction rejects conflict safely.

---

## Marketplace

If product recommendation fails:
- catalogue remains usable.

If payment proof upload fails:
- order remains valid according to current order/payment state;
- user can retry upload if policy allows.

If analytics fails:
- order still works.

If inventory validation fails:
- Place Order does not succeed.

---

## Virtual Try-On

If camera permission denied:
- recommendation/style/booking remain usable.

If model fails:
- Virtual Try-On degrades only.

If selected asset fails:
- filter shows recoverable feature error.

If save upload fails:
- local capture can remain available if feasible.

---

# 137. Architectural Anti-Patterns

BarberKece explicitly avoids:

- microservices without demonstrated need
- giant AppService
- giant AdminService
- route handlers containing business logic
- raw DB access scattered across modules
- generic CRUD for critical transactional domains
- arbitrary status PATCH
- trusting frontend price/availability/stock
- floating-point money
- deleting transaction history
- permanent public URLs for private media
- storing auth token in localStorage
- sending camera frames to server by default
- cloud AI dependency for recommendation
- cloud GPU dependency for Virtual Try-On
- Redis before measurement
- one query per time slot
- N+1 ORM access
- success UI before server commit
- blind retry of critical mutations
- infinite background retries
- analytics blocking transactions
- email rollback of booking/order
- secrets in frontend bundle
- environment sharing one DB
- migrations on every app startup
- demo seed in production
- preview environments connected to production data

---

# 138. Recommended Next Technical Artifacts

Technical Design consolidation is complete.

Recommended sequence after this document:

```text
STEP 13 — Database Schema
STEP 14 — Reservation Engine Specification
STEP 15 — Recommendation Engine Specification
STEP 16 — Virtual Hair Filter Technical Specification
STEP 17 — Marketplace Technical Specification
STEP 18 — API Specification
STEP 19 — Security & Privacy Specification
STEP 20 — Test Plan
STEP 21 — Final Tech Stack
STEP 22 — Repository & Code Architecture
STEP 23 — Implementation Plan
STEP 24 — AGENTS.md
```

---

# 139. Technical Design Completion Status

```text
STEP 1 — Architecture Foundation          ✅
STEP 2 — Frontend Architecture            ✅
STEP 3 — Backend Architecture             ✅
STEP 4 — Authentication & Authorization   ✅
STEP 5 — Data & Persistence Architecture  ✅
STEP 6 — Media / Storage Architecture     ✅
STEP 7 — Integration Architecture         ✅
STEP 8 — Performance & Caching            ✅
STEP 9 — Error / Reliability Architecture ✅
STEP 10 — Observability                   ✅
STEP 11 — Deployment Architecture         ✅
STEP 12 — Technical Design Consolidation  ✅
```

---

# 140. Final Architecture Summary

BarberKece Release 1 is designed as a production-capable modular monolith.

The system uses:

```text
Responsive Web Application
+
Feature-Oriented Frontend
+
Modular Monolith Backend
+
PostgreSQL
+
Object Storage
+
Background Worker
+
Transactional Outbox
+
Client-Side Computer Vision
```

The architectural philosophy is:

> Keep the system simple where scale does not require complexity, and be strict where correctness, privacy, transactions, and user trust require discipline.

BarberKece therefore optimizes for:

- production-grade correctness;
- explicit business boundaries;
- privacy-safe media handling;
- explainable recommendation;
- real-time client-side Virtual Try-On;
- transaction-safe reservation;
- auditable marketplace inventory/payment;
- graceful degradation;
- deployability without enterprise infrastructure overhead.

This document is now the technical architecture baseline for all downstream BarberKece engineering specifications.

---

# Technical Design Amendment — Non-Docker Development Baseline

Status: **LOCKED**

This amendment synchronizes the previously locked STEP 21, STEP 22, and STEP 23 decisions with the explicit BarberKece requirement that Docker must not be required because the development machine should use a lightweight setup.

If an older statement in STEP 21–23 conflicts specifically with local Docker/Docker Compose/MinIO/Mailpit requirements, **this amendment supersedes that older statement**. All unrelated STEP 21–23 decisions remain unchanged.

## STEP 21 Amendment — Final Tech Stack

The BarberKece core stack remains unchanged except for local infrastructure tooling.

### Default Local Development Stack

```text
Operating System / Developer Machine
├── Node.js LTS
├── pnpm
├── Next.js Web Application
├── Node.js Worker
├── PostgreSQL installed natively
├── Local filesystem media/storage adapter
└── Development email / console adapter
```

Rules:

1. Docker is not required for BarberKece R1 development.
2. Docker Desktop is not part of the default setup.
3. Docker Compose is not part of the default setup.
4. PostgreSQL remains the authoritative relational database and runs natively during normal local development.
5. The web application and worker run directly as Node.js processes.
6. The object-storage architecture remains S3-compatible behind a port/adapter.
7. Early local development may use a filesystem-backed storage adapter.
8. Production direction may use Cloudflare R2 or another compatible managed object-storage provider.
9. Development email may use a console/test adapter.
10. Production email remains behind the configured provider adapter, with Resend remaining the preferred direction unless changed later.
11. CI and production must not assume that a developer has Docker installed.
12. A VPS is not required by the BarberKece architecture.
13. Production should be compatible with managed Node hosting, managed PostgreSQL, managed S3-compatible object storage, and a managed email provider.
14. Docker/containerization may only be optional or introduced later through an explicit decision.
15. No Docker-specific implementation may leak into Domain/Application code.

### Production Direction

```text
Browser
   ↓
HTTPS / CDN
   ↓
Node-capable Web Hosting
   ├── Managed PostgreSQL
   ├── S3-compatible Object Storage
   └── Outbox
         ↓
   Node-capable Worker / Job Runtime
         └── Email Provider
```

Production remains provider-independent. The architecture does not require a self-managed VPS.

## STEP 22 Amendment — Repository & Code Architecture

The canonical repository remains a pnpm workspace, but a mandatory `docker/` directory is removed.

Updated baseline:

```text
barberkece/
├── apps/
│   ├── web/
│   └── worker/
├── packages/
│   ├── core/
│   ├── database/
│   ├── contracts/
│   ├── config/
│   ├── infrastructure/
│   └── testing/
├── tooling/
├── docs/
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── .env.example
├── AGENTS.md
└── README.md
```

Rules:

1. `docker/`, `docker-compose.yml`, and equivalent container files are not required baseline repository artifacts.
2. Repository setup documentation must prioritize the native non-Docker workflow.
3. Scripts must not require Docker to start PostgreSQL, the web app, or the worker.
4. `packages/infrastructure` is the shared package for concrete platform and provider adapters (such as `LocalFilesystemMediaAdapter` and future development email/console adapters), implementing port contracts defined in `packages/core`.
5. Dependency direction: `packages/infrastructure` → `packages/core`. `packages/core` contains pure domain models, application use cases, ports, and domain errors, and must never import or depend on `packages/infrastructure`, Node filesystem APIs, or provider SDKs.
6. Applications (`apps/web`, `apps/worker`) compose and inject concrete adapters from `packages/infrastructure` and repositories from `packages/database` into application use cases.
7. `packages/core` remains unaware of native PostgreSQL installation details, filesystem paths, hosting provider, or Docker.
8. If optional container support is added later, it must remain an optional developer convenience and not become a repository prerequisite.

All other STEP 22 dependency directions, module boundaries, naming rules, testing structure, server/client boundaries, and architecture rules remain unchanged.

## STEP 23 Amendment — Implementation Plan

PHASE 0 / M0 must use the lightweight non-Docker bootstrap.

### Updated PHASE 0 — Repository Bootstrap

```text
01. Verify Node.js LTS
02. Enable/install pnpm
03. Initialize Git repository
04. Initialize pnpm workspace
05. Create apps/web
06. Create apps/worker
07. Create packages/core
08. Create packages/database
09. Create packages/contracts
10. Create packages/config
11. Create packages/infrastructure
12. Create packages/testing
13. Configure TypeScript
14. Configure Next.js
15. Configure Tailwind CSS
16. Configure ESLint + Prettier
17. Configure environment validation
18. Install PostgreSQL natively
19. Create local BarberKece PostgreSQL database
20. Configure Drizzle
21. Create migration infrastructure
22. Create local filesystem media adapter foundation
23. Create development email / console adapter foundation
24. Bootstrap worker process
25. Add logging + request ID foundation
26. Configure Vitest
27. Configure Playwright baseline
28. Configure GitHub Actions CI
29. Create .env.example
30. Create developer README/setup instructions
```

Explicitly removed from the default Phase 0:

```text
Docker Desktop
Docker Compose
Docker PostgreSQL
MinIO container
Mailpit container
```

### Updated M0 Success Path

A new developer should be able to reach:

```text
git clone
↓
pnpm install
↓
configure native PostgreSQL
↓
copy/configure .env
↓
pnpm db:migrate
↓
pnpm db:seed
↓
pnpm dev
↓
BarberKece running
```

The exact script names may be finalized during repository bootstrap, but the workflow must not require Docker.

### Updated M0 Definition of Done

```text
✓ Web application runs natively
✓ Worker runs natively
✓ Native PostgreSQL connection works
✓ Drizzle migrations work
✓ Development storage adapter works
✓ Development email adapter works
✓ Environment validation works
✓ Lint passes
✓ Typecheck passes
✓ Tests pass
✓ Production build passes
✓ CI passes
✓ README documents a non-Docker setup
```

All later STEP 23 milestones, dependency ordering, integrity gates, concurrency gates, security requirements, and Release 1 scope remain unchanged.

---

# Amendment Invariants

1. Docker is not a BarberKece R1 prerequisite.
2. Native Node.js + pnpm is the default application runtime for local development.
3. Native PostgreSQL is the default local database.
4. Local development must remain lightweight.
5. Local filesystem storage is development-only and remains behind an abstraction.
6. Production durable media remains object-storage based.
7. Development email may be lightweight; production email remains provider-backed.
8. No VPS is required by architecture.
9. Managed production services are acceptable and preferred when they reduce operational burden.
10. Removing Docker must not weaken database correctness, transactions, security, tests, worker behavior, or production architecture.

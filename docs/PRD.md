# Product Requirements Document (PRD)
# BarberKece

**Document Type:** Product Requirements Document  
**Product:** BarberKece  
**Platform:** Responsive Web Application, mobile-first  
**Document Status:** Product baseline for design, technical design, and implementation  
**Primary Language:** Bahasa Indonesia  
**Version:** 1.0  
**Scope:** End-to-end product definition for the first production-grade release, including Smart Reservation, Hair Intelligence, Real-Time Virtual Hair Filter, Marketplace, and its immediate evolution

---

# 1. Executive Summary

BarberKece adalah **personalized digital barbershop platform** yang membantu pelanggan:

1. menemukan model rambut yang sesuai dengan karakteristik dan preferensinya;
2. mencoba model rambut secara real-time melalui kamera menggunakan Virtual Hair Filter;
3. melakukan reservasi potong rambut tanpa proses chat bolak-balik;
4. memilih barber favorit bila memiliki langganan, atau membiarkan sistem memilih barber yang tersedia;
5. menyimpan riwayat haircut dan feedback agar pengalaman berikutnya semakin personal.

BarberKece **bukan** sekadar website booking barbershop dan **bukan** generic management system.

Core value proposition produk adalah:

> **Discover → Visualize → Decide → Book → Experience → Learn**

BarberKece harus memberikan pengalaman yang cepat, jelas, personal, dan mudah digunakan terutama melalui smartphone.

Tiga fitur inti produk:

- **Haircut Knowledge & Recommendation System**
- **Real-Time Virtual Hairstyle Filter**
- **Smart Reservation System**

Marketplace merupakan fitur resmi BarberKece dan termasuk dalam scope release pertama sebagai **supporting commerce experience** yang terhubung dengan hairstyle personalization, tanpa menggeser tiga core differentiator utama produk.

---

# 2. Product Vision

## 2.1 Vision Statement

> Menjadi platform digital barbershop yang membantu pelanggan membuat keputusan haircut dengan lebih percaya diri, melihat gambaran hairstyle sebelum dipotong, dan melakukan reservasi secara efisien tanpa proses yang membingungkan.

## 2.2 Product Identity

BarberKece harus terasa seperti:

- personal hair assistant;
- virtual hairstyle discovery tool;
- reservation assistant;
- digital connection antara customer dan barber.

BarberKece tidak boleh terasa seperti:

- website profil barbershop biasa;
- template booking generik;
- katalog hairstyle statis;
- dashboard CRUD yang hanya mengganti nama entitas;
- e-commerce yang kebetulan menjual produk rambut.

---

# 3. Product Goals

## 3.1 Primary Goals

### G1 — Mempermudah keputusan hairstyle

User yang belum tahu ingin memotong rambut seperti apa harus dapat menemukan beberapa pilihan yang relevan dan memahami alasan rekomendasinya.

### G2 — Mengurangi uncertainty sebelum haircut

User harus dapat mencoba hairstyle secara virtual melalui kamera sebelum membuat keputusan.

### G3 — Mengurangi friction reservasi

User harus dapat melakukan booking tanpa:

- bertanya jadwal kosong melalui chat;
- menghitung durasi;
- mengetik waktu manual;
- menunggu konfirmasi admin;
- atau memilih barber bila memang tidak mempunyai preferensi.

### G4 — Menghubungkan discovery dengan booking

Recommendation dan Virtual Hair Filter tidak boleh berhenti sebagai fitur eksplorasi.

User harus dapat melanjutkan:

```text
Hairstyle
↓
Try
↓
Select
↓
Book This Style
↓
Reservation
```

### G5 — Membangun personalization

Sistem harus memiliki fondasi untuk memahami:

- barber favorit;
- hairstyle sebelumnya;
- rating haircut;
- feedback;
- preferensi maintenance;
- preferensi style.

---

# 4. Non-Goals

Hal berikut **bukan tujuan utama release pertama**:

- aplikasi Android native;
- iOS native application;
- marketplace multi-vendor / marketplace umum seperti e-commerce besar;
- inventory management;
- payroll barber;
- accounting;
- invoice management;
- POS system;
- loyalty program kompleks;
- queue-number system;
- AI generative hairstyle replacement setara studio visual profesional;
- payment gateway untuk reservasi;
- multi-branch enterprise management;
- social network;
- chat customer–barber;
- TikTok integration untuk mengambil filter;
- penggunaan TikTok Effect sebagai dependency produk.

Fitur tersebut dapat dipertimbangkan di masa depan, tetapi tidak boleh menghambat core experience.

---

# 5. Success Principles

Semua keputusan desain dan implementasi harus mengikuti prinsip berikut.

## 5.1 Minimal User Effort

Jika sistem dapat mengambil keputusan dengan aman, jangan meminta user melakukannya.

Contoh:

```text
Barber Preference:
Any Available Barber
```

harus menjadi default.

## 5.2 Prevent Invalid States

Jangan membiarkan user memilih sesuatu yang sebenarnya tidak tersedia.

Contoh:

- slot penuh harus disabled;
- barber cuti tidak boleh selectable;
- hairstyle asset unsupported tidak boleh muncul pada filter aktif.

## 5.3 Useful Recovery

Jika suatu pilihan tidak tersedia, sistem harus memberikan alternatif yang relevan.

Bukan:

> Barber tidak tersedia.

Tetapi:

> Andi tidak tersedia pukul 10:00.  
> Tersedia dengan Andi pukul 11:00 atau 13:00, atau pilih barber lain pukul 10:00.

## 5.4 Explainability

Recommendation harus menjelaskan alasan.

## 5.5 Mobile First

Semua core flow harus nyaman digunakan pada smartphone.

## 5.6 Privacy by Default

Camera frame atau selfie tidak disimpan ke server tanpa consent eksplisit.

---

# 6. Target Users

## 6.1 Primary Persona — Customer yang Belum Tahu Hairstyle

Karakteristik:

- ingin haircut;
- tidak mengetahui nama model rambut;
- memiliki referensi dari TikTok/Instagram/Pinterest;
- ingin tahu model yang cocok;
- takut hasil tidak sesuai ekspektasi.

Primary need:

> "Bantu saya menentukan hairstyle yang cocok dan tunjukkan kira-kira tampilannya."

---

## 6.2 Secondary Persona — Customer dengan Barber Favorit

Karakteristik:

- rutin haircut;
- sudah memiliki barber langganan;
- ingin booking cepat;
- tidak ingin barber random.

Primary need:

> "Saya mau booking barber langganan saya tanpa tanya jadwal lewat chat."

---

## 6.3 Secondary Persona — Customer Tanpa Preferensi Barber

Karakteristik:

- hanya ingin mendapatkan slot;
- tidak peduli siapa barber selama tersedia.

Primary need:

> "Saya mau dapat jadwal potong secepat mungkin."

---

## 6.4 Internal Persona — Barber

Primary needs:

- melihat jadwal hari ini;
- mengetahui customer berikutnya;
- mengetahui hairstyle reference;
- melihat note penting customer;
- memperbarui status appointment;
- memberikan haircut note setelah layanan selesai.

---

## 6.5 Internal Persona — Admin / Owner

Primary needs:

- mengelola barber;
- mengelola layanan;
- mengelola jam operasional;
- mengelola jadwal barber;
- mengelola reservation;
- mengelola hairstyle knowledge;
- mengelola assets virtual hair filter;
- melihat feedback;
- melihat operational analytics.

---

# 7. User Roles and Permissions

BarberKece menggunakan tiga role.

## 7.1 Customer

Dapat:

- browse website tanpa login;
- menggunakan hairstyle knowledge;
- menggunakan recommendation;
- mencoba Virtual Hair Filter;
- membuat akun;
- login/logout;
- mengelola profil;
- mengelola Hair Profile;
- membuat reservation;
- memilih barber tertentu atau Any Available Barber;
- melihat booking;
- reschedule sesuai policy;
- cancel sesuai policy;
- menyimpan hairstyle favorit;
- memilih hairstyle sebagai reference reservasi;
- memberikan feedback setelah layanan;
- melihat haircut history;
- menghapus data Hair Profile;
- menghapus saved camera snapshot bila fitur penyimpanan tersedia.

Tidak dapat:

- melihat reservation customer lain;
- mengubah jadwal barber;
- mengelola knowledge base.

---

## 7.2 Barber

Dapat:

- melihat jadwal dirinya sendiri;
- melihat customer yang menjadi tanggung jawabnya;
- melihat hairstyle reference untuk appointment tersebut;
- melihat haircut note relevan milik customer;
- mengubah appointment ke status:
  - Checked In;
  - In Service;
  - Completed;
  - No Show;
- menulis haircut note setelah layanan.

Tidak dapat:

- mengubah user role;
- mengubah jam operasional bisnis;
- menghapus barber lain;
- mengubah booking barber lain tanpa permission admin;
- melihat data customer yang tidak relevan terhadap appointment.

---

## 7.3 Admin / Owner

Memiliki seluruh kemampuan operasional:

- manage services;
- manage barber;
- manage schedule;
- manage business hours;
- manage break;
- manage leave;
- manage appointment;
- reassign barber;
- block slot;
- close specific date;
- manage hairstyle knowledge;
- manage recommendation metadata;
- manage Virtual Hair Filter assets;
- view feedback;
- view analytics;
- configure booking policies.

Admin tidak diperbolehkan melihat camera stream user.

---

# 8. Product Information Architecture

## 8.1 Public Navigation

Primary navigation:

```text
Home
Find My Style
Try Hairstyles
Hairstyles
Book
My Account
```

Jika marketplace ditambahkan kemudian:

```text
Shop
```

---

## 8.2 Customer Authenticated Navigation

```text
My Appointments
My Hair Profile
My Hair History
Saved Styles
Account Settings
```

---

## 8.3 Barber Navigation

```text
Today
Schedule
Appointments
Customer Notes
Profile
```

---

## 8.4 Admin Navigation

```text
Overview
Reservations
Barbers
Schedules
Services
Hairstyles
Virtual Filter Assets
Customers
Feedback
Analytics
Settings
```

---

# 9. Primary End-to-End Customer Journey

```text
Home
↓
Find My Style
↓
Complete Hair Profile
↓
Receive Recommendations
↓
Open Recommended Hairstyle
↓
Try in Virtual Hair Filter
↓
Choose Hairstyle
↓
Book This Style
↓
Choose Service
↓
Choose Barber Preference
↓
Choose Date
↓
Choose Available Time
↓
Review
↓
Confirm
↓
Appointment Confirmed
↓
Add to Calendar
↓
Visit Barbershop
↓
Haircut
↓
Give Feedback
↓
Hair History Updated
↓
Future Recommendation Becomes More Personal
```

User tidak wajib mengikuti seluruh flow.

---

# 10. Alternative Customer Journey — Direct Booking

```text
Home
↓
Book
↓
Choose Service
↓
Choose Barber Preference
↓
Choose Date
↓
Choose Available Time
↓
Review
↓
Confirm
```

Hair Recommendation dan Virtual Filter bersifat optional untuk user yang sudah tahu apa yang diinginkan.

---

# 11. Authentication Requirements

## 11.1 Guest Capabilities

Guest dapat:

- browse homepage;
- browse hairstyle knowledge;
- menjalankan Hair Recommendation;
- mencoba Virtual Hair Filter;
- melihat barber public profile;
- melihat service list.

Guest tidak dapat menyelesaikan reservation.

---

## 11.2 Login Trigger

Jika guest menekan:

> Confirm Booking

sistem meminta login/register.

Setelah authentication berhasil:

> user harus kembali ke reservation draft yang sama.

Reservation state tidak boleh hilang.

---

## 11.3 Minimum Account Data

Required:

- display name;
- email;
- password atau supported authentication provider.

Optional:

- phone number;
- profile photo.

Phone OTP bukan requirement release pertama.

---

## 11.4 Account Security

Product requirement:

- password harus disimpan menggunakan secure password hashing oleh auth provider/backend;
- reset password tersedia;
- email verification dapat diterapkan;
- session harus dapat di-revoke;
- brute force protection harus diterapkan pada auth endpoint.

Detail teknologi ditentukan pada Technical Design.

---

# 12. Smart Reservation — Product Definition

Smart Reservation adalah sistem booking berbasis barber availability.

Tujuan utama:

> Customer dapat mendapatkan slot valid dengan langkah sesedikit mungkin tanpa perlu memahami schedule internal barbershop.

---

# 13. Reservation UX Flow

Flow final:

```text
Step 1 — Choose Service
Step 2 — Barber Preference
Step 3 — Choose Date
Step 4 — Choose Time
Step 5 — Review
Step 6 — Confirm
```

Urutan ini dipilih untuk menghindari situasi:

> user memilih waktu terlebih dahulu lalu baru mengetahui barber favoritnya tidak tersedia.

---

# 14. Reservation Step 1 — Choose Service

Setiap service memiliki:

- service name;
- description;
- duration;
- price;
- active/inactive status;
- eligible barber list.

Contoh:

```text
Haircut
Duration: 60 minutes
Price: Rp50.000
```

Price dapat ditampilkan sebagai informasi walaupun pembayaran dilakukan offline.

---

# 15. Reservation Step 2 — Barber Preference

User melihat:

```text
Who would you like?

● Any Available Barber
○ Andi
○ Budi
○ Candra
```

Default:

> **Any Available Barber**

Setiap barber card dapat menampilkan:

- nama;
- foto;
- specialization;
- rating summary jika tersedia;
- next availability indicator.

Pemilihan barber tidak wajib.

---

# 16. Reservation Step 3 — Choose Date

Calendar hanya boleh menampilkan tanggal yang dapat dipesan.

Tanggal harus mempertimbangkan:

- business closed date;
- booking horizon;
- barber preference;
- service duration;
- remaining capacity.

Contoh state:

- Available;
- Limited;
- Fully Booked;
- Closed.

Tanggal masa lalu tidak selectable.

---

# 17. Booking Horizon

Default product rule:

> Reservation dapat dibuat maksimum 30 hari ke depan.

Admin dapat mengubah booking horizon.

Allowed configuration:

- minimum: 7 days;
- maximum: 90 days.

---

# 18. Reservation Step 4 — Choose Time

User **tidak mengetik waktu**.

Sistem menghasilkan slot valid.

UI menampilkan start time yang jelas.

Contoh:

```text
Morning
09:00
10:00
11:00

Afternoon
13:00
14:00
15:00

Evening
17:00
```

End time dapat ditampilkan pada summary tetapi user tidak perlu menghitungnya.

---

# 19. Slot Generation Rules

Slot availability ditentukan berdasarkan:

```text
Business Hours
∩ Barber Working Schedule
∩ Barber Service Eligibility
− Existing Appointment
− Break
− Leave
− Blocked Time
− Service Duration
```

Slot hanya tampil jika seluruh durasi service dapat ditempatkan tanpa konflik.

---

# 20. Service Duration Rules

Service duration bukan input user.

Contoh:

```text
Haircut                 60 min
Haircut + Wash          75 min
Hair Treatment          90 min
Hair Coloring          120 min
```

Jika hanya satu service digunakan pada MVP, default dapat dibuat 60 menit.

Arsitektur tetap harus mendukung duration per service.

---

# 21. Scheduling Granularity

Default slot-start granularity:

> 15 menit.

Contoh:

- 09:00;
- 09:15;
- 09:30;
- 09:45.

Namun admin dapat memilih simplified fixed slot template.

Untuk UX customer, sistem dapat menyembunyikan slot yang akan menghasilkan jadwal terlalu terfragmentasi jika optimization rule diaktifkan kemudian.

Untuk release pertama, semua valid start time dapat ditampilkan.

---

# 22. Any Available Barber Assignment

Jika user memilih:

> Any Available Barber

sistem mengassign barber saat booking dikonfirmasi.

## 22.1 Eligibility

Barber harus:

- aktif;
- bekerja pada waktu tersebut;
- qualified untuk service;
- tidak memiliki booking conflict;
- tidak sedang break;
- tidak sedang leave.

## 22.2 Assignment Algorithm — Release 1

Barber dipilih berdasarkan:

1. total booked service minutes paling sedikit pada hari tersebut;
2. jika tie, pilih barber yang paling lama belum menerima assignment otomatis;
3. jika masih tie, gunakan deterministic stable ordering.

Tujuan:

- workload lebih seimbang;
- assignment tidak random murni;
- hasil dapat dijelaskan;
- tidak selalu mengarah ke barber yang sama.

Admin dapat melakukan reassignment jika diperlukan.

---

# 23. Specific Barber Booking

Jika user memilih barber tertentu:

- sistem hanya menampilkan tanggal/slot yang valid untuk barber tersebut;
- user tidak akan melihat slot invalid.

Jika barber menjadi unavailable setelah booking:

- reservation tidak boleh silently cancelled;
- admin harus melakukan reassignment atau menghubungi customer melalui workflow perubahan reservation.

---

# 24. Reservation Step 5 — Review

Review page menampilkan:

- service;
- date;
- start time;
- calculated end time;
- selected barber atau Assigned after confirmation;
- hairstyle reference jika ada;
- price;
- cancellation/reschedule policy;
- barbershop location;
- optional customer note.

CTA:

> Confirm Reservation

---

# 25. Reservation Confirmation

Reservation harus **auto-confirm** apabila slot masih tersedia saat final confirmation.

Tidak diperlukan manual approval admin.

Setelah berhasil:

```text
Booking Confirmed
```

User menerima:

- booking reference;
- date/time;
- barber;
- service;
- location;
- hairstyle reference;
- policy;
- Add to Calendar action.

---

# 26. Concurrency and Double Booking

Critical business requirement:

> Dua customer tidak boleh berhasil mengunci barber yang sama pada interval waktu yang overlap.

Final reservation confirmation harus menggunakan atomic conflict validation.

Jika slot diambil user lain beberapa detik sebelum confirmation:

Sistem menampilkan:

> Slot ini baru saja terisi.

Lalu langsung menawarkan:

- nearest available time;
- same time with another barber;
- same barber at another time.

Draft reservation tidak boleh hilang.

---

# 27. Appointment Status Model

Supported statuses:

```text
Confirmed
Checked In
In Service
Completed
Cancelled by Customer
Cancelled by Barbershop
No Show
```

Tidak ada Pending Approval pada flow normal.

---

# 28. Appointment State Rules

## Confirmed → Checked In

Dilakukan oleh barber/admin ketika customer datang.

## Checked In → In Service

Dilakukan saat layanan dimulai.

## In Service → Completed

Dilakukan setelah layanan selesai.

## Confirmed → Cancelled by Customer

Hanya jika memenuhi cancellation policy.

## Confirmed → Cancelled by Barbershop

Admin dapat membatalkan dengan reason wajib.

## Confirmed → No Show

Barber/admin dapat menandai setelah grace period.

Status history harus disimpan.

---

# 29. Cancellation Policy

Default:

> Customer dapat cancel sendiri sampai 2 jam sebelum appointment.

Admin dapat mengubah threshold.

Jika melewati threshold:

- self-cancel disabled;
- UI menjelaskan alasannya;
- user diarahkan menghubungi barbershop.

Tidak ada cancellation fee pada release pertama.

---

# 30. Reschedule Policy

Default:

> Customer dapat reschedule sampai 2 jam sebelum appointment.

Reschedule menggunakan availability engine yang sama.

Flow:

```text
My Appointment
↓
Reschedule
↓
Select New Date/Time
↓
Validate
↓
Confirm Change
```

Old slot hanya dilepas setelah new slot berhasil diamankan.

---

# 31. Late Arrival and No Show

Default grace period:

> 15 menit.

Admin dapat mengubah.

Jika customer terlambat:

- barber/admin menentukan apakah layanan masih dapat dilakukan;
- sistem tidak auto-cancel tepat pada menit ke-15.

Setelah grace period, admin/barber dapat mark:

> No Show

Tidak ada automatic punishment pada release pertama.

No-show count tetap disimpan untuk analytics.

---

# 32. Barber Schedule Management

Admin dapat menentukan:

- recurring weekly schedule;
- breaks;
- day off;
- leave;
- exceptional hours;
- special closed date.

Example:

```text
Andi

Monday
09:00–12:00
13:00–18:00

Tuesday
OFF
```

---

# 33. Business Hours

Admin dapat mengatur jam operasional per hari.

Contoh:

```text
Mon–Fri 09:00–18:00
Saturday 09:00–20:00
Sunday Closed
```

Business hours tidak otomatis berarti seluruh barber bekerja.

---

# 34. Schedule Exceptions

Admin harus dapat membuat exception:

- holiday;
- renovation;
- special event;
- emergency closure;
- barber leave;
- temporary blocked period.

Exception harus langsung memengaruhi future availability.

Jika exception menyebabkan conflict terhadap booking yang sudah ada:

sistem harus memperingatkan admin sebelum menyimpan perubahan.

---

# 35. Existing Booking Conflict Handling

Jika admin mencoba membuat barber unavailable pada waktu yang sudah memiliki reservation:

UI harus menampilkan impacted appointments.

Admin harus memilih tindakan untuk setiap appointment:

- reassign;
- reschedule with customer;
- cancel.

Tidak boleh silently menghilangkan booking.

---

# 36. Hairstyle Knowledge System

Hairstyle Knowledge System adalah curated structured knowledge base.

Setiap hairstyle tidak hanya memiliki:

- nama;
- gambar.

Tetapi juga metadata yang digunakan recommendation dan education.

---

# 37. Hairstyle Entity Requirements

Setiap hairstyle minimal memiliki:

- name;
- aliases;
- short description;
- long description;
- preview images;
- supported virtual filter asset;
- face shape compatibility;
- hair type compatibility;
- hair thickness compatibility;
- minimum current hair length;
- recommended length;
- maintenance level;
- styling difficulty;
- style tags;
- professional notes;
- common mistakes;
- recommended styling products placeholder;
- active status.

---

# 38. Hair Attribute Taxonomy

## 38.1 Face Shape

Initial supported values:

- Oval
- Round
- Square
- Oblong / Rectangle
- Heart
- Diamond
- Triangle

User harus dapat memilih:

> Not Sure

---

## 38.2 Hair Type

Initial values:

- Straight
- Wavy
- Curly
- Coily

User dapat memilih:

> Not Sure

---

## 38.3 Hair Thickness / Density

Initial simplified values:

- Thin / Low Density
- Medium
- Thick / High Density
- Not Sure

Terminology final harus diuji di UX agar tidak membingungkan user.

---

## 38.4 Current Hair Length

Initial:

- Very Short
- Short
- Medium
- Long

Setiap kategori harus memiliki visual reference.

---

## 38.5 Maintenance Preference

- Very Low
- Low
- Medium
- High

UI menjelaskan:

```text
Low:
cukup sedikit styling dan tidak membutuhkan banyak produk setiap hari.
```

---

## 38.6 Desired Style

Multi-select:

- Clean
- Classic
- Modern
- Casual
- Textured
- Formal
- Edgy
- Korean-inspired
- Natural

Taxonomy dapat diperluas admin.

---

# 39. Hair Profile

Customer dapat menyimpan Hair Profile.

Fields:

- face shape;
- hair type;
- thickness/density;
- current length;
- hairline notes;
- maintenance preference;
- desired style;
- optional user note.

Hair Profile bersifat editable.

Recommendation harus menampilkan tanggal terakhir profile diubah bila relevan.

---

# 40. Recommendation Modes

BarberKece mendukung dua mode.

## 40.1 Quick Recommendation

Guest/customer menjawab questionnaire tanpa menyimpan data.

## 40.2 Personalized Recommendation

Authenticated customer menggunakan saved Hair Profile dan Hair History.

---

# 41. Recommendation Engine — Release 1

Release pertama menggunakan:

> **Knowledge-Based Weighted Scoring**

Bukan opaque ML ranking.

Goal:

- explainable;
- deterministic;
- dapat diuji;
- tidak memerlukan dataset besar.

---

# 42. Recommendation Inputs

Potential inputs:

- face shape;
- hair type;
- hair thickness;
- current hair length;
- maintenance preference;
- desired style;
- previous haircut feedback.

Tidak semua field wajib.

Jika data tidak tersedia:

> sistem menormalisasi score berdasarkan faktor yang tersedia.

Sistem tidak boleh memberikan skor rendah hanya karena user memilih Not Sure.

---

# 43. Default Recommendation Weight

Initial baseline:

```text
Face Shape Match          25%
Hair Type Match           20%
Hair Thickness Match      15%
Current Length Feasibility 15%
Maintenance Match         10%
Style Preference Match    15%
```

Total:

```text
100%
```

Previous feedback digunakan sebagai adjustment layer setelah user memiliki history.

Nilai ini adalah product baseline dan dapat dituning berdasarkan expert validation.

---

# 44. Compatibility Scoring

Setiap dimension dapat menghasilkan normalized score:

```text
1.0 = strong match
0.7 = acceptable
0.3 = weak
0.0 = incompatible
```

Final score:

```text
Weighted sum of known dimensions
÷
sum of active weights
```

Kemudian dikonversi menjadi percentage.

---

# 45. Hard Constraints

Beberapa kondisi tidak boleh sekadar menurunkan score.

Contoh:

Jika hairstyle membutuhkan minimum hair length yang belum dimiliki user:

UI harus menandai:

> Belum dapat dicapai dengan panjang rambut saat ini.

Hairstyle dapat tetap ditampilkan sebagai:

> Grow-out option

tetapi tidak sebagai immediate haircut recommendation utama.

---

# 46. Recommendation Result

Default output:

> Top 3 recommendations.

Setiap result card menampilkan:

- hairstyle;
- compatibility score;
- preview;
- 2–4 alasan utama;
- maintenance;
- current-length feasibility;
- Try This Style;
- View Details;
- Book This Style.

---

# 47. Explainability Requirement

Recommendation explanation harus berasal dari metadata.

Tidak boleh menggunakan generic generated reasoning seperti:

> "Model ini cocok karena stylish."

Contoh valid:

```text
92% Match

Why:
✓ cocok untuk oval face
✓ bekerja baik pada wavy hair
✓ sesuai dengan preferensi low-maintenance
✓ dapat dicapai dengan panjang rambut saat ini
```

---

# 48. Recommendation Confidence

Jika user memberikan terlalu sedikit informasi:

Sistem harus menampilkan:

> Recommendation confidence: Limited

dan mengajak:

> Lengkapi Hair Profile untuk hasil lebih akurat.

Compatibility percentage tidak boleh memberi kesan ilmiah palsu.

---

# 49. Hair History

Setiap completed appointment dapat membuat Hair History entry.

Data:

- date;
- barber;
- service;
- selected hairstyle reference;
- haircut result notes;
- customer rating;
- customer feedback;
- barber note;
- optional saved final photo dengan consent.

---

# 50. Customer Feedback

Setelah appointment Completed, customer dapat memberi:

- overall haircut rating;
- barber rating;
- hairstyle satisfaction;
- free-text feedback.

Optional structured questions:

```text
Bagian yang paling kamu suka?
Apa yang ingin diubah lain kali?
```

---

# 51. Feedback Influence on Recommendations

Release pertama tidak menggunakan ML training.

Previous feedback menghasilkan preference adjustments.

Example:

Jika customer dua kali menandai:

> fringe terlalu pendek

Hair History dapat menghasilkan profile note:

> prefers longer fringe.

Customer dapat melihat dan mengubah inferred preference.

Sistem tidak boleh menyimpan inference tersembunyi yang tidak dapat dikoreksi user.

---

# 52. Virtual Hair Filter — Product Definition

Virtual Hair Filter memungkinkan user mencoba hairstyle melalui live camera.

Target experience:

```text
Open Camera
↓
Face Detected
↓
Head Tracked
↓
Virtual Hairstyle Anchored
↓
User Moves
↓
Hair Asset Follows Head
↓
User Switches Styles
```

TikTok hanya menjadi reference untuk interaction quality.

BarberKece tidak mengambil atau embed filter TikTok.

---

# 53. Virtual Hair Filter Technology Direction

Product requires:

- browser camera;
- client-side computer vision where feasible;
- face detection;
- face landmark tracking;
- head pose estimation;
- hairstyle asset alignment;
- real-time rendering.

Optional advanced component:

- hair segmentation;
- occlusion handling.

Technical selection ditentukan dalam Technical Design.

---

# 54. Zero-Cost Requirement

Development/MVP harus sebisa mungkin:

> tidak membutuhkan paid AI API per filter session.

Preferred:

```text
Camera
↓
On-Device / Browser CV
↓
Client-side Rendering
```

Cloud generative inference bukan dependency utama.

---

# 55. Virtual Filter Entry Points

User dapat membuka filter dari:

1. primary navigation `Try Hairstyles`;
2. hairstyle detail page;
3. recommendation result;
4. saved styles;
5. reservation hairstyle reference.

---

# 56. Camera Permission Flow

Sebelum meminta browser permission:

UI harus menjelaskan:

> Kamera digunakan untuk menampilkan hairstyle virtual secara real-time. Video tidak disimpan atau dikirim ke server secara default.

CTA:

> Enable Camera

Baru setelah CTA ditekan, browser permission diminta.

---

# 57. Camera Privacy Rules

By default:

- live frame diproses secara lokal jika implementation memungkinkan;
- frame tidak disimpan;
- frame tidak dikirim ke server;
- tidak ada biometric identity recognition;
- tidak ada face identity matching;
- tidak ada background recording.

Jika user memilih:

> Save Preview

harus ada explicit action.

---

# 58. Unsupported Device / Browser

Jika real-time filter tidak dapat berjalan:

Sistem tidak boleh crash.

Fallback:

```text
Virtual try-on is not supported on this device.
```

Offer:

- hairstyle gallery;
- static preview;
- recommendation;
- continue booking.

---

# 59. Filter Detection States

UI harus memiliki state jelas:

### Loading Model

> Preparing virtual try-on…

### Camera Permission Required

> Enable camera to continue.

### No Face

> Posisikan wajah di dalam area kamera.

### Face Detected

Filter aktif.

### Multiple Faces

> Pastikan hanya satu wajah berada di kamera.

### Low Light

> Pencahayaan terlalu gelap. Cari area yang lebih terang.

### Tracking Lost

> Arahkan wajah kembali ke kamera.

---

# 60. Filter Interaction

Required controls:

- switch hairstyle;
- previous/next;
- hairstyle name;
- reset;
- flip camera if device supports relevant camera;
- close;
- view details;
- select this style.

Optional:

- capture preview;
- compare before/after.

---

# 61. Hairstyle Asset Requirements

Setiap filter-compatible hairstyle membutuhkan asset metadata:

- asset id;
- hairstyle id;
- version;
- anchor points;
- scale parameters;
- supported head angle;
- rendering mode;
- quality status;
- fallback asset.

Asset type dapat berupa:

- 2D transparent layered asset;
- deformable mesh;
- 3D model.

Final implementation ditentukan oleh technical feasibility.

---

# 62. Filter Quality Requirement

Release pertama tidak wajib photorealistic setara TikTok.

Minimum quality target:

- hairstyle menempel stabil pada kepala;
- scale mengikuti ukuran kepala;
- position mengikuti landmark;
- head movement tidak menyebabkan asset tertinggal secara ekstrem;
- tidak terjadi flicker berlebihan;
- user dapat mengenali hairstyle dengan jelas.

---

# 63. Filter Performance Targets

Target untuk supported mid-range smartphone:

- first meaningful filter experience ≤ 5 detik pada koneksi broadband/mobile yang wajar setelah page shell loaded;
- tracking target ≥ 20 FPS;
- input-to-render latency target ≤ 150 ms;
- UI tetap responsive selama filter aktif.

Jika device tidak mencapai threshold:

- reduce render quality;
- reduce model resolution;
- fallback gracefully.

Target final perlu diuji pada device matrix.

---

# 64. Hair Recommendation + Filter Integration

Recommendation result:

```text
Textured Crop
92% Match
```

Actions:

```text
Try This Style
Book This Style
View Details
```

If user selects `Try This Style`:

filter langsung membuka Textured Crop sebagai selected asset.

User tidak perlu mencari hairstyle lagi.

---

# 65. Filter + Reservation Integration

Setelah user menekan:

> Select This Style

style menjadi temporary selected hairstyle.

CTA:

> Book This Style

Reservation draft membawa:

- hairstyle id;
- hairstyle preview;
- optional note.

Barber dapat melihat reference tersebut.

---

# 66. Hairstyle Detail Page

Required content:

- hairstyle name;
- aliases;
- images;
- short description;
- who it suits;
- compatible hair types;
- maintenance;
- styling advice;
- recommended current length;
- barber notes;
- Try This Style CTA;
- Book This Style CTA.

---

# 67. Saved Styles

Authenticated customer dapat menyimpan hairstyle.

Actions:

- save;
- unsave;
- compare later;
- try;
- book.

Saved styles bukan social bookmark.

---

# 68. Barber Public Profile

Profile dapat menampilkan:

- name;
- profile photo;
- experience summary;
- specialties;
- supported services;
- portfolio images optional;
- rating summary;
- next availability preview.

Tidak menampilkan:

- personal phone number;
- home address;
- internal schedule notes.

---

# 69. Barber Dashboard

Home state:

```text
Today
```

Menampilkan:

- current appointment;
- next appointment;
- remaining appointments;
- customer name;
- service;
- hairstyle reference;
- status.

Actions:

- Check In;
- Start Service;
- Complete;
- No Show;
- Add Note.

---

# 70. Barber Appointment Detail

Barber hanya melihat information yang relevan:

- customer display name;
- service;
- schedule;
- hairstyle reference;
- relevant Hair Profile summary jika customer consented;
- previous haircut note;
- customer note.

Barber tidak membutuhkan full account data.

---

# 71. Barber Haircut Notes

After completion:

barber dapat menulis structured note.

Examples:

```text
Top left slightly longer.
Customer prefers low taper, not skin fade.
Avoid cutting fringe below previous length.
```

Customer-facing visibility:

Admin dapat menentukan note as:

- internal only;
- customer-visible.

Default barber note:

> internal to barbershop.

Customer preference extracted dari note tidak boleh otomatis dianggap fakta tanpa confirmation user.

---

# 72. Admin Dashboard

Overview menampilkan:

- today appointments;
- upcoming;
- completed;
- cancelled;
- no-show;
- barber utilization;
- most selected services;
- most viewed hairstyles;
- recommendation-to-book conversion;
- filter-to-book conversion.

Dashboard harus fokus pada decision-relevant metrics.

---

# 73. Admin Reservation Management

Admin dapat:

- search reservation;
- filter by date/status/barber;
- view detail;
- reassign barber;
- reschedule;
- cancel;
- add admin note;
- mark no-show;
- export basic operational data if implemented.

All critical changes must write audit history.

---

# 74. Service Management

Admin fields:

- service name;
- description;
- duration;
- price;
- active;
- eligible barbers;
- buffer before;
- buffer after.

Buffer optional.

Example:

```text
Hair Coloring
Duration 120 min
Buffer After 15 min
```

Availability engine harus memperhitungkan buffer.

---

# 75. Hairstyle Knowledge Management

Admin can:

- create hairstyle;
- edit;
- deactivate;
- upload preview;
- set compatibility metadata;
- set styling notes;
- link filter asset;
- preview recommendation impact.

Deletion should be soft-delete if hairstyle referenced in history.

---

# 76. Virtual Asset Management

Admin can:

- upload/register hairstyle filter asset;
- map asset to hairstyle;
- set status:
  - Draft
  - Testing
  - Active
  - Deprecated
- preview asset;
- set fallback.

Only Active asset visible to customers.

---

# 77. Notification Requirements

Release 1 required notification channels:

- in-app/web confirmation;
- email confirmation.

Recommended notification events:

- reservation confirmed;
- reservation rescheduled;
- reservation cancelled;
- barbershop-initiated change;
- reminder before appointment.

---

# 78. Appointment Reminder

Default reminder:

> 3 hours before appointment.

Admin configurable.

If email delivery is not configured in local development:

system should maintain notification event abstraction for later delivery.

---

# 79. Add to Calendar

Confirmation page should support:

> Add to Calendar

At minimum:

- downloadable `.ics`;
- or standards-compatible calendar link.

Event includes:

- BarberKece;
- service;
- date/time;
- location;
- barber;
- booking reference.

---

# 80. Homepage Requirements

Homepage must immediately communicate:

1. what BarberKece does;
2. why user should care;
3. primary action.

Recommended primary CTA:

> Find My Style

Secondary CTA:

> Book a Haircut

Supporting CTA:

> Try Hairstyles

---

# 81. Homepage Content Hierarchy

Suggested order:

1. Hero;
2. How BarberKece works;
3. Popular hairstyles;
4. Personal recommendation value;
5. Virtual filter demonstration;
6. Meet the barbers;
7. Booking CTA;
8. FAQ;
9. Footer.

Avoid excessive marketing copy.

---

# 82. Search and Discovery

Hairstyle library should support:

- search by name/alias;
- filters:
  - face shape;
  - hair type;
  - maintenance;
  - style;
  - length.

Filter library is for discovery.

Recommendation remains separate and personalized.

---

# 83. Empty States

Every state must guide next action.

Examples:

## No Appointments

> Belum ada reservasi.  
> Book your next haircut.

## No Hair History

> Riwayat haircut akan muncul setelah appointment pertamamu selesai.

## No Saved Styles

> Simpan hairstyle yang ingin kamu coba nanti.

---

# 84. Error States

Generic:

> Something went wrong.

is insufficient for known errors.

Examples:

- slot no longer available;
- camera denied;
- model failed to load;
- internet disconnected;
- booking validation expired;
- barber unavailable.

Each requires actionable recovery.

---

# 85. Loading States

Use:

- skeleton for content;
- progress state for model loading;
- disabled duplicate submission during booking confirmation.

Do not show full-screen spinner for simple navigation unless necessary.

---

# 86. Offline / Poor Connection

Product behavior:

- static hairstyle content may remain cached where possible;
- booking requires network;
- confirmation must not be shown until server acknowledges;
- filter may work locally after assets loaded;
- if offline before booking confirm:
  - retain draft locally;
  - explain connection needed.

---

# 87. Accessibility Requirements

Target:

> WCAG 2.2 AA.

Required:

- keyboard navigation;
- visible focus;
- semantic labels;
- form errors connected to fields;
- sufficient contrast;
- no color-only availability indicators;
- camera controls accessible;
- motion reduction support;
- screen-reader-friendly reservation flow.

---

# 88. Responsive Design Requirements

Primary breakpoints determined by design system.

Product requirement:

- all customer flows must work from 320px width upward;
- no horizontal scroll for standard screens;
- time slots must be touch-friendly;
- buttons minimum touch target approx. 44×44 CSS px;
- camera area responsive;
- desktop may use multi-column layout.

---

# 89. Language and Localization

Release 1:

> Bahasa Indonesia.

Architecture should support i18n.

Avoid hardcoding UI strings across components.

Date/time format default:

```text
Sabtu, 12 September 2026
10.00–11.00
```

Timezone:

> Barbershop local timezone.

---

# 90. SEO Requirements

Indexable:

- Home;
- hairstyle library;
- hairstyle detail;
- public barber profile;
- public service information.

Do not index:

- account;
- reservation detail;
- admin;
- barber internal pages;
- personal Hair Profile;
- filter camera session.

Hairstyle pages should support metadata.

---

# 91. Performance Requirements

Customer-facing web targets:

## Core pages

- fast initial render;
- optimized images;
- lazy load non-critical assets;
- no unnecessary JavaScript.

Suggested performance target:

- Core Web Vitals in "Good" range on representative devices where realistic.

## Filter page

Separate performance budget allowed because ML assets are larger.

Filter models should load only when needed.

---

# 92. Privacy Requirements

Sensitive product areas:

- camera;
- Hair Profile;
- optional photos;
- appointment history;
- haircut notes.

Requirements:

- privacy notice;
- consent where applicable;
- data minimization;
- delete user data capability;
- secure transport;
- access control;
- no third-party camera sharing by default.

---

# 93. Camera Data Policy

Default policy:

> Live camera frames are not persisted.

If model inference runs locally:

document it clearly.

If future implementation sends frames to server:

this requires explicit PRD revision, privacy review, and new consent.

---

# 94. User Data Deletion

Customer must be able to request/account-delete.

Deletion behavior:

- authentication profile removed/anonymized;
- personal Hair Profile removed;
- saved style removed;
- optional saved images deleted;
- operational reservation records may be retained in anonymized form if required for business/legal purpose.

Exact retention policy determined by deployment jurisdiction/business.

---

# 95. Security Requirements

Minimum:

- HTTPS in production;
- secure auth;
- authorization on server;
- CSRF protection where applicable;
- XSS prevention;
- SQL/NoSQL injection prevention;
- rate limiting sensitive endpoints;
- input validation;
- file upload validation;
- image content restrictions;
- audit log for admin-critical changes;
- least-privilege access.

---

# 96. Upload Security

For images/assets:

- validate MIME;
- validate size;
- strip dangerous metadata where appropriate;
- generate safe filename;
- restrict executable content;
- limit file dimensions/size;
- authorization required for admin asset upload.

---

# 97. Audit Logging

Required admin events:

- reservation cancellation by staff;
- reassignment;
- schedule override;
- business closure;
- hairstyle knowledge modification;
- filter asset activation;
- role change.

Audit entry includes:

- actor;
- timestamp;
- action;
- target;
- before/after where reasonable.

---

# 98. Analytics Framework

Product analytics should measure funnel performance.

Core events:

```text
home_viewed
recommendation_started
hair_profile_completed
recommendation_generated
hairstyle_viewed
filter_opened
camera_permission_granted
filter_style_selected
book_this_style_clicked
booking_started
service_selected
barber_preference_selected
date_selected
time_selected
booking_confirmed
booking_rescheduled
booking_cancelled
appointment_completed
feedback_submitted
```

---

# 99. Core Product Metrics

## Discovery

- recommendation completion rate;
- hairstyle detail CTR;
- save style rate.

## Filter

- filter start rate;
- camera permission success rate;
- average styles tried;
- filter → booking conversion.

## Reservation

- booking completion rate;
- median time to book;
- slot conflict failure rate;
- cancellation rate;
- reschedule rate;
- no-show rate.

## Personalization

- returning user rate;
- repeat booking rate;
- feedback completion;
- saved Hair Profile usage.

---

# 100. Primary Product KPIs

Initial KPIs:

### KPI 1 — Booking Completion Rate

```text
confirmed bookings / booking starts
```

### KPI 2 — Median Booking Completion Time

Goal:

> keep direct booking as short as reasonably possible.

### KPI 3 — Recommendation-to-Booking Conversion

```text
bookings originating from recommendation
/
recommendation sessions
```

### KPI 4 — Filter-to-Booking Conversion

```text
bookings originating after virtual try-on
/
filter sessions
```

---

# 101. UX Performance Goals

Direct reservation target:

A returning authenticated user with a known service should be able to complete reservation in approximately:

> 4–6 deliberate decisions.

No requirement on exact seconds because network/device conditions vary.

---

# 102. Design System Requirements

Design must define:

- typography;
- spacing;
- border radius;
- buttons;
- fields;
- cards;
- chips;
- status;
- modal/dialog;
- navigation;
- date picker;
- time slot;
- barber card;
- hairstyle card;
- camera controls.

Do not allow every page to invent its own patterns.

---

# 103. Visual Direction

Not finalized.

However product should feel:

- modern;
- premium but approachable;
- confident;
- clean;
- masculine-neutral rather than aggressively stereotypical;
- visual-first where hairstyles matter.

Avoid:

- generic neon "barbershop gaming" aesthetic unless intentionally chosen later;
- excessive gradients;
- decorative barber poles everywhere;
- cluttered dashboards.

Brand direction will be handled separately.

---

# 104. Marketplace Scope

Marketplace **termasuk dalam Release 1** sebagai commerce module milik satu barbershop.

Marketplace bukan marketplace multi-vendor. Semua produk dikelola oleh barbershop yang menggunakan BarberKece.

Initial product categories:

- pomade;
- clay;
- wax;
- hairspray;
- hair powder;
- shampoo;
- conditioner;
- hair tonic;
- clipper;
- comb;
- scissors;
- razor;
- beard oil;
- beard balm.

---

# 105. Marketplace Future Integration Principle

Marketplace should connect to hairstyle personalization.

Example:

```text
Textured Crop
↓
Recommended Styling Products
↓
Matte Clay
Hair Powder
Sea Salt Spray
```

Marketplace should not become detached generic e-commerce.

---

# 106. Payment Scope

Release 1:

- service price displayed;
- payment reservasi tetap dilakukan di luar BarberKece / di barbershop;
- marketplace memiliki checkout flow;
- payment marketplace dapat menggunakan metode manual/offline-first pada MVP, misalnya pembayaran di barbershop atau transfer yang dikonfirmasi sesuai implementasi bisnis;
- payment gateway bukan dependency wajib Release 1.

Future:

- deposit reservasi;
- full online payment reservasi;
- marketplace payment gateway;
- automated payment verification.

Jika payment gateway ditambahkan, diperlukan technical/payment specification terpisah.

---

# 107. Multi-Branch Scope

Release 1 assumes:

> single barbershop location.

Data model should avoid impossible-to-migrate assumptions, but UI/product does not require branch selection.

Future multi-branch support is out of scope.

---

# 108. Notifications Scope

Release 1:

- in-app;
- email.

Future:

- WhatsApp;
- push notification;
- PWA push.

WhatsApp should not be assumed free.

---

# 109. Edge Cases — Reservation

## Case 1 — Slot Taken During Checkout

Offer nearest alternative without restarting.

## Case 2 — Barber Becomes Unavailable

Admin sees impacted appointment.

## Case 3 — Service Deactivated After Booking

Existing booking remains valid unless manually changed.

## Case 4 — User Opens Two Tabs

Server conflict validation is source of truth.

## Case 5 — Customer Reschedules Repeatedly

Allowed within policy; analytics may flag unusual behavior, no automatic penalty Release 1.

## Case 6 — Barber Schedule Changed

Conflicts must be surfaced.

## Case 7 — Business Closes Unexpectedly

Admin bulk-impact review required.

---

# 110. Edge Cases — Recommendation

## Unknown Face Shape

Recommendation still works using known dimensions.

## Multiple Style Preferences

Calculate across matching tags.

## Current Hair Too Short

Show grow-out message.

## No Strong Match

Do not fabricate 90% score.

Show:

> Tidak ada strong match berdasarkan profil saat ini.

Then offer acceptable alternatives.

---

# 111. Edge Cases — Virtual Filter

## Camera Denied

Explain how to enable permission and offer alternative.

## No Front Camera

Use available camera or fallback.

## Low-End Device

Reduce quality.

## Landscape Orientation

Support gracefully or guide portrait orientation if chosen by design.

## Glasses/Hat

Tracking may degrade; show guidance.

## Hair Covering Face

Display positioning guidance.

---

# 112. Data Model — Product-Level Entities

This is conceptual, not physical database schema.

Required entities:

```text
User
CustomerProfile
HairProfile
Barber
Service
BarberService
BusinessHours
BarberSchedule
ScheduleException
Appointment
AppointmentStatusHistory
Hairstyle
HairstyleCompatibility
VirtualHairAsset
SavedStyle
HairHistory
CustomerFeedback
BarberNote
Notification
AuditLog
AnalyticsEvent
```

Database schema detail belongs to Technical Design.

---

# 113. Appointment Conceptual Fields

```text
id
customer_id
barber_id
service_id
hairstyle_reference_id nullable
start_at
end_at
status
customer_note nullable
created_at
updated_at
cancelled_at nullable
cancellation_reason nullable
```

---

# 114. Hairstyle Conceptual Fields

```text
id
name
slug
aliases
short_description
long_description
maintenance_level
minimum_length
style_tags
active
created_at
updated_at
```

Compatibility metadata may be normalized into related entities.

---

# 115. Virtual Asset Conceptual Fields

```text
id
hairstyle_id
asset_type
asset_version
asset_location
render_metadata
status
fallback_asset
created_at
updated_at
```

---

# 116. Reservation Acceptance Criteria

A reservation feature is accepted when:

1. user can choose active service;
2. default barber preference is Any Available Barber;
3. selecting a barber filters availability correctly;
4. closed date cannot be booked;
5. full slot cannot be booked;
6. conflicting barber appointment cannot be created;
7. Any Barber assignment is deterministic and valid;
8. booking auto-confirms when slot is valid;
9. concurrent final confirmation cannot double-book;
10. user receives confirmation summary;
11. appointment appears in customer dashboard;
12. appointment appears on assigned barber schedule;
13. admin sees the reservation;
14. hairstyle reference persists if booking originates from hairstyle flow.

---

# 117. Recommendation Acceptance Criteria

Accepted when:

1. user can submit available Hair Profile attributes;
2. Not Sure is supported;
3. at least top recommendations are generated when sufficient data exists;
4. score ignores missing dimensions correctly;
5. reasons map to real compatibility metadata;
6. hairstyle with impossible current length is marked;
7. result supports Try, View, Book;
8. result is deterministic for same input/data version;
9. admin can update compatibility knowledge;
10. updated knowledge affects future recommendation.

---

# 118. Virtual Hair Filter Acceptance Criteria

Accepted when:

1. browser camera permission requested only after explanatory action;
2. user can deny permission without breaking page;
3. supported device can detect one face;
4. hairstyle asset is anchored to face/head landmarks;
5. asset updates as head moves;
6. user can switch hairstyle;
7. chosen hairstyle maps to correct hairstyle knowledge entry;
8. user can proceed to booking with selected style;
9. no camera frame is persisted by default;
10. unsupported device receives graceful fallback;
11. filter does not block entire website if model fails.

---

# 119. Barber Dashboard Acceptance Criteria

Accepted when barber can:

1. see today appointments;
2. see next customer;
3. open appointment;
4. see hairstyle reference;
5. update allowed status;
6. add note after service;
7. not access unrelated customer data;
8. not modify admin-only configurations.

---

# 120. Admin Acceptance Criteria

Accepted when admin can:

1. manage service;
2. manage barber;
3. configure schedule;
4. configure leave/break;
5. see appointment conflicts;
6. reassign appointment;
7. manage hairstyle knowledge;
8. manage virtual filter assets;
9. see key analytics;
10. changes produce audit records where required.

---

# 121. Definition of Done — Product Feature

A feature is not "done" merely because happy path works.

Definition of Done includes:

- happy path;
- loading;
- empty state;
- error state;
- permission state;
- responsive layout;
- accessibility;
- authorization;
- analytics events;
- acceptance criteria tests;
- basic performance validation;
- privacy/security review for relevant features.

---

# 122. Release Strategy

## Release 0 — Prototype Validation

Focus:

- UX flows;
- visual design;
- recommendation logic prototype;
- filter technical proof-of-concept;
- reservation availability prototype.

No production promise.

---

## Release 1 — Core BarberKece

Includes:

- responsive web;
- authentication;
- customer profile;
- services;
- barber profiles;
- schedules;
- Smart Reservation;
- Hair Profile;
- hairstyle knowledge;
- explainable recommendation;
- real-time Virtual Hair Filter MVP;
- selected hairstyle → reservation;
- customer appointments;
- barber dashboard;
- admin management;
- email/in-app confirmation;
- feedback;
- Hair History.

---

## Release 1.1 — Personalization Improvement

Potential:

- improved feedback preference;
- richer Hair History;
- recommendation tuning;
- filter asset quality improvements;
- saved preview;
- advanced camera fallback.

---

## Release 2 — Commerce Expansion

Release 1 sudah memiliki marketplace dasar.

Release 2 dapat memperluas commerce dengan:

- advanced product recommendation;
- online payment gateway;
- promo/voucher;
- bundle;
- product review;
- richer order fulfillment;
- shipping integration;
- advanced commerce analytics.

Expansion yang material dapat memiliki commerce specification terpisah.

---

# 123. Technical Design Handoff Requirements

After this PRD, Technical Design must explicitly define:

- frontend framework;
- backend/API;
- database;
- auth;
- hosting;
- storage;
- reservation concurrency;
- schedule query strategy;
- client-side ML runtime;
- face-landmark model;
- hair rendering implementation;
- 2D vs 3D assets;
- browser/device matrix;
- analytics;
- email;
- security;
- CI/CD;
- test strategy.

PRD does **not** prescribe specific framework.

---

# 124. UX/UI Handoff Requirements

UX specification must produce:

- sitemap;
- complete customer flow;
- booking flow;
- recommendation questionnaire;
- recommendation results;
- virtual filter interaction;
- hairstyle detail;
- My Appointments;
- My Hair Profile;
- Barber dashboard;
- Admin dashboard;
- all error/empty/loading states;
- responsive behavior.

---

# 125. Content Handoff Requirements

Content design must define:

- terminology;
- service descriptions;
- maintenance explanations;
- Hair Profile help copy;
- camera permission copy;
- cancellation copy;
- no availability copy;
- recommendation reasoning format;
- privacy explanation.

Avoid technical jargon for customers.

Example:

Do not say:

> Facial landmark model initialized.

Say:

> Kamera siap. Posisikan wajah di tengah.

---

# 126. Testing Strategy — Product Scope

Required functional test areas:

- auth;
- booking;
- concurrency;
- schedule exceptions;
- reschedule;
- cancel;
- role access;
- recommendation scoring;
- incomplete Hair Profile;
- virtual filter permissions;
- virtual filter fallback;
- mobile responsive;
- accessibility;
- data deletion.

---

# 127. Reservation Test Scenarios

Minimum scenarios:

1. Any Barber booking success;
2. specific barber success;
3. specific barber no availability;
4. concurrent same slot;
5. service longer than free gap;
6. break blocks availability;
7. leave blocks availability;
8. closed date;
9. reschedule success;
10. reschedule conflict;
11. cancellation before threshold;
12. cancellation after threshold;
13. barber reassignment;
14. schedule change with impacted appointment.

---

# 128. Recommendation Test Scenarios

Minimum:

1. all fields known;
2. some fields Not Sure;
3. current hair too short;
4. no strong match;
5. multiple style tags;
6. updated admin metadata;
7. repeat identical input;
8. history preference adjustment.

---

# 129. Filter Test Matrix

Test at minimum:

- Chrome Android;
- Safari iOS if supported by chosen implementation;
- Chrome desktop;
- mid-range Android;
- low light;
- glasses;
- head rotation;
- permission denied;
- camera unavailable;
- slow model load;
- poor network;
- device performance degradation.

Exact device list determined later.

---

# 130. Risks and Mitigations

## Risk 1 — Filter Looks Like a Sticker

Mitigation:

- landmark calibration;
- better asset creation;
- deformation/mesh;
- segmentation where feasible;
- do not promise photorealism.

## Risk 2 — Client-Side ML Too Heavy

Mitigation:

- lightweight model;
- lazy load;
- reduced resolution;
- WebGL/WebGPU acceleration;
- fallback.

## Risk 3 — Recommendation Feels Arbitrary

Mitigation:

- expert-curated metadata;
- explainable reasons;
- visible uncertainty;
- validate weighting with barbers.

## Risk 4 — Booking Complexity Grows

Mitigation:

- keep user flow fixed;
- move schedule complexity to admin/system;
- show only valid choices.

## Risk 5 — Admin Schedule Changes Break Reservations

Mitigation:

- conflict review before save;
- impacted appointment workflow.

---

# 131. Product Assumptions

Current assumptions:

- one physical barbershop branch;
- multiple barbers;
- user mainly accesses via phone;
- service payment offline;
- no booking deposit;
- reservation is auto-confirmed;
- customer may or may not have preferred barber;
- hairstyle filter primarily used on front camera;
- Hair Recommendation does not require ML in Release 1;
- Virtual Hair Filter does require CV/ML components;
- Marketplace termasuk Release 1 sebagai supporting feature.

If any assumption changes materially, update this PRD.

---

# 132. Product Decisions Locked by This PRD

The following are considered baseline product decisions.

## Platform

- Responsive Web Application
- Mobile-first
- no Android native requirement
- PWA-compatible direction

## Reservation

- no manual time typing;
- service determines duration;
- barber preference optional;
- Any Available Barber default;
- availability calculated by barber schedule;
- booking auto-confirms;
- no manual approval;
- double-booking prevented;
- reschedule/cancel policy supported;
- Add to Calendar supported.

## Hair Recommendation

- structured Hair Profile;
- curated hairstyle knowledge;
- knowledge-based weighted scoring;
- explainable output;
- missing values supported;
- history can refine future results.

## Virtual Hair Filter

- real-time camera-based;
- built by BarberKece;
- not dependent on TikTok filter;
- client-side CV preferred;
- no camera frame persistence by default;
- graceful fallback required.

## Marketplace

- included in Release 1;
- terintegrasi dengan hairstyle/product recommendation;
- bukan core differentiator utama, tetapi menjadi supporting feature yang lengkap.

---

# 133. Open Product Questions

These are intentionally not finalized and should not be invented silently.

1. exact service catalog and prices;
2. exact barber names and real staff data;
3. final cancellation/reschedule threshold for real business;
4. final hairstyle taxonomy after barber validation;
5. exact recommendation weight after expert validation;
6. whether customer may upload final haircut photo;
7. whether barber ratings are public;
8. whether public reviews are displayed;
9. whether PWA install prompt is used;
10. whether user can book as guest in future;
11. whether WhatsApp notification is added;
12. whether business later becomes multi-branch.

When implementing demo data, label it clearly as sample data.

---

# 134. Quality Bar

BarberKece should feel production-grade when:

- user understands its purpose within seconds;
- booking never requires guessing;
- no invalid slot can be confirmed;
- recommendation explains itself;
- filter degrades gracefully;
- customer data is protected;
- mobile UX is first-class;
- barber/admin workflows are operationally usable;
- empty/error states are designed;
- UI is consistent;
- performance is measured;
- accessibility is not an afterthought.

---

# 135. Final Product Narrative

BarberKece begins when a customer thinks:

> "Aku mau potong rambut, tapi belum yakin model apa yang cocok."

The platform helps them:

```text
Discover
↓
Find hairstyles that match their profile

Visualize
↓
Try the hairstyle on live camera

Decide
↓
Choose the hairstyle confidently

Book
↓
Get a valid barber and time without chat friction

Experience
↓
Visit the barbershop with hairstyle reference ready

Learn
↓
Store feedback and preferences

Improve
↓
Receive better future recommendations
```

This connected loop is the product.

Reservation, recommendation, and filter are not three unrelated features.

They form one personalized barbershop journey.

---

# 136. Final Scope Statement

For Release 1, BarberKece must deliver the following complete experience:

```text
Responsive Website
│
├── Public Experience
│   ├── Home
│   ├── Hairstyle Library
│   ├── Hairstyle Detail
│   ├── Barber Profiles
│   └── Service Information
│
├── Hair Intelligence
│   ├── Hair Profile
│   ├── Hairstyle Knowledge Base
│   ├── Explainable Recommendation
│   └── Hair History
│
├── Virtual Experience
│   ├── Live Camera
│   ├── Face / Head Tracking
│   ├── Hairstyle Rendering
│   ├── Style Switching
│   └── Selected Style → Booking
│
├── Smart Reservation
│   ├── Service
│   ├── Optional Barber Preference
│   ├── Date
│   ├── Valid Time Slot
│   ├── Auto Assignment
│   ├── Confirmation
│   ├── Reschedule
│   ├── Cancellation
│   └── Calendar Integration
│
├── Customer Area
│   ├── Appointments
│   ├── Hair Profile
│   ├── Saved Styles
│   ├── Hair History
│   └── Feedback
│
├── Barber Area
│   ├── Today
│   ├── Schedule
│   ├── Appointment Detail
│   ├── Hairstyle Reference
│   └── Haircut Notes
│
└── Admin Area
    ├── Reservations
    ├── Services
    ├── Barbers
    ├── Schedules
    ├── Hairstyle Knowledge
    ├── Virtual Filter Assets
    ├── Feedback
    ├── Analytics
    └── Settings
```

Marketplace termasuk dalam release ini sebagai supporting commerce module yang terintegrasi dengan personalization.

---



# 138. Marketplace — Product Definition

Marketplace BarberKece adalah **single-store commerce module** untuk menjual produk yang relevan dengan kebutuhan rambut, grooming, dan barbershop.

Marketplace tidak berfungsi sebagai platform multi-vendor.

Semua produk berasal dari barbershop / merchant BarberKece yang sama.

Tujuan Marketplace:

1. memudahkan customer membeli produk grooming yang relevan;
2. menghubungkan hairstyle recommendation dengan product recommendation;
3. memperpanjang customer journey setelah haircut;
4. membantu customer merawat atau styling hairstyle yang dipilih;
5. memberikan barbershop channel penjualan tambahan tanpa membuat user keluar dari ekosistem BarberKece.

---

# 139. Marketplace Product Positioning

Marketplace bukan core differentiator utama BarberKece.

Core differentiator tetap:

```text
Haircut Recommendation
+
Real-Time Virtual Hair Filter
+
Smart Reservation
```

Marketplace menjadi:

> **supporting commerce layer**

yang memperkuat personalization.

Contoh:

```text
Textured Crop
↓
Recommended Styling Products
↓
Matte Clay
Hair Powder
Sea Salt Spray
↓
Marketplace
```

---

# 140. Marketplace Primary User Journey

```text
Home / Hairstyle Detail / Recommendation
↓
Marketplace
↓
Browse / Search Product
↓
Product Detail
↓
Add to Cart
↓
Cart
↓
Checkout
↓
Choose Fulfillment
↓
Choose Payment Method
↓
Place Order
↓
Order Confirmation
↓
Order Processing
↓
Completed
```

---

# 141. Marketplace Entry Points

Marketplace dapat diakses melalui:

1. primary navigation `Shop`;
2. homepage section;
3. hairstyle detail;
4. recommendation result;
5. Hair History;
6. order history;
7. product recommendation card;
8. direct product link.

---

# 142. Marketplace Product Categories

Initial categories:

## Hair Styling

- Pomade
- Clay
- Wax
- Hair Powder
- Hairspray
- Sea Salt Spray
- Styling Cream
- Gel

## Hair Care

- Shampoo
- Conditioner
- Hair Tonic
- Hair Serum
- Hair Mask
- Scalp Treatment

## Beard & Grooming

- Beard Oil
- Beard Balm
- Shaving Cream
- Aftershave

## Barber Tools

- Hair Clipper
- Trimmer
- Comb
- Hair Brush
- Scissors
- Razor
- Cape
- Cleaning Brush

Admin dapat menambah kategori baru.

---

# 143. Product Entity Requirements

Setiap product minimal memiliki:

- product name;
- slug;
- short description;
- long description;
- category;
- images;
- selling price;
- optional compare-at price;
- stock quantity;
- SKU;
- active/inactive status;
- product tags;
- usage information;
- suitability tags;
- linked hairstyles optional;
- linked hair types optional;
- linked maintenance preference optional;
- created_at;
- updated_at.

---

# 144. Product Variant Support

Product dapat memiliki variant.

Contoh:

```text
Pomade X

Variant:
- 50g
- 100g
```

atau:

```text
Hair Color Product

Variant:
- Black
- Dark Brown
- Natural Brown
```

Variant dapat memiliki:

- price override;
- stock;
- SKU;
- image.

Release 1 harus mendukung variant sederhana.

---

# 145. Product Availability

Product status:

```text
Active
Out of Stock
Inactive
Archived
```

Rules:

- Active + stock > 0 → purchasable;
- Active + stock = 0 → visible but cannot add to cart;
- Inactive → not visible to customer;
- Archived → retained for historical order reference.

---

# 146. Marketplace Product Search

Customer dapat mencari berdasarkan:

- product name;
- category;
- brand;
- tag;
- use case.

Search harus toleran terhadap partial keyword.

Contoh:

```text
"pom"
→ Pomade
```

Search implementation detail ditentukan Technical Design.

---

# 147. Marketplace Filters

Initial filters:

- category;
- price range;
- availability;
- product type;
- recommended for hairstyle;
- recommended for hair type.

Sorting:

- Recommended;
- Newest;
- Price Low to High;
- Price High to Low;
- Best Selling jika data cukup.

---

# 148. Product Listing Card

Minimal menampilkan:

- product image;
- product name;
- price;
- stock status;
- optional personalization badge.

Contoh:

```text
Recommended for your Textured Crop
```

Card actions:

- View Product;
- Add to Cart jika variant tidak diperlukan;
- Choose Variant jika diperlukan.

---

# 149. Product Detail Page

Required content:

- product name;
- gallery;
- price;
- variant;
- stock;
- description;
- usage;
- relevant hair/style recommendation;
- quantity;
- Add to Cart;
- Buy Now;
- related products;
- hairstyle compatibility where relevant.

---

# 150. Product Recommendation System

Product recommendation harus memanfaatkan data BarberKece jika tersedia.

Potential signals:

- selected hairstyle;
- saved hairstyle;
- Hair Profile;
- maintenance preference;
- previous purchase;
- current haircut history.

Release 1 dapat menggunakan **rule-based recommendation**.

Tidak membutuhkan ML.

---

# 151. Product Recommendation Rules — Release 1

Contoh relationship:

```text
Textured Crop
→ Matte Clay
→ Hair Powder
→ Sea Salt Spray
```

```text
Slick Back
→ Pomade
→ Comb
```

```text
Curly Hair
→ Curl Cream
→ Conditioner
```

Recommendation berasal dari curated metadata.

Tidak boleh random.

---

# 152. Product Recommendation Explainability

Jika produk direkomendasikan secara personal, UI harus memberikan alasan singkat.

Contoh:

> Cocok untuk membantu mempertahankan tekstur pada Textured Crop.

atau:

> Direkomendasikan untuk rambut wavy dengan kebutuhan styling ringan.

---

# 153. Marketplace Cart

Cart harus mendukung:

- add item;
- remove item;
- change quantity;
- variant;
- subtotal;
- stock validation;
- continue shopping;
- checkout.

Cart dapat digunakan oleh guest.

---

# 154. Guest Cart

Guest dapat menambahkan item ke cart tanpa login.

Jika guest login/register:

> cart guest harus dipertahankan dan digabungkan dengan cart account jika memungkinkan tanpa duplikasi yang tidak diinginkan.

Login wajib saat final checkout.

---

# 155. Cart Stock Validation

Stock harus divalidasi:

1. saat add to cart;
2. saat quantity changed;
3. saat membuka checkout;
4. saat place order.

Cart tidak sama dengan stock reservation.

Product berada di cart tidak menjamin stock terkunci.

---

# 156. Cart Edge Case — Stock Changed

Jika stock berubah sebelum checkout:

Contoh:

```text
Requested: 3
Available: 2
```

Sistem harus:

- menjelaskan perubahan;
- update maximum quantity;
- meminta user review cart.

Tidak boleh silently mengubah order tanpa notice.

---

# 157. Buy Now

Product Detail memiliki:

> Buy Now

Flow:

```text
Product
↓
Selected Variant
↓
Quantity
↓
Checkout
```

Existing cart tidak boleh hilang.

---

# 158. Marketplace Checkout

Checkout harus memiliki urutan jelas:

```text
1. Contact Information
2. Fulfillment Method
3. Order Review
4. Payment Method
5. Place Order
```

User tidak perlu mengisi informasi yang sudah ada di account kecuali ingin mengubahnya.

---

# 159. Fulfillment Method

Release 1 minimal mendukung:

> **Pickup at Barbershop**

Ini adalah metode utama dan paling cocok dengan zero-cost direction.

Optional jika bisnis membutuhkan:

> Local Delivery

Shipping nasional tidak wajib Release 1.

---

# 160. Pickup at Barbershop

Customer dapat memilih:

```text
Pickup at BarberKece
```

Order confirmation menampilkan:

- location;
- opening hours;
- pickup instruction;
- order reference.

Pickup time scheduling tidak wajib pada Release 1.

---

# 161. Local Delivery — Optional Release 1 Capability

Jika diaktifkan admin:

customer mengisi:

- recipient name;
- phone;
- address;
- delivery note.

Delivery cost dapat:

- fixed;
- zone-based.

Real-time courier API bukan requirement.

---

# 162. Marketplace Payment Methods

Untuk menjaga development tetap rendah biaya, Release 1 dapat menggunakan:

## Method A — Pay at Barbershop

Cocok untuk pickup.

## Method B — Manual Bank Transfer

Jika digunakan:

customer melihat payment instruction.

Admin memverifikasi secara manual.

Upload payment proof optional.

Payment gateway tidak wajib.

---

# 163. Marketplace Payment Status

Supported:

```text
Unpaid
Awaiting Verification
Paid
Payment Failed
Refunded
Partially Refunded
```

Tidak semua state harus digunakan jika hanya Pay at Barbershop.

---

# 164. Marketplace Order Status

Order lifecycle:

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

Flow menyesuaikan fulfillment method.

---

# 165. Marketplace Order Creation

Saat `Place Order`:

system harus:

1. validate user;
2. validate item active;
3. validate variant;
4. validate latest price;
5. validate stock;
6. calculate totals;
7. create immutable order item snapshot;
8. decrement/reserve stock secara atomic sesuai implementation;
9. generate order reference;
10. show confirmation.

---

# 166. Order Item Snapshot

Historical order harus menyimpan snapshot:

- product name;
- variant name;
- unit price;
- quantity;
- image reference optional;
- SKU.

Perubahan product setelah order tidak boleh mengubah historical order.

---

# 167. Marketplace Pricing

Order total:

```text
Subtotal
+ Delivery Fee
- Discount
= Grand Total
```

Release 1 tidak wajib memiliki discount engine.

Data model dapat menyediakan ruang untuk discount amount.

---

# 168. Marketplace Stock Management

Walaupun inventory bukan differentiator produk, basic stock management diperlukan agar Marketplace valid.

Admin harus dapat:

- set stock;
- adjust stock;
- see low-stock indicator;
- deactivate product.

Basic stock history recommended.

---

# 169. Inventory Adjustment

Stock adjustment reason:

- Initial Stock;
- Restock;
- Sale;
- Manual Correction;
- Damaged;
- Returned.

Admin adjustment harus menghasilkan audit record.

---

# 170. Overselling Prevention

Critical requirement:

> Sistem tidak boleh menyelesaikan dua order yang menyebabkan stock menjadi negatif.

Final stock validation/decrement harus atomic.

---

# 171. Marketplace Admin — Product Management

Admin dapat:

- create product;
- edit product;
- manage category;
- manage variant;
- upload image;
- set price;
- set stock;
- activate/deactivate;
- archive;
- link product to hairstyle;
- link product to hair type;
- set recommendation metadata.

---

# 172. Marketplace Admin — Order Management

Admin dapat:

- search order;
- filter by status;
- filter by fulfillment;
- open order;
- verify payment;
- mark processing;
- mark ready;
- mark completed;
- cancel;
- refund status;
- add internal note.

---

# 173. Marketplace Customer — Order History

Authenticated customer dapat melihat:

- order reference;
- order date;
- items;
- total;
- status;
- fulfillment;
- payment status.

Actions:

- View Details;
- Buy Again;
- Cancel if policy allows.

---

# 174. Marketplace Cancellation Policy

Default rule:

Customer dapat cancel sendiri jika order masih:

```text
Placed
or
Awaiting Payment
```

Setelah:

```text
Processing
```

self-cancel disabled.

Admin masih dapat cancel dengan reason.

---

# 175. Refund Scope

Karena payment gateway bukan requirement:

refund processing dapat dilakukan manual.

System hanya mencatat:

- refund status;
- amount;
- reason;
- timestamp;
- admin.

Detailed accounting bukan scope.

---

# 176. Marketplace Notification Events

Recommended:

- order placed;
- payment verified;
- order processing;
- ready for pickup;
- out for delivery;
- completed;
- cancelled.

Release 1 channel:

- in-app/web;
- email.

---

# 177. Marketplace Analytics Events

```text
shop_viewed
product_viewed
product_searched
product_filter_used
product_recommended_clicked
product_added_to_cart
product_removed_from_cart
cart_viewed
checkout_started
fulfillment_selected
payment_method_selected
order_placed
order_completed
order_cancelled
buy_again_clicked
```

---

# 178. Marketplace KPIs

Core commerce metrics:

## Product View to Cart Rate

```text
add_to_cart
/
product views
```

## Checkout Conversion

```text
orders placed
/
checkout starts
```

## Marketplace Conversion Rate

```text
completed orders
/
shop sessions
```

## Personalized Product Conversion

```text
orders containing recommended products
/
sessions where recommendations were shown
```

## Average Order Value

```text
revenue
/
completed orders
```

---

# 179. Cross-Feature Personalization

Marketplace harus memanfaatkan ecosystem BarberKece.

Example:

```text
Hair Recommendation
Textured Crop
↓
Book Haircut
↓
Completed Haircut
↓
Hair History
↓
"Maintain your Textured Crop"
↓
Recommended Matte Clay
↓
Marketplace
```

Ini adalah preferred commerce experience.

---

# 180. Post-Haircut Product Recommendation

Setelah appointment Completed:

customer dapat melihat:

```text
Maintain Your Look
```

Products recommended berdasarkan:

- hairstyle;
- barber knowledge;
- Hair Profile.

Barber dapat memiliki curated product mapping.

---

# 181. Barber Product Recommendation

Optional capability:

Barber dapat menandai produk yang direkomendasikan setelah haircut.

Contoh:

```text
Recommended by Andi:
Matte Clay X
```

Customer dapat melihatnya di Hair History.

Barber tidak dapat mengubah price atau stock.

---

# 182. Hairstyle Detail + Marketplace Integration

Hairstyle Detail dapat memiliki section:

```text
Products for This Style
```

Section harus muncul setelah hairstyle knowledge utama agar commerce tidak mengganggu discovery.

---

# 183. Marketplace UX Principles

Marketplace mengikuti prinsip:

- clear;
- simple;
- no deceptive urgency;
- no fake scarcity;
- no hidden fee;
- no preselected paid add-on;
- stock accurate;
- total cost visible before order.

---

# 184. Marketplace Empty States

## Empty Cart

> Keranjangmu masih kosong.

Actions:

- Browse Products;
- View Recommended Products.

## No Orders

> Belum ada pesanan produk.

## No Search Results

> Produk tidak ditemukan.

Suggest:

- clear filters;
- alternative keyword;
- browse categories.

---

# 185. Marketplace Error States

Known errors require explicit handling:

- item out of stock;
- variant unavailable;
- price changed;
- stock changed;
- payment verification failed;
- order creation conflict;
- delivery unavailable;
- uploaded proof invalid.

User harus diberikan recovery action.

---

# 186. Marketplace Accessibility

Requirements:

- product image alt text;
- accessible quantity controls;
- price announced properly;
- cart updates announced for assistive tech;
- validation errors accessible;
- checkout keyboard navigable;
- status tidak hanya menggunakan warna.

---

# 187. Marketplace Performance

Requirements:

- product images optimized;
- responsive images;
- lazy load below fold;
- cart interaction cepat;
- checkout tidak memuat Virtual Hair Filter models;
- filter ML asset dan commerce asset loading dipisahkan.

---

# 188. Marketplace SEO

Indexable:

- Shop;
- Category;
- Product Detail.

Product page metadata:

- title;
- description;
- canonical URL;
- Open Graph;
- structured product data jika applicable.

Cart/checkout/order pages:

> noindex.

---

# 189. Marketplace Privacy

Collect only data needed for:

- account;
- order;
- fulfillment;
- payment verification.

Delivery address hanya diperlukan jika delivery digunakan.

Do not expose customer order to barber unless operationally required.

---

# 190. Marketplace Security

Minimum:

- server-side price validation;
- server-side stock validation;
- authorization on orders;
- customer can access only own order;
- admin actions protected;
- payment proof upload validation;
- checkout rate limiting where needed;
- totals never trusted from client.

---

# 191. Marketplace Audit Logging

Admin events requiring audit:

- price change;
- stock adjustment;
- payment verification;
- order cancellation;
- refund status;
- product archive;
- manual order status override.

---

# 192. Marketplace Conceptual Entities

Additional entities:

```text
Product
ProductCategory
ProductVariant
ProductImage
ProductHairstyleRecommendation
ProductHairTypeRecommendation
Cart
CartItem
Order
OrderItem
OrderStatusHistory
PaymentRecord
Fulfillment
InventoryAdjustment
```

Physical schema belongs to Technical Design.

---

# 193. Product Conceptual Fields

```text
id
name
slug
description
category_id
base_price
sku
stock_quantity
active
created_at
updated_at
```

Variant may override:

```text
price
sku
stock
```

---

# 194. Order Conceptual Fields

```text
id
customer_id
order_reference
status
payment_status
fulfillment_type
subtotal
delivery_fee
discount_amount
grand_total
recipient_name
phone
address nullable
customer_note nullable
created_at
updated_at
completed_at nullable
cancelled_at nullable
```

---

# 195. Marketplace Acceptance Criteria

Marketplace is accepted when:

1. customer can browse active products;
2. customer can search/filter products;
3. product detail displays correct price/stock;
4. variant selection works;
5. cart supports add/remove/update;
6. unavailable stock cannot be ordered;
7. guest cart can survive login where supported;
8. checkout validates latest price and stock;
9. order can be placed;
10. customer sees order confirmation;
11. admin sees order;
12. stock cannot become negative from concurrent orders;
13. customer can view own order history;
14. unauthorized user cannot access other orders;
15. product recommendation can link from hairstyle;
16. product recommendation explanation uses curated metadata;
17. order lifecycle can be managed;
18. critical admin changes are audited.

---

# 196. Marketplace Test Scenarios

Minimum:

1. browse active products;
2. inactive product hidden;
3. out-of-stock product visible but disabled;
4. variant stock differs;
5. add to cart;
6. quantity exceeds stock;
7. stock changes before checkout;
8. price changes before checkout;
9. guest login with cart;
10. place pickup order;
11. manual payment order;
12. concurrent last-stock purchase;
13. order cancellation before processing;
14. cancellation after processing;
15. admin payment verification;
16. order completion;
17. recommendation → product → order;
18. unauthorized order access.

---

# 197. Updated Release 1 Scope — Marketplace Included

Release 1 now includes:

```text
Marketplace
├── Product Catalog
├── Categories
├── Search
├── Filters
├── Product Detail
├── Product Variant
├── Basic Inventory
├── Cart
├── Checkout
├── Pickup
├── Optional Local Delivery
├── Offline / Manual Payment Flow
├── Order Management
├── Order History
├── Product Recommendation
└── Hairstyle Integration
```

The following remain future expansion:

- marketplace multi-vendor;
- nationwide courier integration;
- complex promotion engine;
- loyalty commerce;
- live shopping;
- subscription product;
- advanced payment gateway orchestration.

---

# 198. Updated End-to-End BarberKece Ecosystem

BarberKece customer ecosystem becomes:

```text
                     BARBERKECE
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
        ▼                 ▼                 ▼
   DISCOVER            VISUALIZE           SHOP
        │                 │                 │
 Hair Profile       Virtual Hair Filter   Marketplace
        │                 │                 │
        ▼                 ▼                 │
 Recommendation ──────► Select Style        │
        │                 │                 │
        └──────────┬──────┘                 │
                   ▼                        │
                 BOOK                       │
                   │                        │
              Reservation                   │
                   │                        │
                   ▼                        │
               Haircut                      │
                   │                        │
                   ▼                        │
              Hair History                  │
                   │                        │
            ┌──────┴────────┐               │
            ▼               ▼               │
      Better Future     Maintain Look ──────┘
     Recommendation      Product Recommendation
```

Marketplace menjadi bagian dari customer lifecycle tanpa mengambil alih identitas utama BarberKece.

---

# 199. Updated Final Scope Statement

Release 1 BarberKece harus memberikan pengalaman lengkap berikut:

```text
Responsive Website
│
├── Public Experience
│   ├── Home
│   ├── Hairstyle Library
│   ├── Hairstyle Detail
│   ├── Barber Profiles
│   ├── Service Information
│   └── Marketplace
│
├── Hair Intelligence
│   ├── Hair Profile
│   ├── Hairstyle Knowledge Base
│   ├── Explainable Recommendation
│   └── Hair History
│
├── Virtual Experience
│   ├── Live Camera
│   ├── Face / Head Tracking
│   ├── Hairstyle Rendering
│   ├── Style Switching
│   └── Selected Style → Booking
│
├── Smart Reservation
│   ├── Service
│   ├── Optional Barber Preference
│   ├── Date
│   ├── Valid Time Slot
│   ├── Auto Assignment
│   ├── Confirmation
│   ├── Reschedule
│   ├── Cancellation
│   └── Calendar Integration
│
├── Marketplace
│   ├── Catalog
│   ├── Search & Filter
│   ├── Product Detail
│   ├── Variants
│   ├── Cart
│   ├── Checkout
│   ├── Pickup
│   ├── Optional Local Delivery
│   ├── Order
│   ├── Basic Stock
│   └── Personalized Product Recommendation
│
├── Customer Area
│   ├── Appointments
│   ├── Hair Profile
│   ├── Saved Styles
│   ├── Hair History
│   ├── Orders
│   └── Feedback
│
├── Barber Area
│   ├── Today
│   ├── Schedule
│   ├── Appointment Detail
│   ├── Hairstyle Reference
│   ├── Product Recommendation Optional
│   └── Haircut Notes
│
└── Admin Area
    ├── Reservations
    ├── Services
    ├── Barbers
    ├── Schedules
    ├── Hairstyle Knowledge
    ├── Virtual Filter Assets
    ├── Products
    ├── Categories
    ├── Inventory
    ├── Orders
    ├── Payments
    ├── Feedback
    ├── Analytics
    └── Settings
```

Marketplace is now an official supporting feature in Release 1.


# 137. Next Documents After This PRD

This PRD should be followed by separate documents in this order:

```text
1. UX / Information Architecture Specification
2. Technical & System Design
3. Database Schema
4. API Contract
5. Recommendation Engine Specification
6. Virtual Hair Filter Technical Specification
7. Design System / UI Specification
8. Implementation Plan
9. Test Plan
```

Do not collapse all of these into one uncontrolled coding prompt.

The PRD defines **what BarberKece must do and how the product should behave**.

Technical Design defines **how it will be built**.

# Project Context — Barbershop Personalized Digital Platform

## 1. Tujuan Dokumen

Dokumen ini adalah **project context / handoff context**, bukan PRD.

Tujuannya adalah memberikan pemahaman menyeluruh kepada AI, developer, designer, atau tools lain mengenai project Barbershop yang sedang dirancang, termasuk:

- latar belakang project,
- problem yang ingin diselesaikan,
- arah produk,
- keputusan yang sudah disepakati,
- fitur utama,
- user flow,
- logika reservasi,
- konsep Haircut Knowledge & Recommendation System,
- konsep real-time virtual hairstyle filter,
- posisi marketplace,
- batasan teknis,
- dan arah pengembangan project.

Dokumen ini harus diperlakukan sebagai **sumber konteks utama** sebelum membuat PRD, UI/UX, database schema, system design, codebase, wireframe, prompt engineering, atau implementasi fitur.

---

# 2. Gambaran Umum Project

Project ini adalah sebuah **responsive web platform untuk barbershop** yang bertujuan memberikan pengalaman digital yang lebih personal kepada pelanggan.

Platform ini bukan sekadar:

- website profil barbershop,
- booking system biasa,
- queue system,
- katalog hairstyle,
- atau marketplace sederhana.

Arah utama project adalah membangun sebuah:

> **Personalized Digital Barbershop Platform**

yang membantu user dalam tiga tahap utama:

1. **menentukan gaya rambut yang cocok,**
2. **melakukan reservasi haircut dengan proses yang sederhana dan efisien,**
3. **mendapatkan pengalaman barbershop yang lebih personal berdasarkan preferensi dan riwayatnya.**

Marketplace direncanakan sebagai fitur tambahan, tetapi bukan differentiator utama untuk saat ini.

---

# 3. Problem Utama yang Ingin Diselesaikan

## 3.1 User sering tidak tahu model rambut yang cocok

Banyak pelanggan datang ke barbershop dengan kondisi seperti:

- tidak tahu nama hairstyle yang diinginkan,
- hanya membawa foto referensi,
- bingung apakah hairstyle tertentu cocok dengan bentuk wajahnya,
- tidak memahami karakteristik rambut sendiri,
- tidak tahu tingkat maintenance dari hairstyle tertentu,
- atau hanya berkata kepada barber:

> "Yang cocok buat saya apa?"

Saat ini, keputusan tersebut sangat bergantung pada pengalaman barber.

Masalahnya:

- pengalaman setiap barber berbeda,
- rekomendasi bisa tidak konsisten,
- pelanggan sulit membandingkan beberapa opsi hairstyle,
- preferensi pelanggan dari kunjungan sebelumnya sering tidak terdokumentasi.

Project ini ingin membuat sistem yang dapat membantu proses tersebut secara lebih terstruktur.

---

## 3.2 Reservasi barbershop sering memiliki terlalu banyak friction

Reservasi melalui chat seperti WhatsApp dapat menimbulkan masalah:

- user harus bertanya jam kosong,
- admin harus mengecek jadwal secara manual,
- terjadi bolak-balik pesan,
- user harus menunggu jawaban,
- user bisa bingung menentukan jam,
- potensi double booking,
- sulit memastikan barber tertentu tersedia.

Project ini ingin membuat proses reservasi yang:

- cepat,
- jelas,
- tidak membingungkan,
- membutuhkan sedikit input dari user,
- dan secara otomatis menangani availability barber.

---

## 3.3 User tertentu memiliki barber langganan

Sebagian pelanggan memiliki barber favorit/langganan karena:

- sudah memahami bentuk rambut user,
- hasil cukurnya dianggap lebih cocok,
- user sudah percaya dengan barber tersebut.

Karena itu, sistem harus mengakomodasi dua tipe user:

### User yang memiliki barber favorit

User dapat memilih barber tertentu ketika melakukan reservasi.

### User yang tidak memiliki barber favorit

User tidak perlu memilih barber.

Sistem akan menentukan barber yang tersedia secara otomatis.

Pemilihan barber bersifat **opsional**, bukan wajib.

---

# 4. Platform yang Dipilih

Platform utama project adalah:

> **Responsive Website / Mobile-First Web Application**

Bukan Android native sebagai platform utama.

Website harus dirancang agar nyaman digunakan di:

- Android smartphone,
- iPhone,
- tablet,
- laptop,
- desktop.

Prioritas desain adalah **mobile-first**, karena sebagian besar pelanggan kemungkinan melakukan reservasi atau mencoba fitur hairstyle melalui smartphone.

---

# 5. Alasan Memilih Responsive Website

Keputusan menggunakan responsive website didasarkan pada beberapa alasan.

## 5.1 Tidak membutuhkan instalasi

User dapat langsung mengakses platform dari:

- Instagram,
- Google,
- WhatsApp,
- QR di barbershop,
- atau link lainnya.

Flow yang diinginkan:

```text
User membuka link
        ↓
Website terbuka
        ↓
User menggunakan fitur
```

Tidak diperlukan:

```text
Download app
↓
Install
↓
Buka aplikasi
↓
Baru menggunakan layanan
```

---

## 5.2 Cocok untuk reservasi

Reservasi adalah aktivitas yang idealnya dapat dilakukan secepat mungkin.

Responsive website mengurangi friction karena user cukup membuka browser.

---

## 5.3 Masih dapat menggunakan kamera

Modern browser dapat mengakses kamera melalui permission user.

Karena itu, fitur real-time hairstyle filter tetap memungkinkan dikembangkan melalui web.

---

## 5.4 Dapat dikembangkan menjadi PWA

Website dapat dikembangkan menjadi Progressive Web App jika diperlukan.

Dengan PWA:

- website dapat ditambahkan ke home screen,
- pengalaman penggunaan dapat terasa seperti aplikasi,
- tetapi tetap menggunakan satu web codebase.

PWA bukan requirement MVP saat ini, tetapi arsitektur sebaiknya tidak menghalangi pengembangan ke arah tersebut.

---

# 6. Product Positioning

Project ini sebaiknya **tidak diposisikan hanya sebagai website booking barbershop**.

Positioning yang lebih tepat:

> **Personalized Digital Barbershop Platform with Haircut Recommendation, Virtual Hairstyle Experience, and Smart Reservation**

Nilai utama project bukan berasal dari fitur CRUD seperti:

- invoice,
- stock management,
- queue number,
- QR code,
- atau dashboard sederhana.

Fitur seperti itu boleh ada jika memang diperlukan, tetapi bukan core uniqueness project.

Project harus memiliki identitas yang kuat pada:

- personalization,
- hairstyle knowledge,
- recommendation,
- virtual hairstyle experience,
- customer preference,
- dan simple reservation.

---

# 7. Core Feature 1 — Smart Reservation

## 7.1 Prinsip utama

Reservasi harus dirancang berdasarkan prinsip:

> **User hanya membuat keputusan yang memang perlu dibuat. Sistem menangani sisanya.**

User tidak boleh dibebani dengan input yang tidak diperlukan.

Contohnya:

User **tidak perlu mengetik jam mulai dan jam selesai secara manual**.

---

# 8. Struktur Reservasi

Flow utama:

```text
Pilih Layanan
      ↓
Pilih Tanggal
      ↓
Pilih Slot Waktu yang Tersedia
      ↓
Pilih Barber (Opsional)
      ↓
Review
      ↓
Konfirmasi Reservasi
```

---

# 9. Time Slot Reservasi

Barbershop menentukan:

- jam buka,
- jam tutup,
- durasi slot,
- jadwal kerja setiap barber,
- break time,
- hari libur,
- atau jam khusus tertentu.

Contoh konfigurasi:

```text
Opening Time  : 09:00
Closing Time  : 18:00
Slot Duration : 60 minutes
```

Sistem kemudian dapat menghasilkan slot seperti:

```text
09:00 - 10:00
10:00 - 11:00
11:00 - 12:00
12:00 - 13:00
13:00 - 14:00
14:00 - 15:00
15:00 - 16:00
16:00 - 17:00
17:00 - 18:00
```

User cukup memilih slot yang tersedia.

---

# 10. Slot Tidak Boleh Dipahami sebagai Kapasitas Satu Toko

Availability harus dihitung berdasarkan barber.

Contoh:

```text
09:00 - 10:00

Andi   : Available
Budi   : Booked
Candra : Available
Doni   : Available
```

Artinya slot 09:00–10:00 masih memiliki kapasitas karena masih terdapat barber yang tersedia.

Dengan empat barber, satu slot waktu dapat melayani lebih dari satu pelanggan selama barber berbeda masih tersedia.

---

# 11. Optional Barber Selection

Pada proses reservasi terdapat opsi seperti:

```text
Barber Preference

[ Default ] Any Available Barber

or

- Andi
- Budi
- Candra
- Doni
```

### Default

Default harus:

> **Any Available Barber**

Hal ini mengurangi friction bagi user yang tidak memiliki barber favorit.

---

# 12. Jika User Memilih Barber Tertentu

Contoh:

```text
Date:
12 September

Time:
10:00 - 11:00

Preferred Barber:
Andi
```

Sistem harus mengecek:

```text
Apakah Andi bekerja pada tanggal tersebut?
        ↓
Apakah Andi available pada jam tersebut?
        ↓
Jika ya:
booking dapat dilanjutkan.
```

Jika tidak tersedia, sistem tidak boleh sekadar menampilkan error generik.

Sistem harus memberikan alternatif yang membantu.

Contoh:

```text
Andi tidak tersedia pada 10:00 - 11:00.

Available alternatives:
- Andi, 11:00 - 12:00
- Andi, 13:00 - 14:00

atau

- Any Barber, 10:00 - 11:00
```

Tujuannya agar user tidak harus mengulang proses dari awal.

---

# 13. Jika User Tidak Memilih Barber

Jika user memilih:

> **Any Available Barber**

maka sistem memilih barber yang tersedia secara otomatis.

Assignment dapat menggunakan rule sederhana seperti:

- barber dengan jumlah booking lebih sedikit,
- round-robin,
- first available,
- atau workload balancing.

Algoritma final belum ditetapkan.

Yang wajib adalah:

- hasil assignment masuk akal,
- tidak menyebabkan double booking,
- dan tidak menambah langkah bagi user.

---

# 14. Service Duration

Untuk versi awal, barbershop dapat menggunakan fixed slot duration.

Contoh:

```text
Haircut = 60 minutes
```

Namun arsitektur sebaiknya memungkinkan variasi layanan di masa depan.

Contoh:

```text
Haircut                = 60 minutes
Haircut + Hair Wash    = 75 minutes
Hair Coloring          = 120 minutes
Hair Treatment         = 90 minutes
```

Jika variasi durasi digunakan, sistem reservasi harus menghitung availability berdasarkan durasi service.

Untuk MVP, fixed slot dapat digunakan jika ingin menyederhanakan implementasi.

---

# 15. Tujuan UX Reservasi

User harus bisa memahami reservation flow tanpa membutuhkan penjelasan tambahan.

Target ideal:

```text
Pilih service
↓
Pilih tanggal
↓
Pilih jam
↓
Opsional pilih barber
↓
Confirm
```

Hal-hal berikut harus dihindari:

- meminta user mengetik waktu manual,
- meminta user menghitung durasi,
- menampilkan barber yang sebenarnya tidak available,
- meminta user memilih terlalu banyak konfigurasi,
- error setelah user mengisi seluruh form,
- memaksa user memilih barber.

---

# 16. Core Feature 2 — Haircut Knowledge & Recommendation System

Feature ini adalah salah satu differentiator utama project.

Tujuannya:

> membantu user menemukan hairstyle yang paling sesuai dengan dirinya.

Sistem tidak boleh hanya menjadi katalog hairstyle.

Output harus berupa:

- rekomendasi,
- compatibility,
- reasoning,
- dan informasi hairstyle.

---

# 17. Konsep Hair Profile

Sistem dapat memiliki data karakteristik user seperti:

- face shape,
- hair type,
- hair thickness,
- hair length,
- hairline,
- maintenance preference,
- style preference.

Contoh Hair Profile:

```text
Face Shape        : Oval
Hair Type         : Wavy
Hair Thickness    : Thick
Current Length    : Medium
Maintenance       : Low
Preferred Style   : Modern / Casual
```

Data ini dapat diperoleh dari:

1. manual questionnaire,
2. image analysis,
3. camera analysis,
4. atau kombinasi beberapa metode.

---

# 18. Hairstyle Knowledge Base

Setiap hairstyle harus memiliki metadata yang dapat digunakan oleh recommendation engine.

Contoh:

```text
Hairstyle:
Textured Crop

Suitable Face Shape:
- Oval
- Square
- Round

Suitable Hair Type:
- Straight
- Wavy

Hair Thickness:
- Medium
- Thick

Maintenance Level:
Low

Style:
- Modern
- Casual
- Textured
```

Knowledge base ini penting agar rekomendasi tidak menjadi random.

---

# 19. Recommendation Output

Output sebaiknya bukan:

```text
Recommended:
Textured Crop
```

Tetapi lebih informatif:

```text
Textured Crop
Compatibility: 92%

Why it matches:
- Cocok dengan oval face shape
- Cocok untuk wavy hair
- Cocok untuk thick hair
- Maintenance relatif rendah
- Sesuai dengan modern casual preference
```

Sistem idealnya memberikan beberapa recommendation.

Contoh:

```text
1. Textured Crop   — 92%
2. Messy Fringe    — 87%
3. French Crop     — 82%
```

---

# 20. Recommendation Engine untuk MVP

Machine Learning **tidak wajib** untuk recommendation engine awal.

Versi MVP dapat menggunakan:

> **Knowledge-Based Recommendation + Weighted Scoring**

Contoh:

```text
Compatibility Score =
Face Shape Match
+ Hair Type Match
+ Hair Thickness Match
+ Maintenance Match
+ Style Preference Match
+ Previous Feedback
```

Contoh bobot:

```text
Face Shape          : 25%
Hair Type           : 20%
Hair Thickness      : 15%
Maintenance         : 15%
Style Preference    : 15%
Previous Feedback   : 10%
```

Nilai bobot belum final dan dapat berubah setelah riset lebih lanjut.

Prinsipnya adalah recommendation harus:

- explainable,
- reproducible,
- tidak random,
- dan dapat dijelaskan ketika presentasi project.

---

# 21. Customer Hair History

Sistem diharapkan dapat menyimpan pengalaman haircut user sebelumnya.

Contoh data:

```text
Previous Haircut:
Textured Crop

Rating:
3/5

Feedback:
"Bagian depan terlalu pendek."
```

Pada recommendation berikutnya, sistem dapat mempertimbangkan data tersebut.

Contoh:

```text
Messy Fringe
Compatibility: 89%

Reason:
- sesuai dengan face shape,
- sesuai dengan hair type,
- mempertimbangkan feedback sebelumnya bahwa user tidak menyukai bagian depan terlalu pendek.
```

Konsep ini disebut:

> **Customer Haircut Memory**

Tujuannya adalah meningkatkan personalization seiring penggunaan sistem.

---

# 22. Barber Knowledge System

Selain recommendation untuk customer, project dapat memiliki knowledge system untuk barber.

Contoh informasi hairstyle:

```text
Textured Crop

Difficulty:
Medium

Recommended Hair:
Straight / Wavy

Recommended Top Length:
4–6 cm

Technique:
Texturizing

Common Mistakes:
- Jangan memotong fringe terlalu pendek pada user tertentu.
- Hindari thinning berlebihan pada rambut tipis.
```

Tujuannya:

- membantu barber baru,
- membuat knowledge lebih konsisten,
- mendokumentasikan knowledge,
- dan membantu diskusi barber dengan pelanggan.

Fitur ini termasuk bagian penting dari konsep Haircut Knowledge System, tetapi prioritas implementasinya dapat disesuaikan dengan scope MVP.

---

# 23. Core Feature 3 — Real-Time Virtual Hairstyle Filter

Project ingin menggunakan:

> **Level 3 Hair Filter / TikTok-like Real-Time Hairstyle Filter**

Artinya user menggunakan kamera smartphone/browser dan dapat mencoba tampilan hairstyle secara real-time.

Target pengalaman:

```text
Camera aktif
      ↓
Wajah user terdeteksi
      ↓
Posisi kepala dilacak
      ↓
Hairstyle virtual ditempatkan pada kepala
      ↓
Hairstyle mengikuti gerakan kepala
      ↓
User dapat mengganti hairstyle
```

---

# 24. TikTok Tidak Digunakan sebagai Dependency

TikTok hanya menjadi:

> **referensi UX dan experience**

Project tidak dirancang dengan asumsi dapat mengambil filter TikTok lalu memasukkannya ke website.

Alasannya:

- filter berada dalam ecosystem TikTok,
- penggunaan asset/filter pihak lain memiliki dependency,
- integrasi belum tentu tersedia untuk web,
- API/SDK dapat berubah,
- dan project sebaiknya tidak bergantung pada third-party filter.

Karena itu, virtual hairstyle filter akan dibuat sendiri menggunakan computer vision dan rendering.

---

# 25. Teknologi Dasar Virtual Hair Filter

Pipeline konsep:

```text
Web Camera
    ↓
Face Detection
    ↓
Face Landmark Tracking
    ↓
Head Pose Estimation
    ↓
Hair / Head Region Analysis
    ↓
Hairstyle Asset Alignment
    ↓
Real-Time Rendering
```

Pada versi yang lebih advanced dapat ditambahkan:

```text
Hair Segmentation
```

untuk meningkatkan realism.

---

# 26. Machine Learning pada Hair Filter

Untuk real-time filter, penggunaan **Computer Vision / Machine Learning sangat relevan**.

ML/CV dapat digunakan untuk:

- face detection,
- facial landmark detection,
- head pose tracking,
- hair segmentation,
- atau image analysis.

Namun hairstyle rendering sendiri tidak harus sepenuhnya menggunakan ML.

Rendering dapat menggunakan:

- 2D asset,
- 3D asset,
- WebGL,
- atau WebGPU.

---

# 27. Zero-Cost Development Target

Project menargetkan sebisa mungkin:

> **zero-cost untuk development dan MVP**

Untuk hair filter, hal ini memungkinkan jika inference dijalankan di device user.

Contoh:

```text
User Browser
│
├── Camera
├── Face Detection Model
├── Landmark Model
├── Hair Segmentation Model
├── Hairstyle Rendering
└── Recommendation UI
```

Dengan pendekatan ini:

- tidak perlu membayar AI API per request,
- tidak perlu cloud GPU inference untuk setiap user,
- dan sebagian processing dilakukan client-side.

---

# 28. Kandidat Teknologi untuk Hair Filter

Teknologi yang dapat dipertimbangkan:

### Face / Landmark Detection

- MediaPipe
- TensorFlow.js-compatible models

### ML Runtime

- TensorFlow.js
- MediaPipe
- ONNX Runtime Web jika dibutuhkan

### Rendering

- Canvas
- WebGL
- WebGPU
- Three.js jika menggunakan 3D model

### Camera

- Browser MediaDevices / getUserMedia

Teknologi final belum ditetapkan.

Pemilihan harus mempertimbangkan:

- browser support,
- Android performance,
- latency,
- model size,
- loading time,
- mobile hardware,
- dan implementation complexity.

---

# 29. Target Quality Hair Filter

Target awal:

> filter harus usable, responsive, dan cukup stabil untuk menunjukkan hairstyle secara real-time.

Tidak wajib langsung memiliki photorealistic quality setara TikTok.

Perlu dipahami:

```text
Simple Hair Overlay
```

relatif mudah tetapi dapat terlihat seperti sticker.

Sedangkan:

```text
Realistic Hair Replacement
```

jauh lebih kompleks karena membutuhkan:

- occlusion handling,
- hair segmentation,
- head tracking,
- lighting adaptation,
- scaling,
- angle adjustment,
- dan kemungkinan 3D modeling.

Target project sebaiknya realistis terhadap resource development.

---

# 30. Hair Filter User Experience

Conceptual flow:

```text
Open Hair Filter
      ↓
Allow Camera Permission
      ↓
Face Detected
      ↓
Select Hairstyle
      ↓
Live Preview
      ↓
Swipe / Change Hairstyle
      ↓
View Hairstyle Detail
```

Contoh hairstyle options:

```text
Low Taper
Textured Crop
French Crop
Messy Fringe
Slick Back
Two Block
Comma Hair
Undercut
```

Daftar hairstyle final harus berdasarkan knowledge base project.

---

# 31. Hubungan Hair Filter dengan Recommendation

Hair filter dan recommendation **bukan fitur yang harus berdiri sendiri**.

Flow yang diharapkan:

```text
Hair Analysis / Hair Profile
            ↓
Recommendation Engine
            ↓
Top Hairstyle Recommendations
            ↓
Try Hairstyle
            ↓
Real-Time Hair Filter
```

Dengan demikian:

- recommendation menjawab **"apa yang cocok?"**
- virtual filter menjawab **"kira-kira terlihat seperti apa?"**

Keduanya saling melengkapi.

---

# 32. Hubungan Hair Recommendation dengan Reservation

User harus dapat berpindah dari hairstyle ke booking secara natural.

Contoh:

```text
Textured Crop
      ↓
92% Match
      ↓
Try This Style
      ↓
Book This Haircut
      ↓
Reservation
```

Konsep penting:

> hairstyle yang dipilih dapat diteruskan ke reservation sebagai reference haircut.

Barber kemudian dapat mengetahui model rambut yang ingin dicoba user.

---

# 33. Marketplace

Marketplace direncanakan tetapi **belum menjadi fokus utama saat ini**.

Marketplace dapat menjual produk seperti:

- hairspray,
- pomade,
- hair powder,
- clay,
- wax,
- shampoo,
- conditioner,
- hair tonic,
- hair clipper,
- comb,
- barber scissors,
- razor,
- beard oil,
- beard balm,
- dan produk relevan lainnya.

Namun marketplace dianggap:

> fitur yang cukup umum/basic dibandingkan feature recommendation dan hair filter.

Karena itu, detail marketplace belum perlu diputuskan sekarang.

---

# 34. Marketplace Tidak Boleh Menjadi Core Differentiator

Project tidak boleh kehilangan identitas karena terlalu banyak fokus pada:

```text
Product
Cart
Checkout
Order
```

Feature tersebut dapat dikembangkan kemudian.

Jika marketplace dikembangkan, integrasi yang lebih menarik adalah:

```text
Hairstyle Recommendation
          ↓
Recommended Styling Products
          ↓
Marketplace
```

Contoh:

```text
Textured Crop

Recommended Products:
- Matte Clay
- Hair Powder
- Sea Salt Spray
```

Dengan cara ini marketplace terhubung dengan personalization system.

---

# 35. Product Ecosystem

Target akhirnya adalah membuat semua feature saling terhubung.

```text
                USER
                  │
                  ▼
         PERSONAL HAIR PROFILE
                  │
                  ▼
      HAIRSTYLE RECOMMENDATION
                  │
                  ▼
         VIRTUAL HAIR FILTER
                  │
                  ▼
        SELECT HAIRSTYLE
                  │
                  ▼
            RESERVATION
                  │
                  ▼
              HAIRCUT
                  │
                  ▼
              FEEDBACK
                  │
                  ▼
       CUSTOMER HAIR HISTORY
                  │
                  ▼
     BETTER FUTURE RECOMMENDATION
```

Marketplace dapat masuk sebagai supporting flow:

```text
Selected Hairstyle
        ↓
Recommended Hair Products
        ↓
Marketplace
```

---

# 36. Personalized Experience

Salah satu arah penting project adalah:

> semakin sering user menggunakan sistem, semakin personal experience yang diberikan.

Contoh data yang dapat disimpan:

- hairstyle yang pernah dipilih,
- hairstyle yang pernah dicoba,
- hasil haircut sebelumnya,
- rating haircut,
- komentar user,
- barber favorit,
- style preference,
- maintenance preference,
- hair characteristics,
- booking history.

Data tersebut dapat digunakan untuk recommendation berikutnya.

---

# 37. Roles

Untuk menjaga sistem tetap sederhana, secara konseptual cukup menggunakan dua role utama:

## 37.1 Customer / User

Kemampuan utama:

- membuat account,
- mengelola hair profile,
- mendapatkan hairstyle recommendation,
- mencoba virtual hairstyle filter,
- melihat hairstyle knowledge,
- melakukan reservation,
- memilih barber jika diinginkan,
- melihat reservation,
- memberikan feedback haircut,
- melihat haircut history.

Marketplace capabilities dapat ditambahkan kemudian.

---

## 37.2 Admin / Barber Side

Sistem internal dapat mencakup:

- manage hairstyle knowledge,
- manage barber profile,
- manage working schedule,
- manage availability,
- view reservation,
- manage service,
- view customer hairstyle reference,
- add haircut notes,
- manage hairstyle compatibility knowledge.

Belum diputuskan apakah:

- Admin dan Barber akan menjadi satu role,
- atau Admin memiliki privilege lebih tinggi dari Barber.

Untuk konteks awal, anggap sisi internal adalah:

> **Barbershop Management Side**

Role permission detail akan ditentukan saat PRD/system design.

---

# 38. Hal yang Sudah Diputuskan

Keputusan berikut dianggap sebagai keputusan yang sudah disepakati.

## Platform

✅ Responsive website  
✅ Mobile-first  
✅ Android user dapat menggunakan melalui browser  
✅ PWA dapat dipertimbangkan kemudian  

## Reservation

✅ User tidak mengetik jam manual  
✅ User memilih slot yang disediakan sistem  
✅ Barber selection opsional  
✅ Default adalah Any Available Barber  
✅ Availability dihitung berdasarkan barber  
✅ Sistem harus menghindari double booking  
✅ UX harus cepat dan tidak membingungkan  

## Hair System

✅ Haircut Knowledge & Recommendation adalah core feature  
✅ Recommendation harus memberikan alasan  
✅ Knowledge base hairstyle diperlukan  
✅ Customer hair history merupakan arah personalization  

## Hair Filter

✅ Target adalah real-time TikTok-like hairstyle filter  
✅ Filter dibuat sendiri  
✅ TikTok bukan dependency  
✅ Camera-based  
✅ Menggunakan CV/ML jika diperlukan  
✅ Sebisa mungkin processing client-side  
✅ Development diarahkan agar zero-cost  

## Marketplace

✅ Marketplace direncanakan  
✅ Bukan prioritas utama saat ini  
✅ Detail marketplace akan dibahas kemudian  

---

# 39. Hal yang Belum Diputuskan

AI atau developer **tidak boleh menganggap hal berikut sudah final**.

Masih perlu eksplorasi:

- nama project,
- branding,
- final color system,
- UI visual style,
- tech stack final,
- framework frontend,
- backend framework,
- database,
- authentication provider,
- cloud hosting,
- payment system,
- marketplace workflow,
- payment reservation,
- cancellation policy,
- reschedule policy,
- barber assignment algorithm,
- slot duration final,
- jumlah service,
- exact recommendation weight,
- exact hairstyle taxonomy,
- exact ML model,
- 2D vs 3D hair asset,
- hair segmentation approach,
- role permission detail,
- admin dashboard detail,
- notification system,
- production deployment architecture.

Jika membuat desain atau implementasi, item tersebut harus diperlakukan sebagai proposal, bukan requirement final.

---

# 40. Hal yang Harus Dihindari

Jangan mengubah project menjadi generic management system.

Hindari menjadikan feature berikut sebagai nilai utama:

- queue number,
- QR code,
- invoice,
- simple stock management,
- generic dashboard,
- generic product CRUD,
- generic booking calendar.

Feature tersebut boleh digunakan jika memang dibutuhkan operasional, tetapi bukan alasan utama project dibuat.

---

# 41. Prinsip UX

Semua flow harus mengikuti prinsip berikut.

## 41.1 Reduce User Decisions

Jika sistem dapat menentukan sesuatu secara aman, jangan paksa user menentukan secara manual.

Contoh:

```text
Preferred Barber tidak diisi
```

bukan error.

Sistem cukup menggunakan barber yang tersedia.

---

## 41.2 Prevent Invalid Choices

Jangan menampilkan pilihan yang sebenarnya tidak dapat digunakan.

Contoh:

Jika slot penuh:

```text
11:00 - 12:00
Fully Booked
```

jangan membiarkan user memilih lalu memberikan error pada akhir proses.

---

## 41.3 Provide Useful Alternatives

Jika barber favorit unavailable, sistem harus menawarkan alternatif.

Jangan hanya:

```text
Barber unavailable.
```

Lebih baik:

```text
Andi unavailable at 10:00.

Try:
- Andi at 11:00
- Andi at 13:00
- Any Barber at 10:00
```

---

## 41.4 Mobile First

CTA, card, calendar, time slot, camera, hairstyle selector, dan reservation flow harus nyaman digunakan dengan satu tangan pada smartphone.

---

## 41.5 Explain Recommendations

Recommendation tidak boleh terasa seperti black box.

User perlu melihat:

```text
Why this hairstyle matches you
```

---

# 42. Prinsip Teknis

## 42.1 Avoid Unnecessary Paid AI Dependency

Jika memungkinkan:

- gunakan open-source model,
- gunakan client-side inference,
- hindari AI API berbayar,
- hindari cloud GPU dependency untuk MVP.

---

## 42.2 Modular Architecture

Pisahkan domain:

```text
Authentication
Reservation
Barber Availability
Hair Profile
Hairstyle Knowledge
Recommendation Engine
Virtual Hair Filter
Customer History
Marketplace
```

Agar setiap feature dapat dikembangkan secara independen.

---

## 42.3 Hair Filter Performance Matters

Karena target utama adalah smartphone:

prioritaskan:

- model kecil,
- inference cepat,
- loading ringan,
- fallback ketika device lemah,
- browser compatibility.

---

# 43. Recommended Development Priority

Urutan pengembangan yang masuk akal:

## Phase 1 — Foundation

- Authentication
- User Profile
- Barber Profile
- Service
- Barber Schedule
- Reservation Engine

## Phase 2 — Hair Knowledge System

- Hairstyle Knowledge Base
- Hair Profile
- Recommendation Engine
- Recommendation Explanation

## Phase 3 — Virtual Hair Filter

- Camera access
- Face detection
- Face landmarks
- Hairstyle overlay
- Real-time tracking
- Hairstyle selector

## Phase 4 — Personalization

- Haircut history
- Feedback
- Barber preference
- Recommendation refinement

## Phase 5 — Marketplace

- Product
- Product category
- Cart
- Order
- Product recommendation integration

Phase order adalah rekomendasi implementasi, bukan PRD final.

---

# 44. Target User Journey

Salah satu target journey utama:

```text
User membuka website
        ↓
User belum tahu hairstyle
        ↓
Hair Recommendation
        ↓
Top Hairstyle Result
        ↓
Try in Virtual Hair Filter
        ↓
User memilih hairstyle
        ↓
Book This Haircut
        ↓
Pilih tanggal
        ↓
Pilih slot
        ↓
Optional barber preference
        ↓
Reservation confirmed
        ↓
Datang ke barbershop
        ↓
Haircut dilakukan
        ↓
User memberikan feedback
        ↓
System menyimpan haircut history
        ↓
Recommendation berikutnya menjadi lebih personal
```

---

# 45. Alternative User Journey

Untuk user yang sudah tahu hairstyle:

```text
User membuka website
        ↓
Reservation
        ↓
Pilih service
        ↓
Pilih tanggal
        ↓
Pilih slot
        ↓
Optional barber
        ↓
Confirm
```

User tidak wajib menggunakan recommendation maupun hair filter.

---

# 46. Core Value Proposition

Project memberikan tiga value utama.

## Discover

> Membantu user menemukan hairstyle yang cocok.

## Visualize

> Membantu user melihat preview hairstyle melalui real-time virtual hair filter.

## Book

> Membantu user melakukan reservasi secara cepat tanpa proses chat yang panjang.

Dalam jangka panjang:

## Learn

> Sistem belajar dari haircut history dan feedback user.

---

# 47. Project Identity

Kalimat singkat untuk menjelaskan project:

> **A personalized digital barbershop platform that helps customers discover suitable hairstyles, preview them through a real-time virtual hair filter, and book the right barber and time slot with minimal friction.**

Versi Indonesia:

> **Platform barbershop digital yang membantu pelanggan menemukan model rambut yang sesuai, mencoba tampilannya secara real-time melalui virtual hair filter, dan melakukan reservasi barber dengan cepat dan sederhana.**

---

# 48. Catatan untuk AI/Developer Berikutnya

Ketika menggunakan dokumen ini sebagai context:

1. Jangan langsung membuat PRD kecuali diminta.
2. Jangan mengubah feature menjadi generic booking system.
3. Jangan menganggap marketplace sebagai core uniqueness.
4. Jangan mengandalkan TikTok filter.
5. Hair filter harus dianggap sebagai fitur real-time camera-based.
6. Reservation harus meminimalkan input user.
7. Barber preference harus opsional.
8. Recommendation harus explainable.
9. Sistem harus dirancang mobile-first.
10. Sebisa mungkin pertahankan zero-cost development approach.
11. Jika mengusulkan teknologi baru, jelaskan:
    - fungsi teknologi,
    - alasan digunakan,
    - trade-off,
    - cost,
    - dan compatibility dengan responsive web.
12. Pisahkan keputusan yang sudah final dengan asumsi baru.
13. Jika ada requirement yang belum diputuskan, jangan mengarang seolah sudah final.

---

# 49. Current Scope Summary

Scope yang sedang menjadi fokus:

```text
Responsive Website
│
├── Smart Reservation
│   ├── Service Selection
│   ├── Date
│   ├── Available Time Slot
│   ├── Optional Barber Preference
│   └── Automatic Availability Handling
│
├── Haircut Knowledge & Recommendation
│   ├── Hair Profile
│   ├── Hairstyle Knowledge Base
│   ├── Compatibility Scoring
│   └── Explainable Recommendation
│
├── Real-Time Virtual Hair Filter
│   ├── Camera
│   ├── Face Detection
│   ├── Face Landmark Tracking
│   ├── Head Tracking
│   └── Hairstyle Rendering
│
└── Customer Personalization
    ├── Haircut History
    ├── Feedback
    ├── Barber Preference
    └── Future Recommendation Improvement
```

Future / secondary:

```text
Marketplace
```

---

# 50. Kesimpulan

Project ini bukan dibuat untuk sekadar mendigitalisasi barbershop.

Tujuan utamanya adalah membuat pengalaman haircut lebih:

- personal,
- informatif,
- visual,
- efisien,
- dan mudah diakses.

Tiga fondasi utama project adalah:

> **Haircut Recommendation + Real-Time Virtual Hairstyle Filter + Smart Reservation**

Ketiganya harus dirancang sebagai satu pengalaman yang terhubung.

User dapat:

```text
Discover
↓
Visualize
↓
Decide
↓
Book
↓
Experience
↓
Give Feedback
↓
Receive Better Recommendation
```

Marketplace dapat dikembangkan setelah fondasi tersebut matang.

# Script Presentasi Per Slide — Aplikasi Ha Jodeya

**Acuan Deck:** `Ha_Jodeya_Presentasi_Aplikasi.pptx` (14 Slide: Slide 01–12 Inti + Slide 13–14 Lampiran Q&A)  
**Estimasi Total Durasi:** ~10–12 menit (Presentasi Utama) + 3 menit (Demo Singkat) + Sesi Tanya Jawab  

> [!TIP]
> **Saran Pembagian Pembicara (Fleksibel sesuai kesepakatan tim):**
> - **Hansen** *(Prompt & Planning)*: Slide 01, Slide 02, Slide 08, Slide 09
> - **Joseph** *(Eksekusi AI & Demo)*: Slide 03, Slide 05, Slide 06, Slide 07, Slide 12 *(+ Demo Langsung & Slide 13–14 bila ada Q&A teknis)*
> - **Raden & Arya** *(Pembuatan PPT)*: Slide 04, Slide 10, Slide 11

---

## SLIDE 01 — Cover & Pembagian Tugas Tim
**Estimasi:** 45–60 detik | **Saran Pembicara:** Hansen (Pembuka)

> "Selamat pagi/siang Bapak/Ibu dosen dan teman-teman sekalian. Pada kesempatan kali ini, kami akan mempresentasikan aplikasi web PPIC yang telah kami kembangkan bernama **Ha Jodeya — 4-Stage Production Planning & Scheduling Workbench**.
>
> *[Tunjuk 4 kotak tahapan di tengah layar]*  
> Ha Jodeya adalah aplikasi pendukung keputusan perencanaan produksi yang menggabungkan **empat metode inti PPIC yang saling terhubung**, yaitu **Forecasting (01 FC)**, **Master Production Schedule (02 MPS)**, **Material Requirements Planning (03 MR)**, dan **Shop-Floor Scheduling (04 SC)**. Aplikasi ini dirancang dengan standar fitur setara OmniQM Studio v1.2, namun dilengkapi keunggulan utama berupa **Penjelasan & Interpretasi Jawaban Kausal 6-Pilar** di setiap metodenya.
>
> *[Tunjuk 3 kartu Pembagian Tugas di bagian bawah]*  
> Sebelum masuk ke cara kerja aplikasi, berikut pembagian tugas tim kami:
> - **Joseph**, bertugas menjalankan prompt yang telah dirancang ke dalam **AI Antigravity** untuk proses pembangunan, pengujian sistem, perbaikan tampilan desktop maupun HP, hingga publikasi aplikasi.
> - **Hansen**, bertugas membuat prompt terstruktur serta menyusun perencanaan aplikasi — mulai dari PRD, Project Planning, hingga Design Plan.
> - **Raden dan Arya**, bertugas menyusun materi presentasi (PPT) yang merangkum cara kerja, panduan penggunaan, dan fitur-fitur utama Ha Jodeya.
>
> Mari kita mulai dari bagaimana cara kerja aplikasi ini secara keseluruhan."

---

## SLIDE 02 — Cara Kerja Ha Jodeya: Alur Penggunaan End-to-End dalam 5 Langkah
**Estimasi:** 60 detik | **Saran Pembicara:** Hansen

> "Di slide kedua ini, kita bisa melihat gambaran besar cara menggunakan Ha Jodeya hanya dalam **lima langkah sederhana**.
>
> *[Tunjuk alur Langkah 01 sampai 05 dari kiri ke kanan]*  
> - **Langkah 1 — Siapkan Data:** Pengguna tidak perlu repot mengetik dari nol; cukup muat Preset 1-Klik, unggah file Excel/CSV/JSON/JS, atau isi langsung tabel editor.
> - **Langkah 2 — Atur Parameter:** Sesuaikan horizon peramalan, batas Time Fence MPS, struktur BOM di MRP, serta aturan penjadwalan.
> - **Langkah 3 — Tautkan Pipeline:** Di tab Pipeline, kita bisa menghubungkan output hulu ke input hilir dari Forecasting sampai Scheduling.
> - **Langkah 4 — Jalankan Paralel:** Cukup klik tombol **Jalankan (4)**, dan sistem akan menghitung keempat metode secara simultan di latar belakang lewat **Web Worker Pool** sehingga browser tidak akan nge-freeze atau hang.
> - **Langkah 5 — Analisis & Ekspor:** Kita langsung membaca **Penjelasan 6-Pilar**, mencoba skenario *What-If*, lalu mengekspor hasilnya ke Excel atau Laporan PDF A4.
>
> *[Tunjuk dua kotak bawah]*  
> Karena 100% berbasis web, aplikasi ini bisa langsung dibuka di `ha-jodeya.vercel.app` tanpa instalasi, otomatis tersimpan secara lokal di browser, mendukung mode offline (PWA), dan nyaman dibuka baik di laptop maupun smartphone."

---

## SLIDE 03 — Mengenal Antarmuka Utama & Cara Navigasi Workbench
**Estimasi:** 60 detik | **Saran Pembicara:** Joseph

> "Sekarang kita lihat langsung wujud tampilan aplikasinya. Di sebelah kanan adalah **screenshot aktual Dashboard Ha Jodeya v1.1**. Tata letaknya kami bagi menjadi **empat zona utama** agar pengguna baru langsung paham ke mana harus mengklik.
>
> *[Tunjuk area TopBar di screenshot]*  
> **Zona 01 adalah TopBar** di bagian atas. Di sini kita bisa berpindah cepat antara 4 tab utama (*Ringkasan*, *Editor*, *Pipeline*, dan *Upload*), memakai Undo/Redo, pencarian cepat `Ctrl+K`, **Dropdown Ekspor** untuk Excel/JSON/PDF, saklar Dark Mode, dan tombol utama **Jalankan (4)**.
>
> *[Tunjuk Sidebar kiri di screenshot]*  
> **Zona 02 adalah Sidebar Kiri**. Di sini kita bisa mengelola beberapa proyek lokal, melihat alur vertikal 4 tahap dari `01` sampai `04`, menambah pekerjaan baru, atau memuat **Preset Cepat** dengan satu klik.
>
> *[Tunjuk 4 kartu tahap & strip KPI di tengah screenshot]*  
> **Zona 03 adalah Kartu Kesehatan 4-Tahap dan Strip KPI**. Kita bisa langsung melihat KPI kunci tiap tahap lengkap dengan panah alurnya. Menariknya, kartu KPI *Status Optimal* dan *Peringatan* ini **bisa diklik langsung** untuk memfilter tabel di bawahnya.
>
> *[Tunjuk tabel bagian bawah screenshot]*  
> **Zona 04 adalah Tabel Matriks Batch**. Pengguna tinggal klik **Detail** untuk membuka hasil & Penjelasan 6-Pilar langsung di tempat, atau klik **Edit** untuk mengubah angka input."

---

## SLIDE 04 — Cara Memasukkan Data: 3 Jalur Input yang Fleksibel & Aman
**Estimasi:** 50–60 detik | **Saran Pembicara:** Raden / Arya

> "Untuk memasukkan data ke dalam Ha Jodeya, kami menyediakan **tiga jalur input** yang bisa disesuaikan dengan kebiasaan pengguna.
>
> *[Tunjuk 3 kolom kartu dari kiri ke kanan]*  
> - **Jalur 01 — Preset 1-Klik & Template Excel:** Ini cara tercepat untuk belajar atau presentasi. Klik *Preset Rantai PPIC 4-Tahap Terpadu* di sidebar untuk memuat kasus Pompa Industri HX-200 lengkap dengan 3 sambungan pipeline, atau unduh Template Excel 4-Sheet resmi dari menu Ekspor.
> - **Jalur 02 — Editor Spreadsheet & Tempel `Ctrl+V`:** Pengguna bisa langsung mengetik angka di tabel editor, atau menyalin tabel dari Microsoft Excel / Google Sheets lalu tekan **`Ctrl+V`**. Sistem otomatis memisahkan baris dan kolom, lalu menghitung ulang secara real-time.
> - **Jalur 03 — Upload Multi-Format Zero-`eval()`:** Di tab Upload, pengguna bisa tarik-lepas file `.xlsx`, `.csv`, `.hajodeya.json`, bahkan file objek `.js`. Jika nama kolom di file berbeda, akan muncul **Column Mapping Wizard** interaktif. Seluruh proses baca file ini 100% aman tanpa `eval()`.
>
> *[Tunjuk kotak bawah]*  
> Di repositori GitHub kami juga sudah tersedia **7 file dataset contoh siap unggah** di folder `samples/`."

---

## SLIDE 05 — Cara Menggunakan Tahap 01 (Forecasting) & Tahap 02 (MPS)
**Estimasi:** 70 detik | **Saran Pembicara:** Joseph

> "Sekarang kita masuk ke cara menggunakan dua tahap pertama, yaitu **Forecasting** dan **MPS**.
>
> *[Tunjuk kartu 01 FC di kiri atas]*  
> Pada **Tahap 01 — Forecasting**, pengguna cukup mengisi data permintaan historis dan menentukan jumlah periode proyeksi ke depan. Ha Jodeya langsung mengevaluasi **7 metode peramalan sekaligus** — mulai dari Naive, SMA, WMA, SES, Holt Trend, Regresi Linear OLS, hingga Holt-Winters — lengkap dengan **Auto-Optimize parameter α dan β**. Sistem otomatis memilih metode dengan error terkecil, memantau *Tracking Signal*, dan meneruskan deret ramalannya ke MPS.
>
> *[Tunjuk kartu 02 MPS di kiri bawah & screenshot kanan]*  
> Lalu pada **Tahap 02 — MPS**, berbeda dari banyak aplikasi yang langsung lompat ke MRP, Ha Jodeya menyediakan modul **MPS mandiri berstandar buku teks**. Seperti terlihat di screenshot sebelah kanan, parameter MPS sudah kami tata rapi dalam **3 sub-kartu**: Identitas & Stok Awal, Kebijakan Time Fence (*DTF/PTF*) & Lot-Sizing, serta Kapasitas RCCP & Biaya.
>
> Di bawahnya, pengguna mengisi tabel Forecast, Customer Orders, Firm MPS opsional, dan Kapasitas Jam. Sistem langsung menghitung *Effective Demand*, *PAB*, **Discrete & Cumulative ATP** — termasuk peringatan *over-promise* bila ATP negatif — serta uji kapasitas **RCCP** yang menandai jika utilisasi melebihi 100%. Di layar lebar, pengguna juga bisa mengaktifkan **Split-View** agar input dan hasil tampil berdampingan."

---

## SLIDE 06 — Cara Menggunakan Tahap 03 (MRP & BOM) & Tahap 04 (Scheduling)
**Estimasi:** 70 detik | **Saran Pembicara:** Joseph

> "Lanjut ke tahap ketiga dan keempat, yaitu **MRP & BOM** serta **Shop-Floor Scheduling**.
>
> *[Tunjuk kartu 03 MR di kiri]*  
> Pada **Tahap 03 — MRP & BOM**, pengguna menyusun tabel struktur Bill of Materials dari produk jadi Level-0 hingga komponen terbawah menggunakan format `Parent:Qty` yang mendukung multi-parent. Selanjutnya pilih aturan lot-sizing — tersedia **L4L, FOQ, POQ, EOQ, dan Silver-Meal** — dan sistem juga otomatis membandingkan total biaya kelimanya. Mesin akan memvalidasi agar tidak ada siklus BOM melingkar, melakukan *Low-Level Coding*, *Netting & Offsetting*, menampilkan diagram pohon **`SvgBomTree`**, serta memberi peringatan **Past-Due** bila ada order yang terlambat dilepas.
>
> *[Tunjuk kartu 04 SC di kanan]*  
> Pada **Tahap 04 — Shop-Floor Scheduling**, pengguna dapat memilih mode **Mesin Tunggal** atau **2-Mesin Flow Shop (Algoritma Johnson)**. Daftar pekerjaan bisa diisi manual atau diterima langsung dari hasil *Planned Order Releases* MRP. Sistem langsung membandingkan **6 aturan prioritas sekaligus** (*FCFS, SPT, WSPT, LPT, EDD,* dan *Critical Ratio*) lalu menampilkan perbandingan *Flow Time*, *Makespan*, *Tardiness*, dan **Gantt Chart interaktif**.
>
> *[Tunjuk kotak penghubung di bawah]*  
> Jadi ada jembatan otomatis dari `03 MR` ke `04 SC`: order produksi yang dilepas di MRP langsung berubah menjadi daftar *Work Order* yang dijadwalkan di Gantt Chart."

---

## SLIDE 07 — Cara Kerja Pipeline Terpadu 4-Tahap (FC → MPS → MRP → SC)
**Estimasi:** 60 detik | **Saran Pembicara:** Joseph

> "Salah satu kekuatan utama Ha Jodeya ada di **Tab Pipeline**, yang bisa kita lihat pada screenshot Mode Gelap di sebelah kanan.
>
> *[Tunjuk screenshot Pipeline di kanan]*  
> Melalui tab ini, keempat metode tidak berdiri sendiri-sendiri, melainkan terhubung sebagai satu rantai produksi utuh:
> - **Deret Forecast** dari `01 FC` masuk otomatis ke kolom Forecast `02 MPS`;
> - **Jadwal MPS** dari `02 MPS` masuk ke *Gross Requirements Level-0* `03 MR`;
> - dan **Order Kerja MRP** dari `03 MR` masuk ke daftar pekerjaan `04 SC` dengan faktor pengali skala waktu (misalnya `×0.02` jam/unit).
>
> *[Tunjuk poin 3 & 4 di kiri]*  
> Sistem menggunakan algoritma *Kahn Topological Sort* sehingga urutan eksekusi selalu terjaga dari hulu ke hilir dan otomatis mencegah tautan melingkar. Setiap kotak tahap pada diagram juga bisa diklik langsung untuk membuka editornya, dan diagram ini bisa diunduh dalam format `.svg` atau `.png` 2× untuk dimasukkan ke laporan.
>
> Bayangkan saat kita menaikkan permintaan di Forecasting — cukup klik **Jalankan Pipeline**, dalam waktu di bawah 100 milidetik seluruh jadwal MPS, kebutuhan material MRP, sampai Gantt Chart Scheduling langsung ikut berubah."

---

## SLIDE 08 — Fitur Unggulan: Penjelasan & Interpretasi Jawaban 6-Pilar
**Estimasi:** 70 detik | **Saran Pembicara:** Hansen

> "Sekarang kita masuk ke **Bagian Kedua: Penjelasan Fitur Aplikasi**, dimulai dari fitur pembeda terbesar Ha Jodeya, yaitu **Penjelasan & Interpretasi Jawaban 6-Pilar**.
>
> Banyak software simulasi bersifat *black-box* — hanya mengeluarkan angka akhir tanpa menjelaskan alasannya. Di Ha Jodeya, setiap metode wajib menghasilkan **6 pilar penjelasan terstruktur**:
>
> *[Tunjuk 6 kartu di sisi kiri dari atas ke bawah]*  
> - **01 · Kesimpulan:** Ringkasan keputusan inti dalam bahasa sehari-hari.
> - **02 · Alasan Kausal:** Ini yang paling penting — menjelaskan *mengapa jawaban ini yang keluar* lengkap dengan ikon status (hijau untuk optimal/hemat, kuning untuk peringatan overload).
> - **03 · Arti Angka:** Membedah arti dan dampak operasional tiap metrik seperti MAPE, ATP, atau RCCP dalam grid 2×2 yang rapi.
> - **04 · Hitungan:** Menampilkan rumus umum lengkap dengan **substitusi angka input aktual pengguna** langkah demi langkah, sehingga mudah dicek manual.
> - **05 · Risiko & Aksi:** Deteksi dini masalah kapasitas atau keterlambatan beserta rekomendasi tindakan.
> - **06 · Kamus:** Definisi istilah teknis modul tersebut.
>
> *[Tunjuk screenshot kanan]*  
> Seperti terlihat pada contoh MPS di kanan, narasinya **100% dinamis dari angka input pengguna** — misalnya sistem langsung mendeteksi overload RCCP 102,1% di Minggu ke-6 dan menghitung bahwa mengganti aturan lot ke L4L dapat menghemat biaya Rp 2.192.000. Tersedia pula saklar **Mode Lengkap / Ringkas** dan tombol ekspor `.md`."

---

## SLIDE 09 — Matriks Fitur Lengkap 4 Modul Inti PPIC Ha Jodeya
**Estimasi:** 50–60 detik | **Saran Pembicara:** Hansen

> "Slide kesembilan ini merangkum seluruh kemampuan teknis dari keempat modul dalam satu matriks perbandingan agar mudah dilihat secara menyeluruh.
>
> *[Tunjuk baris demi baris secara ringkas]*  
> - **01 FC (Forecasting):** 7 metode + Auto-Optimize $(\alpha, \beta)$, output 6 metrik akurasi + grafik aktual vs ramalan, dan deteksi *Tracking Signal drift*.
> - **02 MPS:** Zona *Frozen/Slushy/Liquid*, PAB, Firm MPS, 4 aturan lot-sizing, Discrete & Cumulative ATP, serta peringatan dini *Over-Promise* (`ATP < 0`) dan *Overload* (`RCCP > 100%`).
> - **03 MR (MRP & BOM):** Eksplosi BOM multi-level & multi-parent, 5 aturan lot-sizing, diagram pohon `SvgBomTree`, validasi anti-siklus BOM, dan deteksi rambatan *Past-Due*.
> - **04 SC (Scheduling):** 6 aturan prioritas mesin tunggal + Algoritma Johnson 2-mesin, tabel komparasi kinerja lengkap, grafik batang, dan Gantt Chart interaktif.
>
> Singkatnya, Ha Jodeya menghadirkan paritas fitur setara OmniQM Studio v1.2 yang benar-benar difokuskan untuk 4 tahap PPIC yang paling krusial."

---

## SLIDE 10 — Fitur Produktivitas Workbench: Simulasi What-If & Kontrol Cepat
**Estimasi:** 55 detik | **Saran Pembicara:** Raden / Arya

> "Selain perhitungan inti, Ha Jodeya juga dibekali **empat kelompok fitur produktivitas** agar terasa seperti workbench analitik profesional:
>
> *[Tunjuk 4 kartu 2×2]*  
> 1. **Matriks Sensitivitas What-If:** Pengguna dapat menyimpan hingga **5 skenario** (misalnya *Baseline*, *Permintaan +20%*, atau *Lot L4L*). Begitu input diubah, aplikasi otomatis menampilkan tabel perbandingan lengkap dengan selisih absolut (**Δ**) dan persentasenya (**%**) lintas 4 metode.
> 2. **Multi-Proyek Lokal & Duplikasi:** Kita bisa menyimpan banyak proyek studi kasus terpisah dalam satu browser secara otomatis lewat `localStorage`, serta menduplikasi pekerjaan untuk eksperimen paralel.
> 3. **Kontrol Cepat:** Mendukung **Undo/Redo hingga 30 langkah** (`Ctrl+Z`/`Ctrl+Y`), **Command Palette (`Ctrl+K`)** untuk mencari fitur lewat keyboard, dan filter KPI interaktif di Dashboard.
> 4. **Ergonomi Analisis:** Dilengkapi mode **Split-View** untuk layar lebar, **Sticky Jump-Bar** agar tidak perlu scroll jauh, *Pipeline Breadcrumb*, dan **Panduan Konsep & Rumus Inti** yang bisa dibuka-tutup."

---

## SLIDE 11 — Visualisasi Interaktif, Ekspor Multi-Format & Akses Mobile/Offline
**Estimasi:** 55 detik | **Saran Pembicara:** Raden / Arya

> "Di slide sebelas ini adalah fitur pelaporan, visualisasi, dan aksesibilitas lintas perangkat.
>
> *[Tunjuk 3 kartu di sebelah kiri]*  
> - **5 Grafik Pure SVG Interaktif:** Mencakup Line Chart, Bar Chart, Gantt Chart, BOM Tree, dan Pipeline DAG. Semua grafik memiliki tooltip saat disentuh kursor dan tombol unduh langsung ke **`.svg`** (vektor tajam) atau **`.png` resolusi 2×** untuk keperluan laporan.
> - **Ekspor Multi-Format:** Melalui satu **Dropdown Ekspor** di TopBar, pengguna bisa mengunduh hasil + narasi 6-Pilar ke **Excel multi-sheet (`.xlsx`)**, **CSV**, **Laporan PDF A4 lengkap berhalaman sampul**, Markdown (`.md`), atau bundel proyek **`.hajodeya.json`**.
> - **Responsif HP, Dark Mode & PWA Offline:** *[Tunjuk mockup HP di sebelah kanan]* Ini adalah tampilan aktual Ha Jodeya saat dibuka dari layar HP 390 piksel — header 2-baris rapi, 4 tab navigasi penuh, grid KPI 2×2, dan **nol overflow horizontal**, sehingga sama nyamannya dibuka dari smartphone maupun laptop, bahkan saat offline berkat Service Worker PWA."

---

## SLIDE 12 — Ringkasan, Panduan Demo Singkat & Penutup
**Estimasi:** 45 detik (sebelum masuk Demo Langsung) | **Saran Pembicara:** Joseph

> "Sebagai penutup presentasi sebelum kita masuk ke sesi demo singkat dan tanya jawab, Ha Jodeya hadir untuk menyatukan empat tahapan inti PPIC ke dalam satu aplikasi web modern yang cepat, responsif di laptop maupun HP, dan transparan menjelaskan alasan kausal di balik setiap jawabannya.
>
> *[Tunjuk 3 kotak Demo di tengah]*  
> Setelah ini kami akan mendemokan secara langsung 3 skenario cepat di **`https://ha-jodeya.vercel.app`**:
> 1. Membuka Dashboard 4-Tahap dan memfilter modul yang memiliki peringatan kapasitas;
> 2. Mengubah aturan Lot-Sizing di Editor MPS (dari FOQ ke L4L) dan melihat Penjelasan 6-Pilar serta grafik langsung berubah otomatis;
> 3. Menyimpan skenario *What-If*, menaikkan permintaan di Forecasting, lalu melihat perambatannya di Tab Pipeline hingga Gantt Chart Scheduling.
>
> Seluruh kode sumber dan dokumentasi lengkap juga tersedia terbuka di **`https://github.com/Oceppppp/ha-jodeya`**.  
> Demikian pemaparan dari tim kami — Joseph, Hansen, Raden, dan Arya. Terima kasih atas perhatiannya, selanjutnya mari kita masuk ke demo aplikasi dan sesi tanya jawab."

---

## LAMPIRAN CADANGAN Q&A (Hanya Dibuka Jika Ditanya Penguji/Dosen)

### SLIDE 13 — Appendix A: Arsitektur 5-Lapisan Bersih, Eksekusi Paralel & Keamanan Sistem
**Gunakan jika ditanya:** *"Bagaimana arsitektur kodenya? Kenapa tidak hang? Apakah aman saat upload file?"*

> "Terima kasih atas pertanyaannya. Seperti terlihat pada **Lampiran A**, kami membangun Ha Jodeya menggunakan **Arsitektur 5-Lapisan Bersih**:
> - **Lapisan 1 & 2 (`src/core/` & `src/engines/`)** berisi kontrak tipe, Pipeline DAG, dan 4 mesin matematika murni dengan **nol impor React/DOM**, sehingga kalkulasi 100% deterministik dan mudah diaudit.
> - **Lapisan 3 (`src/workers/` & `src/store/`)** menjalankan seluruh komputasi di **Web Worker Pool** (2–8 worker dengan timeout 15 detik), sehingga antarmuka tidak pernah membeku.
> - **Lapisan 4 (`src/io/`)** memakai parser berbasis tokenizer **Zero-`eval()`** dengan batas 200.000 token agar upload file `.xlsx`, `.csv`, `.json`, maupun `.js` aman dari injeksi skrip.
> - **Lapisan 5 (`src/ui/` & `src/styles/`)** memakai React 19 dan Vanilla CSS 4-lapisan tanpa dependensi UI berat.
>
> Seluruh proses rekayasa ini juga mengikuti standar **12 Agent Skills** terorkestrasi mulai dari validasi matematika OR hingga QA rilis."

### SLIDE 14 — Appendix B: Validasi Kualitas (QA/CI), Perbaikan Bug & Arah Pengembangan
**Gunakan jika ditanya:** *"Bagaimana cara memastikan hitungannya akurat? Pernah ada bug apa saja? Rencana pengembangannya apa?"*

> "Untuk menjamin keakuratan dan stabilitas aplikasi, seperti terlihat pada tabel di kiri, kami menerapkan **6 gerbang verifikasi otomatis** sebelum setiap rilis:
> - **Static Lint (`oxlint`)** dan **Strict TypeScript (`tsc --noEmit`)** dengan 0 error;
> - **18 tes otomatis (`vitest`)** yang memverifikasi akurasi matematis Forecasting, MPS, MRP, Scheduling, kelengkapan 6-Pilar, DAG, IO, dan PWA;
> - **Production Build** dengan stempel SHA-256 otomatis pada Service Worker;
> - serta **Live Browser E2E** di Headless Chrome pada layar Desktop `1440px` dan Mobile iPhone `390px` dengan hasil `overflowPx = 0` dan `0 console errors`, yang seluruhnya juga terverifikasi hijau di **GitHub Actions CI**.
>
> Di sisi kanan juga tercatat perbaikan nyata dari `v1.0` ke `v1.1` (termasuk perbaikan tampilan Safari iPhone 390px) serta **Roadmap v1.2** ke depan, yaitu penambahan modul **CRP pasca-MRP**, ekspansi **Multi-Machine Job Shop Scheduling**, dan perluasan *edge-case test suite*."

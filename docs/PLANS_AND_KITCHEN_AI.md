# Paket berdasarkan kebutuhan dan AI pesanan dapur

Paket **Mulai** gratis dan tidak mengenakan batas sepuluh menu. Pencatatan manual, stok, riwayat, ekspor, serta keikutsertaan kulakan bersama tidak dikunci oleh kuota AI. Fitur staf yang sudah ada tetap terbuka. Ini implementasi awal paket dasar dan pengukuran penggunaan, bukan sistem pembayaran langganan.

## Yang berjalan

- Pengaturan akun menampilkan pemakaian nyata dari SQLite, bukan angka contoh. Kuota awal percobaan: 100 ekstraksi AI dan 30 transkripsi suara per usaha per bulan kalender Jakarta; semua staf berbagi kuota yang sama.
- `FREE_AI_TEXT_MONTHLY` dan `FREE_AI_SPEECH_MONTHLY` mengatur kuota server; bilangan bulat nol atau lebih. Ini konfigurasi produk yang dapat dievaluasi, bukan angka penggunaan pelanggan. `npm start` tidak otomatis memuat `.env`.
- Reservasi kuota atomik mencegah permintaan bersamaan melampaui batas. Permintaan gagal atau ekstraksi beralih ke parser mengembalikan kuota; reservasi terputus kedaluwarsa setelah lima menit. Peristiwa yang berhasil menyimpan jenis penggunaan dan waktu, tanpa isi chat atau rekaman.
- Kedua endpoint ekstraksi berbagi kuota. Setelah habis, ekstraksi memakai parser lokal dengan penjelasan eksplisit; suara mengembalikan `429 ai_quota_exhausted`. Isian manual dan pesanan dapur tetap tersedia.
- Pemilik dapat menyimpan kebutuhan tambahan: staf, cabang, AI, analisis atau jaringan. Penyimpanan memerlukan persetujuan, terpisah per usaha dan dapat diperbarui. Tidak mengaktifkan paket atau menagih uang.

## Cara mencoba alur utama

1. Jalankan `npm start`, buka `http://localhost:4174`, masuk sebagai pemilik atau kasir. Gunakan menu, resep, stok, waktu dan stasiun yang benar-benar telah dibuat pada usaha itu.
2. Di **Operasional dapur**, temukan **Bantu isi dari chat atau suara**. Ketik nama menu usaha beserta jumlahnya. Atau rekam suara, periksa hasil ucapan dan pilih **Gunakan teks**.
3. Tekan **Bantu isi pesanan**. Menu, porsi dan catatan mengisi formulir pesanan. AI yang tidak tersedia, hasil yang tidak cocok dan parser lokal dijelaskan secara berbeda; tidak ada stok/penjualan yang diubah oleh tahap ini.
4. Periksa dan koreksi semua rincian, isi label serta sumber, lalu tekan **Masukkan ke antrean**. Bahan baru dicadangkan di sini. Jika katalog berubah saat pemrosesan, server menolak hasil lama. Bila berubah sesudahnya, proses ulang teks atau pilih **Lanjutkan isi manual** dan periksa rincian terbaru.
5. Dapur memulai item, menandainya siap, lalu pemilik/kasir menyelesaikan pesanan. Stok dan penjualan tercatat sekali sesuai alur dapur yang sudah ada; tindakan berulang memakai kunci idempoten.
6. Buka **Pengaturan akun → Paket dan pemakaian AI** untuk membaca penggunaan dan mencatat kebutuhan tambahan. Panduan berpanah memuat topik paket serta pesanan AI.

Kasir hanya dapat mengekstrak katalog usahanya. Model menerima ID, nama dan alias menu, tanpa harga modal, resep atau informasi usaha lain. Akun dapur dapat memakai transkripsi untuk kendali tahap, tetapi tidak memperoleh akses ekstraksi pesanan atau pengaturan paket. Sesi yang dicabut saat inferensi tidak memperoleh hasil pesanan yang dapat dipakai.

## Batas yang masih terbuka

- Paket Tumbuh/Jaringan, tarif, penambahan kuota berbayar, pembayaran dan pengelolaan langganan belum aktif. Cabang terpusat dan pembagian pesanan antarusaha masih rencana. Tidak ada tombol pembelian palsu.
- Kuota awal harus diuji bersama calon pengguna, biaya inferensi dan kebutuhan kendali suara empat detik; bukan keputusan harga akhir atau bukti keuntungan bisnis.
- Qwen tetap model pralatih 1.5B dengan pemeriksaan bukti parser yang konservatif. Input ambigu dapat ditolak. Tidak ada pelatihan baru atau klaim memahami semua bahasa percakapan.
- Whisper mengubah audio menjadi teks dan tetap memerlukan pemeriksaan manusia. Verifikasi satu klip publik bukan benchmark akurasi lapangan.
- Verifikasi lokal tidak berarti Qwen cloud sudah aktif. Perubahan ini belum dideploy ke Railway.

## Verifikasi

Tes integrasi memakai SQLite memori dan model pengganti yang dinyatakan sebagai *test double*; tes ini tidak menjadi bukti inferensi AI nyata. Pengujian terpisah `npm run verify:ai-runtime -- --audio KLIP_BERIZIN.wav --report FILE_BARU.json` memerlukan Qwen/Whisper asli dan gagal jika ekstraksi fallback.

[Hasil AI nyata](evaluation/plans-kitchen-ai-runtime.json) mencakup identitas Qwen, kedua layanan, autentikasi/origin, ekstraksi dapur, transkripsi, pemakaian kuota, serta satu pesanan selesai tanpa duplikasi. Semua memakai database memori, tanpa mengisi akun asli. Tidak ada angka akurasi baru yang disimpulkan dari hasil ini.

Regresi akhir: **294 tes backend + 62 tes browser = 356 lulus**. `npm test` exit 0; backend diulang sesudah koreksi pengembalian kuota pada hasil yang ditolak karena katalog/sesi berubah, juga exit 0. [Ringkasan](evaluation/plans-kitchen-ai-release.json). Review sembilan tampilan pemilik/kasir/paket berstatus [ship](evaluation/PLANS_KITCHEN_AI_UI_REVIEW.md); [canon desain dipertahankan](evaluation/PLANS_KITCHEN_AI_DESIGN_CHECK.md).

Migrasi menambahkan dua tabel kosong (`ai_usage_events`, `plan_interests`), menjadi 33 tabel. Tes migrasi memeriksa baris sebelumnya tetap sama, lalu membuka ulang database untuk memeriksa penggunaan dan kebutuhan tersimpan.

Verifikasi backup membandingkan seluruh kolom dan baris **yang ada pada snapshot asal** setelah migrasi salinan. Penambahan tabel/kolom bawaan tidak lagi membuat backup lama yang valid ditolak. Checksum berkas asal, integritas dan relasi tetap diperiksa; file backup yang disimpan tidak dimigrasi atau ditimpa.

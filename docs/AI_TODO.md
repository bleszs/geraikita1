# Prioritas AI v57 — 18 Oktober 2026

- [x] Hitung belanja usaha baru dari target porsi, resep dan stok tersedia; hasil dibatalkan ketika target/data berubah. Ini rencana produksi, bukan prediksi AI.
- [x] Bantu Whisper Base dengan nama/alias menu milik usaha yang masuk; batasi kosakata, pertahankan penolakan pengulangan dan pemeriksaan manusia.
- [x] Pemulihan koneksi Qwen: parser sementara 30 detik setelah gagal, lalu coba model lagi. Uji langsung lokal berhasil mode ollama.
- [x] 330 tes backend, dua tes kosakata Python, sembilan penjagaan voice Python serta 17 alur browser lulus. Tanpa histori produksi buatan.
- [x] Railway efa8d121 SUCCESS: inferensi Whisper Base dan Qwen ollama nyata, model prediksi tetap tersedia serta enam file publik cocok. [Bukti](evaluation/ai-priorities-cloud-release.json).
- [ ] Ukur akurasi voice pesanan nyata dan evaluasi model dengan histori UMKM Indonesia yang sah.
- [ ] Qwen 1.5B mandiri di cloud; kapasitas Railway sebelumnya belum mencukupi. Cooldown tidak menggantikan hosting.

[Cara kerja, verifikasi dan batas](AI_PRIORITIES.md). Riwayat sebelumnya di bawah.

# HCI kasir/dapur dan prediksi langsung — 18 Oktober 2026

- [x] Utamakan antrean dan input kasir; rincian saldo dilipat, seluruh metode pembayaran dipertahankan.
- [x] Tambahkan filter status dengan jumlah, dahulukan pesanan siap di kasir dan pertahankan giliran server pada dapur.
- [x] Pertahankan isian, filter dan panel saat pembaruan; perbaiki fokus keyboard, Tab dialog pembayaran dan Escape.
- [x] Saran kulakan menampilkan prediksi dua hari, stok tersedia dan jumlah beli secara langsung. Bukti model dan pemeriksaan pemakaian berada dalam rincian.
- [x] Model tetap memakai bobot terlatih dan evaluasi lokal; tidak menambah histori usaha buatan atau mengubah aturan stok/pembayaran.
- [x] Konfirmasi visual/alur selesai; 325 tes backend lulus dan kasus browser yang berubah dikonfirmasi. Railway f7fcf807-370b-4b0e-b678-434224e26f03 SUCCESS, sembilan file publik + modul staf API cocok. [Bukti](evaluation/hci-cloud-release.json).
- [ ] Uji kegunaan dengan kasir/koki sungguhan untuk mengukur salah tekan dan waktu tugas.

[Alur dan penerapan HCI](HCI_OPERATIONS.md). Catatan di bawah adalah riwayat.

# Model kulakan terlatih — 18 Oktober 2026

- [x] Latih model sales-only HistGradientBoosting: 500 seri, 19.000 target dua hari; pilih delapan kandidat lewat validasi.
- [x] Uji 200 toko di luar development/v2, 600 target: WAPE 25,68% vs MA7 27,41%; MAE turun 6,30%. Batas domain/periode dan penggunaan ulang holdout setelah perbaikan ekspor dicatat.
- [x] Ekspor 160 pohon ke Node; 600 prediksi cocok dengan Python; metrik dihitung ulang dari sumber mentah tanpa fit ulang.
- [x] Hubungkan kandidat model ke saran bahan melalui backtest lokal 42 tanggal; model khusus usaha tetap didahulukan. Tanpa histori tetap tidak ada angka buatan.
- [x] Sediakan contoh publik yang bisa ditelusuri di Saran kulakan, terpisah dari stok dan transaksi akun.
- [x] 325 tes backend lulus; tur dan model browser dikonfirmasi setelah koreksi penunjuk. Railway 8b9e4ac2 SUCCESS, bobot dan lima file publik cocok, inferensi cloud serta akun kosong memori terverifikasi. [Bukti](evaluation/kulakan-cloud-release.json).
- [ ] Kumpulkan histori UMKM Indonesia yang sah untuk evaluasi maju dan pembuktian manfaat usaha.
- [x] Perencanaan kebutuhan awal dari target porsi dan resep nyata, tanpa mengisi histori buatan.
- [ ] Lengkapi pencatatan hari tutup/nol dan impor histori nyata; ini tidak diselesaikan oleh model publik.

[Model, hasil, cara presentasi dan batas](KULAKAN_MODEL.md). Catatan di bawah adalah riwayat.

# Dasbor dan akses pembayaran - 18 Oktober 2026

- [x] Ubah label Ringkasan menjadi Dasbor; letakkan Operasional dapur dan Layar layanan tepat setelah Daftar staf, dengan tautan lama tetap kompatibel.
- [x] Keuangan menampilkan Tarik saldo pemilik termasuk pada saldo nol, dengan kontrol nonaktif dan alasan. Jelaskan potongan 10% saat penjualan dan tanpa potongan kedua saat penarikan.
- [x] Perjelas jalur pembayaran kasir dan uji Tunai, QRIS, Transfer Bank, E-Wallet. Hapus gambar QR palsu; QRIS resmi dan penarikan bank nyata belum terintegrasi.
- [x] Pisahkan angka kotor/biaya/bersih agar tidak bertumpuk; jumlah yang sudah ditarik tetap terlihat pada ponsel.
- [x] 19 tes Node serta 32 kasus browser relevan terverifikasi; pemeriksaan visual desktop/ponsel/gelap selesai. [Review dan rincian run](evaluation/PAYMENT_NAVIGATION_REVIEW.md).
- [x] Deployment Railway add96e94 berhasil; tujuh file publik cocok dengan lokal. Backup 37 tabel valid; ada aktivitas produksi selama interval, sehingga tidak diklaim identik. Penjualan lama tetap utuh dan perubahan stok cocok dengan ledger; tanpa commit/push. [Bukti](evaluation/payment-navigation-release.json).

[Letak fitur dan batas pembayaran](PAYMENT_NAVIGATION.md). Catatan di bawah adalah riwayat pekerjaan sebelumnya.

# Pendaftaran, kelompok dan ekspor — 18 Oktober 2026

- [x] Hilangkan pilihan kelompok dari formulir daftar; akun mandiri dapat membuat atau bergabung melalui Beli bersama. Kelompok dan kode lama tetap berlaku.
- [x] Perpindahan atomik mempertahankan katalog, stok, transaksi, pemakaian dan kuota. Bahan bernama/satuan sama diselaraskan; satuan berbeda ditolak. Izin berbagi direset, sesi lain dan tautan layar lama dicabut.
- [x] Rapikan undangan, tombol perintah dapur, formulir pemasok ponsel dan logo GK dari referensi pengguna. Favicon, ikon terpasang dan struk menggunakan identitas yang sama.
- [x] CSV mempunyai pemisah Excel, UTF-8, desimal Indonesia dan kolom penjualan yang mudah dibaca. Tidak mengubah tarif atau simulasi pembayaran teman.
- [x] Perbaiki tes panduan tamu yang masih mengharapkan banner yang sudah dihapus, serta capture panel yang memakai koordinat di luar viewport.
- [x] Regresi 317 backend + 70 browser lulus. Railway diperbarui tanpa commit/push: 12 hash file publik cocok, HTTP Base/Qwen dan join diuji di database memori, 36 tabel lama tetap identik; tabel penarikan ditambahkan secara aditif. [Bukti deployment](evaluation/community-deployment.json).
- [ ] Uji mikrofon fisik dan ketepatan menu/jumlah pada rekaman pesanan berizin. Runtime Base/Qwen aktif bukan bukti akurasi domain.
- [ ] Kumpulkan histori pemakaian usaha nyata untuk prediksi/pelatihan; audit cloud 18 Oktober menemukan empat bahan tanpa histori, nol baseline siap dan nol model usaha aktif.

[Perubahan dan batas](COMMUNITY_AND_EXPORTS.md). [Status operasional](RAILWAY_MAIN_STATUS.md). Catatan di bawah merupakan arsip status sebelumnya; Qwen kini terhubung melalui endpoint eksternal dan voice memakai Whisper Base.

# Arsip pembaruan main dan Railway — 18 Oktober 2026

- [x] Audit semua head branch `origin`; seluruhnya tercakup di `29565e6`. Main di-fast-forward dan di-push tanpa commit baru; penghapusan Surplus dipertahankan.
- [x] Deploy main ke Railway dan cocokkan hash empat modul frontend. HTTPS, pembatasan akses tamu, prasyarat browser voice dan backup/restore terpisah diperiksa. Migrasi cloud 30 → 36 tabel berhasil; cloud awal masih kosong, tanpa fixture produksi.
- [x] Voice cloud memakai Whisper Tiny asli, diuji melalui API pemilik/kasir pada SQLite memori. Qwen 1.5B/Ollama lokal aktif dan delapan pemeriksaan model asli lulus.
- [ ] Qwen/Ollama cloud: akun masih Trial, RAM 1 GB/volume 500 MB dan belum ada metode pembayaran. Pengguna belum bisa mengaktifkan paket berbayar. Tetap gunakan model 1.5B yang dipilih; cloud menampilkan fallback parser secara jujur.
- [ ] Autodeploy GitHub: Railway menolak akses repo; upload CLI berhasil, tetapi Railway GitHub App perlu diberi akses sebelum autodeploy dapat dihubungkan.
- [ ] Uji akun cloud dan izin mikrofon pada perangkat fisik; akun lokal/demo tidak otomatis dimigrasikan.

[Status dan bukti terbaru](RAILWAY_MAIN_STATUS.md). Dokumen pembaruan ini belum di-commit. Catatan versi berikut adalah riwayat.

# Lanjutan v0.50 — sinkronisasi staf dan jalur kasir

- [x] Ambil `origin/rahasiagelap3.0` (`08ca38d`) dan gabungkan dengan pekerjaan AI/paket/jumlah lokal `8a58807`. Cadangan sebelum merge: `backup/pre-rahasiagelap3-8a58807`; `origin/main` masih `625f40f` saat pengambilan.
- [x] Gunakan Daftar staf, biodata, kode masuk berulang, penghapusan terkonfirmasi, tampilan kasir/dapur dan tombol lihat kata sandi dari pembaruan teman. Akun email, perubahan peran/nonaktif dan kode sementara tetap tersedia di Pengaturan.
- [x] Sambungkan pemeriksaan pesanan kasir ke kontrak AI/katalog/kuota yang sudah ada, pertahankan koreksi banyak item dan penjelasan hampir habis. Pilihan antrean mencadangkan bahan; penjualan langsung mencatat pesanan yang sudah selesai. Koreksi sesuai arahan pengguna: menu/route Surplus dihapus mengikuti branch teman. Panduan hanya menerangkan riwayat lama, tanpa mengarahkan ke formulir Surplus. Koreksi menu/panduan lulus 8 tes Node + 24 browser. Perubahan setelah koreksi ini tidak di-commit otomatis.
- [x] Tutup risiko penjualan ganda saat respons hilang: tindakan tertunda dan kunci tetap, pemulihan memakai metadata penjualan kasir/versi perannya sendiri. Kode baru hanya tersimpan sebagai hash, pembuatan yang diulang memakai kode/kunci sama, benturan kode sementara/berulang ditolak. Hasil sensitif dan rincian review dibersihkan saat akun berubah.
- [x] Peringatan bahan menipis memakai stok tersedia setelah pencadangan, tanpa membuka angka stok/resep/harga beli kepada staf. Pembatalan item/bahan terbuang tetap tugas pemilik sesuai pembatasan dari branch teman.
- [x] **308 tes backend lulus**; delapan pemeriksaan Qwen 1.5B/Whisper Tiny asli lulus pada SQLite memori. Tidak ada model/bobot baru atau perubahan database usaha nyata. [Runtime](evaluation/branch-sync-v50-runtime.json).
- [x] Regresi akhir `npm test` exit 0: **308 backend + 65 browser = 373 lulus**, panduan 20 topik/100 langkah. Desktop/ponsel/gelap diperiksa; dua temuan komposisi diperbaiki sekali, verdict **ship** untuk perbaikan yang dinilai. [Rilis](evaluation/branch-sync-v50-release.json), [review](evaluation/BRANCH_SYNC_V50_UI_REVIEW.md). Tidak menggantikan uji pengguna/perangkat fisik.
- [ ] Uji demo pengguna awam dan perangkat fisik berbeda. Pengujian browser otomatis/emulasi tidak menggantikan tahap ini.
- [ ] Evaluasi pesanan/rekaman usaha Indonesia berizin dan berlabel masih menunggu data; tentukan fine-tuning dari pola kesalahan nyata. Aktivasi Qwen Railway masih memerlukan kapasitas yang telah dibahas.

[Rincian perubahan, cara memakai dan batas](BRANCH_SYNC_V50.md). Sinkronisasi lokal belum berarti push/deploy.

# Lanjutan v0.49 — pemeriksaan jumlah dan waktu tunggu AI

- [x] Tutup celah angka tersisa: input seperti dua belas yang terbaca dua, jumlah bertanda negatif/positif sebelum menu, serta angka menu lain yang tersembunyi di catatan ditolak untuk pemeriksaan manual.
- [x] Pemeriksaan tidak menebak variasi numerik yang belum mempunyai schema katalog. Level pedas/harga/nomor meja dalam chat perlu diperiksa manual; kolom label, jumlah dan catatan tetap dapat dipakai.
- [x] Perbaiki batas tunggu klien `/kitchen/extractions` dari 15 menjadi 60 detik agar tidak lebih singkat daripada batas inferensi model 45 detik. Endpoint ekstraksi lama tetap 60 detik, request biasa tetap 15 detik; cache PWA diperbarui.
- [x] Tes kontrak memastikan input tidak valid tidak mencapai model, reservasi kuota dikembalikan, serta stok/penjualan/antrean tidak berubah pada pemilik/kasir. Kasus valid, alias bernomor, catatan teks dan jalur manual tetap diuji.
- [x] **305 tes backend + 63 browser = 368 lulus**; delapan pemeriksaan Qwen/Whisper asli juga lulus. Satu tes browser lama sempat gagal menunggu toast, kemudian lulus saat diuji sendiri dan seluruh 63 tes browser lulus pada pengulangan penuh. [Regresi](evaluation/ai-quantity-release.json), [runtime](evaluation/ai-quantity-runtime.json).
- [ ] Evaluasi akurasi lapangan dan kebutuhan fine-tuning tetap menunggu data pesanan usaha berizin; perbaikan validasi/timeout bukan training atau bukti akurasi baru.

[Perubahan perilaku dan cara mencoba](AI_QUANTITY_VALIDATION.md).

# Lanjutan v0.48 — catatan pesanan dan evaluasi AI

- [x] Perjelas kebutuhan training per komponen: Qwen/Whisper pralatih; eksperimen Ridge/boosting dilatih dari sumber publik; aturan antrean/kuota bukan model terlatih. Tidak ada bobot baru atau fine-tuning pada tahap ini. [Keputusan pelatihan](AI_TRAINING_DECISIONS.md).
- [x] Perbaiki hilangnya catatan di luar daftar kata kunci. Kata yang tersisa di luar pasangan menu/jumlah membuat pesan asli dipertahankan untuk review, termasuk hangat/dingin/gula sedikit. Catatan >500 karakter ditolak ke input manual tanpa pemotongan diam-diam; penempatan per item tetap perlu diperiksa pengguna.
- [x] Evaluator schema 2 menilai menu/jumlah dan retensi fragmen catatan secara terpisah; anotasi kosong/hilang tidak menghasilkan skor retensi palsu. Kompatibel schema 1, dengan cakupan anotasi eksplisit dan denominator error/penolakan tetap dipertahankan.
- [x] Catatan hasil dan fragmen anotasi dinilai dalam memori lalu dihapus dari laporan, diganti hitungan/panjang/hash. Protokol menyimpan versi schema dan kebijakan metrik. Template tetap kosong; tidak membuat chat bisnis buatan untuk benchmark.
- [x] Delapan belas tes kontrak chat lulus, termasuk redaksi, anotasi parsial, modifier tak terdaftar, catatan terlalu panjang, fallback dan CLI. Uji Qwen/Whisper nyata kembali lulus tujuh pemeriksaan HTTP dengan catatan tambahan tetap sampai antrean dapur; bukan evaluasi akurasi lapangan.
- [x] Regresi lengkap **302 tes backend + 62 browser = 364 lulus**, `npm test` exit 0. [Bukti regresi](evaluation/ai-notes-release.json), [uji model asli](evaluation/ai-notes-runtime.json). Belum di-push atau dideploy pada tahap ini.
- [ ] Evaluasi chat/rekaman pesanan usaha Indonesia berizin dan berlabel belum dapat dijalankan: data tersebut belum tersedia. Infrastruktur evaluasi selesai bukan berarti item ini selesai.
- [ ] Tentukan kebutuhan fine-tuning setelah melihat pola kesalahan pada data pengembangan nyata, dengan test terpisah; jangan melatih atau mengubah bobot sekadar agar disebut AI.

# Lanjutan v0.47 — paket adil dan AI ke dapur

- [x] Paket Mulai tanpa batas sepuluh menu; pencatatan manual, stok dan keikutsertaan kulakan tetap terbuka. Pengaturan menampilkan kuota dari penggunaan nyata per usaha, dibagi staf dan direset menurut bulan Jakarta. Nilai percobaan 100 ekstraksi/30 transkripsi dapat diatur melalui environment.
- [x] Kuota persisten dengan reservasi atomik, pengembalian untuk kegagalan/fallback dan kedaluwarsa reservasi terputus. Dua endpoint ekstraksi berbagi kuota; setelah habis parser lokal tetap tersedia dengan label yang jelas. Suara mengarahkan pengguna ke input manual.
- [x] Kebutuhan paket tambahan tersimpan atas persetujuan pemilik, tanpa menagih atau mengaktifkan paket palsu. Tumbuh/Jaringan dan fitur cabang/mitra masih ditandai rencana.
- [x] **Prioritas utama: chat/suara → ekstraksi → formulir pemeriksaan → antrean dapur** tersedia bagi pemilik/kasir. Pengguna mengoreksi menu, porsi, catatan, label dan sumber sebelum mengirim. Ekstraksi tidak mengubah stok/penjualan. Katalog berubah dan sesi dicabut ditolak; pengiriman dapur tetap idempoten.
- [x] Model hanya menerima ID/nama/alias katalog usahanya. Kasir tidak memperoleh resep atau pengaturan paket. Hasil baru yang gagal tidak menghapus formulir sebelumnya dan diberi penjelasan.
- [x] Verifikasi lokal Qwen 1.5B/Whisper asli lulus tujuh pemeriksaan HTTP, termasuk pesanan selesai sekali dan penggunaan kuota; seluruhnya SQLite memori. Bukan benchmark akurasi atau aktivasi Qwen cloud. [Bukti](evaluation/plans-kitchen-ai-runtime.json).
- [x] Regresi lengkap: **294 tes Node + 62 tes browser = 356 lulus**, `npm test` exit 0. Backend 294 tes diulang setelah penyesuaian pengembalian kuota pada konflik katalog/sesi; exit 0. [Ringkasan validasi](evaluation/plans-kitchen-ai-release.json).
- [x] Panduan berpanah v9 menambah topik paket dan pesanan AI (20 topik/99 langkah). Review tampilan pemilik/kasir/paket pada desktop, ponsel dan gelap mendapat verdict **ship** pada lingkup perluasan ini. [Review](evaluation/PLANS_KITCHEN_AI_UI_REVIEW.md).
- [x] Perbaikan temuan sebelumnya: kode pemulihan dibersihkan saat akun/navigasi berubah; penghitung percobaan login/pemulihan menormalkan spasi/email; verifier backup mendukung migrasi aditif sambil memeriksa seluruh baris/kolom asal.
- [ ] Tetapkan kuota/harga dari uji kebutuhan dan biaya nyata; pembayaran, aktivasi langganan, penambahan kapasitas berbayar dan koordinasi jaringan belum tersedia.
- [ ] **Prioritas berikut:** uji pesanan Bahasa Indonesia berizin pada Qwen/Whisper, ukur kesalahan menu/jumlah/variasi, penolakan dan waktu proses; tingkatkan cakupan hanya jika pemeriksaan aman dan evaluasi mendukungnya. Jalur konservatif sekarang tetap dapat menolak chat ambigu.
- [ ] Uji demo ujung ke ujung dengan pengguna awam/perangkat nyata dan kondisi bising; lanjutkan validasi ramalan pada histori usaha berizin. Tidak melatih model dari akun simulasi.

[Cara mencoba, konfigurasi dan batas](PLANS_AND_KITCHEN_AI.md). Status ini adalah pekerjaan lokal; belum menyatakan perubahan sudah di-push atau dideploy ke Railway.

# Lanjutan v0.46 — pemantauan perubahan pola pemakaian (drift)

- [x] Aturan tinjauan drift (`median-level-shift-review-v1`) di `server/ml/usage-drift.mjs`: membandingkan median jendela terakhir (14 hari) dengan baseline sebelumnya (28 hari) secara robust (median+MAD, ambang modified-z 3,5 dan lantai relatif 25%), sehingga lonjakan satu hari tidak memicu sinyal. Bukan model terlatih, tanpa atribusi sebab (libur/cuaca), tanpa koreksi/retraining otomatis.
- [x] Jendela berlubang / histori kurang / tanpa histori tetap "belum tersedia" (status eksplisit), tidak menebak; tanggal masa depan/berjalan dikecualikan; baris duplikat/tak valid ditolak.
- [x] Terintegrasi ke `recommendations[].driftScreening` dan ditampilkan di panel Periksa pemakaian: notifikasi ringkas tingkat-panel ("N bahan menunjukkan perubahan pola"), tag "Perubahan pola" dan penjelasan baseline→terbaru per bahan. Panduan kulakan diperbarui; cache shell `v45-usage-drift`.
- [x] Catatan: ini menjawab sebagian item AI "pemantauan perubahan pola" dan "notifikasi otomatis" sebagai aturan statistik yang disurface; **validasi lapangan pada data berlabel, deteksi anomali terlatih, fitur libur/cuaca, aktivasi Qwen, dan pelatihan/validasi dengan data usaha Indonesia berizin tetap terbuka** (dataset ML publik tidak ada di repo; Qwen menunggu akun berbayar).
- [x] Regresi penuh **286 Node + 58 browser = 344 lulus**, exit 0. Ditambah empat tes backend drift dan satu tes browser sinyal perubahan pola.

# Lanjutan v0.45 — pemulihan akun pemilik dengan kode pemulihan

- [x] Pemilik membuat kode pemulihan sekali pakai (10 kode, hanya tersimpan sebagai hash SHA-256) dari Pengaturan → "Kode pemulihan akun"; ditampilkan sekali untuk disalin/disimpan, dengan Salin semua kode dan Sembunyikan kode. Membuat ulang mengganti seluruh batch lama.
- [x] Lupa kata sandi: dari halaman masuk "Lupa kata sandi?" → email + satu kode + kata sandi baru. Kode dikonsumsi, kata sandi diganti, seluruh sesi lama akun dikeluarkan, lalu langsung masuk. Tanpa ketergantungan email eksternal (konsisten dengan desain kode masuk staf).
- [x] Email/kode salah memberi satu pesan generik "Email atau kode pemulihan tidak sesuai" (anti-enumerasi); rate-limit per alamat+email; percobaan gagal tidak mengonsumsi kode. Akun kode-only (staf) tidak memiliki kode pemulihan; `details.recoveryCodes` null untuknya.
- [x] Migrasi aditif tabel `account_recovery_codes` (hash unik, FK cascade); schema 30 → 31 tabel, backup/restore membandingkan 31 tabel, snapshot migrasi lama tetap identik.
- [x] Panduan pengaturan v8 diperbarui (langkah kata sandi mencakup kode pemulihan + "Lupa kata sandi?"); cache shell `v44-aging-stock-recovery`.
- [x] Regresi penuh **282 Node + 57 browser = 339 lulus**, exit 0. Ditambah tiga tes backend pemulihan dan satu tes browser alur lupa-sandi (buat kode, reset, kode bekas ditolak, sandi lama gagal).
- [ ] Verifikasi email dan pemulihan untuk akun staf berpassword belum tersedia (pemilik memulihkan/menerbitkan ulang untuk staf). Pilot usaha nyata tetap terbuka.

# Lanjutan v0.44 — batas tunggu dapur yang dapat diatur

- [x] Pemilik mengatur batas tunggu (aging) per stasiun 1–120 menit, bawaan 15; bilangan bulat, divalidasi server dan dijaga revisi. Sebelum batas, tugas tercepat didahulukan; setelah batas, pesanan menunggu terlama didahulukan. Tugas yang sedang dikerjakan tidak pernah diinterupsi.
- [x] Satu perencana dipakai owner/staf/pelanggan untuk giliran dan ETA; layar layanan memakai batas per stasiun yang sama.
- [x] Migrasi aditif `kitchen_stations.aging_minutes` (DEFAULT 15, CHECK 1–120); seluruh nilai stasiun lama dipertahankan, klien lama tanpa field tetap menyimpan kapasitas memakai batas sebelumnya.
- [x] UI kapasitas menambah isian batas tunggu beserta bantuan; konflik revisi mempertahankan isian tiap stasiun dan menyediakan "Muat pengaturan terbaru" dengan fokus. Panduan dapur diperbarui, cache shell `v44-kitchen-aging`.
- [x] Perkiraan hari stok tersisa per bahan di panel Saran kulakan: stok tersedia dibagi pemakaian harian dari estimasi yang sama (baseline/model terlatih), ditampilkan hanya saat histori cukup (≥7 hari) dan ada pemakaian tercatat; bahan ≤2 hari ditandai. Panduan kulakan diperbarui.
- [x] Regresi penuh **279 Node + 56 browser = 335 lulus**, exit 0. Ditambah dua tes kapasitas, tiga tes penjadwalan dan satu tes browser batas tunggu; satu tes backend dan satu tes browser hari stok tersisa.
- [ ] Review UI berpanduan Impeccable (capture `.impeccable/review`) belum dijalankan; perubahan ini perluasan biasa form kapasitas dan tabel saran tanpa mengubah canon desain (cream/terracotta/Nunito/dark).
- [ ] Alur suara/penjualan langsung kasir, fuzzy matching dan pilot usaha nyata tetap terbuka.

# Lanjutan v0.43 - Railway dan AI cloud

- [x] Sambungkan akun Railway yang diminta; buat proyek, domain HTTPS dan volume SQLite `/data`, satu replika di Singapura.
- [x] Kontrak origin/host/cookie Secure/HSTS, IP proxy eksplisit, penolakan startup database di luar volume; lokal tetap berfungsi.
- [x] Build Docker Linux dengan Whisper Tiny sesuai sumber terkunci; verifikasi pemuatan, inferensi dan endpoint suara pada akun memori.
- [x] Perbaiki penjelasan suara agar sesuai pemrosesan di layanan aplikasi; UI/panduan tetap memakai rekam, periksa teks dan konfirmasi terpisah. Review UI ship; canon desain tidak berubah.
- [x] Regresi akhir **270 Node + 54 browser = 324 lulus**, npm test exit 0.
- [x] Database cloud 30 tabel, integritas/relasi OK; hash logis dan penanda volume bertahan setelah redeploy, tanpa fixture produksi atau unggahan database laptop.
- [x] Backup SQLite konsisten, salinan restore terpisah dan unduhan backup ke laptop diverifikasi; kunci SSH diagnostik sementara dicabut.
- [x] Siapkan Dockerfile Ollama resmi yang dipatok digest dan startup unduh ke volume; konfigurasi privat diterapkan pada layanan kosong. Sintaks shell lulus; image model belum dibangun/dijalankan.
- [x] Siapkan `npm run verify:ai-runtime`: enam pemeriksaan API dengan Qwen/Whisper nyata pada SQLite memori, termasuk digest model, autentikasi/origin dan kesamaan seluruh tabel. Run lokal lulus; kontrol Qwen tidak tersedia gagal dengan benar, fallback tidak dianggap AI. Ini belum verifikasi Qwen cloud. [Bukti](evaluation/ai-runtime-acceptance.json).
- [ ] **Qwen belum aktif**: pengguna memilih peningkatan kapasitas dengan model tetap 1.5B. Akun masih Trial tanpa metode pembayaran; tunggu aktivasi Hobby berbayar di dashboard, periksa ulang kuota, lalu atur 2 GB RAM/2 vCPU, volume model dan uji ekstraksi nyata. Batas yang teramati masih 1 GB RAM/500 MB volume.
- [x] Tool backup cloud ke laptop dapat dipakai ulang: `npm run backup:railway -- --config data/railway-backup.local.json`. Transfer checksum, integritas/relasi, restore melalui store aplikasi dan kesamaan 30 tabel berhasil; lima tes terarah lulus. [Petunjuk dan bukti](RAILWAY_BACKUP.md).
- [ ] Backup terjadwal berkelanjutan: kuota backup Railway 0; Windows menolak pembacaan script pemasang jadwal karena deteksi software tidak diinginkan. Tugas belum terdaftar, script jadwal persiapan dihapus, keamanan Windows tidak diubah. Backup manual belum menggantikan jadwal.
- [ ] Uji owner/kasir/dapur/pelanggan pada perangkat fisik berbeda; ukur CPU/RAM/antrean/latensi saat semua AI aktif.
- [ ] Opsional berikutnya: hubungkan deployment otomatis GitHub; saat ini upload CLI dari branch fitur.
- [ ] Aging bisa diatur, hari stok tersisa, alur suara kasir, fuzzy matching dan pilot nyata tetap terbuka.

[URL dan petunjuk](RAILWAY_DEPLOYMENT.md) | [bukti lokal](evaluation/railway-preparation.json) | [bukti cloud](evaluation/railway-runtime.json). Model/bobot/protokol evaluasi tidak diubah, model forecast publik tidak diaktifkan ke bahan akun baru. Checklist berikut adalah riwayat.

# Lanjutan v0.42 - kode masuk staf

- [x] Buat staf nama/peran tanpa email/password fiktif; kode 8 karakter, 15 menit, sekali pakai dan hash-only di server. Akun email lama tetap berfungsi.
- [x] Kode untuk staf yang sudah ada, cabut kode belum dipakai, pembatalan saat role/status/password berubah, batas tebakan per sumber koneksi dan isolasi scope/peran.
- [x] UI pemilik/staf dengan konfirmasi, hasil setelah respons server, retry idempoten, rahasia di memori saja serta penghapusan saat pindah halaman/expiry; Akun saya sesuai jenis kredensial.
- [x] Panduan berpanah v8: 18 topik / 93 langkah; Lanjut/Kembali/Lewati tetap tersedia.
- [x] Backup/migrasi tiga database: 29 tabel asal identik, kredensial/sesi dipertahankan; tabel staff_invites baru kosong, schema total 30, FK/integritas OK.
- [x] Regresi penuh **263 Node + 54 browser = 317 lulus**, exit 0. Runtime 18 pemeriksaan anonim dan tiga login demo, tanpa perubahan data bisnis. [Bukti rilis](evaluation/pairing-release.json).
- [x] Dokumentasi penggunaan dan kontrak: [Kode masuk staf](STAFF_PAIRING.md). Review UI/desain dicatat pada laporan rilis.
- [ ] Berikutnya: deployment/HTTPS/origin/cookie, volume SQLite persisten, backup/restore dan uji antarperangkat.
- [ ] Aging bisa diatur, hari stok tersisa, alur suara/penjualan langsung kasir, fuzzy matching dan pilot nyata tetap terbuka.

Model, bobot, dataset bisnis dan protokol evaluasi tidak diubah. Checklist versi berikut adalah riwayat.

# Lanjutan v0.41 — status kasir, pelaku tindakan dan demo F&B

- [x] Ambil dan gabungkan perubahan terbaru origin/rahasiagelap2.0 (`fe073d0`): tombol, navigasi, ikon keluar, keadaan data kosong dan catatan layar layanan; fitur staf/kapasitas/waste/ETA tetap tersedia.
- [x] Hitung `ok/low/out` dari stok tersedia setelah cadangan dan ambang bahan milik pemilik. Kasir hanya mendapat status; jumlah porsi dan bahan tidak dikirim. Menu hampir habis memunculkan petunjuk; menu habis tetap ditolak server.
- [x] Simpan snapshot ID/nama/peran/revisi pelaku dari database pada catatan baru dan aksi dapur; tampilkan pada Jejak aktivitas. Histori lama tetap tanpa atribusi, payload tidak menentukan pelaku.
- [x] Backup dan migrasi aditif delapan kolom pada 29 tabel asli/demo lama, dengan baris/kolom asal identik dan relasi/integritas OK.
- [x] Siapkan demo F&B tiga peran pada database terpisah: 9 bahan, 7 menu, histori 84 hari, antrean pasif/siap/waste dan tiga status menu. Jalankan ulang mempertahankan data. [Akun](DEMO_ACCOUNT.md).
- [x] Regresi penuh selesai normal: 253 Node + 51 browser = **304 lulus**, npm test exit 0. [Bukti rilis](evaluation/fnb-release.json).
- [x] Review UI v0.41: ship, tanpa perbaikan material pada delapan capture. Catatan desain selesai; DESIGN.md dan sidecar tetap identik. [Review](evaluation/FNB_UI_REVIEW.md), [desain](evaluation/FNB_DESIGN_CHECK.md).
- [x] Pairing staf dengan kode sekali pakai selesai v0.42, mempertahankan akun/email/kata sandi lama.
- [ ] Deployment/HTTPS/origin/cookie, volume SQLite persisten, backup/restore dan uji antarperangkat.
- [ ] Aging bisa diatur, hari stok tersisa, alur input suara/penjualan langsung kasir, fuzzy matching dan pilot nyata masih terbuka.

[Perubahan v0.41](FNB_OPERATIONS.md). Checklist versi di bawah adalah riwayat; model/bobot/protokol evaluasi tidak diubah.

# Lanjutan v0.40 — integrasi Claude dan rahasiagelap2.0

- [x] Periksa tiga commit fitur Claude: kapasitas stasiun/waste sebagian, katalog pelanggan dengan konfirmasi, dan ETA; selaras dengan SRS/fungsi saat ini.
- [x] Merge branch tampilan lama ke feat/kitchen-capacity-and-waste tanpa kehilangan akun staf, kontrol role, inbox, kapasitas dan CSS fitur. main tidak diubah.
- [x] Perbaiki ETA: durasi pasif tidak dihitung dua kali, alat penuh menahan slot staf, kapasitas yang diturunkan dihormati, satu perencana untuk owner/staf/pelanggan, dan pembaruan ETA masuk revisi SSE.
- [x] Gabungkan panduan role-aware, pengenalan per halaman setelah pendaftaran UI, perlindungan tur manual, target antrean kosong dan cache v40 network-first/fallback offline.
- [x] Backup dan migrasi main/demo: baris dan kolom lama identik, schema 29 tabel, integritas/relasi OK; tanpa seed bisnis baru.
- [x] Regresi akhir selesai normal: **246 Node + 49 browser = 295 lulus**, exit 0. [Bukti](evaluation/integration-release.json). Model/bobot/hasil riset tidak diubah.
- [x] Tulis hasil integrasi dan konteks lanjutan untuk Claude. [Perubahan](BRANCH_INTEGRATION.md), [handoff](CONTINUE_WITH_CLAUDE.md).
- [x] Review UI integrasi: ship; catatan sistem desain selesai, DESIGN.md dan sidecar tetap identik. Koreksi tanda baca diverifikasi ulang (1 browser + 12 Node, kasus berulang, tidak menambah 295 tes unik).
- [ ] Berikutnya: konfigurasi deployment/HTTPS/origin/cookie, volume SQLite persisten dan backup/restore; uji kasir/dapur/pelanggan dari perangkat berbeda.
- [ ] Pilot dapur nyata untuk durasi fase, mutu ETA dan proses waste; alat bersama lintas stasiun dan shift masih terbuka.
- [ ] Streaming suara dua detik, kestabilan ASR, pembayaran daring dan adaptor ojol belum selesai.

Checklist versi di bawah adalah riwayat. [Cakupan, koreksi, bukti dan batas](BRANCH_INTEGRATION.md).

# Lanjutan v0.38 — katalog pesanan pelanggan (REQ-F05)

- [x] Tautan berjenis `catalog` terpisah dari layar status; token hanya membuka jenisnya sendiri.
- [x] Katalog publik: hanya menu berwaktu/stasiun, ketersediaan boolean dari stok dikurangi cadangan, pembaruan SSE; menu habis tidak dapat dipilih dan dikeluarkan dari pesanan yang sedang disusun.
- [x] Permintaan pelanggan menunggu konfirmasi kasir/pemilik; terima membuat pesanan dapur `web` dengan cadangan bahan, tolak menyimpan alasan; kedaluwarsa 30 menit; batas laju per tautan; idempotensi.
- [x] Perubahan harga atau bahan kurang saat penerimaan ditolak secara atomik (SAVEPOINT bersarang).
- [x] Panduan kasir ditambah satu langkah (89 langkah). [Panduan](CUSTOMER_CATALOG.md).
- [ ] Akses ponsel pelanggan lewat jaringan/HTTPS, pembayaran daring, integrasi otomatis ojol.
# Lanjutan v0.37 — kapasitas dan bahan terbuang sebagian

- [x] Kapasitas per stasiun: staf aktif 1–20 membuka beberapa giliran SJF+aging sekaligus; alat tahap pasif 1–50 atau tidak dibatasi. Revisi mencegah penimpaan dari perangkat lain; bawaan sama dengan v0.36.
- [x] Pembatalan per item: item belum dikerjakan melepas cadangan item saja; item yang sudah dimulai mencatat `kitchen_waste` sesuai jumlah per bahan, sisa cadangan kembali tersedia. Total dan penjualan akhir tidak memuat item yang dibatalkan.
- [x] Penutupan seluruh pesanan menerima jumlah per bahan (bawaan seluruh cadangan).
- [x] Izin: pemilik mengatur kapasitas dan jumlah sebagian; akun dapur membatalkan item dengan seluruh resep; kasir tidak membatalkan item. Server menolak jumlah per bahan dari staf.
- [x] Migrasi aditif (`kitchen_stations`, `item_index`/`usage_json`/`waste_json`); pesanan lama multi-item menolak pembatalan per item dengan pesan jelas.
- [x] Panduan dapur diperbarui (88 langkah). Regresi: 233 Node + 45 browser. [Panduan](KITCHEN_CAPACITY.md).
- [x] Estimasi waktu tunggu dari kapasitas ditambahkan v0.39 dan dikoreksi v0.40.
- [ ] Alat bersama lintas stasiun dan shift staf.
# Lanjutan v0.36 — akun staf

- [x] Regresi akhir selesai normal: 227 Node + 44 browser = **271 lulus**, exit 0 pada browser Chromium terpisah. [Bukti rilis](evaluation/staff-release.json). Percobaan gagal/cleanup lama tetap dicatat, bukan dihitung sebagai run sukses.

- [x] Review UI menilai dua perbaikan (fokus keyboard dan akses intake mobile) resolved; pemeriksaan desain mempertahankan kedua hash baseline. [Review](evaluation/STAFF_ROLES_UI_REVIEW.md) dan [catatan desain](evaluation/STAFF_ROLES_DESIGN_CHECK.md).

- [x] Role owner/cashier/kitchen di database, akun lama menjadi owner pada migrasi pertama; role hilang selalu gagal autentikasi.
- [x] Pemilik membuat akun staf nyata dalam usaha yang sama, mengubah peran dan mengaktifkan/menonaktifkan dengan konfirmasi/revisi/idempotensi.
- [x] Server membatasi endpoint/tindakan dan data bootstrap; dapur tidak mendapat harga/laporan/resep, kasir mendapat harga/porsi untuk intake saja.
- [x] Perubahan akses mencabut seluruh sesi target; SSE mendeteksi sesi hilang. Staf dapat mengubah password sendiri.
- [x] Tampilan kasir/dapur, antrean bersama dan panduan per peran; jalur masuk melewati cache PWA lama.
- [x] Namespace bukti kirim per akun/peran/revisi dan tanpa snapshot staf offline; draft pemilik tidak ditampilkan ke staf.
- [x] Backup/migrasi main+demo: 25 tabel lama identik, dua tabel baru, hanya role owner turunan akun lama; tanpa staf/data contoh otomatis.

[Cara memakai, batas dan pengujian](STAFF_ROLES.md). Tahap berikutnya: kapasitas alat/staf dan waste sebagian; kemudian pilot suara terukur serta deployment/HTTPS. Model/bobot/benchmark AI tidak berubah pada tahap ini.

Checklist versi lama di bawah menjadi riwayat; rincian riset yang belum selesai tetap terbuka.

# Lanjutan v0.35

- [x] Regresi akhir 220 Node + 41 browser = 261 lulus, proses selesai normal; sesi hilang/pergantian akun dan tab tersembunyi mendapat tes regresi khusus. [Bukti](evaluation/display-release.json).

Pekerjaan berikutnya setelah modul dapur: layar pelanggan yang dapat dibuka tanpa membagikan akun pemilik. Implementasi dan uji akses/proyeksi/migrasi sudah tersedia; tautan dibuat pemilik sesuai kebutuhan, bukan diisi otomatis. Node.js/SQLite tetap; tidak melatih/mengaktifkan model baru. [Alur dan batas](CUSTOMER_DISPLAY.md). Prioritas sesudahnya adalah peran kasir/staf dapur; suara dua detik dan deployment tetap terbuka.

# Prioritas integrasi SRS dapur — v0.34

Pengguna memilih memprioritaskan fungsi SRS Smart Kitchen Command Center dan mempertahankan teknologi saat ini. [Pemetaan kebutuhan, cara mencoba dan batas](KITCHEN_INTEGRATION.md).

- [x] Tambah pengaturan waktu total/pasif dan stasiun ke menu tanpa nilai contoh di akun nyata.
- [x] Antrean multi-item, SJF per stasiun dengan aging 15 menit, tahap pasif dan giliran berikutnya.
- [x] Reservasi seluruh bahan, perlindungan penjualan/surplus/penerimaan, snapshot resep/harga, konsumsi saat selesai tepat sekali.
- [x] Pembatalan sebelum mulai serta penutupan seluruh bahan terpakai dengan konfirmasi eksplisit setelah mulai.
- [x] Layar layanan terautentikasi dan SSE scoped, status koneksi serta perbaikan fokus keyboard.
- [x] Kendali suara opt-in menggunakan adapter lokal, parser perintah terbatas, penolakan ambigu/negasi/revisi usang; tidak menyimpan rekaman/transkrip.
- [x] Tema mengikuti OS sebelum pengguna memilih tema sendiri; panduan tambahan enam langkah dapur/layanan.
- [x] Backup dan migrasi aditif: 20 tabel asli identik, empat tabel dapur kosong; tidak mengubah bobot/model atau hasil benchmark.
- [x] Regresi penuh selesai normal: 215 Node dan 35 browser lulus; worker browser tunggal, stream/idle connection ditutup saat shutdown. [Bukti rilis](evaluation/kitchen-release.json).
- [ ] Target voice-to-screen ≤2 detik: belum terpenuhi (rekaman saat ini empat detik), perlu streaming dan pengukuran nyata.
- [ ] Validasi koki/pemilik, durasi masak aktual, kebisingan dan mikrofon lapangan; kestabilan Whisper masih terbuka.
- [x] Layar pelanggan tanpa login pemilik: token baca terbatas/berakhir/dicabut, proyeksi kode-status, SSE, tidak menyimpan kunci asli atau transkrip. [Panduan](CUSTOMER_DISPLAY.md).
- [x] Peran kasir/dapur dengan pembatasan tindakan/sesi server selesai pada v0.36. [Cakupan dan batas](STAFF_ROLES.md).
- [x] Kapasitas per stasiun dan waste sebagian ditambahkan v0.37; alat bersama/shift dan tahap lebih rinci tetap terbuka.
- [ ] Integrasi pemesanan/katalog ojol dan kanal eksternal; sumber saat ini dicatat manual.
- [ ] Kesiapan deployment, HTTPS, pemantauan, backup produksi dan uji beban.

Checklist riset lama di bawah tetap berlaku; model publik tidak otomatis digunakan untuk bahan akun atau penjadwalan dapur.

# Pekerjaan AI sesuai proposal

Urutan kerja saat ini: data berizin → pelatihan forecasting → evaluasi waktu terpisah → aktivasi bersyarat → eksperimen ekstraksi.

- [x] Memeriksa proposal bagian 4.2–4.6 dan 8: model bahasa lokal, forecasting dibanding baseline, dataset/evaluasi dan kontribusi pipeline.
- [x] Format dataset harian, template kosong, validasi CSV dan ekspor read-only dari SQLite dengan konfirmasi izin/kelengkapan.
- [x] Implementasi pelatihan Ridge dan run nyata publik: 500 model dipelajari dari 45.000 catatan harian FreshRetailNet-50K, tanpa data sintetis.
- [x] Pemisahan train/validation/test kronologis, target dua hari tanpa overlap, MAE/WAPE, dua baseline dan ablation kalender.
- [x] Artefak model, hash dataset, parameter/scaler, aktivasi bersyarat, checksum dan integrasi saran kulakan per usaha/bahan.
- [x] Sebelas uji ML terisolasi, termasuk penolakan aktivasi model publik untuk akun usaha. Panduan: AI_TRAINING.md.
- [x] Mencari, memeriksa lisensi dan mengunduh dataset nyata publik secara mandiri: Dingdong-Inc, CC BY 4.0, revisi/checksum dipatok. Lihat datasets/public/freshretailnet/README.md.
- [x] Pengguna belum memiliki CSV; pencarian dan eksperimen publik tidak lagi menunggu pengguna mengumpulkan file. Template kosong dan DATA_COLLECTION.md tetap tersedia untuk pilot sendiri.
- [x] Melatih 500 model, menilai 3.500 target internal dan 1.500 target eksternal, serta menyimpan seluruh bobot/scaler, error, metrik dan provenance. Hasil: evaluation/FRESHRETAILNET_RESULTS.md.
- [x] Melaporkan kegagalan mengalahkan baseline: Ridge WAPE eksternal 35,65%, nilai terakhir 37,30%, rata-rata tujuh hari 26,88%. Tidak mengklaim Ridge lebih baik dari seluruh baseline atau mengubah test agar lolos.
- [x] Error analysis stockout/non-stockout dan stabilitas kelulusan; run ulang memverifikasi 500 bobot/scaler/prediksi identik. Lihat evaluation/FRESHRETAILNET_ERROR_ANALYSIS.md dan freshretailnet-reproducibility.json.
- [x] Menetapkan protokol v2 sebelum eksperimen: pooled residual boosting, 16 kandidat validasi, 200 toko holdout di luar seluruh 355 toko pengembangan. Test v1 tidak digunakan kembali sebagai bukti independen.
- [x] Melatih model gabungan dari 19.000 target nyata; test 600 target toko baru menghasilkan WAPE 24,83% dibanding MA7 27,04% (galat turun 8,16%). Model menang pada 113/200 seri; semua kegagalan tetap dilaporkan. Lihat evaluation/FRESHRETAILNET_V2_RESULTS.md.
- [x] Memeriksa ulang sumber/hash, pemilihan toko, label, baseline, seluruh metrik dan pelatihan ulang konfigurasi yang dibekukan: 600 prediksi identik. Tujuh tes Python tambahan lulus; aplikasi tetap memakai data pengguna, tanpa mengaktifkan model publik.
- [x] Replikasi pipeline Ridge pada sumber/domain dan kalender berbeda: UCI Online Retail 2010–2011, CC BY 4.0; protokol dibekukan, 4 negara dipilih dari development saja, 4 model dan 76 target eksternal. WAPE ternormalisasi 54,41% vs MA7 62,99%; raw Ridge 32,92% kalah dari pola mingguan 24,92%. Laporan: evaluation/UCI_RETAIL_RESULTS.md.
- [x] Verifikasi replikasi UCI dari workbook asli: hash preparasi/pemilihan/normalisasi sama, 4 bobot/scaler dan 76 prediksi identik; delapan tes kontrak tambahan. Semua hasil, termasuk baseline yang lebih baik, disimpan dan model publik tidak diaktifkan.
- [x] Periksa kompatibilitas transfer v2 ke UCI: stockout tidak tersedia, sehingga fitur itu tidak diisi nol. Siapkan varian sales-only dengan fitur relatif; bobot v2 asli tetap utuh dan tidak ditransfer langsung.
- [x] Uji varian boosting lintas dataset: fit/validasi hanya pada 500 seri FreshRetailNet, lalu transfer bobot tetap ke 10 negara UCI yang sebelumnya belum dinilai / 190 target. Protokol mengakui kalender UCI sudah diketahui. Hasil negatif: rata-rata WAPE negara 173,00% vs MA7 165,12% dan MA14 156,51%; model menang atas MA7 pada 1/10 negara. Panduan: BOOSTING_TRANSFER.md.
- [x] Verifikasi transfer dari sumber asli: bobot/koreksi refit identik, 190 prediksi dan seluruh metrik cocok; tujuh tes transfer tambahan. Analisis 121 target dua hari SUM event nol, seluruh kasus/negara tetap disimpan. Tidak ada retuning/aktivasi publik.
- [ ] Perbaiki dan validasi generalisasi dengan strategi adaptasi/data yang sesuai serta test baru sebelum klaim operasional. Hasil transfer sales-only belum mengalahkan baseline. Fresh v1/v2, UCI Ridge dan UCI transfer kini sudah terlihat; jangan tuning di sana lalu menyebutnya test independen. Transfer bobot v2 asli dengan fitur yang benar tetap belum diuji.
- [ ] Validasi pilot dengan data usaha Indonesia yang berizin; ini pekerjaan terpisah dari pelatihan publik yang sudah selesai. Jangan memasangkan model publik ke bahan pengguna.
- [x] Audit cakupan ledger read-only melalui `forecast readiness` dan metadata `historyQuality` saat inferensi: nol tersimpan/asumsi, tanggal sebelum histori, status kandidat training, registry dan ringkasan perubahan tujuh hari. Sembilan tes tambahan; panduan FORECAST_READINESS.md.
- [ ] Pada pilot usaha sendiri: verifikasi kelengkapan pencatatan bersama pemilik dan validasi pemantauan perubahan pola. Audit deskriptif belum membuktikan kelengkapan atau mendeteksi drift/anomali secara tervalidasi. Belum ada retraining otomatis.
- [x] Infrastruktur evaluasi chat: template kosong, panduan anotasi, validasi sumber/izin/redaksi, pencegahan kebocoran percakapan/teks antar-split, hash dataset dan keluaran privat. Panduan: CHAT_EVALUATION.md.
- [x] Alat pembanding parser, Qwen mentah dan pipeline aplikasi yang sebenarnya, dengan exact match, false acceptance, fallback/error dan p50/p95; sepuluh tes kontrak terisolasi. Tidak membuat skor tanpa dataset nyata.
- [ ] Kumpulkan chat nyata berizin, redaksi, anotasi manusia dan pembekuan split percakapan sebelum eksperimen. Belum ada dataset chat lapangan yang dinilai.
- [ ] Jalankan pembanding pada chat nyata dan analisis kesalahan/latensi. Pipeline sekarang memakai parser sebagai gate, sehingga hasil pipeline bukan bukti bahwa Qwen memperluas cakupan parser. Qwen tetap pretrained, belum fine-tune.
- [x] Infrastruktur voice bookkeeping lokal: Whisper Tiny pretrained multilingual, CPU int8, source lock/checksum dan lingkungan terpisah; rekam/stop/batal, transkrip dapat dikoreksi dan ditambahkan ke catatan sebelum review pesanan. Audio tidak disimpan; login/CSRF, batas ukuran/durasi/konkurensi/timeout dan pembatalan tersedia. Tujuh tes Node, tujuh Python dan empat browser tambahan. Panduan: [VOICE_BOOKKEEPING.md](VOICE_BOOKKEEPING.md).
- [x] Evaluasi ASR pada suara nyata publik: FLEURS Indonesia, CC BY 4.0; checksum/revisi dan pemilihan hash dibekukan, 64 dari 687 rekaman test melalui adapter produksi tanpa training/fine-tuning. WER 67,27%, CER 27,64%, exact match 0/64, enam penolakan tetap dinilai. Delapan tes skor/pemilihan tambahan. [Hasil dan batas klaim](evaluation/FLEURS_ASR_RESULTS.md).
- [x] Verifikasi ASR publik: preparasi ulang sumber, seluruh 64 hash audio/referensi dan skor/durasi dibandingkan; delapan inferensi pertama sesuai protokol diulang. Kesamaan transkrip hanya diklaim untuk delapan pengulangan tersebut. Tidak mengubah sampel/model setelah hasil buruk.
- [x] Tetapkan dan jalankan pembanding ASR Tiny/Base dengan 16 kalimat validation dan 48 test baru, tanpa kalimat/teks/audio dari run lama atau overlap validation-test. Aturan pemilihan dan keputusan validation dibekukan sebelum test. Pada satu run: WER test Base 36,36% vs Tiny 66,93% (galat relatif turun 45,67%), Base lebih baik pada 43/48 rekaman. Delapan tes pemisahan/keputusan ditambahkan. [Hasil dan batas klaim](evaluation/ASR_COMPARISON_RESULTS.md).
- [x] Audit perbandingan: preparasi ulang sumber/hash, seluruh skor, pairing dan keputusan validation cocok. Kegagalan reproduksi inferensi tetap dilaporkan: **3/4 transkrip ulang berbeda**; ini bukan lulus reproduksi prediksi. Runtime/model aktif tidak diganti. [Bukti](evaluation/asr-comparison-reproducibility.json).
- [x] Diagnostik awal variasi inferensi: 136 inferensi proses baru dengan hash PCM/VAD/fitur/encoder, lima urutan impor dan kontrol satu faktor. Empat dari 20 kelompok tanpa hash tensor masih berubah; 22 kelompok instrumentasi cocok pada pengulangan yang diamati. Hanya mengganti thread OpenBLAS mengubah fitur/encoder dan teks Tiny pada klip yang diketahui bermasalah. Seluruh bukti/hash/protokol dan tujuh tes audit tersedia; ini belum menetapkan penyebab variasi konfigurasi tetap. [Hasil diagnostik v0.22](evaluation/ASR_STABILITY_RESULTS.md), [panduan](ASR_STABILITY.md).
- [x] Tindak lanjut v0.23: 64 inferensi plain/deferred dengan hash setelah transkripsi, empat capture Tiny dan 112 pemeriksaan alignment. Delapan kelompok pengulangan cocok pada run ini; seluruh kontrol alignment cocok dengan referensi profilnya. Pada 16/16 pasangan perubahan OpenBLAS, tahap pertama berbeda adalah **proyeksi mel**, setelah PCM/window/filter/STFT/magnitudes yang sama. Ini lokalisasi intervensi pengaturan, bukan penyebab kegagalan historis konfigurasi tetap. Tujuh tes audit tambahan; seluruh hasil negatif dan bukti lama dipertahankan. [Hasil](evaluation/ASR_FOLLOWUP_RESULTS.md), [panduan](ASR_FOLLOWUP.md).
- [x] Adapter kandidat profil v0.24: Tiny current, Tiny pinned dan Base pinned; pengaturan BLAS sebelum impor native, checksum serta identitas model/profil diperiksa, transport/timeout/abort/konkurensi tetap dibatasi. Factory opt-in dan CLI pemeriksaan tersedia; default HTTP/model aktif tidak dialihkan. Sebelas tes kontrak tambahan lulus. [Panduan](ASR_PROFILES.md).
- [x] Evaluasi profil v0.24 dan audit preparasi ulang selesai: 16 validation / 24 test mengecualikan seluruh 128 rekaman lama; Base pinned dipilih lewat validation sebelum test. WER test Base pinned **36,99%** vs Tiny current **86,59%**, sedangkan Tiny pinned lebih buruk **97,36%**. Base lebih sedikit galat pada 22/24 klip, dua seri. Semua 24 pengulangan tambahan pada dua klip per profil cocok dengan hasil utama; baseline juga cocok, sehingga ini bukan bukti pinning menyelesaikan variasi. Capture bersyarat tidak terpicu. Model aktif tetap Tiny; **belum promosi/perbaikan tervalidasi**. [Hasil](evaluation/ASR_PROFILE_RESULTS.md), [audit](evaluation/asr-profile-audit.json).
- [x] Integrasi runtime v0.25: profil opt-in lewat CLI/`SPEECH_PROFILE`, port terpisah untuk Base, penolakan konfigurasi sebelum membuka DB, dan doctor yang memeriksa profil server sebenarnya. Uji CLI → HTTP → Python pada database sementara lulus; login/CSRF/origin serta kesamaan 19 tabel diperiksa. Default tetap Tiny. [Cara menjalankan](RUNTIME_SPEECH.md).
- [x] Pertahankan ketidakcocokan baru pada smoke HTTP: satu Tiny default dan satu Base pinned berbeda dari prediksi v0.24. Empat capture deferred pada klip Base yang dipatok cocok antar-capture, sehingga penyebab masih belum terlokalisasi. Tidak mengubah skor lama atau menyatakan pinning menyelesaikan variasi. [Bukti awal](evaluation/runtime-speech-smoke-first.json), [capture](evaluation/runtime-speech-capture.json).
- [x] Diagnostik decoder v0.31: protokol sebelum run, 24 transkripsi pada dua klip publik lama × plain/deferred × enam pengulangan, penangkapan hingga token/skor/segmen dan 36 replay dari buffer encoder ditahan. Semua upaya disimpan dan hash/checkpoint diaudit. **Base pinned plain kembali menghasilkan dua varian teks**, sedangkan tahap deferred dan replay cocok; variasi plain belum terlokalisasi dan penguncian thread belum menjamin kestabilan. Tujuh tes Node/tiga Python baru; default Tiny dan seluruh bukti lama dipertahankan. [Hasil](evaluation/ASR_DECODER_RESULTS.md), [metode](ASR_DECODER.md).
- [ ] Tangkap tahap pertama yang berubah pada kegagalan konfigurasi tetap dan validasi perbaikan pada jalur tanpa instrumentasi. Setelah perubahan yang beralasan, evaluasi kestabilan dan mutu pada protokol/data yang sesuai sebelum promosi atau klaim peningkatan yang berulang. `causeEstablished=false`, `fixValidated=false`, `readyForPromotion=false`. Sampel v0.20/v0.21/v0.24 dan klip diagnostik kini telah dilihat; jangan tuning di sana lalu menyebutnya test baru.
- [ ] Validasi suara nyata berizin: anotasi/split pembicara, WER/CER dan exact match pesanan/negasi, latensi menurut durasi serta uji mikrofon pemilik usaha. Model suara belum fine-tune; tes transport/sinyal teknis tidak membuktikan akurasi lapangan.
- [x] Penyaring awal pemakaian tidak biasa: median/MAD delapan hari sejenis, referensi 56 tanggal tersimpan, tanpa imputasi nol atau informasi masa depan. CLI read-only dengan scope/cutoff, rincian keputusan dan 14 tes kontrak; seluruh 19 tabel aktif sesuai backup. Ini aturan review, bukan model anomali terlatih atau bukti akurasi. [Panduan](USAGE_ANOMALIES.md), [pemeriksaan data aktif](evaluation/usage-anomalies-release.json).
- [x] Integrasikan pemeriksaan pemakaian ke API bootstrap akun dan panel Saran kulakan: ringkasan per bahan, tanggal untuk ditinjau, delapan referensi asli, semua tanggal/gap, status offline dan snapshot lama. Empat tes backend serta empat browser terisolasi; tidak ada tindakan atau perubahan forecast otomatis. [Panduan panel](USAGE_REVIEW.md).
- [x] Infrastruktur evaluasi review pemakaian: ekspor read-only satu bahan dengan izin, semua tanggal target dan gap asli, lembar tanpa prediksi/label buatan, protokol dibekukan sebelum anotasi, hash sumber/data, validasi label/kelengkapan dan split waktu, precision/recall/F1, coverage, abstain serta beban review. Tiga belas tes kontrak terisolasi; template tetap kosong dan belum ada skor lapangan. [Panduan evaluasi](USAGE_EVALUATION.md).
- [x] Simpan hasil tinjauan pemilik per bahan/tanggal: Sudah diperiksa/Perlu tindak lanjut, catatan dan waktu, event revisi, data berubah meminta review ulang, konflik sesi serta retry idempoten. Delapan tes backend/empat browser; migrasi hanya menambah tabel kosong, 19 tabel lama tetap sama. Status operasional tidak menjadi label riset buta atau mengubah stok/forecast. [Panduan](USAGE_DECISIONS.md).
- [ ] Validasi penyaring anomali pada data nyata berizin/berlabel dan split waktu beku: precision/recall, beban review, tren/musim dan kelengkapan pencatatan. Akun aktif belum mempunyai histori untuk dinilai. Penyimpanan tinjauan operasional tersedia; notifikasi otomatis belum diimplementasikan.
- [ ] Pengujian fitur hari libur/cuaca dengan sumber dan protokol evaluasi yang sesuai; belum diimplementasikan. Penyaring statistik tidak menjelaskan penyebab perubahan.

Tambahan pengalaman pengguna (terpisah dari training AI):

- [x] Atas permintaan pengguna, sediakan satu akun usaha demo lengkap pada database/server terpisah: 8 bahan, 6 menu, histori 84 hari, stok/penjualan/pembatalan, kulakan, surplus dan review. Hanya satu akun login; dua bisnis pendukung berlabel simulasi tanpa login. Saldo/pemakaian diverifikasi, data asli tetap utuh, tidak melatih AI dari data demo. [Akun dan alur presentasi](DEMO_ACCOUNT.md).
- [x] Panduan visual berpanah sesuai koreksi pengguna: 11 langkah dimulai dari pengenalan aplikasi lalu fitur utama, target nyata disorot dan bagian lain diredupkan; Lanjut/Kembali/Lewati. Posisi panel/panah mengikuti scroll/resize. Katalog rinci 14 topik / 67 langkah, pause/resume, pencarian, bantuan per halaman, akses sebelum/sesudah masuk, offline dan progress v2 per akun/perangkat. Panduan tidak mengisi atau mengirim transaksi. [Panduan fitur](INTERACTIVE_GUIDE.md).
- [ ] Uji pemahaman panduan bersama pemilik usaha awam; periksa istilah, waktu menyelesaikan pekerjaan dan bagian yang masih membingungkan. Belum ada studi kegunaan lapangan.

Data uji otomatis hanya berada pada fixture/database sementara. Aplikasi usaha utama tetap tidak diisi data dummy. Pengecualian eksplisit yang diminta pengguna: akun presentasi berdata simulasi hanya berada di database demo terpisah; tidak menjadi data riset/pilot. Status selesai teknis tidak berarti model sudah dilatih dengan data usaha atau berhasil pada lapangan.

Laporan keseluruhan fitur, model, data aktif dan pekerjaan tersisa: [PROGRESS.md](PROGRESS.md).

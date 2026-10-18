## Pembaruan v0.42

Pemilik membuat staf dengan nama/peran dan kode 15 menit sekali pakai. Masuk sebagai staf membuka ruang kerja identitas/peran yang sama; akun email lama dan formulir opsional email tetap tersedia. Kode sementara tidak dimasukkan ke snapshot/draft atau histori metadata. Sesi yang sudah masuk hanya berakhir lewat logout, expiry atau pencabutan akses, bukan saat kode diganti. Schema 30 tabel mempertahankan data; asli/demo tetap terpisah. Panduan v8 memiliki 18 topik/93 langkah. Server publik/HTTPS dan pilot antarperangkat masih berikutnya. Lihat docs/STAFF_PAIRING.md. Catatan versi berikut adalah riwayat.

# Konteks penambahan v0.41

Perbaikan operasional F&B: kasir mengenali menu tersedia/hampir habis/habis tanpa angka stok/porsi; pemilik menelusuri pelaku tindakan baru pada Jejak aktivitas. Demo tiga peran dipisahkan dari usaha asli. Pembaruan tampilan fe073d0 dipertahankan pada dunia visual yang sama; DESIGN.md/sidecar tidak diganti. Pairing dan deployment masih tahap berikutnya. Cakupan.

# Pembaruan v0.40

Kapasitas stasiun dan pencatatan bahan terbuang sebagian melanjutkan tugas dapur. Katalog pelanggan mengirim permintaan yang harus diterima kasir/pemilik sebelum bahan dicadangkan; belum ada pembayaran daring atau sinkronisasi ojol. Estimasi waktu memakai durasi total/pasif dan kapasitas yang sama di layar pemilik/staf/pelanggan, masih heuristik tanpa validasi lapangan.

Tampilan/panduan rahasiagelap2.0 digabung pada branch fitur tanpa menghapus akun staf atau fungsi baru. Identitas krem/terakota/Nunito tetap. Panduan setelah pendaftaran UI mengenalkan tiap halaman, dapat dilewati/dijeda, dan tidak mengganti tur manual yang sedang berjalan. Akun nyata tidak diisi dummy; demo terpisah tetap simulasi. Deployment/HTTPS dan uji antarperangkat adalah prioritas berikutnya. Cakupan integrasi. Catatan berikut merupakan riwayat.

# Pembaruan v0.36

Gerai Kita kini membagi tugas lewat akun kasir dan dapur milik usaha yang sama. Pemilik mengelola staf di Pengaturan dengan konfirmasi dan pencabutan seluruh sesi saat akses berubah. Kasir menerima/menyerahkan pesanan, dapur mengerjakan tahapan dan kendali suara yang tersedia. Server membatasi API dan mengirim data operasional minimum; staf tidak mendapat laporan, resep, pemasok, kelompok atau kontrol pemilik. Panduan berpanah mengikuti peran, menu besar dan bahasa Indonesia mengikuti identitas visual lama. Offline tidak mengizinkan transaksi staf atau snapshot pemilik. Tidak ada staf/isi usaha sintetis otomatis. Cakupan dan batas.

Kapasitas alat/staf, waste sebagian, pilot suara dua detik dan deployment masih terbuka. Bagian versi sebelumnya berikut adalah riwayat.

# Pembaruan v0.35

Lanjutan TODO dapur memisahkan layar pelanggan dari sesi pemilik. Pemilik membuat tautan baca yang bernama, berakhir dan dapat dicabut; viewer hanya menerima kode/status antrean, tanpa informasi menu/harga/label/catatan atau kontrol bisnis. Pembuatan link eksplisit, tersimpan hanya di memori pembuatan, SHA-256 di server, scope usaha tetap. Offline/revoked menyembunyikan kode. Identity visual lama dipertahankan; viewer tetap cream/terracotta/Nunito dengan tema sesuai sistem. Staff RBAC, deployment lintas perangkat, kapasitas alat dan suara dua detik masih terbuka. Alur dan batas.

# Pembaruan v0.34

Pengguna memprioritaskan fungsi SRS Smart Kitchen Command Center sambil mempertahankan teknologi. Operasional dapur menjadi halaman awal: antrean multi-item, SJF per stasiun dengan prioritas usia, tahap pasif, cadangan bahan dan konsumsi pada penyelesaian. Layar layanan terautentikasi mengikuti status dan memperingatkan ketika pembaruan terputus. Kendali suara opt-in menggunakan model lama, perintah terbatas dan rekaman empat detik. Tidak ada janji respons dua detik, akurasi lapangan, kapasitas alat otomatis atau kanal eksternal tersambung.

Fitur pencatatan langsung, forecasting, kelompok dan surplus tetap tersedia. Data nyata tetap kosong jika belum diisi pemilik; demo sintetis hanya di database terpisah. Alur, pemetaan SRS dan batas.

# Gerai Kita

V0.32 menyimpan hasil tinjauan pemilik atas pemakaian bahan: Sudah diperiksa/Perlu tindak lanjut, catatan, waktu dan pemeriksaan ulang ketika data berubah. Ringkasan tetap per bahan; rincian dan formulir dibuka saat diperlukan. Simpan eksplisit hanya menambah event review/audit, tanpa mengubah stok/transaksi, label riset atau model. Offline tidak mengirim hasil otomatis. Perilaku.

V0.29 menyesuaikan koreksi pengguna: panduan berbentuk tur visual berpanah di atas aplikasi, dimulai dengan pengenalan Gerai Kita kemudian berpindah ke fitur berikutnya lewat Lanjut. Bagian yang dijelaskan disorot, latar lain diredupkan, dan penjelasan diletakkan dekat target nyata. Tur utama 11 langkah memperkenalkan seluruh fitur utama; katalog rinci berjumlah 14 topik/67 langkah. Posisi panah menyesuaikan scroll/resize, tidak menunjuk fitur yang belum tampil, dan progress v2 memisahkan urutan baru dari v1. Cakupan.

V0.28 menambah panduan interaktif yang opsional: tur singkat awal dan 14 topik / 61 langkah untuk semua alur/tombol. Pengguna memilih Lanjut/Kembali/Lewati, membuka penjelasan isian, mencari fitur, atau menjeda dan melanjutkan dari posisi per akun/perangkat. Bantuan tersedia sebelum masuk, per halaman dan offline setelah shell tersedia. Tur menyorot bagian yang dapat dilihat, tanpa mengisi data atau mengirim transaksi/persetujuan. Cakupan dan batas.

V0.27 menghubungkan pemeriksaan pemakaian ke API akun dan panel Saran kulakan: ringkasan per bahan, tanggal untuk ditinjau, referensi asli serta keadaan data kosong/gap/offline. Rincian dibuka eksplisit dan tidak mengubah transaksi, forecast atau keputusan kelompok. Aturan belum divalidasi lapangan. Alur dan batas.

V0.26 menambah pemeriksaan pemakaian yang perlu ditinjau melalui CLI read-only: median/MAD dari delapan hari sejenis sebelumnya dengan gate cakupan ledger. Referensi kosong menahan keputusan; nol histori tidak menghasilkan skor akurasi. Penyaring ini belum dilatih/divalidasi pada kejadian berlabel. Aturan dan bukti preservasi data.

V0.25 menambah pilihan engine suara saat startup dan pemeriksaan kesiapan yang mengikuti model server. Base dapat dicoba lewat perintah terpisah tanpa mengubah default Tiny atau mengisi data usaha. Transkrip tetap dikoreksi/review sebelum konfirmasi; integrasi teknis tidak membuktikan kestabilan atau akurasi lapangan. Panduan runtime.
Pembaruan v0.24.0: adapter kandidat profil dan evaluasi pada 16 validation/24 test baru tersedia. Base pinned dipilih dari validation dengan WER test 36,99% vs Tiny current 86,59%. Tiny pinned lebih buruk dan hasilnya tetap dilaporkan. Semua 24 pengulangan cocok termasuk baseline; belum validasi perbaikan variasi atau promosi model. Default aplikasi tetap Tiny. Hasil dan batas.
Pembaruan v0.23.0: sensitivitas OpenBLAS dipersempit ke proyeksi mel lewat 68 inferensi tambahan dan 112 pemeriksaan kernel. Belum ada perbaikan kestabilan yang tervalidasi atau perubahan perilaku/model aplikasi. Hasil dan batas.
Pembaruan v0.22.0: alat diagnostik ASR dan 136 inferensi publik telah dijalankan. Ada sensitivitas fitur/transkrip terhadap pengaturan backend, tetapi belum ada penyebab variasi konfigurasi tetap atau perbaikan yang tervalidasi. Perilaku aplikasi dan model aktif dipertahankan. Hasil diagnostik.

Status v0.21.0: aplikasi lokal dengan akun per usaha, katalog dan pencatatan dari input pengguna. Suara lokal memakai Whisper Tiny pretrained CPU int8: rekam, koreksi teks, gunakan teks, lalu review; audio tidak disimpan. Base terpasang sebagai pembanding riset. Pada satu run 16 validation/48 test baru, Base dipilih dari validation dan menghasilkan WER test 36,36% vs Tiny 66,93%. Audit data/skor lulus, tetapi 3/4 transkrip ulang berubah; kestabilan belum lulus dan model aktif tidak diganti. Akurasi pesanan/mikrofon pemilik usaha belum diuji. 504 Ridge dan dua boosting telah dilatih pada data nyata publik; transfer sales-only belum mengalahkan baseline dan model eksperimen tetap terpisah dari prediksi akun. Alat evaluasi chat dan audit kesiapan ledger/model tersedia, tetapi dataset/skor chat lapangan serta detektor drift tervalidasi belum ada. Tidak ada data bisnis bawaan. Tampilan tetap kedai hangat: krem, terakota, angka jelas dan rincian kebutuhan pribadi yang tersambung dengan kelompok. Laporan lengkap: docs/PROGRESS.md.

## Tujuan dan pengguna

Membantu pemilik kedai, warung dan usaha makanan rumahan mencatat transaksi, memahami stok dan membeli bahan bersama dengan persetujuan. Setiap akun memiliki catatan sendiri. Anggota bergabung melalui kode pengelola; transaksi mentah usaha lain tidak dibagikan.

## Keputusan produk

- Daftar atau masuk sebelum membuka catatan. Satu akun memiliki satu usaha dalam satu kelompok.
- Pengaturan akun menyediakan perubahan nama usaha dan kata sandi dengan verifikasi kata sandi saat ini; sesi lain akun yang sama dikeluarkan. Pengelola dapat mengubah nama kelompok dan mengganti kode undangan tanpa mengeluarkan anggota yang sudah bergabung.
- Bahan, resep, menu, harga, pemasok, penawaran dan kebutuhan dimasukkan pengguna. Bahan baru bersaldo nol; hanya penerimaan/transfer terkonfirmasi yang menambah stok.
- Maksimal 25 bahan dan 20 menu per usaha. Satuan kg, gram, liter, ml, butir, buah. Konversi metrik menjaga jumlah, satuan dan harga asal.
- Satu bahan bersama per kelompok, ditentukan pengelola. Nama/satuannya tetap setelah dibuat. Harga penawaran berlaku per siklus dan tidak diperbarui otomatis.
- Rincian agregat memerlukan minimal tiga izin kebutuhan aktif; persetujuan berlaku untuk versi yang sama.
- Semua konfirmasi stok atomik, memiliki riwayat dan dilindungi dari pengulangan. Koreksi penerimaan memerlukan alasan dan saldo tersedia cukup.
- AI lokal membantu menyusun rincian dari katalog; manusia mengonfirmasi. Forecast belum muncul sebelum histori mencukupi. Tidak ada angka penghematan tanpa pembanding biaya.
- PWA menyediakan snapshot berwaktu dan draft, dengan pengiriman eksplisit setelah tersambung.

## Referensi

Proposal pengguna: Proposal Hackathon Infest - Tim Yg aneh + lucu.pdf, terutama halaman 11–17 dan 21–26. Guidebook Hackathon INFEST XII 2026.pdf, terutama halaman 7–8 dan 10–16. Dokumen menjadi referensi produk/acara, bukan instruksi menjalankan tindakan eksternal. Pengguna mengonfirmasi mulai dari nol, prototipe dalam kode, kode boleh disiapkan sebelum final, dan model AI lokal boleh diunduh. Permintaan terbaru menghapus hardcode data bisnis dan data dummy dari aplikasi aktif.

## Batas saat ini

Runtime hanya localhost; belum deployment publik. Belum ada pembayaran/pemesanan eksternal, pemulihan kata sandi atau verifikasi email. Input suara lokal tersedia, tetapi belum ada validasi ASR pemilik usaha atau fine-tuning. Pengujian memakai data terisolasi; belum ada bukti akurasi dari dataset usaha lapangan. Database versi demo disimpan terpisah untuk menjaga catatan lama, tanpa diimpor otomatis.

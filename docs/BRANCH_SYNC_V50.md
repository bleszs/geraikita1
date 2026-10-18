# Sinkronisasi rahasiagelap3.0

Sumber pembaruan teman: `origin/rahasiagelap3.0`, commit `08ca38d` (18 Oktober 2026). `origin/main` masih `625f40f` saat pengambilan. Pekerjaan lokal sebelum penggabungan ada di `8a58807`, dengan cadangan branch `backup/pre-rahasiagelap3-8a58807`. Penggabungan dilakukan ke `feat/kitchen-capacity-and-waste`.

## Perubahan yang dipakai

- Pemilik mendapat halaman **Daftar staf** untuk biodata, kategori kasir/dapur, kode unik berulang, dan penghapusan staf setelah konfirmasi.
- Kasir membaca teks/suara, memeriksa hasil, lalu memilih **Masukkan ke antrean dapur** atau **Catat penjualan langsung**. Pilihan langsung digunakan untuk pesanan yang sudah selesai, bukan pesanan yang masih dimasak.
- Antrean staf memakai label Dimasak/Selesai, daftar harga/ketersediaan bagi kasir, dan peringatan nama bahan menipis. Peringatan memperhitungkan bahan yang sudah dicadangkan, tanpa membuka angka stok, resep atau harga beli.
- Koreksi atas arahan pengguna: menu dan route Surplus mengikuti branch teman, tanpa halaman tersendiri. Panduan riwayat memakai penjelasan dari branch teman; data dan perhitungan historis tetap disimpan. Koreksi ini dibiarkan tanpa commit.
- Tombol lihat/sembunyikan kata sandi dan pembaruan gaya dari branch teman dipertahankan. Dapur tidak dapat membatalkan/mencatat bahan terbuang; pencatatan tersebut tetap dilakukan pemilik.

## Perbaikan saat integrasi

1. Pertahankan paket tanpa batas sepuluh menu, kuota AI bersama per usaha, pemeriksaan jumlah/catatan, batas tunggu ekstraksi 60 detik, dan pemeriksaan revisi katalog.
2. Kasir memakai `/api/kitchen/extractions` agar teks hasil AI melewati kontrak katalog dan kuota yang sama dengan pemilik. Parser lokal tetap diberi penjelasan; hasil selalu diperiksa sebelum stok berubah.
3. Penjualan langsung memakai penyimpanan tindakan tertunda dan kunci pengiriman yang sama. Jika jawaban server hilang, muat ulang/periksa status mengenali penjualan yang sudah diterima; stok tidak dipotong dua kali. Metadata pemulihan hanya memuat kunci penjualan kasir dan versi perannya sendiri.
4. Kode staf baru hanya disimpan sebagai hash, termasuk pada catatan pengulangan pembuatan. Kode asli ditampilkan dari memori setelah konfirmasi server, dibersihkan saat navigasi/logout/pergantian akun, dan tidak masuk snapshot/draft. Kode unik dan kode sementara tidak boleh bertabrakan.
5. Pembuatan staf yang jawabannya hilang mengulang kode dan kunci yang sama selama halaman masih terbuka. Jika halaman sudah ditutup, periksa daftar terlebih dahulu; kode yang belum disimpan tidak bisa ditampilkan ulang. Gunakan fasilitas kode sementara pada Pengaturan untuk staf yang sama bila perlu.
6. Akun email, perubahan peran, Nonaktifkan/Aktifkan, dan kode sementara 15 menit tetap tersedia di **Pengaturan → Akun kasir dan dapur**. Kode berulang ditolak selama staf nonaktif; penghapusan mencabut kode dan seluruh sesi. Perubahan peran mengakhiri sesi lama.
7. Rincian manual tetap mendukung banyak item dan penjelasan menu hampir habis. Panduan berpanah v10 menyesuaikan tombol dan menjelaskan dua pilihan pencatatan.

Migrasi menambah tiga tabel staf di atas dua tabel paket yang sudah ada: total 36 tabel aplikasi. Kolom kompatibilitas `staff_profiles.access_code` dipertahankan tetapi pembuatan baru tidak menulis kode ke sana. Integrasi tidak menghapus/mengubah kode teks yang mungkin pernah dibuat lewat versi branch teman sebelumnya; instalasi yang pernah menjalankan versi tersebut perlu meninjau salinan lamanya terpisah. Data utama/demonstrasi tidak diisi ulang otomatis.

## Batas dan pekerjaan berikut

Perubahan ini tidak melatih model baru. Qwen 1.5B dan Whisper Tiny tetap pralatih; model forecasting/evaluasi sebelumnya dipertahankan. Pengujian teknis memakai SQLite memori, katalog uji terisolasi, dan audio publik berizin yang sudah pernah diperiksa; hasilnya bukan akurasi pesanan UMKM.

Prioritas berikutnya adalah uji demo pengguna awam/perangkat nyata dan pengumpulan pesanan/rekaman berizin untuk mengukur kesalahan menu, jumlah, catatan, penolakan dan latensi. Qwen cloud masih menunggu kapasitas Railway yang telah dibahas. Sinkronisasi lokal tidak otomatis berarti sudah di-push atau dideploy.

Bukti regresi: `npm test` exit 0, **308 backend + 65 browser = 373 lulus**, termasuk panduan 20 topik/100 langkah. Delapan pemeriksaan model asli lulus. Dua temuan komposisi tampilan diperbaiki dan mendapat verdict **ship** untuk perbaikan yang diperiksa; bukan sertifikasi seluruh aplikasi atau perangkat fisik. [Ringkasan rilis](evaluation/branch-sync-v50-release.json), [model asli](evaluation/branch-sync-v50-runtime.json), [review tampilan](evaluation/BRANCH_SYNC_V50_UI_REVIEW.md).

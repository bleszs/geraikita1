# Hari tanpa pemakaian bahan

Pemilik dapat membuka **Saran kulakan → Catat hari tanpa pemakaian**, memilih bahan/tanggal, memeriksa catatan sebenarnya, mencentang konfirmasi lalu menyimpan. Tanggal harus sudah selesai menurut Asia/Jakarta dan berada dalam 365 hari terakhir. Hari tutup dapat dicatat per bahan hanya jika pemilik memastikan tidak ada pemakaian.

Ini menyimpan nol eksplisit untuk histori model; bukan transaksi atau pengurangan stok. Tanggal tetangga tidak diisi. Tidak otomatis melatih atau mengaktifkan model. Gerbang evaluasi lokal 42 tanggal untuk model kulakan dan aturan lain tetap berlaku. Baseline lama masih memiliki asumsi nol pada gap, ditampilkan pada rincian bahan; perubahan ini belum menghapus asumsi tersebut.

Server memeriksa pemilik, autentikasi, CSRF, bahan milik usaha, revisi katalog dan ketiadaan pemakaian positif. Pemakaian positif tidak dapat ditimpa menjadi nol. Konfirmasi dicatat dengan identitas akun, waktu dan audit aktivitas. Pengiriman ulang tanggal/bahan yang sama tidak menggandakan catatan.

**Batalkan konfirmasi** menghapus nol yang dibuat fitur ini dan mengembalikan tanggal ke status belum tercatat. Jika nol sudah ada dari transaksi/pembatalan sebelumnya, catatan asal dipertahankan. Pembatalan ditolak jika pemakaian menjadi positif atau ID konfirmasi sudah berubah di sesi lain. Dua penulisan dan audit memakai transaksi SQLite atomik; kegagalan dibatalkan bersama.

Antarmuka menunjukkan maksimal 20 konfirmasi terbaru dalam 365 hari. Isian dan panel bertahan ketika data diperbarui; centang konfirmasi dikosongkan sesudah penyimpanan. Saat offline, penyimpanan/pembatalan nonaktif dan tidak diantrikan otomatis. Konfirmasi dan histori tetap terbawa saat usaha bergabung ke Beli bersama.

Migrasi menambahkan satu tabel `usage_zero_confirmations`, dari 37 menjadi 38 tabel. Stok, ledger, transaksi dan saldo lama tidak ditulis ulang. Kolom `created_usage` membedakan nol baru dari nol asal transaksi. Tidak menambahkan histori produksi sebagai contoh atau fixture.

## Verifikasi

Backend akhir 335/335 lulus. Run awal memiliki empat kegagalan karena jumlah tabel pada tes migrasi lama masih dikunci ke schema sebelumnya; hitungan diperbarui. Fixture backup lama tetap menghapus tabel baru agar benar-benar memeriksa migrasi snapshot sebelum fitur ini.

Tes baru mencakup nol eksplisit vs tanggal belum diketahui, pembatalan, transaksi/stock/finance tetap, audit pelaku, validasi tanggal, katalog basi, isolasi tenant/role/CSRF, pemakaian positif, rollback atomik dan perpindahan kelompok. Tiga belas kasus browser lama untuk tur, HCI dan target porsi lulus; kasus baru sempat gagal karena label dropdown tidak memiliki nama akses yang tepat. Nama akses diperbaiki dan alur baru lulus, termasuk penyimpanan, pembatalan dan galat katalog basi.

Desktop 1440 dan ponsel 360 terang/gelap diperiksa tanpa overflow horizontal. Capture panel masih memuat toast sementara dan navigasi bawah; tanggal serta checkbox diuji melalui label dan interaksi browser. Detector masih melaporkan garis status dapur lama dan advisory token lama; panel baru mempertahankan desain yang ada. DESIGN.md dan kanon desain tidak diubah.

## Batas dan langkah berikutnya

Kebenaran nol bergantung pada pemeriksaan pemilik; keberadaan baris saja tidak membuktikan catatan usaha lengkap. Fitur ini belum mengimpor CSV, belum memiliki tutup hari massal dan belum menyelesaikan evaluasi domain UMKM Indonesia. Impor CSV offline yang tervalidasi sudah tersedia melalui `forecast import`; itu membuat dataset terpisah, bukan menambah transaksi/stok akun. Data produksi tetap harus nyata dan berizin.

## Railway

Deployment `1286aad5-1800-41a9-818a-11f3e4f8b79d` SUCCESS. [Pemeriksaan cloud](evaluation/zero-days-cloud-release.json) menjalankan simpan/batalkan nol pada SQLite memori, mempertahankan stok/transaksi/keuangan dan memastikan checksum serta inferensi model prediksi tetap sama. Enam berkas publik dan modul staf API cocok dengan lokal. Qwen 1.5B dan Whisper Base tersedia pada pemeriksaan; ketergantungan hosting Qwen eksternal belum dihapus.

[Backup sebelum/sesudah](evaluation/zero-days-data-preservation.json) valid, integrity/FK dan restore terisolasi lulus. Perubahan schema tepat satu tabel baru, 37 menjadi 38; seluruh baris lama sama pada interval pemeriksaan. Penjualan lama tetap utuh dan stok cocok ledger. Tidak ada fixture atau restore produksi. Sumber kerja setelah HEAD `f570516`, tanpa commit/push otomatis.

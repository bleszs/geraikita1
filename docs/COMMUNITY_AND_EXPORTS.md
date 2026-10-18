# Pendaftaran, Beli bersama, CSV dan identitas visual

Permintaan 18 Oktober 2026. Pendaftaran cukup nama usaha, email dan kata sandi. Akun baru belum mempunyai kelompok pembelian. Ruang penyimpanan internal tetap dibuat agar stok, resep, staf dan transaksi dapat dipakai secara mandiri; ini bukan kelompok contoh dan tidak membagikan kebutuhan.

Setelah masuk, buka **Beli bersama**. Masukkan kode dari pengelola dan konfirmasi bergabung, atau buka **Buat kelompok sendiri**, isi nama dan simpan. Kode baru dibuat oleh server. Kelompok lama dan kode undangan lama tetap berlaku. Nama/kode kelompok dikelola di halaman ini, bukan formulir daftar. Keanggotaan tidak otomatis memberi persetujuan berbagi kebutuhan.

Perpindahan kelompok memakai transaksi SQLite dengan pemeriksaan foreign key. Identitas usaha, katalog, stok, transaksi, pemakaian, staf dan penggunaan kuota tetap tersimpan. Izin kebutuhan direset, versi katalog/peran diperbarui, sesi lain dan tautan layar lama dicabut. Pemilik perlu memeriksa ulang saran; artefak prediksi dengan scope lama tidak otomatis diaktifkan pada scope baru. Selesaikan draft perangkat sebelum pindah.

Bahan yang nama ternormalisasi dan satuannya sama diselaraskan ke identitas bahan kelompok: jumlah stok, resep, penerimaan dan pemakaian historis dipertahankan, termasuk dasar pembatalan penjualan. Satuan berbeda ditolak tanpa konversi diam-diam. Kode kelompok lama dinonaktifkan saat pengelola terakhir berpindah.

Perpindahan ditolak bila pemilik masih mengelola anggota lain, ada pembelian/transfer yang terikat kelompok lama, kelompok tujuan sedang menjalankan rencana pembelian, atau satuan bahan bersama bertabrakan dengan bahan pribadi. Penolakan membatalkan seluruh perubahan.

Ekspor penjualan dan barang masuk menggunakan UTF-8 BOM, deklarasi `sep=;`, baris CRLF dan pengutipan teks agar Excel mengenali kolom dan aksara. Desimal memakai koma. Teks yang menyerupai formula dibuat literal. Penjualan dimulai dengan tanggal/waktu, rincian, metode bayar, total, biaya dan bersih; ID dipindah ke kolom terakhir. CSV tidak mempunyai warna/lebar kolom seperti XLSX. Pembaca CSV umum perlu mengabaikan baris deklarasi pemisah.

Logo GK dibuat ulang sebagai SVG berdasarkan referensi pengguna agar tajam pada ukuran kecil. Digunakan pada halaman akun, sidebar, struk, favicon dan ikon aplikasi terpasang. Tombol **Jalankan perintah** menggunakan tata letak khusus agar tidak mengikuti peregangan form pesanan di sebelahnya. Tidak ada perubahan tarif, simulasi pembayaran atau aturan pencatatan penjualan dalam pekerjaan ini.

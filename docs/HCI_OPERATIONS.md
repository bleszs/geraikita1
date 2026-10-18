# Tampilan kasir, dapur dan saran kulakan

Pembaruan ini mengutamakan tugas harian dengan identitas krem/terakota/Nunito yang sama. Perubahan berada pada tampilan dan interaksi; metode pembayaran, stok, hak akses dan aturan kelayakan model tidak diganti.

| Kebutuhan HCI | Perubahan yang dapat digunakan |
|---|---|
| Kenali pekerjaan tanpa mengingat kode/status | Filter Semua, Siap, Dimasak, Menunggu menampilkan jumlah nyata dan status tertulis. Kasir melihat pesanan siap lebih dulu; dapur tetap mengikuti giliran stasiun dari server. |
| Tindakan utama mudah ditemukan | Pesanan baru, formulir catat pesanan dan antrean diutamakan. Saldo berada dalam rincian yang bisa dibuka. Tombol tahap dan pembayaran berukuran minimal 48–50 px. |
| Informasi secukupnya | Ringkasan stok/prediksi/jumlah beli terlihat langsung. Bukti model dan pemeriksaan pemakaian dibuka saat dibutuhkan; temuan pemeriksaan tetap ditandai pada ringkasan. |
| Status sistem terlihat | Status koneksi dan jumlah antrean mengikuti pembaruan langsung. Filter terpilih, teks pesanan dan panel yang dibuka tetap dipertahankan saat render diperbarui. |
| Cegah salah bayar dan jaga kendali | Metode harus dipilih sebelum pembayaran. QRIS tetap memakai QR resmi usaha. Formulir pesanan ditinjau sebelum dikirim. Tidak ada pembelian otomatis dari saran kulakan. |
| Keyboard dan layar kecil | Fokus tetap pada kontrol yang sesuai, shortcut Pesanan baru menuju isian, pembayaran membatasi Tab di dialog, Escape menutup pembayaran yang belum dikirim dan mengembalikan fokus. |

## Alur kasir

Buka Antrean kasir, pilih status bila diperlukan. Pesanan siap berada lebih dulu pada daftar Semua. Pilih Terima pembayaran & serahkan, lalu metode dan konfirmasi pembayaran. Untuk pesanan baru, pilih Pesanan baru, ketik/ucapkan atau Susun manual, periksa menu/porsi/catatan lalu kirim ke dapur. Pesanan yang sudah selesai bisa dibayar langsung. Rincian pemasukan dan saldo ada di bawah formulir, tetap hanya dapat dibaca kasir.

## Alur dapur

Pilih status, lihat label pesanan dan catatan item. Mulai giliran ini hanya tersedia jika server memberi giliran. Mulai tahap pasif dan Lanjutkan pengerjaan mengikuti kapasitas. Tandai siap tetap memerlukan pemeriksaan kematangan oleh staf. Kendali suara/teks tetap tersedia; contoh perintah bisa dibuka tanpa mengisi perintah buatan.

## Alur saran kulakan

Prediksi dihitung server dari data usaha saat bootstrap/perbarui data; tombol Perbarui prediksi mengambil hasil terbaru. Tampilan pertama berisi perkiraan terpakai dua hari, stok tersedia dan jumlah yang disarankan dibeli. Label **Prediksi AI** hanya muncul saat model terlatih benar-benar aktif untuk bahan itu. **Estimasi histori** berarti metode pembanding, sedangkan **Histori kurang** tidak menghasilkan angka prediksi palsu. Buka Rincian bahan untuk cara hitung, rentang, lama stok dan dasar data.

Model publik tetap memerlukan backtest lokal 42 tanggal sebelum digunakan pada bahan usaha. Model khusus usaha yang sah tetap didahulukan. Data publik contoh di panel Model prediksi kulakan terpisah dari transaksi akun. Bobot, pelatihan dan evaluasi tidak diubah pada pembaruan tampilan ini. [Model dan batasnya](KULAKAN_MODEL.md).

## Pemeriksaan

Browser memakai SQLite memori dan fixture terisolasi, tanpa menulis akun/penjualan produksi. Capture desktop dan ponsel terang/gelap disimpan lokal di `.impeccable/review/hci-v56/`. Satu inspeksi menemukan pemeriksaan pemakaian masih terlalu panjang dan satu kartu dapur melebar; satu koreksi melipat pemeriksaan dan mempertahankan lebar kartu yang konsisten. Konfirmasi dilakukan setelah koreksi. Satu detector pass menghasilkan nol anti-pattern serta tujuh advisory ukuran font; ukuran tersebut mengikuti hirarki operasional/incumbent, tanpa mengganti DESIGN.md.

Ini pemeriksaan alur, aksesibilitas dasar dan heuristik HCI. Belum merupakan studi pengguna dengan kasir/koki lapangan atau bukti percepatan tugas secara terukur. Langkah berikutnya: minta peserta mencoba menerima pesanan, membayar, mengubah tahap masak dan membaca saran beli; catat keberhasilan tugas, salah tekan dan waktu pengerjaan.

# Dasbor, dapur, penarikan dan pembayaran kasir

Menu pemilik dimulai dari **Dasbor**. **Operasional dapur** dan **Layar layanan** berada tepat setelah **Daftar staf**. Tautan lama `#ringkasan` tetap membuka Dasbor agar bookmark dan panduan tersimpan tetap berfungsi.

Pemilik membuka **Keuangan → Tarik saldo pemilik**. Biaya aplikasi 10% dihitung saat penjualan; saldo bersih tidak dipotong 10% lagi saat penarikan. Formulir tujuan bank/e-wallet tetap terlihat saat saldo nol, tetapi nonaktif dan diberi alasan. Penarikan yang tersedia masih simulasi, belum transfer ke bank/e-wallet.

Masuk memakai akun staf dengan peran **Kasir**. Untuk pesanan siap, pilih **Terima pembayaran & serahkan**. Untuk penjualan langsung, pilih **Pesanan baru → Susun manual/Baca pesanan → Bayar langsung & catat**. Dialog pembayaran menyediakan **Tunai, QRIS, Transfer Bank, E-Wallet**. Pilih metode sebelum **Bayar & selesaikan**; hasilnya dicatat sekali dan struk menampilkan metode tersebut.

QRIS mencatat metode pembayaran. Kode QR resmi serta verifikasi pembayaran dari penyedia belum diintegrasikan. Gunakan QRIS resmi usaha di luar aplikasi dan periksa pembayaran sebelum menyimpan. Placeholder bergambar kotak yang sebelumnya menyerupai QR dihapus agar tidak dianggap kode yang dapat dipindai.

Tidak mengubah persentase biaya, perhitungan saldo, hak akses kasir/pemilik, atau mekanisme pencatatan penjualan. Pengujian transaksi dan penarikan menggunakan database memori; tidak membuat data contoh pada Railway.

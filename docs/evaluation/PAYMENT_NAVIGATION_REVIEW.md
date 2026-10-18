# Dasbor dan penemuan pembayaran

Permintaan 18 Oktober 2026. Mode Operate, mempertahankan sistem visual yang ada. Menu pemilik diurutkan sesuai permintaan; label Dasbor menggantikan Ringkasan tanpa mengganti hash lama. Penarikan saldo selalu dapat ditemukan di Keuangan dan nonaktif saat saldo nol. Petunjuk pembayaran ditampilkan pada layar kasir; dialog memakai empat metode yang sudah tersedia dan QRIS dijelaskan tanpa gambar kode palsu.

Pemeriksaan berkelompok menggunakan Chromium, desktop 1440×1000 dan ponsel emulasi 360×900: sidebar, formulir penarikan kosong/berisi, mode gelap, serta dialog QRIS. Satu batch koreksi menangani angka kotor/biaya/bersih yang sebelumnya memakai grid diagram lima kolom sehingga bertumpuk. Ketiganya kini mempunyai kolom sendiri pada desktop dan disusun vertikal pada ponsel; total penarikan juga tetap terlihat. Konfirmasi tunggal selesai. Bukti: `.impeccable/review/payments-v54/`.

Pengujian memverifikasi empat metode masing-masing menghasilkan satu penjualan, biaya 10%, saldo bersih dan satu penarikan tanpa biaya kedua, seluruhnya dalam database memori. Sembilan belas tes Node lulus. Dari 32 browser, 31 lulus pada run awal; tes baru mengenai urutan menu salah menghitung tautan panduan tersembunyi. Setelah memperbaiki selector agar menilai menu yang terlihat, kedua tes baru lulus. Kedua tes diulang sesudah koreksi CSS dan kembali lulus. Ini 32 kasus browser unik yang diperiksa, bukan 36 kasus unik.

Detector satu kali pada tiga modul UI menghasilkan nol temuan. Kanon DESIGN.md dan sidecar dipertahankan. Tidak mengklaim integrasi QRIS, pembayaran terverifikasi penyedia, atau penarikan bank nyata; yang tersedia adalah pencatatan dan simulasi. Tidak melakukan commit/push atau menulis data contoh ke Railway.

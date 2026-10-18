# Tampilan HCI operasional aktif — 18 Oktober 2026

Deployment **`f7fcf807-370b-4b0e-b678-434224e26f03` SUCCESS**, URL https://web-production-a3e13.up.railway.app. Sumber diunggah dari folder kerja branch `voicetext`, HEAD `ff84f25`; tidak dibuat commit, staging atau push.

- Kasir: filter jumlah/status, pesanan siap lebih dulu, formulir pesanan diutamakan dan rincian saldo dilipat. Pembayaran tetap Tunai/QRIS/Transfer Bank/E-Wallet. Dialog mendukung Tab, Shift+Tab dan Escape; struk tetap tidak dibatasi tinggi saat cetak.
- Dapur: giliran server tetap berlaku, label status tertulis dan tombol tahap minimal 48–50 px. Catatan variasi ditonjolkan. Tidak mengubah kapasitas, aturan stok atau hak akses.
- Saran kulakan: prediksi pemakaian dua hari, stok tersedia dan jumlah beli langsung terlihat. Bukti model dan pemeriksaan pemakaian dilipat; jumlah temuan tetap terlihat. Tanpa bahan bersama tidak menampilkan panel kosong kelompok pada halaman ini.
- Model tidak dilatih ulang atau dilonggarkan: label Prediksi AI hanya ketika benar-benar aktif untuk bahan tersebut. Baseline dan histori belum cukup dibedakan. Tidak dibuat histori, stok atau transaksi produksi untuk memperlihatkan angka.
- 325 tes backend lulus. Regresi browser luas menjalankan 47 kasus, 45 lulus dan dua assertion lama perlu disesuaikan dengan disclosure yang kini tertutup. Konfirmasi terkait menghasilkan 11/12 lulus, lalu kasus terakhir lulus setelah eksplisit membuka panel setelah reload. Uji pembayaran/cetak final 2/2 lulus. Semua kasus yang sempat gagal sudah dikonfirmasi; tidak diklaim satu run penuh 47/47. Runner luas dihentikan setelah semua kasus selesai karena teardown koneksi browser tersangkut; fixture kemudian menutup koneksi secara eksplisit.
- Satu inspeksi desktop/ponsel terang/gelap dan satu konfirmasi dilakukan. Canon DESIGN.md dan sidecar tidak berubah. Ini penerapan prinsip HCI dan pemeriksaan alur, belum studi pengguna lapangan.
- Verifikasi cloud memastikan sembilan file publik dan modul staf yang dilayani lewat API cocok dengan lokal. Model kulakan yang sama masih dapat diinferensi pada database memori terisolasi. Endpoint kesehatan melaporkan status AI aktual pada bukti rilis; tidak membuat akun produksi.
- Backup sebelum/sesudah valid, 37 tabel, integrity/FK OK dan restore terisolasi cocok. Penjualan lama tidak berubah, stok cocok ledger; hanya baris sesi berubah selama interval. Tanpa restore produksi. [Bukti data](evaluation/hci-data-preservation.json).

[Bukti cloud](evaluation/hci-cloud-release.json) · [Alur dan batas](HCI_OPERATIONS.md). Riwayat deployment sebelumnya di bawah.

# Model kulakan aktif di Railway — 18 Oktober 2026

Deployment **`8b9e4ac2-8939-43ba-a136-da99d2abc83c` SUCCESS**, URL https://web-production-a3e13.up.railway.app. Sumber tetap folder kerja branch `voicetext`, HEAD `ff84f25`, tanpa commit/push. Pembaruan model menggunakan source upload CLI, bukan bukti autodeploy GitHub.

- Model baru `gerai-kulakan-sales-hgb-v1` tersedia dalam server aplikasi: 160 pohon, 500 seri / 19.000 target pelatihan. Tidak memerlukan proses Python/sklearn, Ollama atau unduhan bobot saat inferensi.
- Uji publik 200 toko terpisah / 600 target: MAE 0,552624 vs MA7 0,589779 (turun 6,30%), WAPE 25,68% vs 27,41%. Skor masih domain ritel ternormalisasi; bukan akurasi lapangan UMKM Indonesia.
- Panel **Saran kulakan → Model prediksi kulakan** menampilkan bukti dan contoh publik. Contoh tidak mengisi histori atau stok akun. Model pada bahan usaha harus lolos backtest lokal 42 tanggal berurutan; model khusus usaha yang sah tetap didahulukan. Histori simulasi demo lama dikecualikan.
- Verifikasi lokal: 325 tes backend lulus. Pengujian browser awal 12 lulus / 1 gagal karena penunjuk tur bergeser; penunjuk diperbaiki, model dan tur diuji kembali (2/2 lulus). Verifikasi Python/Node pada 600 contoh cocok; seluruh metrik dihitung ulang dari file sumber tanpa fit ulang.
- Verifikasi cloud: SHA-256 model cocok dengan lokal, tiga inferensi cocok dengan Python dan bootstrap akun kosong pada SQLite memori tetap kosong. Lima berkas publik cocok hash. Pemeriksaan ini tidak membuka database produksi dan tidak membuat fixture produksi.
- Endpoint kesehatan melaporkan **forecast tersedia**, **Qwen2.5 1.5B tersedia**, **Whisper Base tersedia**. Qwen tetap memakai endpoint eksternal yang sebelumnya dikonfigurasi; bukan Ollama mandiri di Railway. Ketersediaan Qwen dapat mengikuti endpoint tersebut.
- Backup sebelum/sesudah deployment valid, masing-masing 37 tabel, integrity/FK OK dan restore terisolasi cocok; tidak ada restore produksi. Di antara backup terdapat perubahan katalog/penerimaan barang dan ledger sehingga seluruh baris tidak diklaim identik. Seluruh penjualan lama tetap sama, stok cocok dengan ledger dan tidak dibuat fixture produksi. [Pemeriksaan data](evaluation/kulakan-data-preservation.json).

[Bukti deployment](evaluation/kulakan-cloud-release.json) · [Model dan batas klaim](KULAKAN_MODEL.md) · [Hasil](evaluation/kulakan-model-results.json). Catatan di bawah merupakan riwayat deployment sebelumnya.

# Status Railway dan aplikasi - 18 Oktober 2026

Sumber terbaru di folder kerja berangkat dari `ff84f25` pada branch `voicetext`. Perbaikan sesi ini dibiarkan **tanpa commit dan tanpa push**. Tidak mengganti branch milik pengguna atau menghapus perubahan pembayaran/struk teman.

## Pembaruan yang sudah aktif

Deployment `24f3d29a-61c4-4b87-adde-019a5eb6bba2` berstatus **SUCCESS** pada https://web-production-a3e13.up.railway.app. Dua belas file publik cocok dengan hash lokal. Browser publik memverifikasi logo baru, tanpa kolom kelompok pada daftar dan tanpa kartu panduan tamu. Tidak dibuat commit/push baru.

- Daftar cukup nama usaha, email dan kata sandi; kartu panduan tamu tidak muncul.
- Pembuatan kelompok dan kode bergabung berada di **Beli bersama**, termasuk nama dan pengaturan undangan. Kelompok lama tetap tersedia.
- Perpindahan mempertahankan stok, katalog, transaksi, histori pemakaian dan kuota. Bahan dengan nama/satuan sama diselaraskan. Izin kebutuhan direset; sesi lain dan tautan layar lama dicabut.
- Tombol **Jalankan perintah** berada di bawah kolomnya; formulir kelompok menyesuaikan ponsel.
- CSV memakai pemisah Excel dan Unicode, angka desimal Indonesia serta kolom penjualan yang terurut. Logo GK vektor dari referensi pengguna digunakan pada aplikasi, favicon, ikon terpasang dan struk.

## AI yang benar-benar tersedia

Pemeriksaan endpoint Railway setelah pembaruan: **Whisper Base / base-orders tersedia** dan **Qwen2.5 1.5B tersedia**. Qwen diakses melalui endpoint eksternal yang sudah dikonfigurasi; ini tidak membuktikan Ollama berjalan mandiri dalam layanan Railway. Ketersediaannya bergantung pada endpoint tersebut. URL privat dan kredensial tidak disalin ke dokumentasi.

Uji Chromium dengan MediaRecorder asli dan audio publik berizin sebagai mikrofon emulasi menghasilkan transkrip melalui Base. Di instance Railway baru, API memori terautentikasi pemilik dan kasir juga menghasilkan transkrip Base; ekstraksi benar-benar memakai Qwen (mode ollama), bukan fallback. Signup mandiri, join setelah login dan penolakan perubahan kelompok oleh staf diperiksa melalui HTTP. Dua tes Python menolak pengulangan dan segmen yang tidak meyakinkan. Perangkat fisik, kebisingan kedai serta ketepatan nama menu/jumlah tetap perlu diuji. Runtime berhasil tidak berarti model sudah fine-tune atau akurasinya sempurna.

Audit prediksi cloud pada 18 Oktober: **4 bahan, 0 histori pemakaian, 0 baseline siap, 0 model usaha aktif**. Mesin prediksi dan pengujian ada, tetapi akun belum dapat memperoleh estimasi berbasis histori. Eksperimen publik tidak diaktifkan sebagai model usaha. Catat transaksi nyata; baseline memerlukan rentang histori sedikitnya tujuh hari dengan asumsi hari kosong dijelaskan. Pelatihan akun mengikuti pemeriksaan data dan evaluasi yang lebih panjang.

## Verifikasi dan data

Regresi penuh: **317 backend + 70 browser lulus**, exit 0. Setelah koreksi kalimat audit pendaftaran, lima tes kelompok dan dua browser diuji kembali dan lulus. Enam pemeriksaan tambahan memastikan kuota, pemisahan usaha, pencabutan sesi/layar dan foreign key. Tujuh keadaan desktop/ponsel/gelap diperiksa tanpa overflow horizontal.

Backup sebelum pembaruan memiliki integrity dan foreign key OK; uji restore terisolasi membandingkan seluruh baris 36 tabel. Sesudah pembaruan terdapat 37 tabel: seluruh baris/kolom asal pada 36 tabel lama tetap identik, integrity OK dan nol pelanggaran foreign key. Tabel penarikan dari perubahan teman ditambahkan secara aditif. Tidak melakukan restore ke produksi dan tidak mengisi database publik dengan akun/data contoh. Pengujian tulis memakai SQLite memori.

[Rincian perubahan dan batas keanggotaan](COMMUNITY_AND_EXPORTS.md), [bukti regresi](evaluation/community-release.json), [bukti deployment](evaluation/community-deployment.json), [review tampilan](evaluation/COMMUNITY_UI_REVIEW.md). Catatan deployment `29565e6` di laporan `railway-main-activation.json` merupakan arsip, bukan keadaan AI/source terbaru.

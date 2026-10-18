# Gerai Kita — paket berdasarkan kebutuhan dan AI pesanan dapur

V0.50 menggabungkan pembaruan `rahasiagelap3.0` dengan perbaikan AI sebelumnya. Pemilik membuka **Daftar staf**; kasir memeriksa pesanan lalu memilih antrean dapur atau penjualan langsung untuk pesanan yang sudah selesai. Pengiriman yang responsnya hilang dapat diperiksa tanpa mencatat penjualan dua kali. Menu Surplus dihapus mengikuti branch teman; akun email/kode sementara dan pengaturan paket tetap tersedia. [Perubahan dan batas](docs/BRANCH_SYNC_V50.md) · [TODO](docs/AI_TODO.md). Validasi rilis sebelum koreksi menu: **373 tes lulus** dan delapan pemeriksaan model asli. Koreksi menu/panduan diuji terarah: 8 tes Node dan 24 browser lulus. [Bukti](docs/evaluation/branch-sync-v50-release.json). Restart `npm start` dan muat ulang browser untuk memakai kode terbaru; catatan versi berikut adalah riwayat.

V0.49 memperbaiki pemeriksaan angka ambigu dan waktu tunggu AI dapur yang sebelumnya terlalu singkat. **305 tes backend + 63 browser lulus**, ditambah delapan pemeriksaan model asli. [Perubahan, cara mencoba dan batas](docs/AI_QUANTITY_VALIDATION.md) · [Bukti](docs/evaluation/ai-quantity-release.json). Tidak menambah training atau bobot model; catatan v0.48 berikut merupakan riwayat.

Pembaruan AI v0.48 mempertahankan catatan sumber seperti hangat/dingin untuk pemeriksaan pengguna dan menambah evaluasi catatan wajib yang terpisah dari skor menu/jumlah. **364 tes lulus** (302 backend + 62 browser), ditambah tujuh pemeriksaan model asli. Tidak ada fine-tuning baru; Qwen/Whisper tetap pralatih. [Status pelatihan setiap model](docs/AI_TRAINING_DECISIONS.md) · [Metode evaluasi chat](docs/CHAT_EVALUATION.md) · [Bukti](docs/evaluation/ai-notes-release.json). Angka regresi v0.47 berikut disimpan sebagai riwayat.

Pembaruan lokal: paket dasar **tanpa batas 10 menu**, pemakaian AI nyata per usaha, dan pencatatan kebutuhan tambahan tanpa pembelian palsu. Pemilik/kasir dapat memakai chat atau suara untuk mengisi formulir, memeriksa hasil, lalu mengirim pesanan ke dapur secara eksplisit. Penjualan tetap dicatat setelah item siap dan pesanan diselesaikan.

Jalankan `npm start`, buka **http://localhost:4174**. Bantuan pesanan ada di **Operasional dapur**; kuota dan kebutuhan paket ada di **Pengaturan akun**. [Cara memakai dan batas](docs/PLANS_AND_KITCHEN_AI.md) · [TODO terbaru](docs/AI_TODO.md) · [uji Qwen/Whisper nyata](docs/evaluation/plans-kitchen-ai-runtime.json).

**356 tes regresi lulus**: 294 backend dan 62 browser. [Ringkasan validasi](docs/evaluation/plans-kitchen-ai-release.json). Restart server dan refresh browser untuk memuat modul backend baru.

Qwen 1.5B dan Whisper telah diuji secara lokal melalui API pada database memori, termasuk satu pesanan selesai tanpa duplikasi. Ini bukan klaim akurasi lapangan. Pembayaran/langganan berbayar, cabang terpusat dan koordinasi pesanan mitra masih rencana. Perubahan ini **belum dideploy**; bagian berikut menyimpan riwayat deployment dan versi sebelumnya.

# Gerai Kita - v0.43, deployment Railway

Aplikasi online: **https://web-production-a3e13.up.railway.app**. Web berjalan di Singapura dengan SQLite pada volume persisten. Whisper Tiny berhasil melalui API terautentikasi pada akun memori; data produksi tidak diberi contoh. Akun laptop/demo belum dipindahkan, sehingga pemilik perlu mendaftar pada situs cloud.

**Qwen belum aktif.** Pengguna sudah memilih menaikkan kapasitas dan mempertahankan Qwen 1.5B. Akun masih Trial tanpa metode pembayaran, sehingga aktivasi Hobby berbayar di dashboard diperlukan untuk membuka kapasitas. Batas yang teramati masih 1 GB RAM per layanan/500 MB volume. Backup manual, unduhan, pemeriksaan salinan terpisah dan ketahanan data setelah redeploy berhasil; jadwal otomatis belum aktif.

**324 tes lulus** (270 Node + 54 browser), npm test exit 0. [Deployment dan batas](docs/RAILWAY_DEPLOYMENT.md) | [TODO](docs/AI_TODO.md) | [bukti cloud](docs/evaluation/railway-runtime.json). Publikasi memakai CLI; push GitHub belum otomatis deploy. Lokal tetap `npm start` di http://localhost:4174; demo terpisah tetap port 4180. Catatan versi berikut adalah riwayat.

Pemeriksaan AI nyata tambahan: `npm run verify:ai-runtime -- --audio KLIP_PUBLIK.wav --report data/cloud-verification/RUN_BARU.json`. Enam pemeriksaan lokal lulus dengan Qwen 1.5B/Whisper; fallback sengaja dibuat gagal. Script memakai SQLite memori dan tidak mengisi akun produksi. [Bukti dan batas](docs/evaluation/ai-runtime-acceptance.json). Hasil ini tidak menambah jumlah tes regresi 324 atau menyatakan Qwen cloud sudah aktif.

Backup cloud ke laptop: `npm run backup:railway -- --config data/railway-backup.local.json`. Unduhan dan restore terpisah berhasil diuji; jadwal harian belum aktif karena script pemasang diblokir Windows. [Petunjuk](docs/RAILWAY_BACKUP.md).

# Gerai Kita - v0.42, kode masuk staf

Pemilik kini dapat membuat staf cukup dengan nama/peran dan kode masuk sekali pakai 15 menit. Akun email/kata sandi lama tetap berlaku. Buka **Pengaturan akun > Akun kasir dan dapur**; staf memilih **Masuk sebagai staf**. [Cara memakai dan batas](docs/STAFF_PAIRING.md) | [TODO](docs/AI_TODO.md) | [bukti rilis](docs/evaluation/pairing-release.json).

**317 tes lulus** (263 Node + 54 browser Chromium), `npm test` exit 0. Data 29 tabel sebelumnya dipertahankan; schema kini 30 tabel. Tidak ada seed bisnis baru pada akun asli atau perubahan model AI.

Jalankan asli: `npm start` > **http://localhost:4174**. Demo terpisah: `npm run start:demo` > **http://127.0.0.1:4180**, [akun demo](docs/DEMO_ACCOUNT.md). Branch kerja tetap **feat/kitchen-capacity-and-waste**; `main` terpisah. Tahap berikutnya adalah deployment/HTTPS, penyimpanan SQLite persisten dan uji antarperangkat. Catatan versi berikut adalah riwayat.

# Gerai Kita — v0.41, perbaikan F&B

Branch **feat/kitchen-capacity-and-waste** memuat pembaruan `rahasiagelap2.0` sampai **fe073d0**, status menu kasir tanpa jumlah porsi, identitas pelaku pada catatan baru, dan demo pemilik/kasir/dapur. [Perubahan dan batas](docs/FNB_OPERATIONS.md) · [TODO](docs/AI_TODO.md) · [bukti rilis](docs/evaluation/fnb-release.json).

**304 tes lulus** (253 Node + 51 browser Chromium), `npm test` exit 0.

Aplikasi asli: `npm start` → **http://localhost:4174**. Demo F&B terpisah: `npm run demo:setup`, lalu `npm run start:demo` → **http://127.0.0.1:4180**. [Akun demo](docs/DEMO_ACCOUNT.md). Akun asli tetap dimulai dari data yang dimasukkan pengguna. `main` terpisah; deployment publik dan pairing staf belum dikerjakan. Catatan versi berikut adalah riwayat.

# Gerai Kita — v0.40, integrasi branch

Branch **feat/kitchen-capacity-and-waste** menggabungkan kapasitas/waste, katalog pelanggan dan ETA dari Claude dengan tampilan/panduan **rahasiagelap2.0**. Akun pemilik/kasir/dapur serta fitur usaha sebelumnya tetap tersedia. **295 tes lulus**, `npm test` exit 0 (246 Node + 49 browser Chromium). [Bukti rilis](docs/evaluation/integration-release.json).

ETA memakai durasi total resep (pasif sudah termasuk), kapasitas dan antrean yang sama pada pemilik/staf/layar pelanggan. Panduan otomatis mengikuti pendaftaran UI dan tidak menimpa tur manual. Cache aplikasi tetap memuat semua modul staf/inbox. Data usaha asli tidak diisi contoh.

[Hasil pemeriksaan dan perubahan](docs/BRANCH_INTEGRATION.md) · [TODO](docs/AI_TODO.md) · [Konteks untuk Claude](docs/CONTINUE_WITH_CLAUDE.md). `main` tetap terpisah; gunakan branch fitur untuk melanjutkan hasil integrasi.

`npm start` → **http://localhost:4174**; `npm run start:demo` → **http://127.0.0.1:4180** pada database demo terpisah. Berikutnya: persiapan deployment/HTTPS dan uji antarperangkat. Layanan saat ini masih lokal. Catatan versi di bawah adalah riwayat.

# Gerai Kita — v0.38

Validasi akhir: **284 tes lulus, `npm test` exit 0** (238 Node + 46 browser, satu worker, `PLAYWRIGHT_CHANNEL=chromium`).

Baru: **katalog pesanan pelanggan** (SRS REQ-F05). Pemilik membuat tautan **Katalog pesanan** di **Pengaturan akun → Layar dan katalog pelanggan**. Pelanggan memilih menu tanpa akun; menu yang bahannya habis langsung tampil *Habis*. Permintaan masuk ke **Permintaan dari katalog web** di Operasional dapur dan baru masuk antrean setelah kasir/pemilik menerima. Pelanggan melihat kode pesanan atau alasan penolakan.

[Cara memakai, aturan dan batas](docs/CUSTOMER_CATALOG.md). Migrasi aditif: kolom `kind` pada tautan dan tabel `order_requests`. Akses dari ponsel pelanggan tetap memerlukan jaringan/HTTPS/deployment yang belum selesai.
# Gerai Kita — v0.37

Validasi akhir: **278 tes lulus, `npm test` exit 0** (233 Node + 45 browser, satu worker, `PLAYWRIGHT_CHANNEL=chromium`).

Baru: **kapasitas stasiun dan bahan terbuang sebagian**. Di **Operasional dapur → Kapasitas stasiun**, pemilik mengatur jumlah staf aktif (giliran paralel) dan alat tahap pasif per stasiun; bawaannya tetap satu staf dan alat tidak dibatasi. Item dapat dibatalkan satu per satu: item yang belum dikerjakan melepas cadangan, item yang sudah dimulai mencatat bahan yang benar-benar terpakai dan mengembalikan sisanya. Penutupan seluruh pesanan juga menerima jumlah per bahan. Akun dapur hanya dapat mencatat seluruh resep item karena tidak menerima resep.

[Cara memakai, izin dan batas](docs/KITCHEN_CAPACITY.md). Migrasi aditif: satu tabel `kitchen_stations` dan tiga kolom `kitchen_tasks`; data lama tetap, tanpa data contoh. Suara dua detik, pilot nyata, integrasi ojol dan deployment masih terbuka.
# Gerai Kita — v0.36

Validasi akhir: **271 tes lulus, `npm test` exit 0** (227 Node + 44 browser, satu worker, `PLAYWRIGHT_CHANNEL=chromium`). [Bukti rilis dan health](docs/evaluation/staff-release.json).

Baru: **akun pemilik, kasir dan dapur** dengan pembatasan endpoint/tindakan di server. Pemilik membuka **Pengaturan akun → Akun kasir dan dapur** untuk membuat, mengubah peran atau menonaktifkan staf. Kasir menerima/menyerahkan pesanan; dapur mengatur tahap memasak. Data laporan, resep, pemasok dan pengaturan pemilik tidak dikirim ke staf.

Jalankan `npm start`, buka **http://localhost:4174/#pengaturan**. Staf memakai **http://localhost:4174/api/staff/screen#dapur** pada profil browser/jendela privat tersendiri. Demo terpisah: `npm run start:demo`, port **4180**. Tidak ada staf atau isi usaha contoh otomatis.

[Cara menggunakan dan matriks izin](docs/STAFF_ROLES.md) · [Progres/TODO](docs/AI_TODO.md) · [Bukti rilis](docs/evaluation/staff-release.json). `npm run test:staff` menguji akun/sesi/izin pada database sementara. Migrasi mempertahankan 25 tabel lama dan menambah dua tabel role/deduplikasi; akun lama menjadi pemilik. Panduan staf berpanah tersedia. Kapasitas alat/staf, waste sebagian, suara dua detik, pilot nyata dan deployment masih terbuka.

Bagian versi sebelumnya berikut adalah riwayat pengembangan.

# Gerai Kita — v0.35

Validasi terbaru: **261 tes lulus dan `npm test` selesai normal** (220 Node + 41 browser). [Bukti rilis](docs/evaluation/display-release.json).

Baru: **Pengaturan akun → Layar pelanggan** membuat tautan baca terbatas untuk kode/status pesanan, tanpa login pemilik. Pilih masa aktif, simpan tautan sebelum meninggalkan halaman, dan cabut saat tidak dipakai. [Cara memakai, privasi dan batas](docs/CUSTOMER_DISPLAY.md).

`npm start` → **http://localhost:4174/#pengaturan**. Database demo terpisah melalui `npm run start:demo` → **http://127.0.0.1:4180/#pengaturan**. Tautan localhost hanya bekerja pada perangkat server yang sama; akses perangkat lain memerlukan konfigurasi jaringan/HTTPS/deployment yang belum diselesaikan.

`npm run test:display` menguji kontrak akses/proyeksi tanpa mengubah data usaha. Peran kasir/dapur, suara dua detik dan deployment tetap pekerjaan lanjutan. Catatan v0.34 berikut tetap menjadi panduan modul dapur.

# Gerai Kita — tambahan operasional dapur v0.34

SRS Smart Kitchen Command Center digabung dengan prioritas pada fungsi dapur; Node.js, SQLite dan frontend saat ini dipertahankan sesuai pilihan pengguna.

Jalankan `npm start`, buka **http://localhost:4174/#dapur**. Untuk akun presentasi/database terpisah gunakan `npm run start:demo` lalu **http://127.0.0.1:4180/#dapur**. Menu lama belum memiliki waktu/stasiun; lengkapi melalui **Produk & stok → Ubah menu** sebelum memasukkan pesanan dapur.

Baru: antrean multi-item, prioritas SJF+aging per stasiun, tahap pasif/paralel, cadangan bahan, konsumsi saat selesai, layar layanan dengan SSE, dan perintah suara/teks terbatas. Fitur lama tetap tersedia. **Catat pesanan** lama tetap penjualan langsung; jangan mencatat pesanan dapur yang sama dua kali.

[Cara menggunakan dan pemetaan seluruh SRS](docs/KITCHEN_INTEGRATION.md) · [TODO prioritas](docs/AI_TODO.md). Target suara dua detik, integrasi ojol, akses staf/layar publik dan deployment produksi belum selesai. `npm run test:kitchen` menjalankan uji domain/API tanpa mengisi database usaha.

Validasi v0.34: **250 tes lulus melalui `npm test`**, proses selesai normal (215 Node + 35 browser, satu worker browser). [Bukti rilis dan health](docs/evaluation/kitchen-release.json). Data asli dan demo tetap identik pada 20 tabel sebelumnya; migrasi hanya menambah empat tabel dapur kosong.

Dokumentasi implementasi sebelumnya:

# Gerai Kita — v0.33.0

Aplikasi lokal untuk mencatat pesanan, stok dan pembelian kelompok dari data pengguna. Akun, katalog, resep, harga pemasok, saldo dan histori dimulai kosong. Tidak ada pemilih profil, transaksi contoh, harga bawaan atau reset demo pada aplikasi aktif.

**Akun presentasi yang diminta pengguna:** jalankan `npm run start:demo`, lalu buka **http://127.0.0.1:4180**. Email **demo@geraikita.test**, kata sandi demo **GeraiKitaDemo2026!**. Satu akun berisi 8 bahan, 6 menu, histori 84 hari, stok/penjualan, kulakan dan surplus simulasi pada **database terpisah**. Registrasi/aplikasi utama tetap kosong sesuai input pemilik. [Isi akun dan urutan presentasi](docs/DEMO_ACCOUNT.md).

V0.32 menambahkan **hasil pemeriksaan pemilik** di Saran kulakan: Sudah diperiksa/Perlu tindak lanjut, catatan dan waktu yang tetap tersimpan. Data target/pembanding yang berubah meminta review ulang; konflik sesi dan retry respons hilang ditangani. Offline tidak mengirim otomatis. [Cara memakai](docs/USAGE_DECISIONS.md).

V0.31 melanjutkan diagnostik suara: **24 transkripsi publik dan 36 replay decoder** selesai. Base pinned plain kembali menghasilkan dua versi teks; jalur deferred/replay cocok, sehingga penyebab/perbaikan masih belum terbukti. Bukti lama dan default Tiny dipertahankan. [Hasil](docs/evaluation/ASR_DECODER_RESULTS.md), [cara audit](docs/ASR_DECODER.md).

V0.30 menambahkan **alat evaluasi pemeriksaan pemakaian**: ekspor histori asli untuk anotasi manusia, pembekuan periode/aturan sebelum anotasi, precision/recall, coverage dan beban review. Data kosong atau belum berlabel ditolak; belum ada skor lapangan. `npm run usage:evaluation -- --help`. [Cara mengevaluasi](docs/USAGE_EVALUATION.md).

V0.29 mengubah panduan menjadi **tur visual berpanah**: aplikasi dikenalkan terlebih dahulu, fitur sebenarnya disorot, bagian lain diredupkan dan kotak penjelasan terhubung lewat panah. **Lanjut** berpindah fitur; **Kembali** dan **Lewati panduan** selalu tersedia. Tur utama sesudah masuk mencakup 11 langkah; keseluruhan 14 topik memuat 67 langkah. Penjelasan mengikuti posisi target saat scroll/resize. [Cara memakai tur](docs/INTERACTIVE_GUIDE.md).

V0.28 menambah **panduan interaktif untuk pengguna baru**. Pilih **Mulai panduan**, lalu **Lanjut**, **Kembali**, atau **Lewati panduan**. Ada **14 topik / 61 langkah**, penjelasan tombol/isian, pencarian, bantuan per halaman dan pause/resume per akun/perangkat. Buka lagi melalui **Panduan** atau **Panduan penggunaan**; petunjuk juga tersedia sebelum masuk dan saat offline. Tur tidak mengisi atau mengirim catatan. [Petunjuk lengkap](docs/INTERACTIVE_GUIDE.md).

V0.27 menampilkan **Periksa pemakaian bahan** pada **Saran kulakan**: ringkasan per bahan, tanggal yang perlu ditinjau dan delapan catatan pembanding asli. Semua tanggal dapat dibuka terpisah; data kosong, gap, offline dan snapshot lama ditandai. API mengikuti akun yang masuk. Membuka panel tidak mengubah transaksi atau forecast; aturan belum divalidasi pada kejadian usaha berlabel. [Cara memakai](docs/USAGE_REVIEW.md).

V0.26 menambah CLI **pemeriksaan pemakaian yang perlu ditinjau**: `npm run forecast:anomalies`. Penyaring membaca ledger asli, membandingkan hari sejenis dan menahan keputusan jika tanggal referensi kosong. Hasilnya kandidat review dengan rincian perhitungan; belum ada validasi anomali lapangan atau tindakan otomatis. Database akun tanpa histori tetap dilaporkan belum cukup data. [Panduan](docs/USAGE_ANOMALIES.md), [bukti preservasi data v0.26](docs/evaluation/usage-anomalies-release.json).

V0.25 menghubungkan profil kandidat ke aplikasi: **`npm run start:base` → http://localhost:4176**, lalu periksa dengan `npm run doctor:base`. `npm start` tetap Tiny di port 4174. Doctor membaca model server sebenarnya dan memverifikasi model yang sesuai. Uji HTTP nyata juga menemukan perbedaan transkrip terhadap v0.24, termasuk Base; bukti dipertahankan dan kestabilan belum dinyatakan selesai. [Petunjuk dan batas hasil](docs/RUNTIME_SPEECH.md).

V0.24 menambah adapter kandidat profil terpatok dan evaluasi pada 16 validation/24 test yang belum dinilai. Base pinned dipilih melalui validation; WER test **36,99%** dibanding Tiny current **86,59%**, sedangkan Tiny pinned memburuk ke **97,36%**. Seluruh 24 pengulangan tambahan cocok, termasuk baseline; ini belum membuktikan pinning mengatasi variasi. **Model aktif tetap Tiny; kandidat belum dipromosikan.** [Hasil](docs/evaluation/ASR_PROFILE_RESULTS.md), [metode dan pemeriksaan profil](docs/ASR_PROFILES.md).

V0.23 melokalisasi perubahan pertama pada intervensi OpenBLAS ke **proyeksi mel**, dengan input sebelumnya sama pada 16 pasangan pengujian. Ada 68 inferensi tambahan dan 112 pemeriksaan kernel alignment; pengulangan baru cocok, tetapi kegagalan historis konfigurasi tetap belum terlokalisasi dan belum ada perbaikan yang tervalidasi. Model aktif tetap Tiny. [Hasil dan batas klaim](docs/evaluation/ASR_FOLLOWUP_RESULTS.md), [panduan](docs/ASR_FOLLOWUP.md).

V0.22 menambah alat dan **136 inferensi diagnostik** untuk menelusuri variasi transkrip. Empat kelompok pengulangan tanpa hash tensor masih berbeda; kontrol satu faktor menunjukkan pengaturan thread OpenBLAS dapat mengubah fitur audio dan teks Tiny. Penyebab variasi konfigurasi tetap dan perbaikannya belum terbukti. Model aktif tetap Tiny. Periksa bukti tanpa inferensi ulang: `npm run analyze:asr-stability`. [Hasil](docs/evaluation/ASR_STABILITY_RESULTS.md), [panduan](docs/ASR_STABILITY.md).

V0.21 membandingkan Tiny/Base pada 16 kalimat validation dan 48 test baru, dengan pilihan dibekukan sebelum test. Pada satu run, WER test Base **36,36%** vs Tiny **66,93%**. **Uji kestabilan belum lulus: 3/4 transkrip berubah ketika diulang**, meskipun audit data/skor cocok. Base terpasang sebagai kandidat riset; model aktif aplikasi tetap Tiny. [Hasil dan keterbatasan](docs/evaluation/ASR_COMPARISON_RESULTS.md), [panduan](docs/ASR_COMPARISON.md).

V0.19 menambahkan **pencatatan pesanan lewat suara lokal**: Rekam pesanan → koreksi hasil ucapan → Gunakan teks → review pesanan. Whisper Tiny pretrained berjalan di CPU; audio tidak disimpan dan hasilnya tidak otomatis menjadi transaksi. Model sudah dipasang pada laptop ini. Untuk laptop baru: `npm run voice:setup`, lalu `npm run voice:check`. [Panduan dan batas validasi](docs/VOICE_BOOKKEEPING.md).

V0.20 menambahkan **evaluasi ASR bahasa Indonesia pada suara nyata publik FLEURS**. Protokol memilih 64 rekaman dengan hash sebelum inferensi, memakai adapter suara aplikasi, menghitung WER/CER/exact match dan latensi, serta mempertahankan seluruh penolakan. Model tidak dilatih ulang dan audio publik tidak dimasukkan ke database usaha. [Panduan reproduksi](docs/FLEURS_ASR.md), [hasil dan batas klaim](docs/evaluation/FLEURS_ASR_RESULTS.md).

[Laporan progres: yang sudah dibuat dan belum selesai](docs/PROGRESS.md). Pembaruan v0.15 menambah alat evaluasi chat parser/Qwen/pipeline, validasi izin dan split percakapan, serta 10 tes kontrak. Belum ada dataset chat nyata berlabel yang dievaluasi; tidak ada angka akurasi chat pengganti. [Panduan evaluasi chat](docs/CHAT_EVALUATION.md).

V0.16 menambah **audit kesiapan forecasting**: `npm run forecast -- readiness` membedakan tanggal tercatat, nol tersimpan, nol asumsi, status registry serta kebutuhan verifikasi sebelum training. Metadata cakupan input juga tersedia pada API rekomendasi; ringkasan perubahan tujuh hari bersifat deskriptif. [Panduan audit](docs/FORECAST_READINESS.md).

V0.17 menyelesaikan TODO **replikasi metode Ridge pada dataset lain**: empat model tambahan dari UCI Online Retail, CC BY 4.0, diuji pada 76 target dua hari tahun 2011. WAPE ternormalisasi Ridge 54,41% dibanding MA7 62,99%; dalam unit invoice asli, Ridge 32,92% kalah dari pola mingguan 24,92%. Semua hasil dan model disimpan. Ini training ulang metode Ridge, belum bukti transfer bobot boosting atau pilot Indonesia. [Laporan replikasi](docs/evaluation/UCI_RETAIL_RESULTS.md), [analisis error](docs/evaluation/UCI_RETAIL_ERROR_ANALYSIS.md), [sumber dan reproduksi](datasets/public/uci-online-retail/README.md).

V0.18 menyelesaikan eksperimen **transfer bobot tetap varian boosting sales-only**: fit hanya di FreshRetailNet, test 10 kelompok negara UCI baru / 190 target. Fitur stockout tidak dibuat-buat; varian baru tidak memerlukannya. Hasil belum mengalahkan baseline: mean-country WAPE model 173,00% vs MA7 165,12% dan MA14 156,51%. Bobot/prediksi identik ketika diulang; hasil buruk tetap disimpan, tanpa retuning atau aktivasi akun. Kalender UCI sudah diketahui. [Panduan](docs/BOOSTING_TRANSFER.md), [hasil](docs/evaluation/BOOSTING_TRANSFER_RESULTS.md), [analisis error](docs/evaluation/BOOSTING_TRANSFER_ERROR_ANALYSIS.md).

## Jalankan

Gunakan Node.js 24.9+ dan jalankan `npm start` dari folder proyek. Buka **http://localhost:4174**. Server hanya mendengarkan koneksi lokal. Preview pada laptop ini sudah aktif di alamat tersebut.

Ollama dengan model `qwen2.5:1.5b` tersedia pada laptop ini. Jalankan Ollama untuk memakai ekstraksi AI lokal; input manual dan parser lokal tersedia jika model tidak merespons. Katalog harus diisi sebelum ekstraksi. Harga dan resep selalu berasal dari katalog akun, bukan jawaban model.

## Mulai memakai data sendiri

Jika browser menampilkan **Aplikasi belum terhubung** meskipun server aktif, buka [pemulihan cache](http://localhost:4174/api/recovery), lalu klik **Perbarui & buka aplikasi**. Jalur ini melewati cache versi lama, membersihkan shell dan mempertahankan cookie, IndexedDB, draft serta data SQLite. Tidak perlu menghapus seluruh data situs.

1. Daftarkan nama usaha, email dan kata sandi. Buat kelompok atau masukkan kode undangan pengelola.
2. Buka **Produk & stok**. Tambahkan bahan beserta satuannya, catat barang yang benar-benar diterima, lalu buat menu, harga dan resep.
3. Buka **Catat pesanan**. Ketik/tempel catatan, rekam suara lalu koreksi teksnya, atau pilih menu manual; periksa jumlah, harga dan pemakaian bahan, kemudian konfirmasi.
4. Pengelola mengisi bahan bersama, pemasok, harga, ongkir, minimum pembelian dan batas berlaku melalui **Beli bersama**. Biaya pembanding boleh dikosongkan; penghematan tidak dihitung tanpa pembanding.
5. Setiap anggota memakai akunnya sendiri untuk membagikan kebutuhan dan menyetujui bagiannya. Rincian agregat terbuka setelah tiga usaha memberi izin aktif. Tombol **Perbarui data** memuat perubahan anggota lain.
6. Simpan rencana setelah semua anggota setuju. Masing-masing mencatat penerimaan fisik bagiannya. Siklus berikutnya mempertahankan stok/histori dan meminta penawaran pemasok baru.

Saran kulakan menampilkan **Belum cukup histori** sampai tersedia tujuh hari lengkap sejak pemakaian pertama. Tidak dibuat histori atau angka akurasi pengganti. Surplus muncul setelah anggota menerbitkannya; stok berpindah setelah persetujuan pemilik.

**500 model Ridge dan satu model gabungan gradient boosting sudah dilatih dari dataset nyata publik FreshRetailNet-50K**, berlisensi CC BY 4.0, tanpa data sintetis/imputasi. Model gabungan v2 dilatih dari 19.000 target dua hari; pada 200 toko di luar pengembangan, WAPE **24,83% dibanding MA7 27,04%** pada test yang sama (galat turun 8,16%). Seluruh 600 prediksi tersimpan dan identik saat konfigurasi tetap dilatih ulang. Tanggal kalendernya sama dengan v1, sehingga hasil ini menguji toko baru, bukan periode/domain yang sepenuhnya baru. [Model dan bobot](docs/evaluation/AI_MODEL_INDEX.md), [hasil v2](docs/evaluation/FRESHRETAILNET_V2_RESULTS.md), dan [TODO AI](docs/AI_TODO.md).

Run Ridge v1 tetap disimpan: WAPE 35,65% kalah dari MA7 26,88% pada sampel test v1 yang berbeda. Jangan membandingkan angka v1 dan v2 sebagai peningkatan pada sampel yang sama. [Laporan v1](docs/evaluation/FRESHRETAILNET_RESULTS.md), [sumber/lisensi](datasets/public/freshretailnet/README.md), [prosedur reproduksi](docs/AI_TRAINING.md).

Model publik tersebut memakai satuan penjualan ternormalisasi sumber dan tidak diaktifkan untuk bahan pengguna. **Belum ada model khusus usaha pengguna yang dilatih**; aplikasi tetap memakai baseline atau status belum cukup histori. Pipeline pribadi tersedia melalui `npm run forecast -- status`, dengan minimum 84 hari lengkap. Qwen untuk chat tetap model pretrained. [Panduan pelatihan](docs/AI_TRAINING.md).

**Pengaturan akun** memungkinkan pemilik mengganti nama usaha dan kata sandi. Perubahan kata sandi memerlukan kata sandi saat ini, mempertahankan sesi aktif dan mengeluarkan sesi lain dari akun yang sama. Pengelola juga dapat mengganti nama kelompok dan kode undangan; kode lama berhenti menerima anggota baru, anggota yang sudah bergabung tetap ada. [Rincian pengaturan akun](docs/ACCOUNT_SETTINGS.md).

## Penyimpanan dan pemulihan

Database aktif: `data/gerai-kita-live.sqlite`. Database versi sebelumnya `data/gerai-kita.sqlite` tetap disimpan dan tidak dibaca oleh aplikasi aktif. Sumber sebelum perubahan tersimpan pada `data/backups/source-before-live-20261015-105050.zip`. Akun lama berbasis profil demo tidak diubah menjadi akun usaha.

PWA menyimpan shell, snapshot berwaktu, draft manual dan rincian tindakan tertunda pada perangkat. Tidak ada pengiriman otomatis saat tersambung kembali. Periksa status tindakan tertunda sebelum mencatat ulang. Keluar akun membersihkan snapshot aktif; draft/proof tetap terpisah berdasarkan akun asal. Penyimpanan perangkat versi baru tidak membaca snapshot demo lama. Gunakan satu origin secara konsisten: localhost dan 127.0.0.1 memiliki cookie berbeda.

## Pemeriksaan

- `npm test`: pengujian backend/operasional/ML/chat/audit/suara/anomali/panduan/evaluasi/demo dan 32 skenario browser. Data pengujian berada di database memory atau file sementara terpisah.
- `npm run start:demo`: siapkan/buka satu akun presentasi berdata simulasi pada database harian terpisah, lalu jalankan di **http://127.0.0.1:4180**. `npm run demo:setup` hanya menyiapkan/menampilkan akses; `npm run test:demo` menguji tiga kontrak demo. [Akun dan isi](docs/DEMO_ACCOUNT.md).
- `npm run test:uci`: tiga tes Node replikasi (juga termasuk npm test) dan lima tes Python agregasi. `prepare:uci`, `benchmark:uci`, `verify:uci` menyiapkan, melatih dan memeriksa reproduksi publik tanpa SQLite.
- `npm run test:transfer`: tujuh tes Python fitur/transfer tanpa stockout. `benchmark:transfer`, `verify:transfer`, `analyze:transfer` mereproduksi eksperimen sumber-saja dan error analysis; tidak mengubah aplikasi/data usaha.
- `npm run test:readiness`: sembilan tes audit histori, cutoff, nol asumsi, scope dan CLI read-only.
- `npm run forecast:anomalies`: pemeriksaan read-only median/MAD pemakaian dengan referensi 56 tanggal tersimpan. `npm run test:anomalies` menjalankan 14 tes kontrak; bukan skor akurasi lapangan.
- `npm run usage:evaluation -- --help`: ekspor/freeze/evaluate koleksi pemakaian berlabel, tanpa mutasi database. `npm run test:usage-evaluation` menjalankan 13 tes kontrak; belum ada dataset berlabel aktif. [Panduan](docs/USAGE_EVALUATION.md).
- `npm run test:usage-decisions`: delapan tes backend penyimpanan review; empat browser ikut `npm test`. `npm run verify:usage-decisions -- --backup PATH --out FILE_BARU` memverifikasi 19 tabel lama dan tabel review kosong pada migrasi awal. [Panduan](docs/USAGE_DECISIONS.md).
- `npm run test:asr-decoder`: tujuh tes kontrak capture/replay/audit. `npm run diagnose:asr-decoder` menjalankan 24 transkripsi pada audio publik lama, bukan skor akurasi baru; `npm run analyze:asr-decoder -- --directory RUN` memeriksa bukti tanpa inferensi. [Metode](docs/ASR_DECODER.md).
- `npm run test:usage-review`: empat tes integrasi API/panel; empat skenario browser tambahan ikut `npm test`. [Bukti v0.27](docs/evaluation/usage-review-release.json), [review UI](docs/evaluation/USAGE_REVIEW_UI_REVIEW.md).
- `npm run test:guide`: delapan tes kontrak panduan; delapan skenario browser ikut `npm test`, termasuk seluruh 67 langkah tanpa POST bisnis dan posisi panah saat scroll/resize. [Cakupan dan cara memakai](docs/INTERACTIVE_GUIDE.md).
- `npm run test:chat`: 10 tes kontrak evaluasi chat. `npm run evaluate:chat -- --help` menjelaskan penggunaan dataset chat aktual berizin; tidak ada dataset chat bawaan atau mutasi SQLite.
- `npm run test:ml`: sebelas pengujian pipeline pelatihan dan isolasi model publik.
- `npm run benchmark:fresh`: ulang pelatihan/evaluasi 500 seri publik setelah preparasi data, tanpa mengubah SQLite atau mengaktifkan model untuk pengguna.
- `npm run test:pooled`: tujuh tes Python tambahan untuk pemisahan toko, pencegahan kebocoran masa depan, baseline dan model tersimpan; memerlukan .venv-ml.
- `npm run benchmark:pooled`: reproduksi eksperimen v2 dengan protokol tetap; tidak mengubah SQLite. `npm run verify:pooled` memeriksa sumber, artefak, pemilihan toko dan pelatihan ulang konfigurasi terpilih.
- `npm run forecast -- sources`: daftar bahan dan identitas scope dari SQLite secara read-only; impor/ekspor/train/activate dijelaskan di panduan AI.
- `npm run doctor`: pemeriksaan read-only SQLite, 15 aset lokal dan ketersediaan model.
- `npm run backup`: salinan konsisten SQLite ke data/backups; draft browser dan model tidak termasuk.
- `npm run evaluate`: evaluasi histori database aktif, tanpa menambahkan data. Jika histori tidak cukup, metrik tidak dibuat. Belum ada dataset chat lapangan berlabel.
- `npm run rehearse`: membaca kesiapan data; tidak lagi menyisipkan skenario demo.

[Panduan penggunaan](docs/USER_FLOWS.md), [persiapan final](docs/FINAL_DEMO.md), [arsitektur](docs/ARCHITECTURE.md), [offline](docs/OFFLINE.md), dan [laporan data aktif](docs/evaluation/live-evaluation.json).

Ini aplikasi lokal yang belum dipublikasikan. Pemesanan pemasok, pembayaran, pemulihan kata sandi dan verifikasi email belum diimplementasikan. Input suara lokal tersedia dengan koreksi/review manusia dan belum tervalidasi pada ucapan pemilik usaha. Persetujuan hanya menyimpan rencana internal. Dokumen dan hasil evaluasi versi demo tersimpan di [arsip v0.9](docs/archive/v0.9/README.md); angka dalam arsip bukan data usaha aktif.

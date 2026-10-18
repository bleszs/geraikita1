# Presentasi model kulakan yang benar-benar dilatih

Buka aplikasi Railway, masuk sebagai pemilik dan pilih **Saran kulakan**. Buka **Model prediksi kulakan → Lihat hasil uji dan contoh prediksi nyata**, lalu salah satu tanggal prediksi. Tunjukkan prediksi model, rata-rata tujuh hari, aktual dan 14 tanggal masukan. Nilai berasal dari dataset publik dan inferensi bobot model di server; contoh tidak membuat transaksi akun.

Pernyataan yang dapat dipakai: “Kami melatih model prediksi dua hari dari 500 seri penjualan ritel nyata dan 19.000 target. Pada 200 toko di luar pelatihan, MAE model 6,30% lebih kecil dari rata-rata tujuh hari. Saran bahan usaha memakai model setelah lolos backtest lokal.”

WAPE 25,68% adalah galat agregat, jangan disebut akurasi 74,32%. Data adalah penjualan ternormalisasi dari dataset publik, belum bukti lapangan UMKM Indonesia. Akun baru tetap membutuhkan histori nyata; tidak ada prediksi bahan yang dibuat dari stok saja. Model memerlukan 14 tanggal konteks, sedangkan aturan aktivasi bahan memerlukan 42 tanggal untuk menilai 14 target lokal dua hari. Contoh publik dapat ditunjukkan tanpa menunggu histori akun terkumpul.

Demonstrasi sintetis pada database terpisah yang dijelaskan di bagian lama tetap simulasi operasional. Historinya dikecualikan dari aktivasi kandidat model publik dan tidak boleh dipakai mengklaim performa lapangan. [Rincian model, reproduksi dan batas](KULAKAN_MODEL.md), [bukti cloud](evaluation/kulakan-cloud-release.json). Petunjuk demo sebelumnya berikut adalah riwayat.

# Tambahan demo v0.42: masuk staf dengan kode

Gunakan database demo terpisah di port **4180**. Masuk sebagai pemilik memakai [akun demo](DEMO_ACCOUNT.md), lalu buka Pengaturan akun > Akun kasir dan dapur. Pada akun kasir/dapur yang sudah ada, pilih **Buat kode masuk**, konfirmasi lalu bagikan kode/alamat ke jendela privat. Pilih Masuk sebagai staf, masukkan kode dan tunjukkan ruang kerja sesuai peran. Kode berlaku 15 menit untuk sekali masuk; akun email demo lama tetap bekerja. Tidak ada kode demo yang ditanam permanen. Membuat kode untuk akun yang ada menjaga daftar demo tanpa staf duplikat.

Tunjukkan perbedaan **Cabut kode** (hanya kode belum dipakai) dengan **Nonaktifkan** (mengakhiri sesi). Jangan menonaktifkan akun demo bawaan tanpa sengaja. Alur ini belum akses ponsel jarak jauh karena server masih loopback. [Penjelasan lengkap](STAFF_PAIRING.md). Skenario dan angka versi lama berikut adalah riwayat.

# Alur presentasi F&B v0.41

1. Jalankan `npm run start:demo`, buka http://127.0.0.1:4180 dan masuk sebagai pemilik. [Kredensial tiga peran](DEMO_ACCOUNT.md).
2. Buka Produk & stok untuk resep, ambang bahan dan pengaturan waktu; lalu Operasional dapur untuk kapasitas dan empat pesanan simulasi.
3. Pada profil/browser berbeda, masuk sebagai kasir melalui /api/staff/screen#dapur. Perlihatkan menu Tersedia/Hampir habis/Habis. Pilih menu hampir habis untuk membaca petunjuk konfirmasi ke dapur. Tidak ada angka porsi tersisa atau resep pada akun kasir.
4. Masuk sebagai dapur pada profil ketiga. Lanjutkan giliran/tahap pasif, lalu tandai item siap. Dapur tidak mempunyai harga dan laporan.
5. Pada kasir, serahkan pesanan siap dengan Serahkan & catat penjualan. Pemilik membuka Riwayat → Jejak aktivitas untuk nama/peran pelaku. Demo juga sudah berisi contoh bahan terbuang sebagian oleh pemilik.
6. Gunakan Ringkasan, Saran kulakan, kelompok dan surplus untuk penjelasan fitur usaha sebelumnya. Semua nilai berlabel simulasi, bukan hasil uji lapangan atau akurasi model.

Aplikasi utama tetap di localhost:4174. Demo ini lokal; pairing, deployment/HTTPS dan pilot perangkat nyata masih pekerjaan lanjutan. Bagian versi lama di bawah dipertahankan sebagai riwayat.

# Tambahan alur presentasi v0.40

Gunakan database demo terpisah di port 4180, dengan menu yang waktu/stasiunnya sudah diatur oleh pemilik. Tunjukkan kapasitas dua staf dan satu alat pasif, jalankan dua item, lalu buka Catat item terbuang dan isi bahan yang benar-benar terpakai hanya jika memang terjadi dalam simulasi. Jelaskan sisa cadangan dilepas, stok berkurang sesuai isian dan item tersebut tidak dijual.

Pemilik dapat membuat tautan Katalog pesanan, pelanggan mengirim permintaan, kasir menerima ke antrean, dapur menyiapkan dan kasir menyerahkan sekali. Bandingkan ETA lintas layar; angka masih perkiraan. Ponsel di perangkat lain belum dapat memakai URL localhost otomatis. [Cara memakai, integrasi dan batas](BRANCH_INTEGRATION.md). Semua isi demo adalah simulasi, bukan validasi AI atau dapur lapangan.

# Tambahan alur presentasi v0.36

Pada **database demo terpisah**, masuk sebagai pemilik lalu buka **Pengaturan akun → Akun kasir dan dapur**. Buat dua akun presentasi dengan email unik dan password awal sendiri: satu Kasir, satu Dapur. Tidak ada kredensial staf bawaan. Buka **halaman masuk staf** di dua profil browser/jendela privat terpisah; pakai port **4180** untuk seluruh alur demo ini.

1. Kasir memasukkan pesanan dari menu yang sudah diatur waktu/stasiunnya. Tunjukkan harga/porsi dan cadangan bahan, tanpa laporan usaha.
2. Dapur mendapat item, catatan dan giliran tanpa harga/resep. Ikuti Mulai → tahap pasif bila perlu → Tandai siap. Panduan per peran dapat dibuka lewat Panduan.
3. Kasir menyerahkan pesanan siap dan mencatat penjualan sekali. Pemilik melihat penjualan serta pengurangan stok.
4. Pemilik menonaktifkan salah satu staf dengan konfirmasi; layar staf kembali ke login setelah pemeriksaan sesi. Aktifkan kembali lalu masuk ulang jika ingin melanjutkan.

Jelaskan data demo sintetis dan akses masih lokal; akun asli tidak diisi contoh. [Cara memakai dan batas](STAFF_ROLES.md). Versi sebelumnya berikut adalah riwayat/alur pelengkap.

# Tambahan alur presentasi v0.35

Setelah pesanan dapur masuk, buka **Pengaturan akun → Layar pelanggan**, beri nama layar, pilih masa aktif dan buat tautan setelah konfirmasi. Buka tautan di jendela privat pada perangkat server yang sama. Tunjukkan kode/status tanpa menu/harga/catatan pelanggan, perubahan saat item siap, serta layar ditutup ketika akses dicabut. Jangan membagikan akun pemilik sebagai akses pelanggan. Link localhost belum menjangkau perangkat lain tanpa pengaturan jaringan/deployment.

Gunakan database demo dan jelaskan bahwa data presentasi sintetis. Tautan tidak diisi otomatis; salin sebelum berpindah halaman. [Panduan](CUSTOMER_DISPLAY.md).

# Alur tambahan presentasi v0.34: operasional dapur

Gunakan database demo terpisah dan data berlabel simulasi; akun utama tidak diisi contoh. Pada demo lama, konfigurasi waktu total/pasif dan stasiun di **Produk & stok → Ubah menu** terlebih dahulu.

1. Buka **Dapur**, masukkan pesanan aktual/simulasi presentasi dengan label, menu dan porsi. Tunjukkan bahwa saldo fisik belum berkurang, tetapi stok tersedia sudah dicadangkan.
2. Tambahkan pesanan lain dengan estimasi lebih singkat pada stasiun sama. Tunjukkan giliran SJF dan aturan usia 15 menit.
3. Mulai giliran, tandai tahap pasif, lalu mulai giliran berikutnya. Menu tanpa waktu pasif tidak mempunyai tombol tahap tersebut.
4. Buka **Layar layanan** di tab/perangkat yang masuk ke akun usaha sama. Tunjukkan status berubah lewat SSE; layar masih memakai sesi pemilik dan bukan akses publik.
5. Coba perintah teks dengan nama menu/label sendiri; kemudian suara jika layanan siap. Jelaskan rekaman empat detik dan bahwa SLA dua detik/akurasi dapur nyata belum terbukti.
6. Tandai seluruh item siap lalu selesaikan. Tunjukkan satu penjualan dan stok berkurang sesuai snapshot awal. Jangan mencatat kembali di Catat pesanan langsung.
7. Jika diperlukan, tunjukkan pembatalan sebelum mulai dan pemeriksaan bahan terpakai setelah mulai tanpa benar-benar mengonfirmasi waste yang tidak terjadi.

[Cakupan, batas dan perbedaan SRS](KITCHEN_INTEGRATION.md). Demo dan pengujian teknis tidak menjadi bukti mutu model pada usaha nyata.

# Persiapan final dengan data sendiri

**Untuk presentasi dengan data contoh yang diminta pengguna**, gunakan akun/database demo terpisah: `npm run start:demo`, buka **http://127.0.0.1:4180**, masuk dengan **demo@geraikita.test / GeraiKitaDemo2026!**. Ada katalog, resep, histori, kulakan, surplus dan review. Jelaskan bahwa semuanya simulasi; ini bukan data atau skor AI lapangan. [Panduan demo lengkap](DEMO_ACCOUNT.md). Alur di bawah tetap berlaku untuk penggunaan dengan data sendiri.

V0.32: pada histori sendiri yang memenuhi syarat, buka **Saran kulakan → Rincian pemeriksaan → Catat hasil pemeriksaan**, pilih hasil/catatan, konfirmasikan dan simpan. Reload untuk melihat persistensi. Perubahan data meminta review ulang, tanpa mengubah tanda statistik/stok. Jika histori akun kosong, jelaskan prasyarat dan gunakan keadaan kosong; jangan memasukkan histori atau review buatan. [Panduan](USAGE_DECISIONS.md).

V0.31: bukti diagnostik suara terbaru menyimpan variasi yang masih terjadi pada Base pinned plain. Tunjukkan [hasil dan batas](evaluation/ASR_DECODER_RESULTS.md) jika menjelaskan kesiapan AI. 24 transkripsi dan 36 replay adalah diagnostik pada klip yang sudah terlihat, bukan pelatihan, skor test baru atau bukti bahwa kestabilan sudah diperbaiki. Default aplikasi tetap Tiny.

V0.30 menambahkan alat evaluasi review pemakaian. Tunjukkan `npm run usage:evaluation -- --help` untuk menjelaskan proses izin → ekspor histori asli → bekukan protokol → anotasi manusia → ukur precision/recall/coverage. Jangan menjalankan penilaian atau menyatakan skor sebelum ada histori dan label nyata. Akun saat ini belum memiliki histori pemakaian; template tetap kosong. [Panduan operator](USAGE_EVALUATION.md).

V0.29: pilih **Mulai panduan** untuk tur visual yang dimulai dari pengenalan aplikasi. Panah menunjuk fitur nyata, bagian lain diredupkan, lalu **Lanjut** berpindah fitur berikutnya. Ada Kembali/Lewati; setelah masuk tur utama 11 langkah dan rincian tambahan tersedia dari Panduan. Jika baru memperbarui dari versi lama, pilih Muat ulang aplikasi pada pemberitahuan pembaruan terlebih dahulu. [Panduan](INTERACTIVE_GUIDE.md).

V0.28: tawaran **Mulai panduan / Lewati** membantu pengguna baru. Tur awal sesudah masuk terdiri dari enam langkah; menu **Panduan penggunaan** menyediakan 14 topik / 61 langkah lengkap, pencarian tombol, Lanjut/Kembali/Lewati dan pause/resume. Tombol panduan hanya membaca penjelasan/berpindah halaman; tidak mencatat transaksi, meminta mikrofon atau mengisi data contoh. [Panduan fitur](INTERACTIVE_GUIDE.md).

V0.27: buka **Saran kulakan → Periksa pemakaian bahan**. Tunjukkan status cakupan data akun; bila ada tanggal untuk ditinjau, buka rinciannya dan delapan referensi tersimpan. Akun tanpa histori tetap menampilkan **Belum ada histori**. Hindari mengisi riwayat buatan demi memunculkan tanda. Ini aturan statistik untuk review, bukan model anomali terlatih atau skor lapangan. [Panduan panel](USAGE_REVIEW.md).

V0.26 menyediakan CLI `npm run forecast:anomalies` untuk kandidat pemakaian tidak biasa beserta referensi dan batas perhitungannya. Pada akun tanpa histori hasilnya belum cukup data; jangan membuat transaksi/riwayat untuk memunculkan peringatan atau menyebut nol kandidat sebagai bukti akurasi. [Panduan aturan](USAGE_ANOMALIES.md).

V0.25: untuk mencoba kandidat Base gunakan `npm run start:base`, buka **http://localhost:4176**, lalu `npm run doctor:base` di terminal lain. Default `npm start` tetap Tiny di port 4174. Kedua pilihan memakai data usaha yang sama tanpa pengisi data contoh. Jelaskan bahwa ini model pretrained dan kandidat yang perlu review transkrip; smoke HTTP menemukan perbedaan terhadap hasil v0.24, sehingga belum ada klaim perbaikan kestabilan. [Panduan](RUNTIME_SPEECH.md).
V0.24: Base pinned dipilih lewat validation dan menghasilkan WER 36,99% pada 24 klip test baru, dibanding Tiny current 86,59%. Tiny pinned lebih buruk 97,36%; jangan menyatakan thread tunggal selalu lebih akurat. Semua 24 pengulangan cocok termasuk baseline, tetapi ini belum menyelesaikan variasi historis atau menguji pesanan/mikrofon pemilik. Model default tetap Tiny; profil kandidat tersedia untuk pemeriksaan terpisah dan tidak otomatis diaktifkan. [Hasil](evaluation/ASR_PROFILE_RESULTS.md), [panduan](ASR_PROFILES.md).
V0.23 mempersempit sensitivitas pengaturan OpenBLAS ke operasi proyeksi mel pada 16 pasangan. 68 inferensi tambahan dan 112 pemeriksaan alignment sudah dicatat; kecocokan pengulangan baru tidak menghapus kegagalan lama dan bukan perbaikan ASR yang lulus. Model aktif tetap Tiny. [Bukti](evaluation/ASR_FOLLOWUP_RESULTS.md).

Status v0.22: 136 inferensi diagnostik ASR sudah dijalankan pada dua klip publik yang pernah gagal repeat. Pengaturan thread OpenBLAS dapat mengubah fitur audio/teks; penyebab variasi konfigurasi tetap belum terbukti dan belum ada perbaikan yang lulus validasi. Saat presentasi, sebut hasil ini investigasi, bukan peningkatan akurasi atau ASR yang sudah stabil. Model aktif tetap Tiny. [Bukti](evaluation/ASR_STABILITY_RESULTS.md).

Jalankan npm start dan buka http://localhost:4174. npm run doctor memeriksa SQLite/aset/model; npm run backup menyimpan salinan database. npm run rehearse hanya membaca kesiapan data. Tidak ada tombol pengisi data contoh.

## Siapkan sebelum presentasi

Lihat [PROGRESS.md](PROGRESS.md) untuk status menyeluruh dan batas klaim. V0.15 menambah alat evaluasi chat parser/Qwen/pipeline serta panduan anotasi; dataset chat aktual berizin belum tersedia dan akurasi chat lapangan belum dinilai. Jangan menyebut tes kontrak sebagai skor model. Panduan: [CHAT_EVALUATION.md](CHAT_EVALUATION.md).

Status AI saat ini: Qwen untuk ekstraksi adalah pretrained. **500 model Ridge sudah dilatih dari dataset nyata publik FreshRetailNet-50K**, berlisensi CC BY 4.0. Buka evaluation/AI_MODEL_INDEX.md untuk bobot/scaler dan evaluation/FRESHRETAILNET_RESULTS.md untuk metrik aktual. WAPE eksternal Ridge 35,65%, nilai terakhir 37,30%, rata-rata tujuh hari 26,88%; jangan mengklaim Ridge mengalahkan seluruh baseline. Semua model, termasuk yang kalah, disimpan. Ini eksperimen normalized sales publik, bukan hasil pilot UMKM Indonesia atau model pribadi akun aktif. Saran kulakan tetap menampilkan sumber prediksi akun yang sebenarnya. Panduan: AI_TRAINING.md; pekerjaan berikutnya: AI_TODO.md.

Eksperimen terbaru v2 menambah **satu model gabungan gradient boosting** dari 19.000 target nyata. Pada 200 toko baru / 600 target, WAPE 24,83% dibanding MA7 27,04%, galat turun 8,16% pada sampel yang sama. Model menang pada 113/200 seri. Buka [laporan v2](evaluation/FRESHRETAILNET_V2_RESULTS.md) dan [lokasi model](evaluation/AI_MODEL_INDEX.md); `npm run verify:pooled` membuktikan 600 prediksi identik dari pelatihan ulang konfigurasi tetap. Toko test berbeda dari v1 tetapi kalender sama; jangan menyebutnya replikasi pada periode baru atau memakai perbedaan angka v1/v2 sebagai perbandingan langsung. Model ini belum diintegrasikan ke prediksi bahan akun.

Replikasi v0.17 memakai UCI Online Retail pada kalender 2010–2011: empat model Ridge tambahan dan 76 target eksternal. WAPE ternormalisasi Ridge 54,41% vs MA7 62,99%; raw-unit Ridge 32,92% kalah dari pola mingguan 24,92%. Model bukan pemenang semua baseline. Ini training ulang metode Ridge, bukan transfer bobot boosting. Buka [laporan UCI](evaluation/UCI_RETAIL_RESULTS.md), [analisis](evaluation/UCI_RETAIL_ERROR_ANALYSIS.md), dan `npm run verify:uci` untuk empat model/76 prediksi identik. Pada rilis tersebut jumlah publik 504 Ridge dan satu boosting; Qwen tetap pretrained.

Eksperimen v0.18 menambah satu boosting sales-only yang dilatih hanya pada FreshRetailNet dan ditransfer dengan bobot tetap ke 10 kelompok negara UCI baru / 190 target. Mean-country WAPE model 173,00% vs MA7 165,12%; transfer belum berhasil mengalahkan baseline dan kalender UCI telah diketahui. Fitur stockout tidak dibuat-buat, model v2 asli belum diuji langsung. Jangan menyatakan hasil transfer siap dipakai. Semua hasil buruk dan 190 prediksi tetap disimpan serta identik saat refit; lihat [laporan](evaluation/BOOSTING_TRANSFER_RESULTS.md), [analisis kegagalan](evaluation/BOOSTING_TRANSFER_ERROR_ANALYSIS.md), `npm run verify:transfer`. Total publik sekarang 504 Ridge dan dua boosting; Qwen tetap pretrained.

Daftarkan akun pemilik dan anggota yang sebenarnya, isi katalog/resep, catat stok fisik dan penawaran pemasok yang dapat dipertanggungjawabkan. Anggota menggunakan akunnya masing-masing melalui kode kelompok. Gunakan tiga sesi browser terpisah jika meninjau alur kelompok secara lokal; jangan membagikan kata sandi.

Pengaturan akun dapat dipakai untuk memperbaiki nama usaha/kelompok. Pengelola dapat mengganti kode undangan; bagikan kode terbaru jika kode lama diganti. Jika mengganti kata sandi, sesi lain dari akun yang sama akan dikeluarkan. Anggota tetap menggunakan akun masing-masing.

## Urutan klik

Status riset v0.21: Base terpasang sebagai pembanding, bukan model aktif baru. Pada 48 rekaman test baru yang sama, satu-run WER Base 36,36% vs Tiny 66,93%; keputusan dibuat melalui 16 validation sebelum test. Audit data/skor lulus namun 3/4 transkrip ulang berubah. **Jangan mengklaim inferensi berhasil direproduksi atau fitur suara siap operasional**. Demo tetap menggunakan model aktif Tiny dan koreksi manusia. [Laporan](evaluation/ASR_COMPARISON_RESULTS.md).

Tambahan v0.19: setelah katalog/resep diisi, **Catat pesanan → Rekam pesanan → Selesai merekam → koreksi hasil ucapan → Gunakan teks → Susun rincian pesanan**. Periksa rincian sebelum konfirmasi; rekaman/transkrip tidak otomatis mengubah stok. Whisper Tiny pretrained tersedia pada laptop ini; `npm run voice:check` memeriksa file dan pemuatan model lokal. Benchmark publik v0.20 menghasilkan WER 67,27%, CER 27,64%, exact match 0/64 pada sampel FLEURS; pengenalan belum andal dan belum diuji pada pesanan/mikrofon pemilik usaha. Tidak ada fine-tuning. Jika izin mikrofon ditolak, ketik catatan atau gunakan input manual. [Panduan suara](VOICE_BOOKKEEPING.md), [hasil dan batas klaim](evaluation/FLEURS_ASR_RESULTS.md).

1. Produk & stok: tunjukkan bahan, satuan, resep dan sumber saldo dari catatan penerimaan.
2. Catat pesanan: masukkan pesanan aktual yang ingin dicatat; periksa rincian sebelum konfirmasi. Jika hanya memperlihatkan ekstraksi tanpa transaksi, berhenti pada review.
3. Saran kulakan: jelaskan histori yang tersedia. Bila belum cukup, tampilkan statusnya dan tentukan kebutuhan manual setelah memeriksa stok.
4. Beli bersama: pengelola mengisi penawaran aktual; tiga anggota berbagi kebutuhan dan menyetujui versinya sendiri. Tunjukkan jumlah dan ongkir dari input tersebut.
5. Simpan rencana. Catat penerimaan hanya ketika barang benar-benar diterima. Surplus juga memerlukan tawaran pemilik dan persetujuan transfer.

Jika belum ada data nyata, tampilkan alur kosong/formulir serta bukti pengujian terisolasi. Jangan menyebut angka fixture lama sebagai hasil penggunaan nyata atau mengonfirmasi mutasi fiktif pada database aktif. Pengujian npm test berjalan terpisah dan tidak mengisi database ini.

Jika AI lambat/tidak tersedia, gunakan manual atau parser lokal dengan label yang tampil. Jika respons hilang, gunakan panel pemulihan sebelum mencatat ulang. Tidak ada pembayaran atau pemesanan pemasok eksternal.

# Pelatihan forecasting Gerai Kita

Untuk pertanyaan “semua AI harus dilatih ulang?”, lihat [keputusan per model](AI_TRAINING_DECISIONS.md). Qwen/Whisper aplikasi masih pralatih; panduan ini membahas fitting dan evaluasi **ramalan**, bukan fine-tuning model bahasa/suara.

V0.24 mengevaluasi tiga profil ASR pretrained pada 16 validation/24 test baru. Base pinned dipilih dari validation; WER test 36,99% vs Tiny current 86,59%, sementara Tiny pinned 97,36%. Audit dan pengulangan terbatas lulus, tetapi bukan validasi perbaikan variasi atau suara pesanan. Tidak ada training/aktivasi baru; forecasting tetap 504 Ridge dan dua boosting. [Hasil](evaluation/ASR_PROFILE_RESULTS.md), [metode](ASR_PROFILES.md).
V0.23: 68 inferensi diagnostik tambahan dan 112 pemeriksaan kernel; perubahan pertama pada intervensi OpenBLAS ditemukan di proyeksi mel. Pengulangan baru cocok, tetapi penyebab variasi historis konfigurasi tetap dan perbaikannya belum terbukti. Tidak ada model terlatih atau skor akurasi baru. [Hasil/batas](evaluation/ASR_FOLLOWUP_RESULTS.md).

V0.22 menambah 136 inferensi diagnostik ASR dengan hash tahap dan kontrol impor/backend, tanpa training atau benchmark test baru. Pengaturan OpenBLAS memengaruhi fitur/transkrip pada klip yang sudah terlihat, tetapi penyebab variasi konfigurasi tetap dan perbaikannya belum terbukti. [Hasil dan batas](evaluation/ASR_STABILITY_RESULTS.md). Jumlah model forecasting terlatih tetap 504 Ridge dan dua boosting.

V0.21 menambah perbandingan ASR pretrained Tiny/Base tanpa training/fine-tuning: 16 validation dan 48 test baru, keputusan validation dibekukan sebelum test. Satu run memberi WER test Base 36,36% vs Tiny 66,93%, tetapi 3/4 transkrip ulang berubah sehingga reproduksi prediksi belum lulus. Model aktif tetap Tiny, bobot forecasting tidak ditambah atau diubah. [Hasil dan batas](evaluation/ASR_COMPARISON_RESULTS.md).

Pembaruan v0.19: Whisper Tiny pretrained telah dipasang untuk transkripsi suara lokal. Model ASR ini **bukan** hasil pelatihan forecasting atau fine-tuning tim. Bobot/checksum, alur koreksi dan batas validasi suara dijelaskan di [VOICE_BOOKKEEPING.md](VOICE_BOOKKEEPING.md). Tidak ada penambahan dataset atau artefak forecasting pada rilis suara ini.

V0.20 mengevaluasi model suara yang sama pada sampel nyata publik FLEURS Indonesia: 64 rekaman, WER 67,27%, CER 27,64%, exact match 0/64. Semua penolakan tetap dinilai. Ini evaluasi tanpa training/fine-tuning dan belum mendukung pengenalan andal atau ketepatan pesanan UMKM. [Protokol dan hasil](FLEURS_ASR.md).

Status v0.18.0: **504 model Ridge dan dua model gabungan gradient boosting sudah dilatih pada data nyata publik**. Dua boosting adalah v2 dan varian sales-only yang memakai kembali sumber FreshRetailNet yang sama. UCI Online Retail menambah empat Ridge untuk replikasi serta menyediakan kelompok terpisah untuk test transfer boosting. Belum ada model khusus akun usaha pengguna yang dilatih/diaktifkan. Qwen2.5 1.5B untuk ekstraksi tetap pretrained, bukan model hasil pelatihan tim.

## Transfer boosting sales-only: hasil negatif

Model v2 memerlukan stockout masa lalu yang tidak tersedia pada UCI. Eksperimen baru menghapus fitur stockout dan log level absolut, lalu melatih varian sales-only hanya pada 500 seri FreshRetailNet dengan validasi sumber. Tidak ada fitting/tuning pada UCI. Model dan konfigurasi disimpan sebelum workbook target diparsing pada run ini. Bobot tetap diuji pada 10 negara yang belum dinilai saat replikasi Ridge / 190 target dua hari; kondisi kalender UCI telah diketahui dan diakui dalam protokol.

Mean-country WAPE model 173,00%, MA7 165,12%, MA14 156,51%; hanya 1/10 negara menang atas MA7. Hasil belum mendukung generalisasi. Artefak dan seluruh kasus disimpan, tidak dituning ulang setelah test atau diaktifkan ke akun. Refit sumber dan agregasi ulang workbook menghasilkan koreksi, 190 prediksi dan metrik identik. Ini varian baru, bukan pengujian langsung bobot v2 asli. [Panduan dan perintah](BOOSTING_TRANSFER.md), [hasil](evaluation/BOOSTING_TRANSFER_RESULTS.md), [analisis error](evaluation/BOOSTING_TRANSFER_ERROR_ANALYSIS.md).

## Replikasi UCI yang sudah dikerjakan

Sumber resmi UCI, CC BY 4.0, memuat 541.909 baris invoice. Protokol dibekukan sebelum pembacaan data/pelatihan. Target diturunkan sebagai SUM unit positif pada event invoice yang lolos filter per negara/tanggal; tidak ada transaksi buatan atau pencampuran ke ledger pengguna. SUM kosong berarti tidak ada event cocok pada sumber terpublikasi, bukan imputasi permintaan tak diketahui. Skala normalisasi dihitung hanya dari 84 tanggal development pertama.

Empat negara memenuhi kriteria development tanpa melihat test; masing-masing 334 observasi development dan 38 tanggal eksternal, total 76 target dua hari. Pipeline Ridge yang sama dilatih ulang. WAPE ternormalisasi 54,41% vs MA7 62,99%, tetapi raw-unit WAPE Ridge 32,92% kalah dari pola mingguan 24,92%. Empat agregat negara berasal dari satu peritel dan bukan usaha independen. Ini bukan transfer bobot boosting atau pilot Indonesia; angka lintas dataset tidak menjadi pembanding langsung.

Preparasi ulang dari workbook dan training ulang menghasilkan hash data yang sama, empat bobot/scaler serta 76 prediksi identik. `npm run prepare:uci`, `benchmark:uci`, `verify:uci` dan `test:uci` tersedia. [Prosedur/sumber](../datasets/public/uci-online-retail/README.md), [hasil](evaluation/UCI_RETAIL_RESULTS.md), [analisis error](evaluation/UCI_RETAIL_ERROR_ANALYSIS.md), [model](evaluation/AI_MODEL_INDEX.md).

## Eksperimen v2: pooled residual boosting

Protokol baru ada di [protocol-v2.json](../benchmarks/freshretailnet/protocol-v2.json). Satu HistGradientBoostingRegressor belajar koreksi terhadap MA7 dari 500 seri / 355 toko, menggunakan 19.000 target dua hari pada fit final. Fitur hanya mengambil 14 hari sebelum origin dan kalender yang diketahui; informasi stockout masa depan hanya menjadi strata laporan, tidak masuk fitur. Target residual dinormalisasi terhadap skala histori, dengan sample weight skala histori untuk mengoptimalkan galat absolut dalam satuan penjualan sumber.

Empat konfigurasi model × empat bobot koreksi (termasuk nol untuk mempertahankan MA7) dipilih berdasarkan MAE pada 3.500 target validasi. Bagian validasi ini pernah menjadi test internal v1 dan sekarang dinyatakan sebagai data pengembangan. Setelah konfigurasi dipilih, model refit pada seluruh train penerbit, lalu artefak dan pilihannya dibekukan sebelum kuantitas holdout dibaca.

200 toko dipilih berdasarkan hash ID di luar seluruh toko pengembangan, satu produk per toko. 600 target pada eval penerbit menghasilkan MAE 0,565100 dan WAPE 24,83%, dibanding MA7 MAE 0,615315 / WAPE 27,04%. Galat relatif turun 8,16%; 113 seri menang dan 87 tidak menang. Periode kalender sama dengan v1, sehingga ini bukti transfer ke toko baru, bukan replikasi pada waktu atau domain yang sepenuhnya baru. V1 dan v2 memakai toko test berbeda: bandingkan model v2 dengan baseline **pada test v2**, bukan langsung dengan angka Ridge v1.

Artefak `pooled-model.joblib` berisi pohon yang dipelajari, sedangkan `model-metadata.json` memuat fitur, konfigurasi, checksum dan sumber. Seluruh kandidat, label dan prediksi tersimpan. Model ini eksperimen publik Python terpisah, tidak dilayani registry akun atau memerlukan Python ketika aplikasi dijalankan. Lokasi: [AI_MODEL_INDEX.md](evaluation/AI_MODEL_INDEX.md), [laporan v2](evaluation/FRESHRETAILNET_V2_RESULTS.md), [bukti reproduksi](evaluation/freshretailnet-v2-reproducibility.json).

Untuk mereproduksi pada laptop ini:

```powershell
# Jika .venv-ml belum ada: python -m venv .venv-ml
.\.venv-ml\Scripts\python.exe -m pip install -r requirements-ml.txt
# Jika sumber belum diunduh/disiapkan:
.\.venv-ml\Scripts\python.exe scripts/fetch-freshretailnet.py
npm run test:pooled
npm run benchmark:pooled
npm run verify:pooled
```

Perintah benchmark membuat run baru dari protokol yang sama; pengulangan ini reproduksi, bukan test independen baru. Verifikasi melatih ulang **konfigurasi tetap** tanpa tuning dan membandingkan 600 prediksi dengan artefak tersimpan serta menghitung ulang metrik dari parquet asli. Hash protokol merujuk file sumber protokol; salinan JSON pada run dibandingkan secara struktur agar perbedaan format/newline tidak dianggap perubahan eksperimen. Dependensi Python dipatok pada requirements-ml.txt; aplikasi tetap Node.

Hasil ini menggunakan penjualan ternormalisasi, tidak diubah menjadi gram/buah atau data latihan pengguna. Aktivasi model publik ke akun tetap ditolak. Belum ada validasi lapangan UMKM Indonesia, pemulihan permintaan laten saat stockout, atau interval prediksi terkalibrasi. [Dokumentasi estimator](https://scikit-learn.org/1.7/modules/generated/sklearn.ensemble.HistGradientBoostingRegressor.html).

## Run publik v1 yang tetap disimpan

Dataset resmi Dingdong-Inc berlisensi CC BY 4.0 diunduh dari revisi tetap dan SHA256 file diperiksa. Dari 50.000 seri, 500 dipilih dengan hash ID sebelum hasil diketahui. Model dilatih dari 90 hari per seri pada split train penerbit; tujuh hari eval penerbit terpisah sama sekali dari tuning/fitting. Tiga target dua hari lengkap dinilai pada eval tersebut, dengan satu hari tersisa tidak dinilai.

Target publik tetap dalam normalized_sales, tanpa pembulatan ke presisi bahan. Tidak ada data hilang yang diisi nol, perubahan resep, pemulihan latent demand, atau pencampuran ke SQLite pengguna. Provenance source=public_dataset, usage=benchmark_only memerlukan URL, lisensi, revisi dan hash sumber. Registry akun menolak model publik meskipun metrik sebuah seri lolos. Penelitian publik ini bukan validasi UMKM Indonesia.

Hasil: [FRESHRETAILNET_RESULTS.md](evaluation/FRESHRETAILNET_RESULTS.md), rincian semua seri pada freshretailnet-results.json, dan bobot/scaler per seri pada models/benchmarks/freshretailnet. Sumber/atribusi dan perintah reproduksi: [README dataset](../datasets/public/freshretailnet/README.md). Model Ridge bukan otomatis lebih baik: WAPE eksternal 35,65% dibanding 37,30% nilai terakhir dan 26,88% rata-rata tujuh hari. Tidak dilakukan tuning ulang setelah melihat eval eksternal.

Bagian berikut menjelaskan pipeline **dataset usaha sendiri**, yang tetap terpisah dari benchmark publik.

## Apa yang dilatih

Model Ridge mempelajari koefisien dari histori satu bahan milik satu usaha. Targetnya total pemakaian **dua hari berikutnya**, sebelum pengurangan stok. Pelatihan menggunakan JavaScript/Node tanpa instalasi Python atau library ML tambahan; sumbernya `server/ml/forecast-model.mjs`. Model ini berbeda dari baseline rata-rata yang sudah tersedia.

Fitur berasal dari 14 hari sebelum tanggal prediksi: lag 1/2/7/14, rata-rata 7/14 hari, simpangan baku, perubahan rata-rata dan proporsi hari nol. Eksperimen membandingkan fitur tersebut dengan tambahan sin/cos hari dalam minggu dan jumlah hari akhir pekan pada horizon. Tidak ada asumsi libur/cuaca yang diisi tanpa data.

Ridge memakai objective jumlah kuadrat galat + alpha × jumlah kuadrat bobot, dengan intercept tidak dipenalti. Standardisasi dihitung dari bagian fitting saja. Pemilihan regularisasi dan fitur menggunakan validasi kronologis. Rujukan metodologi: [Ridge](https://scikit-learn.org/stable/modules/generated/sklearn.linear_model.Ridge.html) dan [pemisahan data berdasarkan waktu](https://scikit-learn.org/stable/modules/generated/sklearn.model_selection.TimeSeriesSplit.html). Implementasi proyek tidak menggunakan scikit-learn.

## Dataset yang diperlukan

Periksa ledger akun terlebih dahulu dengan `npm run forecast -- readiness`. Audit membedakan baris bernilai nol dari tanggal tanpa baris, memperlihatkan cakupan 14 hari input, kandidat periode dan registry. Keberadaan rentang 84 hari tidak otomatis membuktikan pencatatan lengkap atau mengizinkan training. Panduan: [FORECAST_READINESS.md](FORECAST_READINESS.md).

Minimal **84 tanggal harian berurutan**, satu bahan, satu usaha, satu satuan. Ini batas teknis awal, bukan jaminan mutu model. Jumlah merupakan pemakaian bahan dari transaksi yang telah dikonfirmasi, bukan omzet atau jumlah stok tersisa. Data saat hari berjalan tidak digunakan. Kuantitas tidak negatif, maksimal empat angka desimal.

Template kosong tersedia di `datasets/templates/daily-usage.csv` dan `datasets/templates/metadata.json`. Salin ke `datasets/private/`, isi data sebenarnya dan metadata sumber/izin. Jangan mengubah template menjadi contoh bisnis fiktif. Sumber `user_records`, referensi sumber/izin, permissionConfirmed dan completeDailyRecords harus diisi sesuai keadaan. Dataset belum terverifikasi sebagai data lapangan hanya karena lolos schema.

CSV wajib memakai header `date,quantity`, tanggal ISO dan angka desimal bertitik tanpa pemisah ribuan. Tidak ada kolom tambahan/format kutip kompleks. Tanggal hilang dan duplikasi ditolak. Isi nol hanya jika benar-benar sudah dipastikan tidak ada pemakaian pada hari itu. Tidak dilakukan interpolasi atau pembangkitan histori untuk melengkapi minimum pelatihan.

Identitas kelompok/usaha/bahan dan satuan diperoleh dari data aplikasi:

```powershell
npm run forecast -- sources
```

Perintah tersebut membaca SQLite tanpa mengubahnya dan tidak menampilkan kata sandi/email. Jika hasil sources kosong, daftarkan usaha dan bahan terlebih dahulu. Untuk data CSV dari catatan luar aplikasi, isi identitas sesuai bahan akun yang akan memakai model; impor CSV ini **tidak** mengubah transaksi atau ledger stok aplikasi.

## Impor dan pelatihan

Setelah file nyata beserta metadata siap, jalankan:

```powershell
npm run forecast -- import --csv datasets/private/daily-usage.csv --metadata datasets/private/metadata.json --out datasets/private/training.json
npm run forecast -- train --dataset datasets/private/training.json
```

Tidak ada dataset bawaan. File keluaran yang sudah ada tidak ditimpa. Default pelatihan membuat folder run baru di `models/forecast/runs/`. Folder dataset pribadi dan artefak model diabaikan Git; tetap simpan backup sendiri bila diperlukan.

Jika histori aplikasi sudah cukup, ekspor read-only dengan ID dan tanggal yang benar:

```powershell
npm run forecast -- export --workspace ID_KELOMPOK --business ID_USAHA --product ID_BAHAN --from TANGGAL_AWAL --to TANGGAL_AKHIR --reference "REFERENSI_SUMBER_DAN_IZIN" --confirm-records --out datasets/private/training.json
```

Ganti seluruh placeholder dengan data sendiri. Tanggal akhir harus sebelum hari ini, tanggal awal tidak boleh mendahului pemakaian pertama. Flag confirm-records menyatakan izin dan pencatatan lengkap selama periode tersebut; tanggal tanpa pemakaian di dalam periode yang dikonfirmasi dihitung nol. Bila periode sebenarnya tidak dicatat lengkap, jangan gunakan flag itu dan kumpulkan/perbaiki data terlebih dahulu. Database aktif tidak diubah oleh ekspor, impor CSV, pelatihan atau aktivasi model.

## Evaluasi dan pencegahan kebocoran waktu

Sesudah 14 hari awal untuk membentuk lag, target dua hari dibuat dengan langkah dua hari sehingga label antartarget tidak bertumpuk. Tujuh origin terakhir menjadi test (14 hari), tujuh sebelumnya validasi (14 hari), sisanya train. Pada dataset minimum 84 hari, terdapat 21 origin train, 7 validasi, 7 test.

Sepuluh eksperimen berasal dari dua varian fitur × alpha 0.01/0.1/1/10/100. Masing-masing fit pada train dan dinilai pada validasi. Setelah varian/alpha dipilih, bobot final dilatih ulang pada train+validasi. **Test tidak dipakai untuk memilih parameter atau fitting bobot.** Bobot tidak dilatih ulang setelah melihat hasil test.

Pada setiap origin test, fitur boleh memakai catatan aktual hari-hari sebelumnya yang sudah teramati. Model tetap memakai bobot yang sama pada blok test: ini evaluasi origin bergulir dengan bobot tetap, bukan refit pada setiap origin. Hasil dilaporkan untuk target total dua hari yang sama bagi model dan kedua baseline: dua kali nilai hari terakhir, serta dua kali rata-rata tujuh hari.

Metrik: MAE dalam satuan bahan per dua hari; WAPE = jumlah galat absolut / jumlah target aktual, null saat seluruh target nol. Hasil tidak digabung lintas satuan. Model hanya qualified bila MAE test **lebih rendah dari kedua baseline**. Hasil seri konstan/nol yang sudah diprediksi sempurna oleh baseline tidak dianggap model lebih baik. Test dipakai sebagai pemeriksaan kelayakan rilis, bukan dasar penyetelan ulang; eksperimen berulang terhadap test yang sama harus dicatat dan memerlukan holdout baru untuk klaim independen.

## Artefak dan aktivasi

`model.json` memuat koefisien, standardisasi, identitas/satuan, horizon, hash dataset, sumber/izin, rentang train/validasi/test dan hasil evaluasi. `evaluation.json` memuat eksperimen, ablation dan rincian error tiap origin. Jangan mengubah angka agar lolos. Checksum registry menjaga perubahan file setelah aktivasi; ini bukan sertifikasi kebenaran data atau perlindungan dari operator yang mengedit seluruh artefak.

Setelah meninjau hasil, aktivasi lokal menggunakan path artefak sebenarnya:

```powershell
npm run forecast -- activate --artifact models/forecast/runs/NAMA_RUN/model.json
```

Aktivasi ditolak bila model tidak lolos, metrik tidak cocok dengan rincian error, atau artefak di luar direktori model. Registry hanya memasangkan model ke kelompok/usaha/bahan/satuan asal. Model akun lain tidak dibagikan otomatis. File registry ditulis atomik; jalankan aktivasi satu per satu.

Saran kulakan memuat model tanpa restart server. Model dipakai hanya setelah tanggal akhir dataset/evaluasi, untuk horizon dua hari dan minimal 14 hari histori ledger sebelum prediksi. Dataset impor tidak otomatis menjadi histori ledger. Jika kondisi belum terpenuhi, model hilang/rusak, atau belum aktif, aplikasi memakai baseline yang tersedia atau menampilkan belum cukup histori. Tidak ada retraining otomatis. Sumber prediksi ditampilkan pada layar Saran kulakan.

API juga menyertakan `historyQuality`, termasuk jumlah nol asumsi pada input model dan ringkasan perubahan tujuh hari. Metadata ini belum mengubah aturan aktivasi/inferensi dan bukan bukti verifikasi kelengkapan. Keputusan pemilik tentang pencatatan lengkap tetap diperlukan; perubahan rata-rata belum menjadi deteksi drift yang tervalidasi.

Rentang model memakai MAE validasi target dua hari sebagai spread heuristik; bukan interval probabilistik terkalibrasi. Stok tersedia dikurangi setelah prediksi kebutuhan. Kalender libur/cuaca, lost sales ketika stok kosong, waktu tunggu pemasok dan retraining terjadwal belum dimodelkan. Penyaring kandidat anomali median/MAD tersedia terpisah melalui CLI sejak v0.26; belum dilatih/divalidasi dan tidak mengubah forecasting. [Aturan dan batas](USAGE_ANOMALIES.md).

## Bukti dan pekerjaan tersisa

`npm run test:ml` menjalankan uji matematika/pipeline dengan fixture sintetis **hanya dalam proses/file sementara**. Uji mencakup ketepatan regresi, perubahan test tanpa perubahan bobot, split tanpa overlap, izin/gap data, model tidak lolos, checksum, scope, ekspor read-only, artefak hilang dan integrasi bootstrap. Keberhasilan tes tersebut bukan akurasi pada UMKM nyata.

Pencarian dataset publik berizin, pelatihan nyata, error analysis v1 dan eksperimen perbaikan v2 sudah selesai. Pekerjaan berikutnya ada di [AI_TODO.md](AI_TODO.md): replikasi pada periode/domain lain, validasi pilot usaha Indonesia, dataset/evaluasi ekstraksi chat, serta fitur AI proposal lainnya. Hasil publik tidak dipindahkan menjadi klaim keberhasilan lapangan pengguna aplikasi.

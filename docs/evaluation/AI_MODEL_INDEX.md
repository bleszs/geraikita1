# Integrasi runtime v0.50

Sinkronisasi `rahasiagelap3.0` mempertahankan seluruh model dan artefak pelatihan sebelumnya. Kasir baru memakai kontrak ekstraksi katalog/kuota yang sama; tidak ada fine-tuning, bobot baru atau skor akurasi lapangan baru. Delapan pemeriksaan Qwen 1.5B/Whisper Tiny asli lulus secara lokal pada SQLite memori. [Bukti runtime](branch-sync-v50-runtime.json) dan [rincian integrasi](../BRANCH_SYNC_V50.md). Catatan versi berikut merupakan riwayat.

# Lokasi model AI yang sudah dilatih

V0.49 memperbaiki bukti jumlah pesanan serta waktu tunggu klien AI dapur. Tidak menambah artefak, training atau fine-tuning; status bobot v0.48 berikut tetap berlaku. [Perubahan dan batas](../AI_QUANTITY_VALIDATION.md).

**Terbaru v0.48:** Qwen/Whisper tetap pralatih, tanpa bobot atau fine-tuning baru. Perbaikan retensi catatan dan evaluator bukan training. Eksperimen forecasting publik tetap 504 Ridge dan dua boosting; belum menjadi model khusus usaha pengguna yang tervalidasi. [Kapan perlu melatih](../AI_TRAINING_DECISIONS.md), [evaluasi chat schema 2](../CHAT_EVALUATION.md). Riwayat berikut menyimpan hasil eksperimen beserta batasnya.

V0.31 tidak menambah training atau bobot. Diagnostik 24 transkripsi pada dua klip publik lama dan 36 replay decoder kembali menemukan dua versi teks pada Base pinned plain. Semua capture/replay cocok pada pengulangan yang diamati; penyebab/perbaikan belum dilokalisasi dan default tetap Tiny. Jumlah forecasting tetap 504 Ridge dan dua boosting. [Hasil baru](ASR_DECODER_RESULTS.md), [metode](../ASR_DECODER.md).

V0.27 menampilkan pemeriksaan pemakaian di API akun dan panel Saran kulakan. Tidak ada model, training atau bobot baru: aturan statistik v0.26 tetap sama, belum mempunyai skor anomali lapangan. Total forecasting tetap 504 Ridge dan dua boosting; Whisper/Qwen tetap pretrained. [Panduan panel](../USAGE_REVIEW.md), [bukti rilis](usage-review-release.json).

V0.26 menambah penyaring kandidat anomali median/MAD tanpa training atau bobot baru. Aturan ada di `server/ml/usage-anomalies.mjs`; jalankan `npm run forecast:anomalies`. Ini heuristik review yang belum divalidasi dengan label lapangan; jumlah model forecasting tetap 504 Ridge dan dua boosting. [Aturan dan batas](../USAGE_ANOMALIES.md), [pemeriksaan ledger aktif](usage-anomalies-release.json).

V0.25 tidak menambah bobot/training. Base pretrained yang sama dapat dipilih lewat `npm run start:base` pada port 4176, tanpa mengganti default Tiny. Smoke HTTP menambah bukti variasi yang tetap disimpan; kandidat belum lulus promosi otomatis. Model forecasting tetap 504 Ridge dan dua boosting. [Cara menjalankan](../RUNTIME_SPEECH.md), [bukti awal](runtime-speech-smoke-first.json).
V0.24 menambah profil kandidat, bukan bobot terlatih baru. Base pinned dipilih lewat 16 validation sebelum 24 test baru: WER test **36,99%** vs Tiny current **86,59%**; Tiny pinned lebih buruk **97,36%**. 24 pengulangan pada dua klip per profil cocok termasuk baseline, tanpa membuktikan penyebab/perbaikan variasi. **Aplikasi tetap memakai Tiny, kandidat belum dipromosikan.** Seluruhnya pretrained; jumlah forecasting tetap 504 Ridge dan dua boosting. [Hasil](ASR_PROFILE_RESULTS.md), [adapter/metode](../ASR_PROFILES.md).
V0.23 mempertahankan seluruh bobot dan jumlah model. Tindak lanjut ASR menambah 68 inferensi diagnostik dan 112 pemeriksaan kernel, melokalisasi sensitivitas OpenBLAS ke proyeksi mel; belum ada perbaikan atau promosi yang tervalidasi. [Hasil](ASR_FOLLOWUP_RESULTS.md).

V0.22 menambah **diagnostik**, tanpa artefak model terlatih atau aktivasi baru. 136 inferensi dengan hash tahap/kontrol komputasi menunjukkan sensitivitas fitur/transkrip, tetapi belum menyelesaikan variasi konfigurasi tetap. Seluruh model dan jumlah 504 Ridge/dua boosting dipertahankan. [Hasil/bukti](ASR_STABILITY_RESULTS.md).

## Kandidat ASR Base — v0.21, belum dipromosikan

Base multilingual pretrained tersedia di [model.bin](../../models/speech/whisper-base/model.bin), [manifest](../../models/speech/whisper-base/manifest.json), dan [source lock](../../models/speech-base-source.json). Pada 16 validation / 48 test baru, Base dipilih lewat validation; satu-run test WER 36,36% vs Tiny 66,93%, CER 13,74% vs 31,72%. **Repeat inferensi belum stabil (3/4 transkrip berbeda)** walaupun audit data/skor lulus. Model aplikasi tetap Tiny; Base belum menjadi model hasil fine-tuning tim atau kandidat yang lulus promosi. [Seluruh hasil/prediksi](ASR_COMPARISON_RESULTS.md), [bukti repeat](asr-comparison-reproducibility.json), [metode](../ASR_COMPARISON.md).

## Model suara pretrained lokal — v0.19

Evaluasi v0.20 pada 64 rekaman nyata FLEURS Indonesia menghasilkan WER **67,27%**, CER **27,64%**, exact match **0/64**, dengan enam penolakan tetap dinilai. Model tidak dilatih/ditukar setelah test; hasil belum menunjukkan pengenalan andal dan bukan validasi pesanan UMKM. [Prediksi, skor dan sumber run](FLEURS_ASR_RESULTS.md), [reproduksi](fleurs-asr-reproducibility.json).

Whisper Tiny multilingual tersedia di [model.bin](../../models/speech/whisper-tiny/model.bin), dengan [manifest checksum](../../models/speech/whisper-tiny/manifest.json) dan [source lock revisi](../../models/speech-source.json). Inferensi memakai faster-whisper CPU int8, terpisah dari Qwen/Ollama dan model Ridge/boosting di bawah. Ini **pretrained, belum fine-tune**, dan belum ada skor akurasi ASR lapangan. Jumlah artefak forecasting yang dilatih tetap 504 Ridge dan dua boosting. [Panduan penggunaan dan bukti teknis](../VOICE_BOOKKEEPING.md).

## Transfer sales-only terbaru: hasil belum mengalahkan baseline

Satu **model boosting tambahan** dipelajari hanya dari 500 seri / 19.000 target FreshRetailNet. Fitur stockout dan log level absolut dihapus sebelum training agar sesuai dengan data target. Bobot final ditransfer tetap ke 10 kelompok negara UCI yang belum dinilai pada replikasi Ridge, tanpa fitting atau tuning di UCI. Kalender UCI sudah diketahui.

- [Model terlatih sales-only (.joblib)](../../models/benchmarks/boosting-transfer/2026-10-15T06-43-36Z-fc59f6b9/sales-only-model.joblib).
- [Metadata, fitur, konfigurasi dan checksum](../../models/benchmarks/boosting-transfer/2026-10-15T06-43-36Z-fc59f6b9/model-metadata.json).
- [Seluruh kandidat validasi sumber](../../models/benchmarks/boosting-transfer/2026-10-15T06-43-36Z-fc59f6b9/validation.json).
- [190 prediksi beserta label aktual](../../models/benchmarks/boosting-transfer/2026-10-15T06-43-36Z-fc59f6b9/predictions.csv).
- [Hasil](BOOSTING_TRANSFER_RESULTS.md), [analisis kegagalan](BOOSTING_TRANSFER_ERROR_ANALYSIS.md), [bukti reproduksi](boosting-transfer-reproducibility.json).

Metrik utama mean-country WAPE: model **173,00%**, MA7 **165,12%**, MA14 **156,51%**. Hasil tidak mendukung penerapan lintas domain; model tetap artefak eksperimen publik dan tidak diaktifkan untuk akun. Ini varian baru, belum menguji bobot v2 asli. Total artefak kini **504 Ridge dan 2 boosting**, dengan data training FreshRetailNet yang dipakai kembali untuk eksperimen berbeda, bukan 38.000 target unik. [Panduan](../BOOSTING_TRANSFER.md).

## Replikasi sumber berbeda: UCI Online Retail

Ada **empat artefak Ridge tambahan**, dilatih ulang dari **1.336 agregat harian nyata** (334 hari × empat negara). Ini replikasi algoritme Ridge pada domain/kalender 2010–2011, bukan transfer bobot boosting FreshRetailNet. Model publik tetap terpisah dari akun pengguna.

- [Folder empat model UCI](../../models/benchmarks/uci-online-retail/2026-10-15T06-29-42-482Z-b034a708/series/).
- [Manifest dan sumber per run](../../models/benchmarks/uci-online-retail/2026-10-15T06-29-42-482Z-b034a708/preparation-manifest.json).
- [76 prediksi, label dan skala sumber](../../models/benchmarks/uci-online-retail/2026-10-15T06-29-42-482Z-b034a708/predictions.csv).
- [Hasil UCI](UCI_RETAIL_RESULTS.md), [analisis error](UCI_RETAIL_ERROR_ANALYSIS.md), [bukti reproduksi](uci-retail-reproducibility.json).

WAPE ternormalisasi Ridge 54,41% dibanding MA7 62,99%. Pada unit asli, Ridge 32,92% kalah dari pola mingguan 24,92%; Inggris mendominasi volume. Jangan menyatakan menang dari seluruh baseline atau membandingkan angka ini langsung dengan FreshRetailNet. Qwen tetap pretrained.

## Model gabungan FreshRetailNet v2

Model gabungan v2 adalah **HistGradientBoostingRegressor**, dilatih dari 19.000 target dua hari nyata pada 500 seri. Pada 200 toko di luar pengembangan, WAPE 24,83% dibanding MA7 27,04% pada test yang sama. Ini satu model yang mempelajari pola lintas seri; seluruh 500 model Ridge sebelumnya tetap disimpan.

- [Model terlatih v2 (.joblib)](../../models/benchmarks/freshretailnet-v2/2026-10-15T05-29-16Z-d1f901c0/pooled-model.joblib).
- [Metadata fitur, konfigurasi dan checksum](../../models/benchmarks/freshretailnet-v2/2026-10-15T05-29-16Z-d1f901c0/model-metadata.json).
- [Seluruh kandidat validasi](../../models/benchmarks/freshretailnet-v2/2026-10-15T05-29-16Z-d1f901c0/validation.json).
- [Seluruh 600 prediksi dan label nyata](../../models/benchmarks/freshretailnet-v2/2026-10-15T05-29-16Z-d1f901c0/predictions.csv).
- [Laporan v2](FRESHRETAILNET_V2_RESULTS.md) dan [reproduksi 600 prediksi identik](freshretailnet-v2-reproducibility.json).

Bobot v2 berada di pohon dalam file joblib, bukan array koefisien Ridge. `npm run verify:pooled` memuat model tersebut, melatih ulang konfigurasi tetap dari sumber, dan membandingkan seluruh prediksi. Model hanya benchmark publik; tidak digunakan pada akun usaha. Tanggal test sama dengan v1 sehingga klaimnya terbatas pada toko baru, bukan periode baru. [Prosedur reproduksi](../AI_TRAINING.md).

## Arsip eksperimen Ridge v1

Ada **500 artefak Ridge terlatih dari data nyata publik**, masing-masing untuk satu seri toko–produk FreshRetailNet-50K. Ini bukan file Qwen, bukan prediksi hardcode, dan bukan dataset buatan.

- [Contoh artefak pertama dalam urutan hash sampel](../../models/benchmarks/freshretailnet/2026-10-15T05-14-08-079Z-70b4caa7/series/city-0-store-343-product-487.model.json) — pemilihan contoh tidak berdasarkan skor terbaik.
- [Folder seluruh model](../../models/benchmarks/freshretailnet/2026-10-15T05-14-08-079Z-70b4caa7/series/).
- [Report lengkap](../../models/benchmarks/freshretailnet/2026-10-15T05-14-08-079Z-70b4caa7/report.json).
- [Rincian error CSV](../../models/benchmarks/freshretailnet/2026-10-15T05-14-08-079Z-70b4caa7/errors.csv).
- [Ringkasan hasil](FRESHRETAILNET_RESULTS.md).
- [Bukti reproduksi](freshretailnet-reproducibility.json): 500 model menghasilkan bobot/scaler/prediksi yang sama ketika diulang.

Dalam artefak Ridge v1: model.weights adalah koefisien hasil fitting, means/scales adalah normalisasi hasil fitting, intercept adalah intercept terlatih. datasetHash dan provenance menunjuk data sumber; training dan evaluation menjelaskan pemisahan tanggal serta skor. Artefak Ridge disimpan sebagai JSON portabel; model boosting v2 memakai joblib.

Ridge kalah dari rata-rata tujuh hari secara agregat pada test eksternal. Seluruh model, termasuk yang kalah, tetap disimpan. Model publik tidak dimasukkan ke registry akun dan tidak menambah stok/transaksi pengguna. Qwen2.5 1.5B tetap model bahasa pretrained yang terpisah.

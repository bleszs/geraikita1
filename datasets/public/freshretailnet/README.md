# FreshRetailNet-50K — sumber publik nyata

Penerbit: **Dingdong-Inc**. Dataset resmi: https://huggingface.co/datasets/Dingdong-Inc/FreshRetailNet-50K. Lisensi: **CC BY 4.0**, https://creativecommons.org/licenses/by/4.0/. Makalah: https://arxiv.org/abs/2505.16319.

Wang, Yangyang; Gu, Jiawei; Long, Li; Li, Xin; Shen, Li; Fu, Zhouyu; Zhou, Xiangjun; Jiang, Xu (2025). *FreshRetailNet-50K: A Stockout-Annotated Censored Demand Dataset for Latent Demand Recovery and Forecasting in Fresh Retail*. Dingdong-Inc. Atribusi ini dan tautan sumber/lisensi harus menyertai penggunaan ulang data turunan/hasil proyek.

Revisi yang dipakai: `c374e85975c82816c495acfa904cc55ab14a47d3`. URL dan SHA256 file asli ada di [protocol.json](../../../benchmarks/freshretailnet/protocol.json). Unduhan diverifikasi terhadap checksum penerbit pada Hugging Face. Salinan dataset card asli tersimpan pada raw/SOURCE_README.md; file parquet tidak dimasukkan Git karena ukurannya.

Penerbit menyediakan 4.500.000 baris train dan 350.000 baris eval. Eksperimen v1 memakai 500 dari 50.000 pasangan toko–produk, dipilih berdasarkan hash ID sebelum melihat hasil, dengan 90 hari train dan tujuh hari eval per pasangan. V2 tetap belajar dari 500 seri tersebut dan menambahkan 200 seri dari toko yang seluruhnya terpisah sebagai holdout. Keduanya memakai subset, bukan benchmark penuh atau data UMKM Indonesia.

Target `sale_amount` adalah penjualan dalam skala normalisasi sumber. Nilai float dipertahankan, tidak diubah ke rupiah, buah, gram atau resep bahan. Tidak ada tanggal yang diisi nol, interpolasi, penggantian seri yang hasilnya buruk, atau fallback sintetis. Pada v1, tanda stockout hanya untuk analisis error. V2 juga memakai proporsi stockout **masa lalu** sebagai fitur; stockout pada horizon target hanya untuk strata laporan, tidak masuk fitur. Penjualan teramati tidak diperlakukan sebagai permintaan laten yang sudah dipulihkan.

Transformasi: proyeksi kolom identitas/tanggal/target/stockout, pemilihan ID deterministik, pemisahan per toko–produk, validasi kontinuitas, serta serialisasi ke schema publik `benchmark_only`. Seluruh file turunan berasal dari baris asli. data/gerai-kita-live.sqlite tidak dibaca atau diisi oleh skrip benchmark.

Hasil: FRESHRETAILNET_RESULTS.md. Protokol tetap disimpan sebelum pelatihan dan tidak disetel ulang berdasarkan test eksternal. Seluruh 500 model disimpan, termasuk yang kalah dari baseline. Dataset bukan data pengguna aplikasi; registry akun menolak aktivasi model publik.

V2 menggunakan [protokol terpisah](../../../benchmarks/freshretailnet/protocol-v2.json): pooled residual boosting, validasi kronologis, lalu pengujian 200 toko yang tidak ikut pengembangan. WAPE 24,83% dibanding MA7 27,04% pada test yang sama. Kalender test masih sama dengan v1, sehingga ini bukti transfer toko, bukan replikasi waktu yang sepenuhnya baru. Hasil v2 dan artefak.

## Reproduksi

```powershell
python -m venv .venv-ml
.\.venv-ml\Scripts\python.exe -m pip install -r requirements-ml.txt
.\.venv-ml\Scripts\python.exe scripts/fetch-freshretailnet.py
npm run benchmark:fresh
# Eksperimen v2 dan verifikasi konfigurasi tetap:
npm run test:pooled
npm run benchmark:pooled
npm run verify:pooled
```

Unduhan total sekitar 115 MB. DuckDB dipasang hanya di lingkungan Python lokal; runtime aplikasi tetap Node. File asli yang sudah ada diverifikasi kembali dan tidak diunduh ulang. Setiap run pelatihan menulis folder baru di models/benchmarks/freshretailnet. Tanggal/path run dapat berubah, sementara pemilihan seri, bobot dan metrik dapat direproduksi dari revisi dan protokol yang sama.

Kandidat lain yang ditinjau: UCI Daily Demand Forecasting Orders hanya memiliki 60 observasi, di bawah protokol 84 hari proyek; UCI Online Retail berlisensi jelas tetapi menjual barang hadiah; French Bakery di Kaggle menampilkan lisensi data milik penulis asli sehingga tidak dipilih untuk run ini. FreshRetailNet dipilih karena sumber asli, lisensi dataset eksplisit dan domain produk segar, bukan karena hasil modelnya lebih baik.

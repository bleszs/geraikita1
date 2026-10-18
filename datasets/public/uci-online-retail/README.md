# UCI Online Retail — replikasi metode Ridge

Sumber resmi: [UCI Online Retail](https://archive.ics.uci.edu/dataset/352/online+retail). Chen, D. (2015). *Online Retail* [Dataset]. DOI [10.24432/C5BW33](https://doi.org/10.24432/C5BW33). Lisensi **CC BY 4.0**. Data berasal dari peritel online Inggris yang menjual barang hadiah dan melayani banyak pelanggan grosir. Bukan catatan UMKM makanan Indonesia.

File asli diunduh dari URL ZIP resmi UCI, bukan data contoh. Jumlah baris sumber: **541.909**. SHA256 workbook: `43465a06f2ccf7c8b5bd2892bc7defb52f97487934fe93b16ae4c3936424676d`. SHA256 archive: `f5385cbb54bbebf7196389109c6b0621faab0c304e3702548165e71c84aede8b`.

Checksum dihitung dan dipatok **secara lokal sebelum parsing**; UCI tidak dinyatakan menerbitkan checksum ini. `sourceRevision` pada schema model menggunakan SHA1 konten workbook, bukan revisi Git; metadata mencantumkan `sourceRevisionType`. [Source lock](../../../benchmarks/uci-online-retail/source-lock.json), [protokol](../../../benchmarks/uci-online-retail/protocol.json).

## Transformasi yang dibekukan

Target adalah jumlah `Quantity` positif pada invoice non-cancel, harga positif dan kode produk yang lolos regex protokol, dikelompokkan menurut negara dan tanggal. Duplikasi baris sumber dipertahankan; tidak ada rekonsiliasi retur terhadap pesanan terdahulu. Kolom CustomerID dan Description tidak digunakan/disalin ke file turunan.

Tanggal awal/akhir cakupan penerbit dikeluarkan karena mungkin parsial. Development 2 Desember 2010–31 Oktober 2011 (334 hari), test eksternal 1 November–8 Desember 2011 (38 hari). Semua negara dengan minimal 100 tanggal penjualan aktif dan 1.000 unit pada **development**, serta skala awal positif, dipilih tanpa melihat hasil test. Hanya **empat negara** memenuhi kriteria: EIRE, France, Germany dan United Kingdom; ambang tidak dilonggarkan.

Nol merupakan SUM kosong atas event log yang dipublikasikan pada suatu negara/tanggal: tidak ada event cocok di sumber. Ini tidak membuat transaksi, tidak memperkirakan latent demand dan tidak membuktikan tidak ada permintaan nyata. Terdapat **590 tanggal agregat kosong development dan 36 eksternal** untuk empat negara. Kebijakan ini berbeda dari memperlakukan hari ledger pengguna yang belum tercatat sebagai pencatatan lengkap.

Setiap seri dibagi dengan rata-rata **84 tanggal development pertama**, jauh sebelum validasi/test. Model tetap memakai `normalized_sales` sebagai target turunan tanpa membulatkan rasio; laporan juga menghitung galat setelah inverse scaling ke unit invoice. Satuan ini tidak dipetakan ke buah/gram atau kebutuhan bahan pengguna.

Empat model dilatih dengan pipeline Ridge yang sama pada `server/ml/forecast-model.mjs`. Fitur/alpha dipilih pada validasi kronologis; tujuh origin terakhir development tetap test internal. Semua artefak ditulis sebelum file target eksternal dibaca oleh trainer. Ini **replikasi metode dengan training ulang**, bukan transfer bobot boosting FreshRetailNet atau angka yang dapat dibandingkan langsung lintas dataset.

## Hasil dan reproduksi

Primary pooled WAPE ternormalisasi: Ridge **54,41%**, MA7 **62,99%**, galat relatif turun **13,62%**. Dalam unit asli, Ridge **32,92%** kalah dari pola mingguan **24,92%**; Inggris menyumbang **93,54%** target raw. Seluruh metode/negara/target tetap dilaporkan.

```powershell
.\.venv-ml\Scripts\python.exe -m pip install -r requirements-ml.txt
npm run prepare:uci
npm run test:uci
npm run benchmark:uci
# Preparasi ulang dari workbook yang sama dan verifikasi hasil:
npm run prepare:uci
npm run verify:uci
```

Preparasi memakai openpyxl dalam lingkungan Python terpisah. Training tetap Node. Sumber sudah diunduh pada laptop ini; run berikutnya memeriksa source lock dan tidak mengunduh ulang. Bila unduhan awal gagal karena timeout, berkas parsial bukan data sah: jangan menjalankan training sampai ZIP asli lengkap dan preparasi lolos pemeriksaan row count/header/checksum. Jangan melewati pemeriksaan TLS atau mengganti sumber dengan data buatan.

Setiap preparasi dan training membuat direktori baru. Index processed menunjuk preparasi terbaru, sedangkan manifest/protokol/hash pada run model tetap disimpan. `verify:uci` membandingkan hasil preparasi ulang, memeriksa hash sumber/kode, melatih ulang dengan konfigurasi protokol yang sama dan mencocokkan bobot/scaler/76 prediksi. Test kini sudah terlihat; pengulangan adalah reproduksi, bukan test independen baru.

Raw, processed dan model diabaikan Git. Artefak publik tidak diaktifkan untuk akun dan skrip tidak membaca/menulis SQLite aplikasi. Laporan, analisis error, indeks model.

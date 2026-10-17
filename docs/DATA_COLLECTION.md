# Mengumpulkan data untuk pelatihan

**Chat/suara berbeda dari histori penjualan.** Qwen/Whisper pralatih perlu dievaluasi dahulu; tidak harus dilatih ulang untuk mulai dipakai. Template chat schema 2 dan [panduan anotasi](CHAT_EVALUATION.md) memisahkan menu/jumlah dari catatan wajib per item. Pesan dan izin harus nyata; fixture otomatis bukan pengganti. [Keputusan pelatihan](AI_TRAINING_DECISIONS.md).

Dataset nyata publik FreshRetailNet-50K sudah ditemukan dan dipakai melatih 500 model Ridge serta satu model gabungan boosting; lihat evaluation/AI_MODEL_INDEX.md. Pengumpulan dataset pribadi bukan lagi prasyarat eksperimen publik tersebut. Panduan ini khusus untuk validasi/pelatihan akun usaha sendiri. Mulai dari catatan nyata; jangan mengisi 84 hari dengan angka buatan. Batas 84 hari adalah kebutuhan protokol awal proyek, bukan aturan semua model AI selalu memerlukan jumlah tersebut.

## Apa yang dicatat

Satu dataset berisi satu bahan, satu usaha, satu satuan stok, serta dua kolom: date dan quantity. Date adalah tanggal usaha menurut Asia/Jakarta. Quantity adalah total bahan yang dipakai oleh transaksi terkonfirmasi pada tanggal tersebut, setelah pembatalan/koreksi, dalam satuan bahan. Bukan omzet, harga, penerimaan, atau saldo stok.

Di aplikasi: daftarkan bahan → catat barang yang benar-benar diterima → buat menu beserta resep per porsi → konfirmasi penjualan sebenarnya. Ledger pemakaian terbentuk dari resep saat transaksi dibuat. Periksa resep/satuan sebelum mencatat. Jangan mencatat penjualan fiktif hanya untuk membuat histori.

## Jika mempunyai arsip catatan lama

Gunakan arsip POS, buku penjualan, atau rekap usaha yang pemiliknya mengizinkan penggunaan tersebut. Bila arsip berupa jumlah menu, konversi ke bahan hanya jika resep dan satuan pada tanggal terkait dapat dipastikan. Jangan menerapkan resep hari ini ke seluruh masa lalu tanpa pemeriksaan. Hapus identitas pelanggan yang tidak diperlukan.

Salin template kosong datasets/templates/daily-usage.csv dan metadata.json ke datasets/private. Isi referensi sumber dan izin, identitas bahan/akun yang sesuai, dan rentang tanggal yang lengkap. File dengan tanggal terputus ditolak. Nol berarti sudah diperiksa tidak ada pemakaian, bukan belum diketahui. Bila arsip tidak lengkap, tandai sebagai pekerjaan pengumpulan dan jangan mengubahnya menjadi dataset lengkap dengan perkiraan.

## Jika belum mempunyai arsip

Mulai pencatatan harian dan tinjau kelengkapannya. Jangan menunggu layar model berubah sebelum mencatat transaksi: baseline baru muncul setelah histori cukup, dan pelatihan terpisah dilakukan setelah dataset lengkap tersedia. Untuk final yang waktunya dekat, arsip usaha yang sudah ada secara berizin merupakan jalur yang masuk akal; jika tidak tersedia, jelaskan bahwa model bisnis belum dilatih. Menampilkan kode pipeline dan hasil tes terisolasi tidak sama dengan hasil pelatihan lapangan.

Ekspor histori ledger tersedia melalui perintah forecast export; langkah dan konfirmasi periode lengkap ada di [AI_TRAINING.md](AI_TRAINING.md). Ekspor tidak mengubah stok/transaksi. Simpan file secara privat dan berikan lokasi file kepada asisten ketika ingin menjalankan validasi/pelatihan. Bila kurang dari 84 hari, pipeline akan memberi pesan kurang data; tidak membuat tanggal/jumlah pengganti.

## Pemeriksaan sebelum training

Jalankan `npm run forecast -- readiness` untuk audit read-only sebelum memilih periode ekspor. Tanggal tanpa baris dibedakan dari nol tersimpan; laporan tidak menyatakan periode lengkap secara otomatis. [Panduan audit](FORECAST_READINESS.md).

- Catatan berasal dari usaha sebenarnya dan boleh dipakai untuk tujuan ini.
- Nama bahan/satuan/identitas akun konsisten selama periode dataset.
- Tanggal berurutan dan kelengkapan periode telah diperiksa; hari tanpa penjualan dibedakan dari hari tidak tercatat.
- Pembatalan/koreksi tercermin; penerimaan stok tidak dianggap permintaan.
- Kehabisan stok dan penjualan yang tidak tercatat dicatat sebagai keterbatasan. Model pemakaian dari penjualan tidak otomatis mengetahui permintaan yang hilang.

Setelah siap, ikuti impor → train → periksa evaluasi → activate pada panduan. Jika model tidak mengalahkan kedua baseline, simpan hasil eksperimennya dan gunakan baseline; jangan mengubah label/angka test agar lolos.

## Data chat untuk ekstraksi

Pengumpulan chat terpisah dari histori bahan. Template kosong `datasets/templates/chat-dataset.json` dan validator/evaluator sudah tersedia. Chat harus berasal dari percakapan nyata yang diizinkan, diredaksi dan diberi label manusia; seluruh pesan satu percakapan tetap dalam split yang sama. Belum ada dataset chat nyata yang dievaluasi. Panduan lengkap: [CHAT_EVALUATION.md](CHAT_EVALUATION.md).

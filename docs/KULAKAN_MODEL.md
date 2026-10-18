# Model kulakan yang benar-benar dilatih

Model baru `gerai-kulakan-sales-hgb-v1` dilatih pada 18 Oktober 2026. Ini HistGradientBoostingRegressor untuk memprediksi total dua hari dari 14 tanggal penjualan/pemakaian sebelumnya. Bobot berupa 160 pohon tersimpan di [artefak runtime](../server/ml/artifacts/kulakan-sales-v1.json); bukan jawaban Qwen atau angka prediksi yang ditulis ke tampilan. Inferensi berjalan di Node.js tanpa Python, Ollama, atau koneksi ke model luar.

## Data dan hasil

Sumber: [FreshRetailNet-50K milik Dingdong](https://huggingface.co/datasets/Dingdong-Inc/FreshRetailNet-50K), CC BY 4.0, revisi serta SHA-256 file sumber disimpan dalam artefak. Data publik adalah penjualan ritel yang dinormalisasi, bukan resep dan konsumsi bahan UMKM Indonesia.

Pelatihan memakai 500 seri dari 355 toko, 19.000 target dua hari. Delapan kandidat dipilih melalui 3.500 target validasi. Fitur: lag relatif, rata-rata, median, variasi, tren, proporsi nol dan kalender. Tidak memakai data stok kosong, cuaca, promosi atau informasi masa depan yang tidak tersedia di aplikasi.

Pengujian: 200 toko di luar toko pengembangan dan di luar 200 toko benchmark v2; 600 target dua hari pada 26 Juni–1 Juli 2024. Pembanding memakai target yang sama.

| Metode | MAE | WAPE |
|---|---:|---:|
| Model kulakan | 0,552624 | 25,68% |
| Rata-rata 7 hari | 0,589779 | 27,41% |
| Rata-rata 14 hari | 0,578117 | 26,87% |
| Nilai hari terakhir | 0,826250 | 38,40% |
| Hari sejenis minggu lalu | 0,696400 | 32,36% |

MAE model 6,30% lebih rendah dari rata-rata tujuh hari. WAPE adalah ukuran galat agregat, bukan “akurasi 74,32%”. Hasil ini belum membuktikan performa di UMKM Indonesia. Periode kalender pernah dipakai benchmark sebelumnya; pemisahan baru berada pada toko. Eksperimen transfer UCI yang gagal tetap berlaku dan tidak digantikan klaim keberhasilan lintas domain.

Ekspor awal gagal pemeriksaan kesamaan Python/Node akibat beda pembulatan fitur pada ambang pohon. Fitur lalu dikanonisasi ke 12 angka desimal dan model dilatih ulang dengan kandidat/protokol pemilihan yang sama. Tidak ada pencarian parameter berdasarkan skor test. Holdout yang sama dipakai ulang untuk perbaikan rekayasa ini, sehingga bukan pengujian pertama yang sepenuhnya belum pernah disentuh. Pada artefak final, 600 hasil Python/Node cocok dengan selisih maksimum 1,78 × 10⁻¹⁵. [Hasil lengkap](evaluation/kulakan-model-results.json), [verifikasi dari file mentah tanpa fit ulang](evaluation/kulakan-model-verification.json).

## Pemakaian dalam aplikasi

Buka **Saran kulakan → Model prediksi kulakan → Lihat hasil uji dan contoh prediksi nyata**. Tiga tanggal contoh berasal dari satu seri holdout yang dipilih melalui hash sebelum skor dilihat. Buka tanggal untuk membandingkan prediksi, rata-rata tujuh hari dan aktual, lalu buka masukan 14 hari. Prediksi dihitung ulang oleh server dari bobot model; aktual baru menjadi pembanding. Contoh memperlihatkan juga kesalahan model, bukan hanya kemenangan.

Contoh publik tetap memakai satuan penjualan ternormalisasi. Contoh tidak menjadi transaksi, stok, penjualan atau histori akun. Angka tidak dikonversi menjadi kg/butir tanpa data usaha.

Untuk bahan usaha sendiri:

1. Model global yang dilatih dari data publik menjadi kandidat, bukan model yang diklaim dilatih dari akun tersebut.
2. Perlu 42 tanggal pemakaian tercatat berurutan sampai kemarin. Ini memungkinkan 14 target backtest dua hari, masing-masing dengan konteks 14 tanggal. Tanggal hilang tidak otomatis diisi nol oleh model ini. Semua target evaluasi lokal harus sesudah periode pelatihan publik.
3. Model dipakai hanya bila MAE backtest lokal lebih kecil daripada MA7 dan dua kali nilai hari terakhir. Jika gagal, baseline tetap dipakai. Lolos backtest belum menjadi jaminan masa depan.
4. Prediksi pemakaian dikurangi **stok tersedia** yang sudah memperhitungkan cadangan dapur, lalu dibulatkan menurut satuan. Jumlah pembelian tidak boleh negatif. Rentang memakai MAE lokal, masih heuristik dan belum interval terkalibrasi.
5. Model Ridge khusus usaha yang sudah memenuhi syarat tetap didahulukan. Registry Ridge tetap menolak artefak benchmark publik; model global memakai jalur kandidat terpisah dan evaluasi lokal eksplisit.

Akun tanpa histori tidak menerima prediksi buatan. Minimum tujuh hari baseline lama dan asumsi tanggal kosongnya belum diubah oleh pekerjaan ini. Kebutuhan awal dari target produksi manual, konfirmasi hari tutup/nol dan impor histori usaha yang sah masih pekerjaan berikutnya.

## Reproduksi

Siapkan `.venv-ml` menurut `requirements-ml.txt` dan file sumber terverifikasi yang sudah diunduh melalui alur FreshRetailNet sebelumnya.

```powershell
npm run train:kulakan
npm run verify:kulakan
npm run test:kulakan
```

[Protokol](../benchmarks/kulakan/protocol.json) menetapkan pemisahan, salt pemilihan toko, delapan kandidat dan seed. Run lengkap, model Python, kandidat validasi, parity dan seluruh 600 prediksi tersedia di `models/benchmarks/kulakan/<run>/` lokal (diabaikan Git). Hanya artefak portable publik yang ikut source aplikasi; tidak perlu menyalin dataset atau database pengguna ke Docker. Reproduksi pemilihan toko saat ini juga membutuhkan manifest benchmark v1 dan selection v2 lokal; belum menjadi satu unduhan mandiri.

Runtime menerima input numerik dengan tanggal berurutan dan menolak input rusak. Tidak melakukan retraining otomatis atau menulis histori saat memprediksi. Langkah berikutnya yang bernilai: kumpulkan histori asli berizin, ukur backtest per bahan dan uji maju pada hari baru, lalu ukur dampak pada kehabisan bahan dan pembelian berlebih.

Deployment Railway `8b9e4ac2-8939-43ba-a136-da99d2abc83c` terverifikasi. [Bukti cloud](evaluation/kulakan-cloud-release.json), [review tampilan](evaluation/KULAKAN_UI_REVIEW.md). Dataset demo sintetis lama dikecualikan melalui metadata provenance; awalan nama `[DEMO]` juga dikenali untuk kompatibilitas demo lama. Ini mencegah histori simulasi menjadi bukti kualifikasi model usaha.

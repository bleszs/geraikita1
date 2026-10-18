# FLEURS bahasa Indonesia — evaluasi ASR publik

Sumber resmi: [google/fleurs](https://huggingface.co/datasets/google/fleurs), oleh Alexis Conneau, Min Ma, Simran Khanuja, Yu Zhang, Vera Axelrod, Siddharth Dalmia, Jason Riesa, Clara Rivera dan Ankur Bapna (2022). [Makalah FLEURS](https://arxiv.org/abs/2205.12446). Lisensi penerbit **CC BY 4.0**; penggunaan kembali harus menyertakan atribusi, sumber dan keterangan perubahan.

Rilis ini memakai hanya konfigurasi `id_id`, split `test` penerbit. [Protokol terpatok](../../../benchmarks/fleurs/protocol.json) mencatat revisi dataset card, revisi konversi Parquet Hugging Face, ukuran dan SHA256 shard. Tidak ada data pelanggan atau identitas usaha Gerai Kita di dalam sumber ini.

Perubahan dari sumber: pilih 64 rekaman melalui urutan hash nama berkas, lalu konversi representasi seluruh audio terpilih ke WAV PCM s16 mono 16 kHz. Tidak dilakukan pemotongan, perbaikan transkrip, normalisasi volume atau augmentasi. Referensi memakai kolom `transcription` penerbit; hasil model tidak dipakai untuk memilih sampel. Semua kegagalan terpilih tetap masuk evaluasi.

`raw/` dan `processed/` diabaikan Git karena memuat audio berukuran besar. Manifest menyimpan nama sumber, hash audio asli/konversi dan referensi untuk audit. Tidak ada impor ke SQLite aplikasi atau training/fine-tuning pada data ini.

Ini rekaman pembacaan teks umum, bukan percakapan pesanan, lingkungan kedai, data pengguna aplikasi, atau bukti uji mikrofon pemilik usaha. Pemisahan test oleh penerbit tidak membuktikan bebas overlap dengan data pretraining Whisper. Sampel ini menjadi test yang telah terlihat setelah run; tidak boleh digunakan untuk tuning lalu disebut test independen.

Perintah dan hasil: FLEURS_ASR.md.

# Apakah AI Gerai Kita harus dilatih?

**Tidak semua model perlu dilatih ulang.** Penggunaan AI pralatih untuk menyelesaikan pekerjaan nyata tetap merupakan penggunaan AI. Pelatihan ulang dipilih jika evaluasi menunjukkan kesalahan yang dapat diperbaiki dengan data yang sesuai. Mengganti prompt, menghubungkan katalog dan menambah validasi bukan pelatihan bobot.

| Bagian | Status proyek | Prioritas |
|---|---|---|
| Qwen2.5 1.5B: teks ke menu/jumlah | Pralatih; belum fine-tuning oleh tim | Uji chat Indonesia berizin: menu/jumlah, penolakan dan catatan wajib. Perbaiki hanya memakai data pengembangan. |
| Whisper Tiny: suara ke teks | Pralatih; belum fine-tuning. Base kandidat terpisah. | Uji rekaman pesanan berizin, kebisingan dan istilah menu; ukur transkripsi serta hasil pesanannya. |
| Ridge/boosting: ramalan | Eksperimen telah dilatih pada data publik; belum model khusus usaha pengguna yang tervalidasi | Kumpulkan histori nyata, pisahkan tanggal latihan/validasi/test, bandingkan baseline dan aktifkan hanya jika layak. |
| Antrean, kuota, pemeriksaan aturan | Algoritme/aturan program | Uji perilaku dan konsistensi; tidak dilaporkan sebagai model terlatih. |

Qwen telah melalui pretraining dan post-training menurut [model card penerbit](https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct). Whisper menyediakan bobot pralatih pengenalan suara menurut [repositori resminya](https://github.com/openai/whisper). Gerai Kita memakainya untuk inferensi; menginstal atau menjalankannya tidak melatih bobot.

## Keputusan tahap hackathon

1. **Buktikan alur inti.** Suara/chat, pemeriksaan pengguna, antrean dapur, stok/penjualan tercatat sekali. Uji runtime lokal membuktikan alur berjalan, bukan akurasi lapangan.
2. **Ukur kesalahan nyata.** Bedakan menu/jumlah, penolakan, fallback, waktu proses dan retensi catatan. Data tanpa anotasi tidak diberi skor catatan otomatis.
3. **Perbaiki sumber kesalahan.** Catatan “dingin” hilang akibat parser memerlukan perbaikan parser. Fine-tuning tidak memperbaiki catatan yang dibuang kode sesudahnya.
4. **Latih sesuai kebutuhan.** Latih ramalan memakai histori lengkap yang sesuai. Pertimbangkan fine-tuning Qwen/Whisper setelah ada data berizin, pola kesalahan konsisten, evaluasi terpisah dan sumber daya memadai.

Katalog membantu Qwen memakai menu usaha tanpa mengubah bobot. Pipeline sekarang masih meminta persetujuan parser atas menu/jumlah: model belum memperluas bahasa yang diterima parser. Ini batas fungsi yang perlu diuji, bukan bukti fine-tuning diperlukan atau pasti berhasil.

## Status data dan bukti

Belum ada dataset chat usaha aktual berizin dan berlabel untuk evaluasi lapangan. Template schema 2 tetap kosong. FLEURS adalah rekaman publik untuk pengenalan suara umum, bukan suara pesanan warung. Eksperimen forecasting publik juga bukan histori usaha pengguna.

V0.48 memperbaiki retensi catatan sumber dan alat evaluasi. Tidak membuat bobot, training/fine-tuning, data simulasi akun atau klaim akurasi baru. Fixture otomatis hanya memeriksa kontrak kode, bukan metrik model lapangan.

Verifikasi perubahan: **364 tes regresi** (302 backend + 62 browser), serta tujuh pemeriksaan Qwen/Whisper nyata pada SQLite memori. [Bukti regresi dan lingkup](evaluation/ai-notes-release.json), [runtime](evaluation/ai-notes-runtime.json). Satu klip FLEURS dan katalog uji terisolasi hanya membuktikan inferensi serta alur API; tidak menjadi skor akurasi pesanan nyata.

Penjelasan presentasi yang sesuai keadaan proyek: **“Kami mengintegrasikan Qwen dan Whisper pralatih, mengembangkan pemeriksaan hasil serta alur dapur, dan telah melatih serta mengevaluasi model ramalan pada dataset publik. Validasi pada usaha lokal masih diperlukan.”** Jangan menyebut Qwen/Whisper dilatih tim atau menganggap semua eksperimen publik aktif pada akun.

Lihat [evaluasi chat](CHAT_EVALUATION.md), [pengumpulan data](DATA_COLLECTION.md), [pelatihan ramalan](AI_TRAINING.md) dan [artefak model](evaluation/AI_MODEL_INDEX.md).

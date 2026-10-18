# Status Railway dan main — 18 Oktober 2026

`origin/main` sudah di `29565e6` (`hapus halaman surplus`). Seluruh head branch pada remote `origin` yang diperiksa merupakan ancestor commit tersebut: fitur dapur, rahasiagelap2.0, rahasiagelap3.0 dan geraikita2.1 sudah tercakup. Main diperbarui dengan fast-forward dan di-push; **tidak dibuat commit baru**.

## Layanan yang aktif

- Aplikasi: https://web-production-a3e13.up.railway.app — deployment `72ed4653-75bb-47bd-9709-48b511b936fc`, status SUCCESS.
- Frontend `/app.js`, `/live-views.js`, `/sw.js` dan `/voice.js` memiliki hash yang sama dengan source main. Menu Surplus tetap dihapus.
- HTTPS/HSTS aktif; bootstrap tanpa login memberi HTTP 401. Browser cloud memenuhi prasyarat secure context, getUserMedia, MediaRecorder dan WebM/Opus. Izin mikrofon dan perangkat fisik masih perlu diuji pengguna.
- Whisper Tiny di Railway tersedia. Inferensi lewat API terautentikasi pemilik dan kasir menghasilkan transkrip nonkosong pada audio publik berizin yang sudah pernah diperiksa. Pengujian memakai SQLite memori, bukan akun produksi. Ini bukti runtime, bukan akurasi pesanan usaha atau jaminan latensi.
- Ollama/Qwen 1.5B di laptop aktif; delapan pemeriksaan model asli lulus pada source main. Model/digest tetap sama dengan pemeriksaan sebelumnya.

## Yang belum aktif

**Qwen/Ollama cloud belum aktif.** Pemeriksaan API Railway saat deployment masih menunjukkan Trial, belum ada metode pembayaran, RAM maksimal 1 GB per layanan dan volume maksimal 500 MB. Bobot Qwen 1.5B lokal sendiri sekitar 986 MB, sehingga volume tersebut tidak memadai. Pengguna menyatakan belum dapat mengaktifkan paket berbayar; model tidak diturunkan atau diganti otomatis. Konfigurasi layanan Ollama privat tetap disiapkan untuk dilanjutkan ketika kapasitas tersedia.

Cloud saat ini memakai fallback parser untuk ekstraksi teks; hasil diberi mode `fallback`, wajib diperiksa, dan tidak dihitung sebagai inferensi Qwen atau pemakaian kuota AI teks. Voice tetap memakai model asli. [Paket Railway](https://docs.railway.com/pricing/plans).

Percobaan menghubungkan autodeploy `bleszs/rahasiagelap:main` ditolak Railway dengan `User does not have access to the repo`. Git push ke GitHub berhasil, tetapi akses Railway GitHub App belum tersambung. Deployment kali ini berhasil melalui upload CLI. Menghubungkan akses repo dapat dilakukan kemudian dari pengaturan source Railway; push selanjutnya belum dijamin memicu deploy otomatis.

## Data dan bukti

Backup cloud diunduh dan salinan restore diperiksa sebelum dan sesudah deployment. Migrasi dari 30 ke 36 tabel berhasil; integritas OK dan tidak ada pelanggaran foreign key. Database cloud awal masih kosong (nol baris pada tabel asal), sehingga ini bukan bukti migrasi histori usaha yang sudah terisi. Tidak ada fixture, akun demo atau transaksi uji yang dimasukkan ke produksi. Akun/data laptop tidak disalin ke cloud; akun cloud perlu didaftarkan tersendiri.

[Ringkasan verifikasi](evaluation/railway-main-activation.json) memisahkan voice cloud, Qwen lokal, batas cloud dan pemeriksaan data. Backup serta log rinci disimpan di folder `data/` yang diabaikan Git. Dokumen status ini dibiarkan tanpa commit sesuai arahan pengguna.

Prioritas berikutnya: pengguna menguji login dan izin mikrofon pada perangkat nyata, lalu mengumpulkan pesanan berizin untuk evaluasi domain. Aktivasi Qwen cloud menunggu perubahan kapasitas; model forecasting usaha tetap memerlukan histori nyata dan tidak diisi dari data demo/benchmark secara otomatis.

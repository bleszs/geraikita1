# Gerai Kita

Gerai Kita adalah aplikasi web untuk membantu usaha kecil mengelola operasional kedai: pesanan, kasir, dapur, menu, stok, pembelian, dan pencatatan aktivitas. Aplikasi dibuat dengan antarmuka berbahasa Indonesia dan dirancang agar alur utama tetap dapat digunakan tanpa layanan AI.

## Fitur utama

- **Pesanan dan kasir:** catat pesanan, tinjau isinya, dan selesaikan transaksi secara eksplisit.
- **Operasional dapur:** pantau antrean pesanan dan tahap pengerjaan.
- **Menu dan persediaan:** kelola katalog, bahan, stok, serta penerimaan dan pembatalan yang tercatat.
- **Laporan dan saran kulakan:** tinjau aktivitas usaha dan perkiraan kebutuhan bahan berdasarkan data yang tersedia.
- **Akun dan tim:** kelola akses pemilik/staf serta fitur usaha bersama.
- **Bantuan AI dan suara:** dapat digunakan bila penyedia/model terkait sudah dikonfigurasi. Hasil AI perlu diperiksa sebelum dipakai atau dikirim sebagai pesanan.

## Teknologi

- Node.js (ES modules) untuk server dan aplikasi web.
- SQLite untuk menyimpan data usaha secara lokal.
- Ollama opsional untuk ekstraksi pesanan berbantuan AI.
- Python dan Whisper opsional untuk fitur suara.
- Node.js test runner dan Playwright untuk pengujian.

## Menjalankan secara lokal

### Persyaratan

- Node.js 24 atau versi lebih baru.
- npm (disertakan bersama Node.js).

Untuk AI teks, siapkan Ollama dan model `qwen2.5:1.5b`. Untuk transkripsi suara, siapkan Python dan lingkungan suara proyek secara terpisah. Aplikasi dasar tetap bisa dijalankan tanpa menyiapkan keduanya.

### Instalasi dan mulai

```powershell
npm ci
npm start
```

Buka [http://localhost:4174](http://localhost:4174). Server menyimpan database lokal secara default di `data/gerai-kita-live.sqlite`. Folder `data/` tidak dilacak Git; buat cadangan data penting secara berkala.

Untuk mode pengembangan, jalankan `npm run dev`. Untuk menyiapkan dan menjalankan demo terpisah:

```powershell
npm run demo:setup
npm run start:demo
```

Demo berjalan di port 4180 dan datanya terpisah dari database usaha utama.

## Konfigurasi

Pengaturan lokal dibaca dari environment process; proyek tidak otomatis memuat file `.env`. Lihat [.env.example](.env.example) sebagai daftar variabel untuk deployment. Untuk PowerShell, contohnya:

```powershell
$env:AI_PROVIDER = "ollama"
$env:OLLAMA_URL = "http://127.0.0.1:11434"
$env:OLLAMA_MODEL = "qwen2.5:1.5b"
npm start
```

Variabel penting:

| Variabel | Kegunaan | Default |
| --- | --- | --- |
| `PORT` | Port HTTP server | `4174` |
| `DATABASE_PATH` | Lokasi file database SQLite | `data/gerai-kita-live.sqlite` |
| `AI_PROVIDER` | Penyedia ekstraksi teks | `ollama` |
| `OLLAMA_URL` | Alamat layanan Ollama | `http://127.0.0.1:11434` |
| `OLLAMA_MODEL` | Model Ollama | `qwen2.5:1.5b` |
| `SPEECH_PROVIDER` | Gunakan `disabled` untuk menonaktifkan transkripsi suara | Aktif sesuai konfigurasi runtime |

Jangan masukkan kata sandi, token, atau kunci akses ke README, Git, maupun konfigurasi publik. Lindungi endpoint Ollama yang dapat diakses dari jaringan.

## Pengujian

```powershell
npm run test:backend
```

Untuk seluruh tes, termasuk tes browser:

```powershell
npm test
```

Pengujian browser menggunakan Playwright dan konfigurasi Chrome dari [playwright.config.js](playwright.config.js). Jika Chrome belum tersedia, pasang browser yang diperlukan untuk lingkungan pengujian sebelum menjalankan suite tersebut. Tes backend tidak memerlukan browser.

Pemeriksaan kesiapan lokal:

```powershell
npm run doctor
```

## Deployment

Proyek menyertakan [Dockerfile](Dockerfile) untuk menjalankan server di container. Pada deployment, gunakan volume persisten untuk SQLite dan atur `DATABASE_PATH` ke lokasi di dalam volume tersebut. Di Railway, contoh variabel dan catatan konfigurasi ada di [.env.example](.env.example); `PORT` dan lokasi volume disediakan oleh platform.

Health check aplikasi tersedia di `/api/health`. Pastikan endpoint/model AI dan transkripsi suara yang dipilih memang dapat dijangkau dari layanan deployment. Deployment cloud harus memakai penyimpanan persisten dan tidak boleh mengandalkan filesystem container untuk menyimpan data usaha.

## Struktur proyek

| Lokasi | Isi |
| --- | --- |
| `server/` | Server HTTP, API, logika usaha, SQLite, dan integrasi AI/suara |
| `public/` | Antarmuka web, aset, dan dukungan PWA |
| `scripts/` | Perintah pengembangan, pemeriksaan, backup, dan evaluasi |
| `tests/` | Pengujian backend dan browser |
| `benchmarks/` | Protokol dan alat eksperimen model |
| `datasets/` | Template dan dataset riset publik |
| `models/` | Sumber serta konfigurasi model |
| `deploy/` | Contoh dan catatan deployment |

Sebagian keluaran eksperimen dan data lokal tidak disertakan dalam Git. Hasil benchmark bukan jaminan akurasi untuk data atau kondisi usaha tertentu.

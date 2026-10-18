# Railway: aplikasi, Qwen dan Whisper

Pembaruan 18 Oktober 2026: seluruh branch terbaru sudah tercakup pada `main` (`29565e6`) dan telah di-upload ke Railway. Web/Whisper aktif; Qwen cloud masih menunggu kapasitas karena pengguna belum bisa mengaktifkan paket berbayar. Qwen 1.5B lokal lulus uji runtime. [Status terkini dan bukti](RAILWAY_MAIN_STATUS.md). Detail status/branch versi sebelumnya di bawah merupakan riwayat; sumber rilis sekarang `main`.

Pengguna memilih Railway dan meminta aplikasi beserta Qwen/pengenalan suara langsung aktif. **Web sudah online di [Gerai Kita](https://web-production-a3e13.up.railway.app)** pada akun yang diminta, dengan SQLite di volume `/data`. Build Docker Linux, pemuatan Whisper Tiny dan transkripsi melalui API terautentikasi pada database memori berhasil. **Seluruh AI belum aktif: Qwen masih tertunda karena batas resource.**

Pemeriksaan akun pada 18 Oktober 2026 menemukan batas **1 GB RAM per layanan, volume 500 MB dan kuota backup volume 0**. Permintaan RAM 2 GB ditolak provider dengan pesan `The maximum allowed memory for this service is 1 GB`. Layanan `ollama` sudah dibuat tetapi belum dijalankan. Pengguna memilih peningkatan kapasitas dengan model tetap `qwen2.5:1.5b`. Pemeriksaan lanjutan menunjukkan `isTrialing=true` dan belum ada metode pembayaran: aktivasi Hobby berbayar harus diselesaikan di dashboard sebelum kapasitas dinaikkan. Label API `plan=HOBBY` saja tidak membuktikan langganan berbayar aktif.

Region layanan web telah dikonfigurasi menjadi `asia-southeast1-eqsg3a` (satu replika); akses publik sesudah perpindahan kembali HTTP 200 melalui edge Singapura. Upload dilakukan melalui CLI dari workspace, **belum terhubung sebagai deployment otomatis dari GitHub**. Commit/push saja tidak otomatis memperbarui situs.

## Susunan layanan

| Layanan | Isi | Jaringan dan penyimpanan |
| --- | --- | --- |
| `web` | Node.js 24, frontend, SQLite, forecasting akun, Python 3.13 dan Whisper Tiny pretrained yang sama | Domain HTTPS; satu instance; volume `/data` |
| `ollama` | Direncanakan: Ollama, model `qwen2.5:1.5b`; layanan masih kosong | Jaringan privat; tanpa domain publik; kapasitas dan penyimpanan belum final |

Rincian yang bisa ditinjau: [rencana deployment](../deploy/railway-plan.json). File itu adalah spesifikasi proyek ini, bukan file yang otomatis diterapkan Railway. Dockerfile terdeteksi oleh builder. Konfigurasi layanan dapat diterapkan melalui dashboard/CLI atau Infrastructure as Code Railway saat provisioning. Dokumentasi Railway sekarang menetapkan [IaC sebagai pengganti railway.json](https://docs.railway.com/infrastructure-as-code); jangan memasang konfigurasi lama untuk layanan baru.

SQLite tetap digunakan. Volume mencegah data hilang ketika container diganti; layanan bervolume tidak memakai replika dan dapat mengalami jeda singkat saat redeploy. Lihat [batas volume](https://docs.railway.com/volumes/reference). Data akun asli di laptop dan akun demo tidak disalin otomatis ke cloud. Situs baru mulai kosong; migrasi database atau penerbitan demo terpisah perlu rencana data yang jelas.

## Setelah akun Railway tersambung

1. Periksa `railway whoami --json` dan pastikan identitas sesuai akun yang diminta. Jangan menampilkan token atau isi konfigurasi autentikasi. Akun harus memiliki kuota/paket yang memungkinkan pembuatan proyek dan kedua layanan.
2. Buat proyek `gerai-kita` di workspace yang benar, lalu layanan `web` dari repository `bleszs/rahasiagelap`, branch `feat/kitchen-capacity-and-waste`. Jangan memakai `main` yang belum memuat perubahan ini.
3. Pasang volume `web` di `/data`. Atur variabel dari tabel berikut sebelum startup produksi. Buat domain publik Railway dan biarkan `RAILWAY_PUBLIC_DOMAIN` menyediakan origin HTTPS, atau isi `PUBLIC_ORIGIN` dengan origin domain khusus yang benar.
4. Atur start command `node scripts/serve.mjs`, healthcheck `/api/health`, timeout 300 detik, restart saat gagal dan satu instance. `PORT` berasal dari Railway. Healthcheck menggunakan hostname khusus Railway yang hanya diizinkan untuk GET endpoint tersebut. [Healthcheck Railway](https://docs.railway.com/deployments/healthchecks).
5. Buat layanan `ollama` dari image resmi Ollama. Catat tag/digest image yang dipilih sebelum rilis. Pasang volume `/root/.ollama`, atur `OLLAMA_HOST=[::]:11434`, `OLLAMA_NUM_PARALLEL=1`, `OLLAMA_MAX_LOADED_MODELS=1`. Pastikan DNS privat benar-benar sesuai `OLLAMA_URL`; uji koneksi dari `web` dan jangan membuat domain publik untuk API model.
6. Di container `ollama`, jalankan `ollama pull qwen2.5:1.5b`. Periksa `/api/tags` dan satu inferensi lewat jaringan privat. Nama tag saja belum membuktikan digest model sama dengan suatu benchmark lama; rekam identitas model yang benar-benar terpasang.
7. Build `web`. Dockerfile memasang dependensi suara yang dipatok dan mengunduh Whisper Tiny sesuai revisi/checksum `models/speech-source.json` pada saat build. Tidak ada pengunduhan model saat inferensi. Jalankan pemeriksaan suara di image Linux sebelum menyatakan suara aktif.
8. Buat backup SQLite konsisten dengan `node scripts/backup.mjs --database /data/gerai-kita.sqlite --directory /data/backups`, unduh ke penyimpanan terpisah, lalu uji pemulihan tanpa menimpa database aktif. Satu backup cloud telah dibuat, salinannya diperiksa pada direktori sementara, lalu diunduh ke `data/backups/railway/verified-cloud-backup.sqlite` dan diperiksa kembali; integritas dan relasi OK. Data dan penanda volume bertahan setelah redeploy dengan hash logis database identik. Backup di volume yang sama belum melindungi dari kehilangan volume. Kuota backup volume akun saat ini 0; **backup otomatis harian belum aktif**. Jika kapasitas akun berubah, periksa kembali [dukungan backup volume Railway](https://docs.railway.com/volumes/backups).

## Variabel layanan web

| Variabel | Nilai |
| --- | --- |
| `NODE_ENV` | `production` |
| `BIND_HOST` | `0.0.0.0` |
| `DATABASE_PATH` | `/data/gerai-kita.sqlite` |
| `FORECAST_MODEL_DIR` | `/data/models/forecast` |
| `TRUST_RAILWAY_PROXY` | `true`, hanya saat trafik masuk melalui edge Railway |
| `AI_PROVIDER` | `ollama` |
| `OLLAMA_MODEL` | `qwen2.5:1.5b` |
| `OLLAMA_URL` | `http://ollama.railway.internal:11434`, sesuaikan dengan nama/DNS layanan privat |
| `PUBLIC_ORIGIN` | Opsional jika Railway sudah menyediakan `RAILWAY_PUBLIC_DOMAIN`; bila diisi harus origin HTTPS tanpa path/query/kredensial |

[.env.example](../.env.example) mendokumentasikan variabel; `npm start` tidak otomatis membaca file tersebut. Jangan menyimpan token Railway atau kredensial bisnis pada file yang dikomit.

`server/deployment.mjs` memvalidasi origin dan host, mengeluarkan cookie sesi `Secure` pada mode publik, serta mengabaikan forwarded host/proto untuk keputusan origin. Mode lokal tetap memakai loopback dan aturan cookie lokal. `X-Real-IP` hanya menjadi identitas pembatas percobaan ketika kepercayaan pada edge Railway dinyalakan; header lain tidak menentukan identitas. [Header edge Railway](https://docs.railway.com/networking/public-networking/specs-and-limits).

Startup Railway menolak database relatif/di luar volume dan mount yang belum ada. Ini pemeriksaan konfigurasi/path, bukan bukti bahwa backup, replikasi atau kapasitas disk sudah memadai. Rate limit tetap dalam memori satu proses.

## Syarat sebelum mengumumkan situs siap

- HTTPS/domain dan healthcheck berhasil; cookie masuk/keluar `Secure`, origin asing ditolak.
- Pemilik mendaftar pada situs baru, kasir/dapur masuk memakai kode, role tetap terisolasi; pelanggan hanya membuka katalog/status yang diizinkan.
- Health melaporkan Qwen dan Whisper tersedia, diikuti inferensi nyata dari permintaan akun terautentikasi. Jangan menyatakan AI aktif hanya karena halaman terbuka.
- Data tetap ada setelah redeploy; backup dan pemulihan diuji tanpa menimpa usaha aktif.
- SSE dan mikrofon bekerja pada perangkat berbeda. Ukur RAM, CPU, antrean dan latensi dengan kedua AI aktif; jangan mengklaim target dua detik atau kecukupan paket sebelum pengukuran.

Model forecasting publik tetap artefak benchmark, bukan otomatis menjadi model bahan akun baru. Training/aktivasi akun tetap mengikuti histori nyata dan evaluasi yang sudah ada. Dockerfile tidak membawa database, `.env`, cache laptop, data demo atau model benchmark privat ke image.

## Bukti saat ini

`npm test` selesai normal: **270 Node + 54 browser = 324 lulus**, exit 0. `test:deployment` mencakup host/origin/cookie/proxy/storage dan pertukaran kode staf pada database sementara. [Bukti rilis](evaluation/railway-preparation.json) dan [pemeriksaan cloud](evaluation/railway-runtime.json) memisahkan bukti lokal, build Linux dan inferensi nyata.

Smoke suara memakai rekaman FLEURS publik dengan atribusi yang sudah dicatat di [dataset](../datasets/public/fleurs/README.md). Percobaan pertama ditolak `no_speech`; klip kedua menghasilkan transkrip dan kemudian berhasil melalui API akun memori. Ini verifikasi runtime, bukan benchmark akurasi baru. Tidak ada audio/transkrip yang dicantumkan di laporan atau akun uji yang dibuat pada database produksi. Evaluasi model sebelumnya tidak berubah.

Masih tertunda: aktivasi Hobby berbayar, Qwen dan ekstraksi nyata melalui aplikasi, backup otomatis ke penyimpanan terpisah, uji perangkat fisik berbeda, serta pengukuran CPU/RAM/latensi saat kedua AI aktif. Akun baru belum mempunyai histori untuk model forecasting usaha; artefak benchmark publik tidak diaktifkan otomatis.

## Melanjutkan Qwen setelah pembayaran

Pengguna sudah mengizinkan peningkatan kapasitas dengan model tetap 1.5B. Buka dashboard pada akun yang diminta, pilih pengaturan workspace > Plans/Billing dan aktifkan Hobby. Biaya minimum US$5/bulan mencakup kredit pemakaian US$5; pemakaian lebih besar dikenai selisih. Total semua AI tidak dijamin US$5. [Harga resmi](https://docs.railway.com/pricing/plans). Selesaikan detail pembayaran langsung di dashboard.

Layanan `ollama` kosong sudah dikonfigurasi di Singapura dengan satu replika, Dockerfile `deploy/ollama/Dockerfile`, start command `/bin/sh /usr/local/bin/gerai-kita-ollama-start`, bind privat IPv6 dan satu model/permintaan paralel. Image resmi dipatok digest; startup mengunduh 1.5B ke volume bila belum ada. Bobot yang sudah ada dipakai kembali setelah restart. Pembaruan tag harus dilakukan sebagai operasi rilis yang disengaja, kemudian digest model dicatat; benchmark lama tidak otomatis berlaku bagi bobot baru.

Setelah kuota berbayar benar-benar terlihat:

1. Periksa `customer.isTrialing=false`, limit RAM minimal 2 GB dan volume minimal 2 GB; identitas akun tetap sesuai permintaan.
2. Atur layanan model 2 GB RAM/2 vCPU dan buat volume `/root/.ollama` (default Hobby 5 GB). Ukur konsumsi saat inferensi; limit ini belum bukti kapasitas terukur.
3. Dari root workspace jalankan `railway up --service ollama --detach`. Dockerfile sudah diatur pada layanan. Image Qwen belum dibangun saat catatan ini dibuat; yang lulus saat persiapan hanya pemeriksaan sintaks shell.
4. Tunggu model tersedia, baca `/api/tags` melalui jaringan privat, catat digest dan jalankan inferensi. Verifikasi ekstraksi melalui aplikasi pada database memori sebelum menyatakan Qwen aktif. Layanan model tetap tanpa domain publik.
5. Periksa health web dengan kedua AI tersedia, ukur resource, lalu aktifkan backup terjadwal jika kuota baru mendukung. Backup unduhan manual yang sudah diperiksa tetap dipertahankan.

## Backup cloud yang dapat dipakai ulang

Backup cloud juga sudah mempunyai perintah yang dapat dipakai ulang: `npm run backup:railway -- --config data/railway-backup.local.json`. Pemeriksaan checksum dan pemulihan lewat store aplikasi berhasil pada seluruh 30 tabel. Jadwal lokal belum terpasang karena Windows memblokir script pemasang; kuota backup provider tetap 0. [Cara memakai dan batas](RAILWAY_BACKUP.md).

## Pemeriksaan kedua AI yang dapat dijalankan ulang

`npm run verify:ai-runtime -- --audio LOKASI_KLIP_PUBLIK.wav --report data/cloud-verification/NAMA_RUN_BARU.json` memakai runtime model yang dikonfigurasi melalui `OLLAMA_URL`, `OLLAMA_MODEL` dan opsi profil suara yang sama dengan aplikasi. Audio WAV harus berizin, maksimal 1 MiB/30 detik. File audio tidak dimasukkan ke laporan; hanya hash audio/transkrip, identitas model dan hasil pemeriksaan. Setiap laporan memakai nama baru agar percobaan gagal tetap tersimpan.

Script membuat server loopback dengan database `:memory:` yang eksplisit, sehingga `DATABASE_PATH` produksi tidak dibuka meskipun perintah dijalankan di container Railway. Akun/katalog teknis dibuat hanya dalam memori dan hilang saat proses selesai. Ia memeriksa inventaris/digest model, health kedua model, penolakan tanpa sesi/CSRF dan origin asing, ekstraksi Qwen melalui API, transkripsi melalui API, serta kesamaan seluruh tabel setelah inferensi. Respons ekstraksi HTTP 200 yang memakai fallback parser tetap gagal. Exit 0 memerlukan semua pemeriksaan lulus.

Run lokal awal mengoreksi ekspektasi status setup (endpoint pembuatan memakai 201); run setelah koreksi lulus enam pemeriksaan. Kontrol dengan endpoint Ollama yang tidak tersedia menghasilkan exit 1 dan menolak fallback sebagai bukti AI. Semua percobaan disimpan dalam [bukti penerimaan runtime](evaluation/ai-runtime-acceptance.json). Ini pemeriksaan integrasi, bukan benchmark akurasi atau pengukuran kapasitas cloud. Script baru tersedia pada repository; image web harus diperbarui sebelum menjalankannya langsung di container.

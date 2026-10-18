# Menyambungkan Qwen (Ollama) laptop ke Railway

Tujuan: cloud (Railway) memakai Qwen 1.5B yang sudah jalan di laptop untuk
cross-check ekstraksi pesanan teks, **tanpa** paket berbayar Railway.

Penting dipahami lebih dulu: hasil item pesanan di cloud sudah benar tanpa ini
(parser lokal adalah sumber kebenaran; Qwen hanya mengonfirmasi). Menyambungkan
laptop hanya menghidupkan label "dikonfirmasi AI". Konsekuensinya: **laptop
harus nyala & online**, dan ekstraksi yang terkonfirmasi mulai menghitung kuota
`FREE_AI_TEXT_MONTHLY`. Kalau laptop mati, cloud otomatis balik ke parser
(item tetap sama).

## Arsitektur

```
Railway (app)  --HTTPS-->  Tunnel (ngrok/Cloudflare)  -->  Gateway :11435  -->  Ollama :11434
                                                           cek rahasia +        (tetap loopback,
                                                           hanya /api/tags       tak terbuka ke
                                                           & /api/chat)          internet)
```

Ollama tetap di `127.0.0.1` dan tidak pernah terbuka telanjang. Gateway
(`scripts/ollama-gateway.mjs`) hanya meneruskan 2 endpoint yang dipakai aplikasi
dan menolak sisanya, serta mewajibkan rahasia.

## Langkah

### 1. Buat rahasia (sekali saja, simpan baik-baik)

```bash
npm run gateway:secret
# contoh keluaran: t1kBlPm1ZtiS5HEAj6-cfL8Mxt1jwVh_
```

### 2. Jalankan gateway di laptop (biarkan jendela ini tetap terbuka)

```bash
npm run gateway -- --secret <RAHASIA_DARI_LANGKAH_1>
# -> Ollama gateway aktif di http://127.0.0.1:11435 -> http://127.0.0.1:11434
```

### 3. Pasang tunnel ke port 11435

**Opsi A — ngrok (rekomendasi: URL stabil, akun gratis, tanpa domain).**
Butuh ngrok agent **>= 3.20** (versi lama ditolak `ERR_NGROK_121`; cek dengan
`ngrok version`). Daftar gratis di ngrok, set authtoken sekali
(`ngrok config add-authtoken <TOKEN>`), ambil 1 domain statis gratis, lalu:

```bash
# ngrok 3.3.x memakai --domain; versi lebih baru memakai --url. Keduanya sama.
ngrok http 11435 --domain=NAMAMU.ngrok-free.dev
# URL publik: https://NAMAMU.ngrok-free.dev  (tetap sama tiap restart)
```

**Opsi B — Cloudflare quick tunnel (tanpa akun, tapi URL berubah tiap restart).**

```bash
cloudflared tunnel --url http://127.0.0.1:11435
# URL publik: https://<acak>.trycloudflare.com  (ganti tiap kali dijalankan)
```

Keamanan sudah ditangani gateway (rahasia + allowlist endpoint), jadi tunnel
tanpa auth pun aman untuk dipakai di sini.

### 4. Set variabel di dashboard Railway, lalu Railway restart otomatis

```
AI_PROVIDER = ollama
OLLAMA_MODEL = qwen2.5:1.5b
OLLAMA_URL  = https://NAMAMU.ngrok-free.app      (URL dari langkah 3, tanpa garis miring akhir)
OLLAMA_AUTH = Bearer <RAHASIA_DARI_LANGKAH_1>    (persis sama, ada kata "Bearer " di depan)
```

### 5. Verifikasi

- Buka aplikasi cloud, catat pesanan lewat chat. Bila berhasil, hasil bermode
  `ollama` ("dikonfirmasi AI"), bukan `fallback`.
- Di jendela gateway akan muncul baris log `POST /api/chat -> 200` (tanpa isi
  pesanan — hanya rute & status).

## Catatan keamanan

- Jangan pakai `cloudflared tunnel --url http://127.0.0.1:11434` langsung ke
  Ollama: itu membuka API tanpa kata sandi (termasuk tarik/hapus model) ke
  internet. Selalu lewat gateway.
- Rahasia minimal 16 karakter; gateway menolak start bila lebih pendek.
- Untuk Cloudflare Access (service token) alih-alih rahasia bearer, set
  `OLLAMA_AUTH` ke JSON: `{"CF-Access-Client-Id":"...","CF-Access-Client-Secret":"..."}`.

## Terbukti jalan (laptop ini)

Diuji end-to-end 18 Okt 2026: tanpa/ salah rahasia ditolak 401, rute non-izin
(`/api/pull`) ditolak 404, `/api/tags` 200, dan `extract()` lewat gateway
menghasilkan mode `ollama` dengan item benar.

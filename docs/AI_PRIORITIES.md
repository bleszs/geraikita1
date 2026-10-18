# Prioritas AI — 18 Oktober 2026

Perubahan lokal setelah HEAD `ca3d310`; tanpa commit/push otomatis.

## Saran kulakan untuk usaha baru

Di **Saran kulakan → Belum punya histori? Hitung dari target porsi**, isi jumlah menu yang hendak disiapkan lalu pilih **Hitung kebutuhan belanja**. Server menjumlahkan resep untuk seluruh target, mengurangi stok tersedia yang sudah memperhitungkan cadangan pesanan, lalu membulatkan kekurangan ke atas. Hasil berasal dari katalog usaha yang sedang masuk, bukan contoh data.

Ini perhitungan rencana produksi, **bukan prediksi AI**. Tidak mengurangi stok, mencatat penjualan, membuat pembelian atau mengisi histori pelatihan. Hasil dihapus saat target diedit atau data diperbarui. Jika katalog berubah, server menolak revisi lama dan meminta pengguna memperbarui data. Stok baru setelah hasil ditampilkan memerlukan hitung ulang.

Model kulakan terlatih tetap digunakan untuk bahan yang memiliki histori cukup dan lolos evaluasi lokal. Bobot, gerbang aktivasi dan hasil benchmark sebelumnya tidak diubah. Akun baru tidak otomatis mendapat prediksi dari histori buatan.

## Voice mengenali katalog usaha

Server mengambil nama menu dan alias dari usaha yang terautentikasi, membersihkan serta membatasi kosakata ke 20 istilah/400 karakter. Kosakata dikirim ke proses Whisper Base melalui lingkungan proses per permintaan; profil `base-orders` memakainya sebagai `hotwords`. Kosakata kiriman klien diabaikan dan katalog usaha lain tidak disertakan.

Pemeriksaan durasi, suara kosong, pengulangan dan bukti menu/jumlah tetap berlaku. Transkripsi masih harus diperiksa manusia. Ini bantuan decoding pada model pretrained, bukan pelatihan ulang. Uji rekaman publik Indonesia membuktikan integrasi berjalan, **belum membuktikan peningkatan akurasi pesanan di dapur**. Diperlukan rekaman pesanan nyata dengan persetujuan untuk mengukur nama menu, jumlah, kebisingan dan mikrofon perangkat.

## Qwen pulih tanpa menunggu terus

Setelah koneksi/inferensi gagal, permintaan berikutnya memakai parser lokal selama 30 detik. Status menunjukkan AI sementara tidak tersedia. Setelah interval lewat, permintaan mencoba Qwen lagi secara otomatis. Hasil yang tidak sesuai bukti tetap ditolak; kegagalan bukti tidak dianggap gangguan koneksi. Jalur ini tidak pernah mengubah stok atau mencatat transaksi sendiri.

Uji langsung lokal berhasil menghasilkan mode `ollama` dengan Qwen 2.5 1.5B. **Ketergantungan hosting/tunnel eksternal belum dihapus.** Batas layanan Railway yang diketahui sebelumnya belum cukup untuk Qwen 1.5B mandiri; tidak ada penggantian model atau perubahan paket berbayar dalam pekerjaan ini.

## Verifikasi

- Backend: 330/330 lulus, termasuk hitung resep/stok, tidak ada penulisan bisnis, revisi katalog, autentikasi/CSRF/role, isolasi kosakata dan pemulihan Qwen dengan jam terkontrol.
- Python: dua tes kosakata serta sembilan tes decoding/penjagaan voice lama lulus.
- Browser target produksi: satu alur nyata pada database memori lulus; input, hasil, pembatalan hasil lama, stok/transaksi tetap, desktop 1440 dan ponsel 360 terang/gelap diperiksa.
- Regresi browser: 16/16 lulus untuk panduan, HCI kasir/dapur dan prediksi, serta alur rekam/edit/batal/perizinan/offline voice.
- [Inferensi suara dan Qwen langsung](evaluation/ai-priorities-runtime.json): satu klip publik 8,58 detik; bukan benchmark akurasi baru.

Pemeriksaan tampilan mempertahankan desain krem/terakota yang ada. Detector menemukan garis status lama 4 px pada aturan dapur di `styles.css` serta advisory token lama; tidak ada aturan baru semacam itu pada panel target produksi. Capture penuh memiliki posisi sticky saat scroll/fokus; formulir dan hasil terbaca tanpa overflow horizontal pada kedua tema.

## Belum selesai

1. Histori UMKM Indonesia yang sah dan evaluasi maju manfaat prediksi.
2. Pencatatan hari tutup/nol yang lengkap serta alur impor histori nyata.
3. Pengukuran voice dengan rekaman pesanan nyata dan uji kasir/koki.
4. Hosting Qwen 1.5B mandiri dengan kapasitas memadai.

Perintah: `npm run test:ai-priorities`, `npm run test:voice-vocabulary`, `npm run test:backend`, dan `npx playwright test tests/real-production-plan.spec.js`.

## Railway

Deployment `efa8d121-792a-4fe1-a464-0d330a110f1e` SUCCESS. [Pemeriksaan cloud](evaluation/ai-priorities-cloud-release.json) membuktikan perhitungan target tanpa penulisan pada SQLite memori, inferensi Whisper Base memakai kosakata, Qwen mode ollama dan model prediksi dengan checksum sama. Enam file publik dan modul staf cocok dengan lokal. Hosting Qwen tetap eksternal.

[Backup sebelum/sesudah](evaluation/ai-priorities-data-preservation.json): 37 tabel, integrity/FK dan restore terisolasi valid. Penjualan lama tetap sama, stok cocok ledger; satu sesi pada masing-masing dua tabel sesi hilang selama interval. Tidak mengklaim semua baris database identik dan tidak melakukan restore produksi.

# Pemeriksaan UI pendaftaran, kelompok, perintah dan logo

18 Oktober 2026. Lingkup: perubahan permintaan pengguna pada branch kerja, tanpa commit. Dunia visual tetap krem/terakota, Nunito dan token tema yang ada. DESIGN.md dan sidecar tidak diubah.

Satu putaran pemeriksaan berkelompok meliputi pendaftaran, pilihan kelompok, undangan, dan perintah dapur di Chromium desktop 1440×1000 serta ponsel emulasi 360×900, termasuk mode gelap. Satu batch koreksi memperbaiki peregangan form perintah, kolom pemasok pada ponsel dan keterbacaan logo gelap. Satu putaran konfirmasi selesai; tujuh keadaan tidak mempunyai overflow horizontal. Bukti lokal: `.impeccable/review/community-v53/` dan `data/community-ui-layout.json`.

Kode tampil dengan nama kelompok dan peran pemilik/anggota, dapat disalin dan membungkus kode lama yang panjang. Daftar tidak menampilkan nama/kode kelompok atau kartu panduan. Join/create berada di Beli bersama. Tombol Jalankan perintah menempel pada kolomnya, memakai aksi utama dan tinggi minimal 48 px. Ekspor dinilai lewat kontrak CSV dan unduhan browser, bukan gambar spreadsheet.

Satu detector dijalankan pada modul baru dan permukaan yang berubah. Terdapat warning border aksen dan advisory token lama pada stylesheet; ukuran 24/21 px untuk kode undangan merupakan pengecualian lokal yang disengaja demi pembacaan kode. Tidak mengubah kanon desain atau menulis ulang stylesheet untuk meniadakan temuan di luar lingkup. Detector bukan sertifikasi aksesibilitas.

Pemeriksaan ini menggunakan database memori dan akun uji terisolasi. Tidak membuktikan perangkat fisik, akurasi ucapan pesanan, settlement pembayaran, kompatibilitas seluruh versi Excel, atau kelengkapan data usaha. Logo SVG merupakan rekonstruksi vektor dari referensi pengguna.

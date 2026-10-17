# Jumlah pesanan dan waktu tunggu AI

Pembaruan v0.49 memperbaiki dua masalah pada alur utama pesanan. Ini perbaikan pemeriksaan hasil dan permintaan jaringan, bukan pelatihan model baru.

## Jumlah yang belum jelas

Sebelumnya, kata catatan tertentu dapat membuat angka yang tersisa diabaikan. Pada fixture terisolasi, `roti uji 2 pedas 1 burger` dapat menghasilkan hanya dua roti. `-2 roti uji` juga dapat menjadi dua porsi positif, dan `roti uji dua belas` dapat menjadi dua porsi dengan sisa kata `belas` dijadikan catatan.

Sekarang setiap angka pada input harus termasuk dalam pasangan menu/jumlah yang dikenali. Angka tersisa, tanda jumlah sebelum menu, serta sisa kata bilangan seperti `belas`, `puluh` dan `setengah` menyebabkan penolakan ke formulir manual. Nama/alias katalog yang memang mengandung angka tetap dapat digunakan; angka di dalam alias tersebut ikut pasangan menu yang cocok.

Ini aturan konservatif. Sistem belum memiliki schema variasi numerik per menu. Karena itu, `pedas 3`, nomor meja yang ditempel dalam chat, harga, atau pembagian porsi numerik juga perlu diperiksa manual; sistem tidak menebak apakah angka itu jumlah, level pedas atau item tambahan. Pengguna tetap dapat mengisi jumlah dan catatan angka pada formulir pesanan. Label meja memiliki kolom terpisah.

Bilangan terbilang satu sampai sepuluh tetap didukung. Tulis `12` pada kolom jumlah untuk dua belas; dukungan bahasa terbilang yang lebih luas belum ditambahkan. Pesan asli dengan catatan teks seperti hangat/dingin tetap dipertahankan untuk koreksi pengguna.

Input dengan bukti jumlah tidak valid ditolak sebelum inferensi model. API mengembalikan reservasi kuota jika validasi gagal; proses ekstraksi tidak mencatat stok, penjualan atau antrean. Pengujian memakai pemilik dan kasir pada database memori untuk kedua endpoint yang diizinkan.

## Waktu tunggu halaman dapur

Endpoint `/api/kitchen/extractions` sebelumnya memakai batas klien 15 detik, sedangkan pemanggilan Qwen mempunyai batas 45 detik. Ini dapat membuat klien menyatakan koneksi terputus sebelum model selesai.

Sekarang kedua endpoint ekstraksi memakai batas klien 60 detik. Permintaan biasa tetap 15 detik dan batas model tidak berubah. Tes browser menunda permintaan ekstraksi dapur selama 16 detik, lalu meneruskannya ke server nyata dalam mode parser: hasil harus tetap masuk ke formulir, bukan dianggap terputus. Penundaan tersebut adalah pengujian transport, bukan hasil pengukuran latensi model.

Tes yang sama memeriksa penolakan angka tidak menghapus formulir yang sudah diperiksa, tidak mencadangkan bahan, dan tidak menghalangi pesanan manual. Pengiriman manual tetap mencadangkan bahan sekali tanpa mencatat penjualan sebelum pesanan selesai.

Cache aplikasi dinaikkan ke `v49-ai-quantity-timeout` agar pembaruan modul API bisa ditawarkan kepada perangkat yang memakai PWA. Restart server untuk memuat validasi baru, lalu refresh browser dan gunakan pembaruan aplikasi jika ditawarkan.

## Batas dan verifikasi

Tidak ada bobot AI baru, data usaha buatan pada akun asli, atau klaim akurasi lapangan. Kasus otomatis hanya fixture teknis. Uji Qwen/Whisper nyata memakai katalog sementara dan satu klip FLEURS pada SQLite memori. [Keputusan pelatihan](AI_TRAINING_DECISIONS.md) dan [evaluasi chat](CHAT_EVALUATION.md) tetap menjadi acuan.

Hasil: **305 tes backend dan 63 browser lulus**, ditambah delapan pemeriksaan Qwen/Whisper asli. Tes browser penundaan 16 detik lulus; input tidak valid tidak memotong kuota atau mengubah data usaha. Regresi pertama sempat gagal pada satu tes lama yang menunggu toast hilang; tes tersebut lulus secara terpisah, lalu seluruh 63 tes browser lulus pada pengulangan penuh. Log awal tetap disimpan, bukan ditimpa. [Bukti regresi](evaluation/ai-quantity-release.json), [runtime](evaluation/ai-quantity-runtime.json).

Perubahan lokal ini belum di-push atau dideploy ke Railway.

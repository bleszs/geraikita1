# Backup Railway ke laptop

Jalankan dari root workspace:

```powershell
npm run backup:railway -- --config data/railway-backup.local.json
```

Konfigurasi lokal dan kunci SSH khusus `gerai-kita-backup` sudah disiapkan pada laptop ini. Perintah sudah berhasil mengunduh snapshot database cloud, memeriksa checksum/integritas/relasi, membuka salinan pemulihan memakai store aplikasi dan memastikan seluruh **30 tabel** tetap identik. Database produksi tidak dipulihkan atau diberi data contoh. [Bukti pemeriksaan](evaluation/railway-backup-release.json).

## Status jadwal harian

**Belum aktif.** Windows menolak pembacaan script pemasang jadwal dengan pesan `Operation did not complete successfully because the file contains a virus or potentially unwanted software.` Pemeriksaan dihentikan sebelum pendaftaran tugas. Dua script PowerShell persiapan jadwal yang belum dipakai sudah dihapus; tidak ada perubahan pada pengaturan keamanan Windows. Perintah backup Node yang diuji tetap tersedia untuk pemakaian manual. Tidak ada klaim bahwa jadwal terpasang atau bahwa peringatan Windows telah diselesaikan.

Backup terkelola Railway juga belum tersedia pada kuota akun saat pemeriksaan (`maxBackupsCount=0`). Penyelesaian jadwal otomatis masih diperlukan. Laptop yang dimatikan, tidak login atau tidak terhubung internet tidak dapat menjalankan jadwal lokal; rencana ini belum menggantikan runner yang selalu aktif. [Task Scheduler Microsoft](https://learn.microsoft.com/en-us/powershell/module/scheduledtasks/register-scheduledtask), [SSH Railway](https://docs.railway.com/cli/ssh).

## Cara pemeriksaan bekerja

1. CLI memeriksa akun Railway sesuai konfigurasi lokal, serta layanan dan environment benar-benar berada pada proyek yang dipilih. Deployment yang sedang berjalan dicari ulang setiap run, sehingga ID instance lama tidak dipakai setelah redeploy.
2. SSH membuat snapshot SQLite konsisten dengan `VACUUM INTO` di direktori sementara container. Snapshot menyertakan data WAL yang sudah committed. File sementara tersebut dihapus sesudah transfer; tidak menambah backup permanen pada volume cloud.
3. Unduhan dibatasi 64 MiB, diperiksa panjang, representasi base64 dan SHA-256. File baru memakai nama unik serta akhiran `.partial` sampai pemeriksaan selesai.
4. Integritas SQLite dan foreign key diperiksa. Salinan pemulihan dibuka melalui store/migrasi aplikasi pada folder sementara laptop, kemudian seluruh kolom/baris yang ada pada snapshot asal dibandingkan dengan hasil migrasi salinan. Tabel/kolom bawaan baru diperbolehkan tanpa mengabaikan perubahan data asal. Salinan sementara dibuang; unduhan yang diterbitkan sebagai `.sqlite` beserta laporan `.json` tetap mempertahankan schema dan checksum asal.

Tidak ada penghapusan retensi otomatis. Backup lama dipertahankan saat run baru gagal. Periksa kapasitas disk secara berkala; file backup berisi data akun dan usaha, sehingga harus tetap disimpan privat. Audio, model AI dan draft offline browser tidak termasuk backup SQLite.

## Konfigurasi lokal

`data/railway-backup.local.json` tidak masuk Git. Isinya menunjuk executable Railway/Node, project/environment/service ID, akun yang diharapkan, lokasi kunci SSH, path database remote dan direktori tujuan absolut. Template untuk laptop lain: [railway-backup.example.json](../deploy/railway-backup.example.json). Isi path/akun yang benar, login Railway dan daftarkan kunci sendiri; jangan memakai isi konfigurasi laptop ini sebagai kredensial bersama.

Kunci operasional `gerai-kita-backup` tetap terdaftar agar perintah manual dapat dipakai ulang. Nama kunci menjelaskan tujuannya, bukan pembatas izin SSH. Private key berada di profil SSH pengguna, bukan repository atau Docker image. Untuk menghentikan akses backup, cabut kunci berdasarkan fingerprint di Railway lalu hapus hanya file kunci milik backup tersebut. Jangan membagikan private key atau memasukkannya ke Git.

Jika ukuran snapshot melebihi 64 MiB, tool gagal dengan jelas. Evaluasi kapasitas dan cara transfer sebelum menaikkan batas; tool tidak memotong file diam-diam. Jika aplikasi di-upgrade dan pemulihan memigrasikan nilai baris, pemeriksaan kesamaan juga gagal agar perubahan itu ditinjau sebelum backup dinyatakan terverifikasi.

## Pemulihan

Gunakan salinan backup yang checksum dan laporan pemulihannya cocok. Uji startup aplikasi pada database salinan terpisah terlebih dahulu. Tool ini sengaja tidak mempunyai perintah untuk menimpa database Railway aktif; pemulihan produksi tetap memerlukan penghentian penulisan, backup keadaan terbaru dan rencana penggantian volume/database.

# Evaluasi ekstraksi chat

Pembaruan v0.48: evaluator memisahkan ketepatan menu/jumlah dari retensi catatan wajib, mendukung dataset schema 2 dan menghapus teks catatan dari laporan. **Belum ada dataset chat usaha nyata berizin dan berlabel yang dievaluasi.** Tidak ada nilai akurasi lapangan dan tidak ada fine-tuning Qwen. Template tetap kosong. Tes kontrak bukan dataset lapangan.

## Yang dibandingkan

1. **Parser lokal**: `parseOrder` yang dipakai aplikasi.
2. **Model mentah**: Qwen melalui Ollama dan schema katalog yang sama, sebelum pemeriksaan bukti parser. Ini ablation evaluasi; tidak menjadi endpoint transaksi.
3. **Pipeline aplikasi**: `createExtractor.extract` yang sebenarnya, termasuk pemeriksaan parser, hasil model, fallback dan penolakan manual.

Pemanggilan model menggunakan helper bersama `requestModelItems` di `server/extractor.mjs`, agar prompt, schema dan pemetaan ID tidak disalin menjadi implementasi benchmark yang berbeda. Hasil model mentah tidak pernah langsung mencatat penjualan atau mengubah stok. Pipeline sekarang memerlukan parser menerima chat terlebih dahulu dan hasil AI harus cocok dengan parser. Karena itu, pipeline belum memperluas cakupan bahasa yang bisa diterima parser; keberhasilan pipeline tidak otomatis membuktikan AI lebih akurat.

Schema model mentah hanya meminta daftar menu/jumlah, tanpa keputusan `manual`. Schema membatasi bentuk keluaran, tidak menjamin kebenaran maknanya. Pengujian pesan ambigu tetap diperlukan untuk mengukur keluaran salah yang lolos format.

V0.49 memperketat bukti jumlah: setiap angka harus terikat pada menu yang dikenali. Angka catatan yang belum mempunyai schema variasi, jumlah bertanda dan bilangan terbilang di luar satu–sepuluh diarahkan ke manual. Dataset tetap diberi label manusia dari makna pesan, **bukan** mengikuti keputusan parser supaya skor terlihat baik. Penolakan pesanan jelas tetap dihitung sebagai `rejectedClearOrders`. [Perubahan dan batas](AI_QUANTITY_VALIDATION.md).

## Dataset nyata yang diperlukan

Salin `datasets/templates/chat-dataset.json` ke `datasets/private/chat-dataset.json`. Isi hanya dari chat aktual yang diizinkan pemiliknya. Jangan membuat pesan fiktif untuk memenuhi jumlah dataset. Hapus nama pelanggan, nomor telepon, alamat, bukti pembayaran dan informasi pribadi lain sebelum menyimpan teks. Pertahankan kata/jumlah pesanan yang dibutuhkan anotasi. Flag izin/redaksi/anotasi adalah pernyataan penyedia data, bukan verifikasi otomatis oleh kode.

Satu file memakai satu snapshot katalog aktual. Jika usaha atau katalognya berbeda, gunakan file berbeda. Tidak perlu harga atau resep untuk evaluasi ini.

| Bagian | Isi |
|---|---|
| `provenance.source` | `consented_business_chats` |
| `provenance.reference` | Referensi sumber/izin yang benar, minimal lima karakter |
| `permissionConfirmed`, `redacted`, `humanAnnotated` | `true` hanya setelah masing-masing benar-benar dipenuhi |
| `menu` | Array katalog aktual: `id`, `name`, `aliases`; alias unik, huruf kecil |
| `records[].id` | ID pseudonim unik pesan; jangan gunakan nomor telepon |
| `records[].conversationId` | ID pseudonim percakapan, konsisten untuk seluruh pesan satu percakapan |
| `records[].split` | `train`, `validation` atau `test` |
| `records[].text` | Pesan aktual setelah redaksi, maksimal 2.000 karakter |
| `records[].expected.action` | `extract` jika menu dan jumlah jelas; selain itu `manual` |
| `records[].expected.items` | Untuk `extract`: ID menu aktual dan `qty` integer 1–99; untuk `manual`: array kosong |
| `records[].expected.items[].requiredNoteFragments` | Wajib pada schema 2: potongan catatan dari chat yang harus dipertahankan, maksimal 20 fragmen per item. `[]` berarti sudah diperiksa tanpa catatan wajib. Pertahankan negasi, misalnya frasa lengkap “tanpa gula”. |

## Panduan anotasi dan pemisahan

Manusia memberi label dari pesan asli dan katalog yang berlaku, sebelum melihat prediksi. Pesan jelas memerlukan seluruh menu/jumlah sesuai katalog. Pembatalan, perubahan jumlah yang membutuhkan konteks, jumlah tidak pasti, menu di luar katalog, dan instruksi yang bukan pesanan diberi `manual` ketika tidak aman dikonfirmasi dari satu pesan.

Schema 2 mewajibkan anotasi catatan untuk setiap item berlabel `extract`. Anotator menyalin frasa lengkap dari pesan, termasuk negasi, setelah memeriksa menu tujuan. Jangan membuat atau menebak fragmen. Jika tidak ada catatan wajib, isi array kosong secara eksplisit. Dataset schema 1 tetap dapat dibaca: anotasi yang hilang berarti **belum dinilai**, bukan catatan sudah benar. Sebagian item beranotasi tidak dianggap satu pesanan yang seluruh catatannya telah diperiksa.

Metrik catatan hanya mengukur apakah fragmen literal masih ada pada catatan item setelah normalisasi huruf besar/kecil, Unicode dan spasi. Ini tidak membuktikan penempatan atau pemahaman variasi benar. Parser menyimpan pesan asli jika ada kata di luar pasangan menu/jumlah; untuk beberapa item, konteks lengkap yang sama dapat muncul di setiap item. Pengguna tetap perlu mengoreksi catatan per item. Pesan dengan catatan lebih dari 500 karakter diarahkan ke pemeriksaan manual, tanpa pemotongan diam-diam.

Pisahkan berdasarkan percakapan sebelum mengembangkan parser/prompt. Semua pesan dalam satu percakapan masuk split yang sama. Validator menolak ID percakapan atau teks identik setelah normalisasi yang muncul lintas split. Pemeriksaan ini belum mendeteksi parafrase/duplikasi semantik; kurator tetap memeriksa sumber. Gunakan `validation` untuk pengembangan dan jangan menyesuaikan parser/prompt berdasarkan `test` lalu mengklaim test itu independen.

## Menjalankan

```powershell
npm run evaluate:chat -- --help
# Jalankan hanya setelah file chat nyata berizin dan anotasinya tersedia:
npm run evaluate:chat -- --dataset datasets/private/chat-dataset.json --provider rules --split validation
npm run evaluate:chat -- --dataset datasets/private/chat-dataset.json --provider ollama --split test
```

Mode `rules` tidak memanggil AI dan melaporkan `rawModel: not_run`, tanpa angka pengganti untuk model. Mode `ollama` mengirim chat hanya ke server Ollama loopback. Qwen harus sudah terpasang; tidak ada download atau pelatihan otomatis. Model mentah dan pipeline dipanggil terpisah secara berurutan, dengan temperature nol. Timeout default 45 detik per panggilan; kasus gagal tetap dilaporkan. Satu chat dapat memerlukan dua panggilan, kecuali parser sudah menolak pada pipeline.

Run baru ditulis di `data/evaluation/chat/`, diabaikan Git. `protocol.json` membekukan hash file dataset dan kode evaluator/ekstraktor, versi schema dataset/laporan, kebijakan metrik, pilihan provider/model/split dan timeout sebelum prediksi. `report.json` schema 2 menyimpan label ID/jumlah, hasil per kasus, metrik, fallback serta error. Teks chat, nama menu, catatan hasil, fragmen anotasi, ID pesan/percakapan asli dan respons mentah model tidak disalin ke laporan. Catatan dinilai di memori sebelum diganti panjang dan SHA-256; hasil penilaian memuat hitungan fragmen, bukan teksnya. ID pesan/percakapan di-hash. Hash bukan jaminan anonimisasi; label menu dan jumlah tetap termasuk data privat. Dataset asal disimpan privat agar provenance dapat diperiksa pemilik. Run lama tidak ditimpa. Tidak ada akses SQLite atau pemanggilan API mutasi aplikasi.

## Arti metrik

| Metrik | Definisi |
|---|---|
| `exactMatchRate` | Proporsi semua kasus yang tepat: seluruh menu/jumlah cocok, atau keputusan manual tepat. Error tidak dihitung benar. |
| `unsafeAcceptanceRate` | Kasus yang diterima dengan menu/jumlah salah atau seharusnya manual, dibagi seluruh kasus. |
| `falseAcceptanceOnManualRate` | Kasus berlabel manual yang malah diterima, dibagi seluruh kasus berlabel manual. `null` jika tidak ada label manual. |
| `rejectedClearOrders` | Jumlah pesanan berlabel jelas yang ditolak untuk manual. |
| `errors` dan `modeCounts` | Error model/layanan, pemakaian model, parser dan fallback; tidak disembunyikan dari hasil. |
| `latencyMs.p50/p95` | Durasi panggilan masing-masing jalur, termasuk timeout/fallback; belum memisahkan cold/warm inference. |
| `requiredNotes.annotationCoverageRate` | Proporsi pesanan jelas yang seluruh itemnya beranotasi catatan. `null` tanpa pesanan jelas. |
| `requiredNotes.retentionRate` | Fragmen wajib yang bertahan dibagi semua fragmen wajib berlabel. Penolakan/error tetap berada pada denominator. `null` tanpa fragmen wajib. |
| `requiredNotes.acceptedOrdersWithMissingNotes` | Pesanan diterima yang kehilangan fragmen berlabel, meskipun menu/jumlah dapat benar. |
| `requiredNotes.menuQuantityAndRequiredNotesMatchRate` | Menu/jumlah benar dan semua fragmen wajib bertahan, dibagi pesanan beranotasi lengkap. Error/penolakan tidak benar; tanpa anotasi lengkap nilainya `null`. Bukan skor pemahaman semantik. |

Sembilan belas tes kontrak memakai fixture terisolasi dan stub respons di `tests/chat-evaluation.test.mjs`, termasuk catatan hilang, redaksi laporan, anotasi sebagian, error, angka ambigu dan kompatibilitas schema lama. Fixture ini bukan data lapangan atau training; tidak dimasukkan ke aplikasi atau dilaporkan sebagai akurasi Qwen. Jalankan `npm run test:chat`.

# Panduan Agent

## Scope dan referensi

Instruksi ini berlaku untuk seluruh repository, kecuali ada `AGENTS.md` yang lebih dekat dengan file terkait.

Untuk perubahan lintas package, lifecycle agent, penyimpanan, protokol, atau integrasi eksternal, baca [ARCHITECTURE.md](ARCHITECTURE.md) terlebih dahulu. Dokumen tersebut memetakan implementasi checkout ini dan batasannya; kode serta konfigurasi tetap sumber kebenaran.

## Aturan kerja

- Telusuri caller dan jalur runtime sebelum mengedit. Gunakan pola yang sudah ada; perubahan dibatasi pada kebutuhan tugas.
- Pertahankan perubahan pengguna. Commit, push, rebase, dan perubahan riwayat hanya bila diminta.
- Setiap push wajib ke fork Kodrat: remote `fork`, URL `https://github.com/kodratIT/bifold-wallet.git`. Jangan push ke upstream OpenWallet pada `origin`. Gunakan `git push fork <branch>` dan periksa branch serta URL remote aktual sebelum menjalankannya. Force push hanya atas permintaan eksplisit; gunakan `--force-with-lease`.
- Jangan memasukkan `.env`, wallet database, mnemonic, private key, backup wallet, token, atau log berisi credential ke Git maupun dokumentasi.

## Jalur implementasi

- `samples/app/index.js` dan `samples/app/container-imp.tsx` adalah composition root. Gunakan token/container yang sudah ada untuk override layar dan service.
- Runtime, navigation, auth, dan agent dimiliki `packages/core`; `packages/react-hooks` memproyeksikan record/event ke React. Provider UI bukan persistence authoritative.
- Sample memakai `@bifold/ui`, bukan `@bifold/custom-ui`. Router presentation kustom tetap mempertahankan fallback layar core untuk request yang tidak cocok.
- OpenID aktif memakai Credo melalui `packages/core/src/modules/openid`. Package `packages/openid4vp` mandiri bukan jalur runtime sample yang sama.
- Saat mengubah protokol DIDComm, periksa namespace `agent.modules.didcomm.*`; sejumlah caller lama masih memakai namespace sebelumnya. Jangan menyalin caller lama tanpa memeriksa API yang dipakai agent saat ini.
- Periksa `samples/app/metro.config.js` sebelum menyimpulkan consumer memakai output build atau source lokal. Sample memaksa beberapa entrypoint ke source workspace.

## Batas keamanan

- Pisahkan store Askar, secret/keychain, dan preferensi AsyncStorage. Jangan memindahkan secret ke storage preferensi.
- Biometric unlock, secure-environment holder binding, device attestation, validasi kriptografi, dan Trust Registry authorization adalah mekanisme berbeda. Jangan menganggap satu menggantikan yang lain.
- Trust Registry opsional. Default/no-op saat disabled atau konfigurasi tidak lengkap harus tetap aman dirender. Warning dan confirmation yang ada bukan bukti hard enforcement, terutama pada OpenID.
- `DEV_MODE` Trust Registry memiliki bypass development. Jangan menyebut hasil bypass sebagai verifikasi registry.
- OCA mengatur tampilan, bukan validitas credential atau otorisasi issuer.
- Perubahan backup/restore harus memperhitungkan kegagalan import: implementasi saat ini menghapus wallet lama sebelum import selesai. Hindari operasi terhadap wallet pengguna untuk smoke test; gunakan data disposable.
- Periksa payload logger sebelum menambah logging atau transport remote. Request, presentation, credential, serta mnemonic dapat berisi data sensitif.

## Menjalankan dan memverifikasi

- Ambil perintah dan versi dari manifest root serta `samples/app/package.json`; gunakan Yarn yang ditetapkan repository. CI ada pada `.github/workflows`, tetapi trigger workflow tidak selalu mencakup branch kerja.
- Untuk perubahan native, periksa Podfile, plist, Gradle, dan dependency terkait bersama-sama. Expo dependency tidak berarti aplikasi dapat dijalankan sebagai Expo Go.
- Ambil bundle identifier dari konfigurasi atau binary build aktual sebelum `devicectl` launch. `com.ariesbifold` pernah menyebabkan launch gagal karena identifier tersebut tidak terpasang.
- Jalankan pemeriksaan yang mencakup perubahan, lalu smoke alur yang terdampak bila runtime tersedia. Untuk UI, periksa layar yang benar-benar dipilih container/router sample.
- Build sukses, install sukses, process launch sukses, dan keberhasilan alur pengguna adalah bukti berbeda. Laporkan hanya tahap yang teramati; jangan menyatakan crash teratasi dari build saja.
- Tunggu hasil final background command sebelum menyatakan sukses. Bila runtime tidak tersedia, sebutkan batas verifikasi secara spesifik.
- Perubahan dokumentasi saja cukup diverifikasi melalui referensi lokal dan konsistensi dengan source; tidak memerlukan build native.

## Pemeliharaan

Perbarui `ARCHITECTURE.md` bila wiring, ownership storage, protokol, atau default keamanan berubah. Simpan `AGENTS.md` sebagai aturan tindakan dan pitfall terverifikasi, bukan salinan struktur kode atau daftar versi dependency.

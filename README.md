# Skin Minecraft and Mods

Starter website komunitas untuk Minecraft Bedrock dengan:
- Login dan pendaftaran akun.
- Semua halaman koleksi membutuhkan login.
- Upload resmi hanya untuk admin.
- Upload anggota masuk antrean dan harus disetujui admin.
- Admin dapat menyetujui dan menghapus karya.
- Anggota dapat menghapus karya miliknya.
- Download file `.mcaddon`, `.mcpack`, `.mcworld`, `.png`, dan format umum lainnya.

## Teknologi
Next.js + Supabase Auth + Supabase Database + Supabase Storage.

## Menjalankan website
1. Install Node.js versi LTS.
2. Buat project di https://supabase.com.
3. Buka SQL Editor di Supabase, lalu jalankan isi `supabase/schema.sql`.
4. Buka Storage, buat bucket `minecraft-files`, aktifkan **Public bucket**.
5. Salin `.env.example` menjadi `.env.local`, isi URL project dan anon/public key dari Supabase.
6. Di terminal pada folder proyek, jalankan:
   ```bash
   npm install
   npm run dev
   ```
7. Buka `http://localhost:3000`.

## Jadikan akunmu admin
1. Daftar melalui website menggunakan email milikmu.
2. Di Supabase > SQL Editor, jalankan perintah berikut dengan email akunmu:
   ```sql
   update public.profiles p
   set role = 'admin'
   from auth.users u
   where p.id = u.id and u.email = 'EMAIL_KAMU';
   ```
3. Logout lalu login kembali. Label ADMIN akan muncul dan pilihan upload resmi tersedia.

## Deploy online
Import folder proyek ini ke GitHub, lalu deploy melalui Vercel. Tambahkan dua environment variables dari `.env.local` ke pengaturan project Vercel. Website akan online setelah deployment selesai.

## Catatan keamanan dan moderasi
- Jangan pernah menaruh `service_role` key di browser atau file `.env` yang diawali `NEXT_PUBLIC_`.
- Admin pertama harus ditetapkan melalui SQL di dashboard Supabase.
- Upload komunitas otomatis berstatus `pending`, sehingga tidak tampil ke publik sebelum admin menyetujui.
- Untuk produksi, tambahkan batas ukuran file, pemeriksaan tipe file di server, proteksi spam/rate limit, serta mekanisme laporan konten.

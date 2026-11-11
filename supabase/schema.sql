-- Jalankan seluruh SQL ini di Supabase SQL Editor.
-- Buat bucket publik bernama minecraft-files sebelum mengaktifkan upload.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text,
  role text not null default 'member' check (role in ('admin','member')),
  created_at timestamptz not null default now()
);

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  kind text not null check (kind in ('mod','skin')),
  source text not null check (source in ('official','community')),
  status text not null default 'pending' check (status in ('pending','approved')),
  file_name text not null,
  storage_path text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username)
  values (new.id, coalesce(new.raw_user_meta_data->>'username', split_part(new.email,'@',1)));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.items enable row level security;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

drop policy if exists "Profiles readable by signed-in users" on public.profiles;
create policy "Profiles readable by signed-in users" on public.profiles
for select to authenticated using (true);

drop policy if exists "Users update own username" on public.profiles;
create policy "Users update own username" on public.profiles
for update to authenticated using (id = auth.uid()) with check (id = auth.uid() and role = 'member');

drop policy if exists "Read approved or own or admin items" on public.items;
create policy "Read approved or own or admin items" on public.items
for select to authenticated using (status = 'approved' or owner_id = auth.uid() or public.is_admin());

drop policy if exists "Members submit community pending and admins submit official" on public.items;
create policy "Members submit community pending and admins submit official" on public.items
for insert to authenticated with check (
  owner_id = auth.uid() and (
    (source = 'community' and status = 'pending') or
    (source = 'official' and status = 'approved' and public.is_admin())
  )
);

drop policy if exists "Admins approve items" on public.items;
create policy "Admins approve items" on public.items
for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Owner or admin delete items" on public.items;
create policy "Owner or admin delete items" on public.items
for delete to authenticated using (owner_id = auth.uid() or public.is_admin());

-- Storage: bucket publik untuk file download. Buat bucket 'minecraft-files'
-- dengan Public bucket = ON melalui Storage > New bucket.
drop policy if exists "Signed-in users upload own folder" on storage.objects;
create policy "Signed-in users upload own folder" on storage.objects
for insert to authenticated with check (
  bucket_id = 'minecraft-files' and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Public can read minecraft files" on storage.objects;
create policy "Public can read minecraft files" on storage.objects
for select to public using (bucket_id = 'minecraft-files');

drop policy if exists "Owner or admin delete stored file" on storage.objects;
create policy "Owner or admin delete stored file" on storage.objects
for delete to authenticated using (
  bucket_id = 'minecraft-files' and (
    (storage.foldername(name))[1] = auth.uid()::text or public.is_admin()
  )
);

-- SET ADMIN:
-- 1. Daftar akunmu melalui website terlebih dahulu.
-- 2. Ganti EMAIL_KAMU dengan email akunmu lalu jalankan:
-- update public.profiles p set role = 'admin'
-- from auth.users u where p.id = u.id and u.email = 'EMAIL_KAMU';

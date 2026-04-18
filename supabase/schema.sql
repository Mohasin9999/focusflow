create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  age integer check (age between 10 and 100),
  occupation text,
  email text unique,
  weekly_goal_preset text not null default 'average' check (weekly_goal_preset in ('beginner', 'average', 'intensive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
add column if not exists weekly_goal_preset text not null default 'average';

alter table public.profiles
drop constraint if exists profiles_weekly_goal_preset_check;

alter table public.profiles
add constraint profiles_weekly_goal_preset_check
check (weekly_goal_preset in ('beginner', 'average', 'intensive'));

alter table public.profiles
drop constraint if exists profiles_full_name_not_blank;

alter table public.profiles
add constraint profiles_full_name_not_blank
check (btrim(full_name) <> '');

create table if not exists public.user_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  weekly_goal_preset text not null default 'average' check (weekly_goal_preset in ('beginner', 'average', 'intensive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.user_settings (user_id, weekly_goal_preset)
select id, coalesce(weekly_goal_preset, 'average')
from public.profiles
on conflict (user_id) do update
set weekly_goal_preset = excluded.weekly_goal_preset;

create table if not exists public.logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  source text not null check (source in ('activity', 'session')),
  type_id text not null check (type_id in ('study', 'sleep', 'focus')),
  duration_secs integer not null default 0 check (duration_secs >= 0),
  distracted_secs integer not null default 0 check (distracted_secs >= 0),
  session_name text not null default '',
  notes text not null default '',
  timestamp timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.logs
add column if not exists session_name text not null default '';

update public.logs
set session_name = notes
where source = 'session'
  and btrim(session_name) = ''
  and btrim(notes) <> '';

create table if not exists public.study_material_folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

alter table public.study_material_folders
drop constraint if exists study_material_folders_name_not_blank;

alter table public.study_material_folders
add constraint study_material_folders_name_not_blank
check (btrim(name) <> '');

create table if not exists public.study_materials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  folder_id uuid references public.study_material_folders(id) on delete set null,
  name text not null,
  file_type text not null default 'application/octet-stream',
  size bigint not null default 0 check (size >= 0),
  storage_path text not null,
  uploaded_at timestamptz not null default now()
);

alter table public.study_materials
drop constraint if exists study_materials_name_not_blank;

alter table public.study_materials
add constraint study_materials_name_not_blank
check (btrim(name) <> '');

alter table public.study_materials
drop constraint if exists study_materials_storage_path_not_blank;

alter table public.study_materials
add constraint study_materials_storage_path_not_blank
check (btrim(storage_path) <> '');

create index if not exists logs_user_id_timestamp_idx
on public.logs (user_id, timestamp desc);

create index if not exists logs_user_id_type_id_timestamp_idx
on public.logs (user_id, type_id, timestamp desc);

create index if not exists study_material_folders_user_id_idx
on public.study_material_folders (user_id);

create index if not exists study_materials_user_id_idx
on public.study_materials (user_id);

create index if not exists study_materials_folder_id_idx
on public.study_materials (folder_id);

create or replace function public.set_current_timestamp_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, email, full_name, age, occupation)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    nullif(new.raw_user_meta_data->>'age', '')::integer,
    coalesce(new.raw_user_meta_data->>'occupation', '')
  );
  insert into public.user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create or replace function public.sync_profile_from_auth_user()
returns trigger
language plpgsql
security definer
as $$
begin
  update public.profiles
  set
    email = new.email,
    full_name = coalesce(new.raw_user_meta_data->>'full_name', public.profiles.full_name),
    age = coalesce(nullif(new.raw_user_meta_data->>'age', '')::integer, public.profiles.age),
    occupation = coalesce(new.raw_user_meta_data->>'occupation', public.profiles.occupation)
  where id = new.id;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

drop trigger if exists on_auth_user_updated_sync_profile on auth.users;
create trigger on_auth_user_updated_sync_profile
after update on auth.users
for each row execute procedure public.sync_profile_from_auth_user();

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute procedure public.set_current_timestamp_updated_at();

drop trigger if exists set_user_settings_updated_at on public.user_settings;
create trigger set_user_settings_updated_at
before update on public.user_settings
for each row execute procedure public.set_current_timestamp_updated_at();

drop trigger if exists set_study_material_folders_updated_at on public.study_material_folders;
create trigger set_study_material_folders_updated_at
before update on public.study_material_folders
for each row execute procedure public.set_current_timestamp_updated_at();

alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.logs enable row level security;
alter table public.study_material_folders enable row level security;
alter table public.study_materials enable row level security;

drop policy if exists "users can view own profile" on public.profiles;
create policy "users can view own profile"
on public.profiles
for select
using (auth.uid() = id);

drop policy if exists "users can update own profile" on public.profiles;
create policy "users can update own profile"
on public.profiles
for update
using (auth.uid() = id);

drop policy if exists "users can insert own profile" on public.profiles;
create policy "users can insert own profile"
on public.profiles
for insert
with check (auth.uid() = id);

drop policy if exists "users can view own settings" on public.user_settings;
create policy "users can view own settings"
on public.user_settings
for select
using (auth.uid() = user_id);

drop policy if exists "users can insert own settings" on public.user_settings;
create policy "users can insert own settings"
on public.user_settings
for insert
with check (auth.uid() = user_id);

drop policy if exists "users can update own settings" on public.user_settings;
create policy "users can update own settings"
on public.user_settings
for update
using (auth.uid() = user_id);

drop policy if exists "users can delete own settings" on public.user_settings;
create policy "users can delete own settings"
on public.user_settings
for delete
using (auth.uid() = user_id);

drop policy if exists "users can view own logs" on public.logs;
create policy "users can view own logs"
on public.logs
for select
using (auth.uid() = user_id);

drop policy if exists "users can insert own logs" on public.logs;
create policy "users can insert own logs"
on public.logs
for insert
with check (auth.uid() = user_id);

drop policy if exists "users can update own logs" on public.logs;
create policy "users can update own logs"
on public.logs
for update
using (auth.uid() = user_id);

drop policy if exists "users can delete own logs" on public.logs;
create policy "users can delete own logs"
on public.logs
for delete
using (auth.uid() = user_id);

drop policy if exists "users can view own folders" on public.study_material_folders;
create policy "users can view own folders"
on public.study_material_folders
for select
using (auth.uid() = user_id);

drop policy if exists "users can insert own folders" on public.study_material_folders;
create policy "users can insert own folders"
on public.study_material_folders
for insert
with check (auth.uid() = user_id);

drop policy if exists "users can update own folders" on public.study_material_folders;
create policy "users can update own folders"
on public.study_material_folders
for update
using (auth.uid() = user_id);

drop policy if exists "users can delete own folders" on public.study_material_folders;
create policy "users can delete own folders"
on public.study_material_folders
for delete
using (auth.uid() = user_id);

drop policy if exists "users can view own materials" on public.study_materials;
create policy "users can view own materials"
on public.study_materials
for select
using (auth.uid() = user_id);

drop policy if exists "users can insert own materials" on public.study_materials;
create policy "users can insert own materials"
on public.study_materials
for insert
with check (auth.uid() = user_id);

drop policy if exists "users can update own materials" on public.study_materials;
create policy "users can update own materials"
on public.study_materials
for update
using (auth.uid() = user_id);

drop policy if exists "users can delete own materials" on public.study_materials;
create policy "users can delete own materials"
on public.study_materials
for delete
using (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('study-materials', 'study-materials', false)
on conflict (id) do nothing;

drop policy if exists "authenticated users can view own study materials objects" on storage.objects;
create policy "authenticated users can view own study materials objects"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'study-materials'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "authenticated users can upload own study materials objects" on storage.objects;
create policy "authenticated users can upload own study materials objects"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'study-materials'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "authenticated users can update own study materials objects" on storage.objects;
create policy "authenticated users can update own study materials objects"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'study-materials'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'study-materials'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "authenticated users can delete own study materials objects" on storage.objects;
create policy "authenticated users can delete own study materials objects"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'study-materials'
  and (storage.foldername(name))[1] = auth.uid()::text
);

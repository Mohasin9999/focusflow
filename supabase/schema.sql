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
  log_date date not null default current_date,
  created_at timestamptz not null default now()
);

alter table public.logs
add column if not exists session_name text not null default '';

alter table public.logs
add column if not exists log_date date;

update public.logs
set session_name = notes
where source = 'session'
  and btrim(session_name) = ''
  and btrim(notes) <> '';

update public.logs
set log_date = timestamp::date
where log_date is null
  or (
    log_date = current_date
    and created_at < date_trunc('day', now())
    and timestamp::date <> current_date
  );

alter table public.logs
alter column log_date set default current_date;

alter table public.logs
alter column log_date set not null;

create table if not exists public.daily_focus_totals (
  user_id uuid not null references public.profiles(id) on delete cascade,
  focus_date date not null,
  total_focus_secs integer not null default 0 check (total_focus_secs >= 0),
  total_distracted_secs integer not null default 0 check (total_distracted_secs >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, focus_date)
);

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

create table if not exists public.ai_coach_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
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

create index if not exists logs_user_id_log_date_type_id_idx
on public.logs (user_id, log_date, type_id);

create index if not exists daily_focus_totals_user_id_focus_date_idx
on public.daily_focus_totals (user_id, focus_date desc);

create index if not exists study_material_folders_user_id_idx
on public.study_material_folders (user_id);

create index if not exists study_materials_user_id_idx
on public.study_materials (user_id);

create index if not exists study_materials_folder_id_idx
on public.study_materials (folder_id);

create index if not exists ai_coach_messages_user_id_created_at_idx
on public.ai_coach_messages (user_id, created_at asc);

create or replace function public.set_current_timestamp_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.refresh_daily_focus_total(target_user_id uuid, target_focus_date date)
returns void
language plpgsql
security definer
as $$
declare
  focus_total integer;
  distracted_total integer;
begin
  if target_user_id is null or target_focus_date is null then
    return;
  end if;

  select
    coalesce(sum(duration_secs), 0)::integer,
    coalesce(sum(distracted_secs), 0)::integer
  into focus_total, distracted_total
  from public.logs
  where user_id = target_user_id
    and log_date = target_focus_date
    and type_id = 'focus';

  insert into public.daily_focus_totals (
    user_id,
    focus_date,
    total_focus_secs,
    total_distracted_secs,
    updated_at
  )
  values (
    target_user_id,
    target_focus_date,
    focus_total,
    distracted_total,
    now()
  )
  on conflict (user_id, focus_date) do update
  set
    total_focus_secs = excluded.total_focus_secs,
    total_distracted_secs = excluded.total_distracted_secs,
    updated_at = now();
end;
$$;

create or replace function public.sync_daily_focus_totals_from_logs()
returns trigger
language plpgsql
security definer
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') and new.type_id = 'focus' then
    perform public.refresh_daily_focus_total(new.user_id, new.log_date);
  end if;

  if tg_op in ('UPDATE', 'DELETE') and old.type_id = 'focus' then
    perform public.refresh_daily_focus_total(old.user_id, old.log_date);
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

delete from public.daily_focus_totals totals
where not exists (
  select 1
  from public.logs logs
  where logs.user_id = totals.user_id
    and logs.log_date = totals.focus_date
    and logs.type_id = 'focus'
);

insert into public.daily_focus_totals (user_id, focus_date, total_focus_secs, total_distracted_secs, updated_at)
select
  user_id,
  log_date,
  coalesce(sum(duration_secs), 0)::integer,
  coalesce(sum(distracted_secs), 0)::integer,
  now()
from public.logs
where type_id = 'focus'
group by user_id, log_date
on conflict (user_id, focus_date) do update
set
  total_focus_secs = excluded.total_focus_secs,
  total_distracted_secs = excluded.total_distracted_secs,
  updated_at = now();

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

drop trigger if exists sync_daily_focus_totals_after_logs_change on public.logs;
create trigger sync_daily_focus_totals_after_logs_change
after insert or update or delete on public.logs
for each row execute procedure public.sync_daily_focus_totals_from_logs();

drop trigger if exists set_study_material_folders_updated_at on public.study_material_folders;
create trigger set_study_material_folders_updated_at
before update on public.study_material_folders
for each row execute procedure public.set_current_timestamp_updated_at();

alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.logs enable row level security;
alter table public.daily_focus_totals enable row level security;
alter table public.study_material_folders enable row level security;
alter table public.study_materials enable row level security;
alter table public.ai_coach_messages enable row level security;

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

drop policy if exists "users can view own daily focus totals" on public.daily_focus_totals;
create policy "users can view own daily focus totals"
on public.daily_focus_totals
for select
using (auth.uid() = user_id);

drop policy if exists "users can view own ai coach messages" on public.ai_coach_messages;
create policy "users can view own ai coach messages"
on public.ai_coach_messages
for select
using (auth.uid() = user_id);

drop policy if exists "users can insert own ai coach messages" on public.ai_coach_messages;
create policy "users can insert own ai coach messages"
on public.ai_coach_messages
for insert
with check (auth.uid() = user_id);

drop policy if exists "users can delete own ai coach messages" on public.ai_coach_messages;
create policy "users can delete own ai coach messages"
on public.ai_coach_messages
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

create table if not exists public.cat_profiles (
  session_id text primary key,
  nickname text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cat_profiles_updated_at_idx
  on public.cat_profiles(updated_at desc);

alter table public.cat_profiles enable row level security;
revoke all on table public.cat_profiles from anon, authenticated;

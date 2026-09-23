-- V2 growth engine. Applied to production Supabase on 2026-09-23.
create extension if not exists pgcrypto;

alter table public.cat_feedback
  add column if not exists run_id uuid,
  add column if not exists cat_id text not null default '',
  add column if not exists experiment_key text not null default 'difficulty_v2';

alter table public.cat_feedback enable row level security;
revoke all on table public.cat_feedback from anon, authenticated;

create table if not exists public.cat_events (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  session_id text not null,
  run_id uuid,
  event_name text not null,
  score integer not null default 0 check (score >= 0 and score <= 100000),
  experiment_key text not null default 'difficulty_v2',
  experiment_variant text not null default '',
  cat_id text not null default '',
  challenge_target integer not null default 0 check (challenge_target >= 0),
  country text not null default '',
  device text not null default '',
  payload jsonb not null default '{}'::jsonb
);
create index if not exists cat_events_created_at_idx on public.cat_events(created_at desc);
create index if not exists cat_events_name_created_idx on public.cat_events(event_name, created_at desc);
create index if not exists cat_events_variant_created_idx on public.cat_events(experiment_variant, created_at desc);
create index if not exists cat_events_session_idx on public.cat_events(session_id, created_at desc);
alter table public.cat_events enable row level security;
revoke all on table public.cat_events from anon, authenticated;

create table if not exists public.cat_runs (
  run_id uuid primary key,
  token_hash text not null,
  session_id text not null,
  nickname text not null default '',
  cat_id text not null default '',
  experiment_key text not null default 'difficulty_v2',
  experiment_variant text not null default '',
  challenge_target integer not null default 0 check (challenge_target >= 0),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  duration_ms integer,
  score integer not null default 0 check (score >= 0 and score <= 100000),
  valid boolean not null default false,
  country text not null default '',
  device text not null default '',
  user_agent_family text not null default '',
  metadata jsonb not null default '{}'::jsonb
);
create index if not exists cat_runs_valid_score_idx on public.cat_runs(valid, score desc, finished_at desc);
create index if not exists cat_runs_session_idx on public.cat_runs(session_id, finished_at desc);
create index if not exists cat_runs_finished_idx on public.cat_runs(finished_at desc) where valid = true;
alter table public.cat_runs enable row level security;
revoke all on table public.cat_runs from anon, authenticated;

create table if not exists public.cat_experiments (
  experiment_key text primary key,
  version integer not null default 1,
  enabled boolean not null default true,
  variants jsonb not null,
  weights jsonb not null,
  min_sessions_per_variant integer not null default 200,
  primary_metric text not null default 'repeat_session_rate',
  max_unfair_rate numeric(5,4) not null default 0.35,
  updated_at timestamptz not null default now()
);
alter table public.cat_experiments enable row level security;
revoke all on table public.cat_experiments from anon, authenticated;

create table if not exists public.cat_experiment_audit (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  experiment_key text not null,
  old_weights jsonb not null,
  new_weights jsonb not null,
  reason text not null,
  metrics jsonb not null default '{}'::jsonb
);
alter table public.cat_experiment_audit enable row level security;
revoke all on table public.cat_experiment_audit from anon, authenticated;

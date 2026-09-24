-- V4 adaptive difficulty engine.
-- Player model + hazard scheduler + contextual Thompson Sampling + fairness guardrails.

alter table public.cat_runs
  add column if not exists adaptive_arm text not null default '';

create index if not exists cat_runs_adaptive_arm_idx
  on public.cat_runs(adaptive_arm, finished_at desc);

create table if not exists public.cat_adaptive_players (
  session_id text primary key,
  reaction_mu_ms numeric(8,2) not null default 285,
  reaction_sigma_ms numeric(8,2) not null default 90,
  deception_skill numeric(6,4) not null default 0.50,
  uncertainty_skill numeric(6,4) not null default 0.50,
  motor_skill numeric(6,4) not null default 0.50,
  pressure_skill numeric(6,4) not null default 0.50,
  observations integer not null default 0,
  survived_looks integer not null default 0,
  deaths integer not null default 0,
  false_stops integer not null default 0,
  last_arm text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.cat_adaptive_arms (
  arm_key text primary key,
  label text not null,
  enabled boolean not null default true,
  alpha numeric(12,4) not null default 1,
  beta numeric(12,4) not null default 1,
  exposures integer not null default 0,
  updates integer not null default 0,
  unfair_reports integer not null default 0,
  params jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.cat_adaptive_updates (
  run_id uuid primary key references public.cat_runs(run_id) on delete cascade,
  session_id text not null,
  arm_key text not null,
  score integer not null default 0,
  reward numeric(6,4) not null default 0,
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists cat_adaptive_players_updated_idx
  on public.cat_adaptive_players(updated_at desc);

create index if not exists cat_adaptive_updates_session_idx
  on public.cat_adaptive_updates(session_id, created_at desc);

alter table public.cat_adaptive_players enable row level security;
alter table public.cat_adaptive_arms enable row level security;
alter table public.cat_adaptive_updates enable row level security;

revoke all on table public.cat_adaptive_players from anon, authenticated;
revoke all on table public.cat_adaptive_arms from anon, authenticated;
revoke all on table public.cat_adaptive_updates from anon, authenticated;

insert into public.cat_adaptive_arms(arm_key,label,params)
values
('reflex','反应猎手','{
  "hazardBase":0.92,
  "timeHazard":1.05,
  "progressHazard":0.34,
  "fakeBias":-0.04,
  "doubleBluffBonus":0.04,
  "anticipationScale":0.84,
  "watchScale":0.94,
  "movementThresholdScale":1.00
}'::jsonb),
('deception','假动作猎手','{
  "hazardBase":0.76,
  "timeHazard":0.82,
  "progressHazard":0.28,
  "fakeBias":0.18,
  "doubleBluffBonus":0.24,
  "anticipationScale":0.98,
  "watchScale":1.00,
  "movementThresholdScale":1.00
}'::jsonb),
('uncertainty','节奏破坏者','{
  "hazardBase":0.70,
  "timeHazard":1.42,
  "progressHazard":0.48,
  "fakeBias":0.07,
  "doubleBluffBonus":0.11,
  "anticipationScale":0.91,
  "watchScale":0.92,
  "movementThresholdScale":1.00
}'::jsonb),
('control','手控压迫','{
  "hazardBase":0.68,
  "timeHazard":0.90,
  "progressHazard":0.62,
  "fakeBias":0.03,
  "doubleBluffBonus":0.08,
  "anticipationScale":0.95,
  "watchScale":0.96,
  "movementThresholdScale":0.82
}'::jsonb),
('pressure','连续高压','{
  "hazardBase":1.02,
  "timeHazard":1.18,
  "progressHazard":0.36,
  "fakeBias":0.06,
  "doubleBluffBonus":0.13,
  "anticipationScale":0.90,
  "watchScale":1.12,
  "movementThresholdScale":0.94
}'::jsonb)
on conflict (arm_key) do update
set label=excluded.label,
    params=excluded.params,
    updated_at=now();

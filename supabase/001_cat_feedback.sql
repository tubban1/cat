create table if not exists cat_feedback (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  session_id text not null,
  fairness text not null check (fairness in ('too_easy','fair','unfair')),
  message text not null default '',
  score integer not null default 0 check (score >= 0),
  challenge_target integer not null default 0 check (challenge_target >= 0),
  experiment_variant text not null default 'A',
  locale text not null default '',
  device text not null default '',
  country text not null default '',
  user_agent_family text not null default ''
);

create index if not exists cat_feedback_created_at_idx
  on cat_feedback (created_at desc);

create index if not exists cat_feedback_variant_idx
  on cat_feedback (experiment_variant, fairness);

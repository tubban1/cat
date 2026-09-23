import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __catFeedbackPool: Pool | undefined;
  // eslint-disable-next-line no-var
  var __catFeedbackInit: Promise<unknown> | undefined;
}

function getConnectionString() {
  return process.env.SUPABASE_DB_URL?.trim() || "";
}

export function feedbackDbConfigured() {
  return Boolean(getConnectionString());
}

export function getFeedbackPool() {
  const connectionString = getConnectionString();
  if (!connectionString) {
    throw new Error("SUPABASE_DB_URL is not configured");
  }

  if (!globalThis.__catFeedbackPool) {
    globalThis.__catFeedbackPool = new Pool({
      connectionString,
      max: 3,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 4_000,
      ssl: connectionString.includes("localhost")
        ? false
        : { rejectUnauthorized: false },
    });
  }

  return globalThis.__catFeedbackPool;
}

export async function ensureFeedbackSchema() {
  if (!globalThis.__catFeedbackInit) {
    const pool = getFeedbackPool();
    globalThis.__catFeedbackInit = pool.query(`
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
      create index if not exists cat_feedback_created_at_idx on cat_feedback (created_at desc);
      create index if not exists cat_feedback_variant_idx on cat_feedback (experiment_variant, fairness);
    `);
  }
  return globalThis.__catFeedbackInit;
}

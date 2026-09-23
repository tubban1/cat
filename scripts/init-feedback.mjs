import pg from "pg";

const { Pool } = pg;
const connectionString = process.env.SUPABASE_DB_URL?.trim();
if (!connectionString) throw new Error("SUPABASE_DB_URL is missing");

const pool = new Pool({
  connectionString,
  max: 1,
  connectionTimeoutMillis: 5000,
  ssl: connectionString.includes("localhost") ? false : { rejectUnauthorized: false },
});

try {
  await pool.query(`
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
  const result = await pool.query("select current_database() as db, now() as now");
  console.log("Feedback database ready:", result.rows[0]);
} finally {
  await pool.end();
}

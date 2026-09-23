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
  const result = await pool.query(
    "select current_database() as db, now() as now, " +
    "to_regclass('public.cat_feedback') is not null as feedback_ready, " +
    "to_regclass('public.cat_events') is not null as events_ready, " +
    "to_regclass('public.cat_runs') is not null as runs_ready, " +
    "to_regclass('public.cat_experiments') is not null as experiments_ready, " +
    "to_regclass('public.cat_profiles') is not null as profiles_ready"
  );
  const row = result.rows[0];
  if (!row.feedback_ready || !row.events_ready || !row.runs_ready || !row.experiments_ready || !row.profiles_ready) {
    throw new Error("Cat growth schema is incomplete. Apply Supabase migrations first.");
  }
  console.log("Cat production database ready:", row);
} finally {
  await pool.end();
}

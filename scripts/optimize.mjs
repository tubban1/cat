import pg from "pg";
const { Pool } = pg;

const connectionString = process.env.SUPABASE_DB_URL?.trim();
if (!connectionString) throw new Error("SUPABASE_DB_URL is missing");

const pool = new Pool({
  connectionString,
  max: 1,
  ssl: connectionString.includes("localhost") ? false : { rejectUnauthorized: false },
});

const key = process.env.EXPERIMENT_KEY || "difficulty_v2";
const days = Number(process.env.OPTIMIZE_DAYS || 7);
const since = new Date(Date.now() - days * 86400000);
const apply = process.env.AUTO_OPTIMIZE === "true";

try {
  const expResult = await pool.query(
    "select experiment_key, version, weights, min_sessions_per_variant, max_unfair_rate from cat_experiments where experiment_key=$1 and enabled=true limit 1",
    [key],
  );
  const exp = expResult.rows[0];
  if (!exp) {
    console.log("No active experiment:", key);
    process.exit(0);
  }

  const metricsResult = await pool.query(
    \`with starts as (
       select experiment_variant as variant, session_id, count(*) as plays
         from cat_events
        where event_name='game_start' and created_at >= $1
          and experiment_key=$2 and experiment_variant <> ''
        group by experiment_variant, session_id
     ),
     shares as (
       select distinct experiment_variant as variant, session_id
         from cat_events
        where event_name in ('share_complete','challenge_copy')
          and created_at >= $1 and experiment_key=$2
     ),
     feedback as (
       select experiment_variant as variant,
              count(*)::int as feedbacks,
              (count(*) filter(where fairness='unfair'))::int as unfair
         from cat_feedback
        where created_at >= $1 and experiment_key=$2
        group by experiment_variant
     )
     select s.variant,
            count(*)::int as sessions,
            count(*) filter(where s.plays>=2)::int as repeat_sessions,
            (count(*) filter(where s.plays>=2))::numeric/nullif(count(*),0) as repeat_rate,
            (count(*) filter(where (s.variant,s.session_id) in (select variant,session_id from shares)))::numeric/nullif(count(*),0) as share_rate,
            coalesce(max(f.feedbacks),0)::int as feedbacks,
            coalesce(max(f.unfair),0)::int as unfair,
            case when coalesce(max(f.feedbacks),0)>0
                 then coalesce(max(f.unfair),0)::numeric/max(f.feedbacks)
                 else 0 end as unfair_rate
       from starts s
       left join feedback f on f.variant=s.variant
      group by s.variant
      order by s.variant\`,
    [since, key],
  );

  const rows = metricsResult.rows.map((r) => ({
    variant: r.variant,
    sessions: Number(r.sessions),
    repeatRate: Number(r.repeat_rate || 0),
    shareRate: Number(r.share_rate || 0),
    feedbacks: Number(r.feedbacks || 0),
    unfairRate: Number(r.unfair_rate || 0),
  }));

  console.log("Experiment metrics:", JSON.stringify(rows, null, 2));

  const minSessions = Number(exp.min_sessions_per_variant || 200);
  const variants = Object.keys(exp.weights || {});
  if (variants.length < 2 || variants.some((v) => (rows.find((r) => r.variant === v)?.sessions || 0) < minSessions)) {
    console.log("Not enough data. Need at least " + minSessions + " sessions per variant.");
    process.exit(0);
  }

  const maxUnfair = Number(exp.max_unfair_rate || 0.35);
  const scored = rows
    .map((r) => ({
      ...r,
      score: r.repeatRate + 0.65 * r.shareRate - 1.25 * Math.max(0, r.unfairRate - maxUnfair),
    }))
    .sort((a, b) => b.score - a.score);

  const winner = scored[0];
  const runner = scored[1];
  if (!winner || !runner) process.exit(0);

  const delta = winner.score - runner.score;
  if (winner.unfairRate > maxUnfair || delta < 0.025) {
    console.log("No weight change: winner is unsafe or difference is too small.", { delta, maxUnfair });
    process.exit(0);
  }

  const strongEvidence = winner.sessions >= 1000 && runner.sessions >= 1000 && delta >= 0.05;
  const winnerWeight = strongEvidence ? 0.9 : 0.75;
  const loserWeight = 1 - winnerWeight;
  const newWeights = { ...exp.weights };
  newWeights[winner.variant] = winnerWeight;
  newWeights[runner.variant] = loserWeight;

  console.log("Proposed weights:", newWeights);
  if (!apply) {
    console.log("DRY RUN: set AUTO_OPTIMIZE=true to apply.");
    process.exit(0);
  }

  await pool.query("begin");
  try {
    await pool.query(
      "insert into cat_experiment_audit(experiment_key, old_weights, new_weights, reason, metrics) values($1,$2::jsonb,$3::jsonb,$4,$5::jsonb)",
      [
        key,
        JSON.stringify(exp.weights),
        JSON.stringify(newWeights),
        "auto optimizer: " + winner.variant + " score +" + delta.toFixed(4) + " vs " + runner.variant,
        JSON.stringify({ days, rows: scored }),
      ],
    );
    await pool.query(
      "update cat_experiments set weights=$2::jsonb, updated_at=now() where experiment_key=$1",
      [key, JSON.stringify(newWeights)],
    );
    await pool.query("commit");
    console.log("Weights updated safely.");
  } catch (error) {
    await pool.query("rollback");
    throw error;
  }
} finally {
  await pool.end();
}

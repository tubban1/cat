import pg from "pg";

const base = process.env.SMOKE_BASE_URL || "https://cat.fde.fan";
const connectionString = process.env.SUPABASE_DB_URL?.trim();
if (!connectionString) throw new Error("SUPABASE_DB_URL is missing");

const { Pool } = pg;
const pool = new Pool({
  connectionString,
  max: 1,
  ssl: connectionString.includes("localhost") ? false : { rejectUnauthorized: false },
});

const suffix = Date.now().toString(36);
const sessionId = "smoke_v2_" + suffix;
let runId = "";
let adaptiveArm = "";
let armSnapshot = null;

async function jsonFetch(path, options = {}) {
  const response = await fetch(base + path, options);
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!response.ok) {
    throw new Error(path + " HTTP " + response.status + " " + text.slice(0, 500));
  }
  return data;
}

try {
  const savedProfile = await jsonFetch("/api/profile", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sessionId, nickname: "CI猫友" }),
  });
  if (!savedProfile?.ok || savedProfile?.nickname !== "CI猫友") throw new Error("profile save failed");

  const loadedProfile = await jsonFetch("/api/profile?session=" + encodeURIComponent(sessionId), { cache: "no-store" });
  if (!loadedProfile?.ok || loadedProfile?.profile?.nickname !== "CI猫友") throw new Error("profile load failed");

  const bootstrap = await jsonFetch("/api/bootstrap?session=" + encodeURIComponent(sessionId), { cache: "no-store" });
  if (!bootstrap?.ok || !bootstrap?.experiment?.variant || !bootstrap?.experiment?.config) {
    throw new Error("bootstrap response incomplete");
  }
  if (!bootstrap?.adaptive?.enabled || !bootstrap?.adaptive?.armKey || !bootstrap?.adaptive?.player) {
    throw new Error("adaptive bootstrap response incomplete");
  }
  adaptiveArm = bootstrap.adaptive.armKey;
  const snapshotResult = await pool.query(
    "select alpha::float8,beta::float8,exposures,updates,unfair_reports from cat_adaptive_arms where arm_key=$1",
    [adaptiveArm],
  );
  armSnapshot = snapshotResult.rows[0] || null;

  const start = await jsonFetch("/api/run/start", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      sessionId,
      nickname: "CI猫友",
      catId: "momo",
      variant: bootstrap.experiment.variant,
      experimentKey: bootstrap.experiment.key,
      challengeTarget: 0,
      device: "qa",
      adaptiveArm,
    }),
  });
  if (!start?.ok || !start?.runId || !start?.token) throw new Error("run start failed");
  runId = start.runId;

  await new Promise((resolve) => setTimeout(resolve, 900));

  const finish = await jsonFetch("/api/run/finish", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      runId,
      token: start.token,
      sessionId,
      nickname: "CI猫友",
      score: 1,
    }),
  });
  if (!finish?.ok || finish?.score !== 1) throw new Error("run finish failed");

  const adaptiveUpdate = await jsonFetch("/api/adaptive/update", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      sessionId,
      runId,
      token: start.token,
      armKey: adaptiveArm,
      score: 1,
      metrics: {
        reactionMeanMs: 260,
        reactionStdMs: 48,
        fakeCues: 2,
        falseStops: 1,
        realCues: 2,
        survivedLooks: 1,
        dragMeanSpeed: 0.42,
        dragCv: 0.55,
        nearMissLatencyMs: 135,
        durationMs: 4200
      }
    }),
  });
  if (!adaptiveUpdate?.ok || !adaptiveUpdate?.adaptive?.model) throw new Error("adaptive update failed");

  const duplicateUpdate = await jsonFetch("/api/adaptive/update", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      sessionId, runId, token: start.token, armKey: adaptiveArm, score: 1,
      metrics: { reactionMeanMs: 260, fakeCues: 2, falseStops: 1, realCues: 2, survivedLooks: 1, durationMs: 4200 }
    }),
  });
  if (!duplicateUpdate?.ok || !duplicateUpdate?.duplicate) throw new Error("adaptive duplicate guard failed");

  const renamed = await jsonFetch("/api/profile", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sessionId, nickname: "CI已改名" }),
  });
  if (!renamed?.ok || renamed?.nickname !== "CI已改名") throw new Error("profile rename failed");

  const leaderboard = await jsonFetch("/api/leaderboard?scope=today&session=" + encodeURIComponent(sessionId) + "&limit=10");
  if (!leaderboard?.ok || !leaderboard?.me?.rank) throw new Error("leaderboard did not include smoke player");
  if (leaderboard?.me?.nickname !== "CI已改名") throw new Error("leaderboard nickname did not update");

  const events = await jsonFetch("/api/events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      sessionId,
      events: [
        {
          eventName: "game_start",
          runId,
          score: 0,
          experimentKey: bootstrap.experiment.key,
          variant: bootstrap.experiment.variant,
          catId: "momo",
          challengeTarget: 0,
          device: "qa",
          payload: { smoke: true },
        },
        {
          eventName: "run_end",
          runId,
          score: 1,
          experimentKey: bootstrap.experiment.key,
          variant: bootstrap.experiment.variant,
          catId: "momo",
          challengeTarget: 0,
          device: "qa",
          payload: { smoke: true },
        },
      ],
    }),
  });
  if (!events?.ok || events?.accepted !== 2) throw new Error("event ingestion failed");

  const feedback = await jsonFetch("/api/feedback", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      sessionId,
      runId,
      fairness: "fair",
      message: "[smoke-v2] production end-to-end",
      score: 1,
      challengeTarget: 0,
      experimentKey: bootstrap.experiment.key,
      variant: bootstrap.experiment.variant,
      catId: "momo",
      locale: "zh-CN",
      device: "qa",
    }),
  });
  if (!feedback?.ok) throw new Error("feedback failed");

  console.log(JSON.stringify({
    ok: true,
    base,
    experiment: bootstrap.experiment.variant,
    run: true,
    leaderboardRank: leaderboard.me.rank,
    events: events.accepted,
    feedback: true,
    profile: true,
    profileNickname: leaderboard.me.nickname,
    adaptiveArm,
    adaptiveReward: adaptiveUpdate.adaptive.reward,
    adaptiveObservations: adaptiveUpdate.adaptive.model.observations,
  }, null, 2));
} finally {
  try {
    await pool.query("delete from cat_feedback where session_id=$1", [sessionId]);
    await pool.query("delete from cat_events where session_id=$1", [sessionId]);
    await pool.query("delete from cat_adaptive_updates where session_id=$1", [sessionId]);
    await pool.query("delete from cat_runs where session_id=$1", [sessionId]);
    await pool.query("delete from cat_profiles where session_id=$1", [sessionId]);
    await pool.query("delete from cat_adaptive_players where session_id=$1", [sessionId]);
    if (adaptiveArm && armSnapshot) {
      await pool.query(
        `update cat_adaptive_arms
            set alpha=$2,beta=$3,exposures=$4,updates=$5,unfair_reports=$6,updated_at=now()
          where arm_key=$1`,
        [adaptiveArm, armSnapshot.alpha, armSnapshot.beta, armSnapshot.exposures, armSnapshot.updates, armSnapshot.unfair_reports],
      );
    }
    console.log("Smoke data cleaned:", sessionId);
  } finally {
    await pool.end();
  }
}

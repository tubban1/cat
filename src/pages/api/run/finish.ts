import type { APIRoute } from "astro";
import { timingSafeEqual } from "node:crypto";
import { dbConfigured, getDbPool } from "../../../lib/db";
import {
  cleanInt,
  cleanText,
  hashHex,
  json,
  sanitizeNickname,
  validSessionId,
  validUuid,
} from "../../../lib/gameServer";

export const prerender = false;

function safeEqualHex(a: string, b: string) {
  try {
    const left = Buffer.from(a, "hex");
    const right = Buffer.from(b, "hex");
    return left.length === right.length && timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

async function rankFor(sessionId: string, since: Date | null) {
  const params: any[] = [sessionId];
  const filter = since ? "and finished_at >= $2" : "";
  if (since) params.push(since);

  const result = await getDbPool().query(
    \`with best as (
       select distinct on (session_id)
              session_id, nickname, country, score, finished_at
         from cat_runs
        where valid = true
          and finished_at is not null
          \${filter}
        order by session_id, score desc, finished_at asc
     ),
     ranked as (
       select session_id, score,
              dense_rank() over(order by score desc, finished_at asc) as rank,
              count(*) over() as players
         from best
     )
     select rank::int, players::int, score::int
       from ranked
      where session_id = $1
      limit 1\`,
    params,
  );
  return result.rows[0] || null;
}

export const POST: APIRoute = async ({ request }) => {
  if (!dbConfigured()) return json({ ok: false, error: "leaderboard_unavailable" }, 503);

  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  const runId = cleanText(body?.runId, 40);
  const token = cleanText(body?.token, 160);
  const sessionId = cleanText(body?.sessionId, 80);
  const nickname = sanitizeNickname(body?.nickname);
  const score = cleanInt(body?.score, 100000);

  if (!validUuid(runId) || !validSessionId(sessionId) || token.length < 20) {
    return json({ ok: false, error: "invalid_payload" }, 422);
  }

  try {
    const found = await getDbPool().query(
      \`select run_id, token_hash, session_id, started_at, finished_at
         from cat_runs
        where run_id = $1
        limit 1\`,
      [runId],
    );
    const run = found.rows[0];
    if (!run || run.session_id !== sessionId) return json({ ok: false, error: "run_not_found" }, 404);
    if (run.finished_at) return json({ ok: false, error: "run_already_finished" }, 409);
    if (!safeEqualHex(run.token_hash, hashHex(token))) return json({ ok: false, error: "invalid_token" }, 403);

    const elapsedMs = Math.max(1, Date.now() - new Date(run.started_at).getTime());

    // Casual anti-cheat: enough slack for animation/network, but impossible instant scores are rejected.
    const maxPlausibleScore = Math.max(3, Math.floor((elapsedMs + 2500) / 500));
    const valid = score <= maxPlausibleScore && score <= 5000;

    await getDbPool().query(
      \`update cat_runs
          set finished_at = now(),
              duration_ms = $2,
              score = $3,
              nickname = $4,
              valid = $5
        where run_id = $1\`,
      [runId, Math.min(elapsedMs, 86_400_000), score, nickname, valid],
    );

    if (!valid) return json({ ok: false, error: "score_rejected", maxPlausibleScore }, 422);

    const now = new Date();
    const today = new Date(now);
    today.setUTCHours(0, 0, 0, 0);
    const week = new Date(now.getTime() - 7 * 24 * 3600 * 1000);

    const [todayRank, weekRank, allRank] = await Promise.all([
      rankFor(sessionId, today),
      rankFor(sessionId, week),
      rankFor(sessionId, null),
    ]);

    return json({
      ok: true,
      valid: true,
      score,
      ranking: { today: todayRank, week: weekRank, all: allRank },
    });
  } catch (error) {
    console.error("run_finish_failed", error);
    return json({ ok: false, error: "storage_error" }, 500);
  }
};

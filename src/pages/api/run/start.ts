import type { APIRoute } from "astro";
import { randomBytes, randomUUID } from "node:crypto";
import { dbConfigured, getDbPool } from "../../../lib/db";
import {
  EXPERIMENT_KEY,
  cleanInt,
  cleanText,
  countryFrom,
  hashHex,
  json,
  sanitizeNickname,
  uaFamily,
  validSessionId,
} from "../../../lib/gameServer";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  if (!dbConfigured()) return json({ ok: false, error: "leaderboard_unavailable" }, 503);

  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  const sessionId = cleanText(body?.sessionId, 80);
  if (!validSessionId(sessionId)) return json({ ok: false, error: "invalid_session" }, 422);

  const runId = randomUUID();
  const token = randomBytes(24).toString("base64url");
  const tokenHash = hashHex(token);
  const nickname = sanitizeNickname(body?.nickname);
  const catId = cleanText(body?.catId, 32);
  const variant = cleanText(body?.variant, 12);
  const experimentKey = cleanText(body?.experimentKey, 40) || EXPERIMENT_KEY;
  const challengeTarget = cleanInt(body?.challengeTarget, 100000);
  const device = cleanText(body?.device, 20);
  const adaptiveArm = cleanText(body?.adaptiveArm, 32);
  const country = countryFrom(request);
  const family = uaFamily(request.headers.get("user-agent") || "");

  const client = await getDbPool().connect();
  try {
    await client.query("begin");
    await client.query(
      `insert into cat_runs
        (run_id, token_hash, session_id, nickname, cat_id, experiment_key,
         experiment_variant, challenge_target, country, device, user_agent_family, adaptive_arm)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [runId, tokenHash, sessionId, nickname, catId, experimentKey, variant, challengeTarget, country, device, family, adaptiveArm],
    );

    if (adaptiveArm) {
      await client.query(
        `update cat_adaptive_arms
            set exposures=exposures + 1, updated_at=now()
          where arm_key=$1 and enabled=true`,
        [adaptiveArm],
      );
    }

    await client.query("commit");
    return json({ ok: true, runId, token, startedAt: Date.now(), adaptiveArm }, 201);
  } catch (error) {
    await client.query("rollback");
    console.error("run_start_failed", error);
    return json({ ok: false, error: "storage_error" }, 500);
  } finally {
    client.release();
  }
};

import type { APIRoute } from "astro";
import { dbConfigured, getDbPool } from "../../lib/db";
import {
  EXPERIMENT_KEY,
  cleanInt,
  cleanText,
  countryFrom,
  json,
  uaFamily,
  validSessionId,
  validUuid,
} from "../../lib/gameServer";

export const prerender = false;

const allowedFairness = new Set(["too_easy", "fair", "unfair"]);

export const POST: APIRoute = async ({ request }) => {
  if (!dbConfigured()) return json({ ok: false, error: "feedback_unavailable" }, 503);

  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  const sessionId = cleanText(body?.sessionId, 80);
  const fairness = cleanText(body?.fairness, 20);
  const message = cleanText(body?.message, 800);
  const variant = cleanText(body?.variant, 12) || "A";
  const experimentKey = cleanText(body?.experimentKey, 40) || EXPERIMENT_KEY;
  const locale = cleanText(body?.locale, 32);
  const device = cleanText(body?.device, 20);
  const score = cleanInt(body?.score);
  const challengeTarget = cleanInt(body?.challengeTarget);
  const catId = cleanText(body?.catId, 32);
  const rawRunId = cleanText(body?.runId, 40);
  const runId = validUuid(rawRunId) ? rawRunId : null;

  if (!validSessionId(sessionId) || !allowedFairness.has(fairness)) {
    return json({ ok: false, error: "invalid_payload" }, 422);
  }

  const country = countryFrom(request);
  const family = uaFamily(request.headers.get("user-agent") || "");

  try {
    await getDbPool().query(
      `insert into cat_feedback
        (session_id, run_id, fairness, message, score, challenge_target,
         experiment_key, experiment_variant, cat_id, locale, device, country, user_agent_family)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [sessionId, runId, fairness, message, score, challengeTarget, experimentKey, variant, catId, locale, device, country, family],
    );
    return json({ ok: true }, 201);
  } catch (error) {
    console.error("feedback_insert_failed", error);
    return json({ ok: false, error: "storage_error" }, 500);
  }
};

import type { APIRoute } from "astro";
import { timingSafeEqual } from "node:crypto";
import { updateAdaptiveModel } from "../../../lib/adaptive";
import { dbConfigured, getDbPool } from "../../../lib/db";
import {
  cleanInt,
  cleanText,
  hashHex,
  json,
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

function finite(value: unknown, min: number, max: number) {
  const number = Number(value);
  if (!Number.isFinite(number)) return undefined;
  return Math.max(min, Math.min(max, number));
}

export const POST: APIRoute = async ({ request }) => {
  if (!dbConfigured()) return json({ ok: false, error: "adaptive_unavailable" }, 503);

  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  const sessionId = cleanText(body?.sessionId, 80);
  const runId = cleanText(body?.runId, 40);
  const token = cleanText(body?.token, 160);
  const armKey = cleanText(body?.armKey, 32);
  const score = cleanInt(body?.score, 5000);

  if (!validSessionId(sessionId) || !validUuid(runId) || token.length < 20 || !armKey) {
    return json({ ok: false, error: "invalid_payload" }, 422);
  }

  const metrics = {
    reactionMeanMs: finite(body?.metrics?.reactionMeanMs, 0, 1200),
    reactionStdMs: finite(body?.metrics?.reactionStdMs, 0, 500),
    fakeCues: cleanInt(body?.metrics?.fakeCues, 500),
    falseStops: cleanInt(body?.metrics?.falseStops, 500),
    realCues: cleanInt(body?.metrics?.realCues, 500),
    survivedLooks: cleanInt(body?.metrics?.survivedLooks, 500),
    dragMeanSpeed: finite(body?.metrics?.dragMeanSpeed, 0, 20),
    dragCv: finite(body?.metrics?.dragCv, 0, 5),
    nearMissLatencyMs: finite(body?.metrics?.nearMissLatencyMs, 0, 2000),
    durationMs: cleanInt(body?.metrics?.durationMs, 86_400_000),
  };

  const pool = getDbPool();
  const client = await pool.connect();

  try {
    await client.query("begin");

    const found = await client.query(
      `select run_id, token_hash, session_id, adaptive_arm
         from cat_runs
        where run_id=$1
        for update`,
      [runId],
    );
    const run = found.rows[0];

    if (!run || run.session_id !== sessionId) {
      await client.query("rollback");
      return json({ ok: false, error: "run_not_found" }, 404);
    }

    if (!safeEqualHex(run.token_hash, hashHex(token))) {
      await client.query("rollback");
      return json({ ok: false, error: "invalid_token" }, 403);
    }

    if (run.adaptive_arm && run.adaptive_arm !== armKey) {
      await client.query("rollback");
      return json({ ok: false, error: "arm_mismatch" }, 409);
    }

    const duplicate = await client.query(
      "select reward::float8 from cat_adaptive_updates where run_id=$1 limit 1",
      [runId],
    );
    if (duplicate.rowCount) {
      await client.query("commit");
      return json({ ok: true, duplicate: true, reward: duplicate.rows[0].reward });
    }

    const result = await updateAdaptiveModel({
      client,
      sessionId,
      runId,
      armKey,
      score,
      metrics,
    });

    await client.query("commit");
    return json({ ok: true, adaptive: result }, 201);
  } catch (error) {
    await client.query("rollback");
    console.error("adaptive_update_failed", error);
    return json({ ok: false, error: "storage_error" }, 500);
  } finally {
    client.release();
  }
};

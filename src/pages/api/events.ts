import type { APIRoute } from "astro";
import { dbConfigured, getDbPool } from "../../lib/db";
import {
  EXPERIMENT_KEY,
  allowedEvents,
  cleanInt,
  cleanText,
  countryFrom,
  json,
  safePayload,
  validSessionId,
  validUuid,
} from "../../lib/gameServer";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  if (!dbConfigured()) return json({ ok: false, error: "analytics_unavailable" }, 503);

  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  const sessionId = cleanText(body?.sessionId, 80);
  if (!validSessionId(sessionId)) return json({ ok: false, error: "invalid_session" }, 422);

  const rawEvents = Array.isArray(body?.events) ? body.events.slice(0, 40) : [];
  if (!rawEvents.length) return json({ ok: true, accepted: 0 });

  const country = countryFrom(request);
  const rows = rawEvents.flatMap((event: any) => {
    const eventName = cleanText(event?.eventName, 40);
    if (!allowedEvents.has(eventName)) return [];

    const runId = cleanText(event?.runId, 40);
    return [{
      event_name: eventName,
      run_id: validUuid(runId) ? runId : null,
      score: cleanInt(event?.score, 100000),
      experiment_key: cleanText(event?.experimentKey, 40) || EXPERIMENT_KEY,
      experiment_variant: cleanText(event?.variant, 12),
      cat_id: cleanText(event?.catId, 32),
      challenge_target: cleanInt(event?.challengeTarget, 100000),
      device: cleanText(event?.device, 20),
      payload: safePayload(event?.payload),
    }];
  });

  if (!rows.length) return json({ ok: true, accepted: 0 });

  try {
    await getDbPool().query(
      \`insert into cat_events
        (session_id, run_id, event_name, score, experiment_key, experiment_variant,
         cat_id, challenge_target, country, device, payload)
       select
         $1,
         x.run_id::uuid,
         x.event_name,
         x.score,
         x.experiment_key,
         x.experiment_variant,
         x.cat_id,
         x.challenge_target,
         $2,
         x.device,
         x.payload
       from jsonb_to_recordset($3::jsonb) as x(
         run_id text,
         event_name text,
         score integer,
         experiment_key text,
         experiment_variant text,
         cat_id text,
         challenge_target integer,
         device text,
         payload jsonb
       )\`,
      [sessionId, country, JSON.stringify(rows)],
    );
    return json({ ok: true, accepted: rows.length }, 201);
  } catch (error) {
    console.error("event_batch_failed", error);
    return json({ ok: false, error: "storage_error" }, 500);
  }
};

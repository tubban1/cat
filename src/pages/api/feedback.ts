import type { APIRoute } from "astro";
import { ensureFeedbackSchema, getFeedbackPool, feedbackDbConfigured } from "../../lib/db";

export const prerender = false;

const allowedFairness = new Set(["too_easy", "fair", "unfair"]);

function cleanText(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function cleanInt(value: unknown, max = 100000) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(max, Math.round(number)));
}

function uaFamily(ua: string) {
  const s = ua.toLowerCase();
  if (s.includes("iphone") || s.includes("ipad")) return "ios";
  if (s.includes("android")) return "android";
  if (s.includes("mac os")) return "macos";
  if (s.includes("windows")) return "windows";
  return "other";
}

export const POST: APIRoute = async ({ request }) => {
  if (!feedbackDbConfigured()) {
    return new Response(JSON.stringify({ ok: false, error: "feedback_unavailable" }), {
      status: 503,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "invalid_json" }), {
      status: 400,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }

  const sessionId = cleanText(body.sessionId, 80);
  const fairness = cleanText(body.fairness, 20);
  const message = cleanText(body.message, 800);
  const variant = cleanText(body.variant, 12) || "A";
  const locale = cleanText(body.locale, 32);
  const device = cleanText(body.device, 20);
  const score = cleanInt(body.score);
  const challengeTarget = cleanInt(body.challengeTarget);

  if (!/^[a-zA-Z0-9_-]{8,80}$/.test(sessionId) || !allowedFairness.has(fairness)) {
    return new Response(JSON.stringify({ ok: false, error: "invalid_payload" }), {
      status: 422,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }

  const country = cleanText(request.headers.get("x-vercel-ip-country"), 2).toUpperCase();
  const family = uaFamily(request.headers.get("user-agent") || "");

  try {
    await ensureFeedbackSchema();
    const pool = getFeedbackPool();
    await pool.query(
      `insert into cat_feedback
        (session_id, fairness, message, score, challenge_target, experiment_variant, locale, device, country, user_agent_family)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [sessionId, fairness, message, score, challengeTarget, variant, locale, device, country, family],
    );

    return new Response(JSON.stringify({ ok: true }), {
      status: 201,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    console.error("feedback_insert_failed", error);
    return new Response(JSON.stringify({ ok: false, error: "storage_error" }), {
      status: 500,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }
};

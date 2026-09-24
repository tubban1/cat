import { createHash } from "node:crypto";

export const EXPERIMENT_KEY = "difficulty_v2";

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export function cleanText(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function cleanInt(value: unknown, max = 100000) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(max, Math.round(number)));
}

export function validSessionId(value: string) {
  return /^[a-zA-Z0-9_-]{8,80}$/.test(value);
}

export function validUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function uaFamily(ua: string) {
  const s = ua.toLowerCase();
  if (s.includes("iphone") || s.includes("ipad")) return "ios";
  if (s.includes("android")) return "android";
  if (s.includes("mac os")) return "macos";
  if (s.includes("windows")) return "windows";
  if (s.includes("linux")) return "linux";
  return "other";
}

export function countryFrom(request: Request) {
  return cleanText(request.headers.get("x-vercel-ip-country"), 2).toUpperCase();
}

export function sanitizeNickname(value: unknown) {
  const raw = cleanText(value, 24)
    .replace(/[^\p{L}\p{N}_·\-\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  return raw.slice(0, 16) || "匿名猫友";
}

export function hashHex(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function hashUnit(value: string) {
  const hex = hashHex(value).slice(0, 12);
  return parseInt(hex, 16) / 0xffffffffffff;
}

export function pickWeightedVariant(weights: Record<string, number>, seed: string) {
  const entries = Object.entries(weights).filter(([, weight]) => Number(weight) > 0);
  if (!entries.length) return "A";
  const total = entries.reduce((sum, [, weight]) => sum + Number(weight), 0);
  let cursor = hashUnit(seed) * total;
  for (const [key, rawWeight] of entries) {
    cursor -= Number(rawWeight);
    if (cursor <= 0) return key;
  }
  return entries[entries.length - 1]?.[0] ?? "A";
}

export function safePayload(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  try {
    const encoded = JSON.stringify(value);
    if (encoded.length > 1800) return { truncated: true };
    return JSON.parse(encoded);
  } catch {
    return {};
  }
}

export const allowedEvents = new Set([
  "page_view",
  "game_start",
  "first_interaction",
  "fake_cue",
  "eyes_open",
  "look_survived",
  "fish_stolen",
  "run_end",
  "retry",
  "share_open",
  "share_complete",
  "challenge_copy",
  "challenge_open",
  "challenge_beat",
  "leaderboard_open",
  "leaderboard_scope",
  "nickname_saved",
  "audio_started",
  "audio_toggle",
  "adaptive_update",
  "feedback_open",
  "feedback_submitted",
  "page_hide",
  "image_error",
]);

import type { APIRoute } from "astro";
import { getDbPool, dbConfigured } from "../../lib/db";
import { EXPERIMENT_KEY, cleanText, json, pickWeightedVariant, validSessionId } from "../../lib/gameServer";

export const prerender = false;

const fallback = {
  A: {
    label: "高压反应",
    fakeChanceBase: 0.28,
    fakeChanceMax: 0.46,
    cueDelayMin: 720,
    cueDelayMax: 1520,
    anticipationBase: 420,
    anticipationMin: 225,
    watchBase: 900,
    watchMin: 510,
    difficultySlope: 0.07,
    dragScaleTouch: 0.34,
    dragScalePointer: 0.26,
  },
  B: {
    label: "欺骗高手",
    fakeChanceBase: 0.38,
    fakeChanceMax: 0.52,
    cueDelayMin: 760,
    cueDelayMax: 1600,
    anticipationBase: 455,
    anticipationMin: 235,
    watchBase: 940,
    watchMin: 520,
    difficultySlope: 0.065,
    dragScaleTouch: 0.35,
    dragScalePointer: 0.27,
  },
};

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const sessionId = cleanText(url.searchParams.get("session"), 80);
  if (!validSessionId(sessionId)) return json({ ok: false, error: "invalid_session" }, 422);

  let version = 1;
  let variants: Record<string, any> = fallback;
  let weights: Record<string, number> = { A: 0.5, B: 0.5 };

  if (dbConfigured()) {
    try {
      const result = await getDbPool().query(
        "select version, variants, weights from cat_experiments where experiment_key = $1 and enabled = true limit 1",
        [EXPERIMENT_KEY],
      );
      const row = result.rows[0];
      if (row) {
        version = Number(row.version) || 1;
        variants = row.variants || fallback;
        weights = row.weights || weights;
      }
    } catch (error) {
      console.error("bootstrap_experiment_failed", error);
    }
  }

  const variant = pickWeightedVariant(weights, sessionId + ":" + EXPERIMENT_KEY + ":" + version);
  const config = variants[variant] || variants.A || fallback.A;

  return json({
    ok: true,
    experiment: { key: EXPERIMENT_KEY, version, variant, config },
    monetization: { adsEnabled: false, rewardedContinueEnabled: false },
  });
};

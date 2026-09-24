import type { APIRoute } from "astro";
import { getDbPool, dbConfigured } from "../../lib/db";
import { getAdaptivePlayer, publicPlayerModel, selectAdaptiveArm, targetFailureRange } from "../../lib/adaptive";
import { EXPERIMENT_KEY, cleanText, json, pickWeightedVariant, validSessionId } from "../../lib/gameServer";

export const prerender = false;

const fallback = {
  A: {
    label: "高压反应 V3",
    fakeChanceBase: 0.34,
    fakeChanceMax: 0.56,
    cueDelayMin: 520,
    cueDelayMax: 1160,
    anticipationBase: 335,
    anticipationMin: 165,
    watchBase: 760,
    watchMin: 430,
    difficultySlope: 0.09,
    dragScaleTouch: 0.32,
    dragScalePointer: 0.245,
  },
  B: {
    label: "猫咪诡计 V3",
    fakeChanceBase: 0.44,
    fakeChanceMax: 0.64,
    cueDelayMin: 560,
    cueDelayMax: 1240,
    anticipationBase: 355,
    anticipationMin: 170,
    watchBase: 800,
    watchMin: 440,
    difficultySlope: 0.085,
    dragScaleTouch: 0.325,
    dragScalePointer: 0.25,
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

  let adaptive: any = {
    enabled: false,
    version: 4,
    armKey: "reflex",
    armLabel: "反应猎手",
    params: {},
    player: {
      reactionMuMs: 285, reactionSigmaMs: 90, deceptionSkill: 0.5,
      uncertaintySkill: 0.5, motorSkill: 0.5, pressureSkill: 0.5, observations: 0,
    },
    targetFailure: { early: 0.16, mid: 0.27, late: 0.34, ceiling: 0.36 },
    fairness: {
      minAnticipationMs: 150,
      maxFakeChance: 0.68,
      maxConsecutiveFakes: 2,
      minMovementThresholdPointer: 1.3,
      minMovementThresholdTouch: 1.8,
    },
  };

  if (dbConfigured()) {
    try {
      const player = await getAdaptivePlayer(sessionId);
      const arm = await selectAdaptiveArm(player);
      adaptive = {
        enabled: true,
        version: 4,
        armKey: arm.arm_key,
        armLabel: arm.label,
        params: arm.params || {},
        player: publicPlayerModel(player),
        targetFailure: targetFailureRange(player),
        fairness: {
          minAnticipationMs: 150,
          maxFakeChance: 0.68,
          maxConsecutiveFakes: 2,
          minMovementThresholdPointer: 1.3,
          minMovementThresholdTouch: 1.8,
        },
      };
    } catch (error) {
      console.error("bootstrap_adaptive_failed", error);
    }
  }

  return json({
    ok: true,
    experiment: { key: EXPERIMENT_KEY, version, variant, config },
    adaptive,
    monetization: { adsEnabled: false, rewardedContinueEnabled: false },
  });
};

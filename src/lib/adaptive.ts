import type { PoolClient } from "pg";
import { getDbPool } from "./db";

export type AdaptivePlayer = {
  session_id: string;
  reaction_mu_ms: number;
  reaction_sigma_ms: number;
  deception_skill: number;
  uncertainty_skill: number;
  motor_skill: number;
  pressure_skill: number;
  observations: number;
  survived_looks: number;
  deaths: number;
  false_stops: number;
  last_arm: string;
};

export type AdaptiveArm = {
  arm_key: string;
  label: string;
  alpha: number;
  beta: number;
  exposures: number;
  updates: number;
  unfair_reports: number;
  params: Record<string, number>;
};

export function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function gammaSample(shape: number) {
  const k = Math.max(0.001, shape);
  if (k < 1) {
    const u = Math.max(Number.EPSILON, Math.random());
    return gammaSample(k + 1) * Math.pow(u, 1 / k);
  }

  const d = k - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);

  for (;;) {
    let x = 0;
    let v = 0;
    do {
      const u1 = Math.max(Number.EPSILON, Math.random());
      const u2 = Math.random();
      x = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      v = 1 + c * x;
    } while (v <= 0);

    v = v * v * v;
    const u = Math.random();
    if (u < 1 - 0.0331 * x * x * x * x) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

function betaSample(alpha: number, beta: number) {
  const a = gammaSample(Math.max(0.25, alpha));
  const b = gammaSample(Math.max(0.25, beta));
  return a / Math.max(Number.EPSILON, a + b);
}

function reactionSkill(player: AdaptivePlayer) {
  // 145ms is exceptional, 430ms is novice territory.
  return clamp((430 - Number(player.reaction_mu_ms || 285)) / 285);
}

function vulnerabilityFor(armKey: string, player: AdaptivePlayer) {
  if (armKey === "reflex") return 1 - reactionSkill(player);
  if (armKey === "deception") return 1 - Number(player.deception_skill || 0.5);
  if (armKey === "uncertainty") return 1 - Number(player.uncertainty_skill || 0.5);
  if (armKey === "control") return 1 - Number(player.motor_skill || 0.5);
  if (armKey === "pressure") return 1 - Number(player.pressure_skill || 0.5);
  return 0.5;
}

export async function getOrCreateAdaptivePlayer(sessionId: string) {
  const pool = getDbPool();
  await pool.query(
    `insert into cat_adaptive_players(session_id)
     values($1)
     on conflict(session_id) do nothing`,
    [sessionId],
  );

  const result = await pool.query(
    `select session_id,
            reaction_mu_ms::float8,
            reaction_sigma_ms::float8,
            deception_skill::float8,
            uncertainty_skill::float8,
            motor_skill::float8,
            pressure_skill::float8,
            observations,
            survived_looks,
            deaths,
            false_stops,
            last_arm
       from cat_adaptive_players
      where session_id=$1
      limit 1`,
    [sessionId],
  );

  return result.rows[0] as AdaptivePlayer;
}

export async function selectAdaptiveArm(player: AdaptivePlayer) {
  const result = await getDbPool().query(
    `select arm_key, label,
            alpha::float8, beta::float8,
            exposures, updates, unfair_reports, params
       from cat_adaptive_arms
      where enabled=true
      order by arm_key`,
  );

  const arms = result.rows as AdaptiveArm[];
  if (!arms.length) {
    return {
      arm_key: "reflex",
      label: "反应猎手",
      alpha: 1,
      beta: 1,
      exposures: 0,
      updates: 0,
      unfair_reports: 0,
      params: {},
    } satisfies AdaptiveArm;
  }

  let best = arms[0];
  let bestScore = -Infinity;

  for (const arm of arms) {
    const posterior = betaSample(Number(arm.alpha), Number(arm.beta));
    const vulnerability = vulnerabilityFor(arm.arm_key, player);

    // Contextual Thompson Sampling:
    // posterior learns global engagement quality, vulnerability personalizes the challenge.
    let score = posterior * (0.82 + 0.36 * vulnerability);

    // Avoid repeatedly attacking exactly the same dimension.
    if (player.last_arm && player.last_arm === arm.arm_key) score *= 0.88;

    // If an arm has accumulated too many explicit unfair reports, softly suppress it.
    const unfairRate = arm.updates > 0 ? arm.unfair_reports / arm.updates : 0;
    score *= 1 - Math.min(0.28, unfairRate * 0.45);

    if (score > bestScore) {
      best = arm;
      bestScore = score;
    }
  }

  return best;
}

export function publicPlayerModel(player: AdaptivePlayer) {
  return {
    reactionMuMs: Math.round(Number(player.reaction_mu_ms || 285)),
    reactionSigmaMs: Math.round(Number(player.reaction_sigma_ms || 90)),
    deceptionSkill: Number(Number(player.deception_skill || 0.5).toFixed(3)),
    uncertaintySkill: Number(Number(player.uncertainty_skill || 0.5).toFixed(3)),
    motorSkill: Number(Number(player.motor_skill || 0.5).toFixed(3)),
    pressureSkill: Number(Number(player.pressure_skill || 0.5).toFixed(3)),
    observations: Number(player.observations || 0),
  };
}

export function targetFailureRange(player: AdaptivePlayer) {
  const observations = Number(player.observations || 0);
  return {
    early: observations < 3 ? 0.16 : 0.18,
    mid: observations < 3 ? 0.27 : 0.34,
    late: observations < 3 ? 0.34 : 0.46,
    ceiling: observations < 3 ? 0.36 : 0.50,
  };
}

function ewma(oldValue: number, observed: number, alpha: number) {
  return oldValue * (1 - alpha) + observed * alpha;
}

export async function updateAdaptiveModel(args: {
  client: PoolClient;
  sessionId: string;
  runId: string;
  armKey: string;
  score: number;
  metrics: {
    reactionMeanMs?: number;
    reactionStdMs?: number;
    fakeCues?: number;
    falseStops?: number;
    realCues?: number;
    survivedLooks?: number;
    dragMeanSpeed?: number;
    dragCv?: number;
    nearMissLatencyMs?: number;
    durationMs?: number;
  };
}) {
  const { client, sessionId, runId, armKey, score, metrics } = args;

  const existingResult = await client.query(
    `select session_id,
            reaction_mu_ms::float8,
            reaction_sigma_ms::float8,
            deception_skill::float8,
            uncertainty_skill::float8,
            motor_skill::float8,
            pressure_skill::float8,
            observations,
            survived_looks,
            deaths,
            false_stops,
            last_arm
       from cat_adaptive_players
      where session_id=$1
      for update`,
    [sessionId],
  );

  const player = (existingResult.rows[0] || {
    session_id: sessionId,
    reaction_mu_ms: 285,
    reaction_sigma_ms: 90,
    deception_skill: 0.5,
    uncertainty_skill: 0.5,
    motor_skill: 0.5,
    pressure_skill: 0.5,
    observations: 0,
    survived_looks: 0,
    deaths: 0,
    false_stops: 0,
    last_arm: "",
  }) as AdaptivePlayer;

  const oldObs = Number(player.observations || 0);
  const alpha = Math.max(0.08, Math.min(0.30, 2 / (oldObs + 5)));

  const reactionSample = Number(metrics.reactionMeanMs);
  const reactionStdSample = Number(metrics.reactionStdMs);
  const hasReaction = Number.isFinite(reactionSample) && reactionSample >= 80 && reactionSample <= 900;

  const nextReactionMu = hasReaction
    ? ewma(Number(player.reaction_mu_ms || 285), clamp(reactionSample, 90, 750), alpha)
    : Number(player.reaction_mu_ms || 285);

  const nextReactionSigma = Number.isFinite(reactionStdSample) && reactionStdSample >= 10
    ? ewma(Number(player.reaction_sigma_ms || 90), clamp(reactionStdSample, 18, 240), alpha)
    : Number(player.reaction_sigma_ms || 90);

  const fakeCues = Math.max(0, Number(metrics.fakeCues || 0));
  const falseStops = Math.max(0, Math.min(fakeCues, Number(metrics.falseStops || 0)));
  const observedDeception = fakeCues > 0 ? 1 - falseStops / fakeCues : Number(player.deception_skill || 0.5);

  const realCues = Math.max(0, Number(metrics.realCues || 0));
  const survived = Math.max(0, Math.min(realCues, Number(metrics.survivedLooks || 0)));
  const observedPressure = realCues > 0 ? survived / realCues : Number(player.pressure_skill || 0.5);

  const dragCv = Number(metrics.dragCv);
  const observedMotor = Number.isFinite(dragCv)
    ? 1 - clamp(dragCv / 1.15)
    : Number(player.motor_skill || 0.5);

  const uncertaintyObservation =
    armKey === "uncertainty" && realCues > 0
      ? clamp((survived + Math.min(3, score) * 0.25) / Math.max(1, realCues + 0.75))
      : Number(player.uncertainty_skill || 0.5);

  const nextDeception = clamp(ewma(Number(player.deception_skill || 0.5), observedDeception, alpha));
  const nextPressure = clamp(ewma(Number(player.pressure_skill || 0.5), observedPressure, alpha));
  const nextMotor = clamp(ewma(Number(player.motor_skill || 0.5), observedMotor, alpha));
  const nextUncertainty = clamp(ewma(Number(player.uncertainty_skill || 0.5), uncertaintyObservation, alpha));

  const nearMiss = Number(metrics.nearMissLatencyMs);
  const nearMissReward = Number.isFinite(nearMiss) && nearMiss > 0 && nearMiss <= 220 ? 1 : 0;
  const scoreReward = clamp(score / 12);
  const survivalReward = realCues > 0 ? clamp(survived / realCues) : 0.35;
  const depthReward = Number(metrics.durationMs || 0) >= 7000 ? 1 : Number(metrics.durationMs || 0) >= 3000 ? 0.55 : 0.15;

  // Online bandit reward is a proxy for "challenging but engaging".
  // Long-term replay/share metrics are still handled by the daily optimizer.
  const reward = clamp(
    0.36 * scoreReward +
    0.26 * survivalReward +
    0.22 * nearMissReward +
    0.16 * depthReward,
  );

  await client.query(
    `insert into cat_adaptive_players(
       session_id, reaction_mu_ms, reaction_sigma_ms,
       deception_skill, uncertainty_skill, motor_skill, pressure_skill,
       observations, survived_looks, deaths, false_stops, last_arm, updated_at
     )
     values($1,$2,$3,$4,$5,$6,$7,1,$8,1,$9,$10,now())
     on conflict(session_id) do update set
       reaction_mu_ms=excluded.reaction_mu_ms,
       reaction_sigma_ms=excluded.reaction_sigma_ms,
       deception_skill=excluded.deception_skill,
       uncertainty_skill=excluded.uncertainty_skill,
       motor_skill=excluded.motor_skill,
       pressure_skill=excluded.pressure_skill,
       observations=cat_adaptive_players.observations + 1,
       survived_looks=cat_adaptive_players.survived_looks + excluded.survived_looks,
       deaths=cat_adaptive_players.deaths + 1,
       false_stops=cat_adaptive_players.false_stops + excluded.false_stops,
       last_arm=excluded.last_arm,
       updated_at=now()`,
    [
      sessionId,
      nextReactionMu,
      nextReactionSigma,
      nextDeception,
      nextUncertainty,
      nextMotor,
      nextPressure,
      survived,
      falseStops,
      armKey,
    ],
  );

  const inserted = await client.query(
    `insert into cat_adaptive_updates(run_id, session_id, arm_key, score, reward, metrics)
     values($1,$2,$3,$4,$5,$6::jsonb)
     on conflict(run_id) do nothing
     returning run_id`,
    [runId, sessionId, armKey, score, reward, JSON.stringify(metrics)],
  );

  if (inserted.rowCount) {
    await client.query(
      `update cat_adaptive_arms
          set alpha=alpha + $2,
              beta=beta + (1 - $2),
              updates=updates + 1,
              updated_at=now()
        where arm_key=$1`,
      [armKey, reward],
    );
  }

  return {
    reward: Number(reward.toFixed(4)),
    model: {
      reactionMuMs: Math.round(nextReactionMu),
      reactionSigmaMs: Math.round(nextReactionSigma),
      deceptionSkill: Number(nextDeception.toFixed(3)),
      uncertaintySkill: Number(nextUncertainty.toFixed(3)),
      motorSkill: Number(nextMotor.toFixed(3)),
      pressureSkill: Number(nextPressure.toFixed(3)),
      observations: oldObs + 1,
    },
  };
}

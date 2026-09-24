import pg from "pg";
const { Pool } = pg;

const connectionString = process.env.SUPABASE_DB_URL?.trim();
if (!connectionString) throw new Error("SUPABASE_DB_URL is missing");

const pool = new Pool({
  connectionString,
  max: 1,
  ssl: connectionString.includes("localhost") ? false : { rejectUnauthorized: false },
});

const days = Number(process.env.REPORT_DAYS || 7);
const since = new Date(Date.now() - days * 86400000);

try {
  const [summary, variants, fairness, countries, top, adaptiveArms, adaptivePlayers] = await Promise.all([
    pool.query(
      `with starts as (
         select session_id, count(*) as plays
           from cat_events
          where event_name='game_start' and created_at >= $1
          group by session_id
       ),
       shares as (
         select distinct session_id
           from cat_events
          where event_name in ('share_complete','challenge_copy') and created_at >= $1
       ),
       challenges as (
         select distinct session_id
           from cat_events
          where event_name='challenge_open' and created_at >= $1
       )
       select
         count(*)::int as unique_players,
         coalesce(sum(plays),0)::int as total_plays,
         coalesce(avg(plays),0)::numeric(10,2) as plays_per_player,
         count(*) filter (where plays >= 2)::int as repeat_players,
         round((count(*) filter (where plays >= 2))::numeric / nullif(count(*),0),4) as repeat_rate,
         count(*) filter (where session_id in (select session_id from shares))::int as sharing_players,
         round((count(*) filter (where session_id in (select session_id from shares))::numeric / nullif(count(*),0)),4) as share_player_rate,
         count(*) filter (where session_id in (select session_id from challenges))::int as challenged_players
       from starts`,
      [since],
    ),
    pool.query(
      `with starts as (
         select experiment_variant as variant, session_id, count(*) as plays
           from cat_events
          where event_name='game_start' and created_at >= $1 and experiment_variant <> ''
          group by experiment_variant, session_id
       ),
       shares as (
         select distinct experiment_variant as variant, session_id
           from cat_events
          where event_name in ('share_complete','challenge_copy') and created_at >= $1
       )
       select
         variant,
         count(*)::int as sessions,
         count(*) filter(where plays>=2)::int as repeat_sessions,
         round((count(*) filter(where plays>=2))::numeric/nullif(count(*),0),4) as repeat_rate,
         count(*) filter(where (variant,session_id) in (select variant,session_id from shares))::int as share_sessions,
         round((count(*) filter(where (variant,session_id) in (select variant,session_id from shares)))::numeric/nullif(count(*),0),4) as share_rate
       from starts
       group by variant
       order by variant`,
      [since],
    ),
    pool.query(
      `select experiment_variant as variant,
              count(*)::int as feedbacks,
              count(*) filter(where fairness='too_easy')::int as too_easy,
              count(*) filter(where fairness='fair')::int as fair,
              count(*) filter(where fairness='unfair')::int as unfair,
              round((count(*) filter(where fairness='unfair'))::numeric/nullif(count(*),0),4) as unfair_rate
         from cat_feedback
        where created_at >= $1
        group by experiment_variant
        order by experiment_variant`,
      [since],
    ),
    pool.query(
      `select country, count(distinct session_id)::int as players
         from cat_events
        where event_name='game_start' and created_at >= $1 and country <> ''
        group by country
        order by players desc
        limit 10`,
      [since],
    ),
    pool.query(
      `select nickname, country, score, cat_id, finished_at
         from cat_runs
        where valid=true and finished_at >= $1
        order by score desc, finished_at asc
        limit 10`,
      [since],
    ),
    pool.query(
      `select arm_key, label, exposures, updates, unfair_reports,
              round((alpha/(alpha+beta))::numeric,4) as posterior_mean,
              round((unfair_reports::numeric/nullif(updates,0)),4) as unfair_rate
         from cat_adaptive_arms
        where enabled=true
        order by arm_key`,
    ),
    pool.query(
      `select count(*)::int as modeled_players,
              round(avg(reaction_mu_ms)::numeric,1) as avg_reaction_ms,
              round(avg(deception_skill)::numeric,3) as avg_deception_skill,
              round(avg(uncertainty_skill)::numeric,3) as avg_uncertainty_skill,
              round(avg(motor_skill)::numeric,3) as avg_motor_skill,
              round(avg(pressure_skill)::numeric,3) as avg_pressure_skill,
              round(avg(observations)::numeric,2) as avg_observations
         from cat_adaptive_players`,
    ),
  ]);

  const s = summary.rows[0] || {};
  const out = [];
  out.push("# 猫咪游戏增长报告（最近 " + days + " 天）");
  out.push("");
  out.push("- 独立玩家：**" + (s.unique_players || 0) + "**");
  out.push("- 总开局：**" + (s.total_plays || 0) + "**");
  out.push("- 人均开局：**" + (s.plays_per_player || 0) + "**");
  out.push("- 二次开局率：**" + ((Number(s.repeat_rate) || 0) * 100).toFixed(1) + "%**");
  out.push("- 发生分享/挑战的玩家比例：**" + ((Number(s.share_player_rate) || 0) * 100).toFixed(1) + "%**");
  out.push("");
  out.push("## 难度实验");
  out.push("|版本|玩家|二次开局率|分享率|不公平反馈率|");
  out.push("|---|---:|---:|---:|---:|");
  for (const row of variants.rows) {
    const f = fairness.rows.find((x) => x.variant === row.variant) || {};
    out.push("|" + row.variant + "|" + row.sessions + "|" + (Number(row.repeat_rate) * 100).toFixed(1) + "%|" + (Number(row.share_rate) * 100).toFixed(1) + "%|" + ((Number(f.unfair_rate) || 0) * 100).toFixed(1) + "%|");
  }
  out.push("");
  out.push("## Adaptive Difficulty V4");
  const ap = adaptivePlayers.rows[0] || {};
  out.push("- 已建模玩家：**" + (ap.modeled_players || 0) + "**");
  out.push("- 平均估计反应时间：**" + (ap.avg_reaction_ms || "-") + "ms**");
  out.push("- 平均技能向量：欺骗 " + (ap.avg_deception_skill || "-") + " / 不确定性 " + (ap.avg_uncertainty_skill || "-") + " / 手控 " + (ap.avg_motor_skill || "-") + " / 高压 " + (ap.avg_pressure_skill || "-"));
  out.push("");
  out.push("|策略臂|曝光|更新|Bandit 后验均值|不公平反馈率|");
  out.push("|---|---:|---:|---:|---:|");
  for (const row of adaptiveArms.rows) {
    out.push("|" + row.label + " (" + row.arm_key + ")|" + row.exposures + "|" + row.updates + "|" + (Number(row.posterior_mean || 0) * 100).toFixed(1) + "%|" + (Number(row.unfair_rate || 0) * 100).toFixed(1) + "%|");
  }
  out.push("");

  out.push("## 国家/地区");
  out.push(countries.rows.length ? countries.rows.map((r) => "- " + r.country + ": " + r.players).join("\\n") : "- 暂无数据");
  out.push("");
  out.push("## 最近高分");
  out.push(top.rows.length ? top.rows.map((r, i) => (i + 1) + ". " + (r.nickname || "匿名猫友") + " — " + r.score + " 分 (" + (r.country || "??") + ")").join("\\n") : "- 暂无数据");
  out.push("");
  out.push("## 变现观察");
  if ((Number(s.unique_players) || 0) < 1000) {
    out.push("- 当前优先级仍应是**增长与复玩**，不要用强制插屏破坏第一批用户数据。");
  } else {
    out.push("- 已有一定流量，可以开始小流量测试**失败后奖励续命**或**自然断点广告**，但必须单独做实验。");
  }
  out.push("- 广告收入不是当前实验的成功指标；先看二次开局率、分享/挑战率、好友挑战带来的新增开局。");

  console.log(out.join("\\n"));
} finally {
  await pool.end();
}

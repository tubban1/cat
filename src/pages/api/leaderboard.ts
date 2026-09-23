import type { APIRoute } from "astro";
import { dbConfigured, getDbPool } from "../../lib/db";
import { cleanText, json, validSessionId } from "../../lib/gameServer";

export const prerender = false;

const scopes = new Set(["today", "week", "all"]);

function flag(country: string) {
  if (!/^[A-Z]{2}$/.test(country)) return "";
  return String.fromCodePoint(...country.split("").map((c) => 127397 + c.charCodeAt(0)));
}

export const GET: APIRoute = async ({ request }) => {
  if (!dbConfigured()) return json({ ok: false, error: "leaderboard_unavailable" }, 503);

  const url = new URL(request.url);
  const scope = scopes.has(url.searchParams.get("scope") || "") ? (url.searchParams.get("scope") as string) : "today";
  const sessionId = cleanText(url.searchParams.get("session"), 80);
  const limit = Math.max(10, Math.min(100, Number(url.searchParams.get("limit") || 50) || 50));

  let since: Date | null = null;
  const now = new Date();
  if (scope === "today") {
    since = new Date(now);
    since.setUTCHours(0, 0, 0, 0);
  } else if (scope === "week") {
    since = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
  }

  const params: any[] = [limit];
  const filter = since ? "and finished_at >= $2" : "";
  if (since) params.push(since);

  try {
    const result = await getDbPool().query(
      `with best as (
         select distinct on (session_id)
                session_id, nickname, country, score, cat_id, finished_at
           from cat_runs
          where valid = true
            and finished_at is not null
            ${filter}
          order by session_id, score desc, finished_at asc
       ),
       ranked as (
         select session_id, nickname, country, score, cat_id, finished_at,
                dense_rank() over(order by score desc, finished_at asc) as rank,
                count(*) over() as players
           from best
       )
       select session_id, nickname, country, score, cat_id, finished_at,
              rank::int, players::int
         from ranked
        order by rank asc, finished_at asc
        limit $1`,
      params,
    );

    let me = null;
    if (validSessionId(sessionId)) {
      const meParams: any[] = [sessionId];
      const meFilter = since ? "and finished_at >= $2" : "";
      if (since) meParams.push(since);
      const mine = await getDbPool().query(
        `with best as (
           select distinct on (session_id)
                  session_id, nickname, country, score, cat_id, finished_at
             from cat_runs
            where valid = true and finished_at is not null ${meFilter}
            order by session_id, score desc, finished_at asc
         ),
         ranked as (
           select *, dense_rank() over(order by score desc, finished_at asc) as rank,
                     count(*) over() as players
             from best
         )
         select session_id, nickname, country, score, cat_id, rank::int, players::int
           from ranked where session_id = $1 limit 1`,
        meParams,
      );
      me = mine.rows[0] || null;
    }

    return json({
      ok: true,
      scope,
      players: result.rows[0]?.players || 0,
      me,
      entries: result.rows.map((row: any) => ({
        rank: row.rank,
        nickname: row.nickname || "匿名猫友",
        score: row.score,
        catId: row.cat_id,
        country: row.country,
        flag: flag(row.country || ""),
      })),
    });
  } catch (error) {
    console.error("leaderboard_failed", error);
    return json({ ok: false, error: "storage_error" }, 500);
  }
};

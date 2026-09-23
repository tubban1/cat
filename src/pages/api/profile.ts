import type { APIRoute } from "astro";
import { dbConfigured, getDbPool } from "../../lib/db";
import { cleanText, json, sanitizeNickname, validSessionId } from "../../lib/gameServer";

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  if (!dbConfigured()) return json({ ok: false, error: "profile_unavailable" }, 503);

  const url = new URL(request.url);
  const sessionId = cleanText(url.searchParams.get("session"), 80);
  if (!validSessionId(sessionId)) return json({ ok: false, error: "invalid_session" }, 422);

  try {
    const result = await getDbPool().query(
      "select nickname, updated_at from cat_profiles where session_id=$1 limit 1",
      [sessionId],
    );
    const row = result.rows[0];
    return json({
      ok: true,
      profile: row ? { nickname: row.nickname, updatedAt: row.updated_at } : null,
    });
  } catch (error) {
    console.error("profile_get_failed", error);
    return json({ ok: false, error: "storage_error" }, 500);
  }
};

export const POST: APIRoute = async ({ request }) => {
  if (!dbConfigured()) return json({ ok: false, error: "profile_unavailable" }, 503);

  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  const sessionId = cleanText(body?.sessionId, 80);
  if (!validSessionId(sessionId)) return json({ ok: false, error: "invalid_session" }, 422);

  const nickname = sanitizeNickname(body?.nickname);

  try {
    const client = await getDbPool().connect();
    try {
      await client.query("begin");
      await client.query(
        `insert into cat_profiles(session_id, nickname, updated_at)
         values($1,$2,now())
         on conflict(session_id) do update
           set nickname=excluded.nickname, updated_at=now()`,
        [sessionId, nickname],
      );

      await client.query(
        "update cat_runs set nickname=$2 where session_id=$1",
        [sessionId, nickname],
      );

      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }

    return json({ ok: true, nickname }, 200);
  } catch (error) {
    console.error("profile_save_failed", error);
    return json({ ok: false, error: "storage_error" }, 500);
  }
};

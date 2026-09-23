import type { APIRoute } from "astro";
import { feedbackDbConfigured } from "../../lib/db";

export const prerender = false;

export const GET: APIRoute = async () => {
  return new Response(JSON.stringify({
    ok: true,
    service: "dont-wake-miso",
    dbConfigured: feedbackDbConfigured(),
    time: new Date().toISOString(),
  }), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
};

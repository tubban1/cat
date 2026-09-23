import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __catDbPool: Pool | undefined;
}

function connectionString() {
  return process.env.SUPABASE_DB_URL?.trim() || "";
}

export function dbConfigured() {
  return Boolean(connectionString());
}

export function getDbPool() {
  const value = connectionString();
  if (!value) throw new Error("SUPABASE_DB_URL is not configured");

  if (!globalThis.__catDbPool) {
    globalThis.__catDbPool = new Pool({
      connectionString: value,
      max: 4,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 4_000,
      ssl: value.includes("localhost") ? false : { rejectUnauthorized: false },
    });
  }
  return globalThis.__catDbPool;
}

// Backward-compatible names used by existing health code.
export const feedbackDbConfigured = dbConfigured;
export const getFeedbackPool = getDbPool;

export async function ensureFeedbackSchema() {
  // Production schema is managed by Supabase migrations.
  return Promise.resolve();
}

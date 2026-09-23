import fs from "node:fs/promises";

const source = await fs.readFile(new URL("../src/data/cats.ts", import.meta.url), "utf8");
const ids = [...new Set(source.match(/photo-[0-9]+-[a-zA-Z0-9_-]+/g) || [])];

if (ids.length < 10) {
  throw new Error("Expected at least 10 curated real-cat photos, found " + ids.length);
}

const results = await Promise.all(ids.map(async (id) => {
  const url = "https://images.unsplash.com/" + id + "?auto=format&fit=crop&fm=jpg&q=70&w=320";
  const response = await fetch(url, { method: "HEAD", redirect: "follow" });
  return { id, status: response.status, ok: response.ok, type: response.headers.get("content-type") || "" };
}));

for (const result of results) {
  console.log(result.id + ": HTTP " + result.status + " " + result.type);
}

const failed = results.filter((result) => !result.ok || !result.type.startsWith("image/"));
if (failed.length) {
  throw new Error("Broken cat images: " + failed.map((item) => item.id).join(", "));
}

console.log("All " + results.length + " cat photos are reachable.");

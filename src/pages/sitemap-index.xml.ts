import type { APIRoute } from "astro";

export const GET: APIRoute = async () => {
  const updated = new Date().toISOString();
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://cat.fde.fan/sitemap.xml</loc>
    <lastmod>${updated}</lastmod>
  </sitemap>
</sitemapindex>`;
  return new Response(xml, { headers: { "content-type": "application/xml; charset=utf-8" } });
};

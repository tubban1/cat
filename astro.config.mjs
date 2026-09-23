import { defineConfig } from "astro/config";
import vercel from "@astrojs/vercel";

export default defineConfig({
  site: "https://cat.fde.fan",
  output: "server",
  adapter: vercel(),
  prefetch: true,
  build: {
    inlineStylesheets: "always",
  },
});

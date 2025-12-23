// @ts-nocheck
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import vercel from "@astrojs/vercel/serverless"; // ← ADD THIS LINE

export default defineConfig({
  integrations: [mdx(), sitemap()],
  site: "https://lystaria.im",
  output: "static",
  adapter: vercel(),
});

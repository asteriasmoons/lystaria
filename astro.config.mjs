// @ts-nocheck
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import node from "@astrojs/node";

export default defineConfig({
  integrations: [mdx(), sitemap()],
  site: "https://lystaria.im",

  // ✅ SSR on Render
  output: "server",
  adapter: node({
    mode: "standalone",
  }),

  vite: {
    resolve: {
      alias: {
        "@": "/src",
      },
    },
  },
});
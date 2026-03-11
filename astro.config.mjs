// @ts-nocheck
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import netlify from "@astrojs/netlify";

export default defineConfig({
  integrations: [mdx(), sitemap()],
  site: "https://lystaria.im",

  // SSR for Netlify
  output: "server",
  adapter: netlify(),

  vite: {
    resolve: {
      alias: {
        "@": "/src",
      },
    },
  },
});

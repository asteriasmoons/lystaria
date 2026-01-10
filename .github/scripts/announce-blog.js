/* eslint-disable no-console */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import matter from "gray-matter";

function mustGetEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

// These are provided by your workflow env block.
// ENDPOINT and SECRET are populated from GitHub Secrets (ANNOUNCER_ENDPOINT / ANNOUNCER_SECRET).
const ENDPOINT = mustGetEnv("ENDPOINT");
const SECRET = mustGetEnv("SECRET");
const SITE_BASE_URL = mustGetEnv("SITE_BASE_URL");

const BLOG_CONTENT_DIR_1 = (process.env.BLOG_CONTENT_DIR_1 || "").replace(/\/+$/, "");
const BLOG_CONTENT_DIR_2 = (process.env.BLOG_CONTENT_DIR_2 || "").replace(/\/+$/, "");
const PUBLIC_BLOG_PREFIX = (process.env.PUBLIC_BLOG_PREFIX || "/blog").replace(/\/+$/, "");

const BEFORE = process.env.GITHUB_BEFORE;
const AFTER = process.env.GITHUB_SHA;

function run(cmd) {
  return execSync(cmd, { stdio: ["ignore", "pipe", "pipe"] }).toString("utf8").trim();
}

function isWithin(dir, file) {
  if (!dir) return false;
  const normDir = dir.replace(/\/+$/, "") + "/";
  return file.startsWith(normDir);
}

function stripExt(p) {
  return p.replace(/\.(md|mdx)$/i, "");
}

// Astro content collections commonly use folder/index.md(x) patterns.
// If file is .../slug/index.mdx -> slug
function slugFromFile(contentDir, file) {
  const rel = file.slice(contentDir.length + 1); // remove dir + "/"
  const noExt = stripExt(rel);

  if (noExt.endsWith("/index")) return noExt.slice(0, -"/index".length);
  return noExt;
}

function absoluteUrl(maybeUrl) {
  if (!maybeUrl || typeof maybeUrl !== "string") return "";
  const u = maybeUrl.trim();
  if (!u) return "";

  // Already absolute
  if (/^https?:\/\//i.test(u)) return u;

  const base = SITE_BASE_URL.replace(/\/+$/, "");

  // Site-root relative path
  if (u.startsWith("/")) return base + u;

  // Relative path without leading slash
  return base + "/" + u;
}

function pickFirstString(obj, keys) {
  for (const k of keys) {
    const v = obj?.[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

/**
 * Extract an image reference from frontmatter.
 * Handles:
 * - string urls/paths
 * - objects like { src: "...", ... } or { url: "..." }
 * - common key variants
 */
function extractImageFrontmatter(fm) {
  const keys = [
    "image",
    "cover",
    "coverImage",
    "heroImage",
    "featuredImage",
    "thumbnail",
    "banner",
    "ogImage",
    "imageUrl",
    "socialImage",
  ];

  for (const key of keys) {
    const v = fm?.[key];

    // Simple string
    if (typeof v === "string" && v.trim()) return v.trim();

    // Object formats (Astro / image pipeline / custom)
    if (v && typeof v === "object") {
      // Most common
      if (typeof v.src === "string" && v.src.trim()) return v.src.trim();
      if (typeof v.url === "string" && v.url.trim()) return v.url.trim();

      // Sometimes nested
      if (typeof v.image === "string" && v.image.trim()) return v.image.trim();
      if (typeof v.path === "string" && v.path.trim()) return v.path.trim();
    }
  }

  return "";
}

/**
 * Discord embeds require a publicly fetchable image URL.
 * This filters out values that look like local filesystem refs
 * that wouldn't resolve in production.
 */
function isLikelyEmbeddableImageUrl(u) {
  if (!u || typeof u !== "string") return false;

  // Must be absolute http(s)
  if (!/^https?:\/\//i.test(u)) return false;

  // Usually safe if it looks like an image file OR an OG-image endpoint
  // (Discord can embed non-extension URLs too, but this is a decent guard.)
  const lower = u.toLowerCase();
  if (/\.(png|jpg|jpeg|webp|gif)(\?|#|$)/i.test(lower)) return true;

  // Allow common OG image routes (optional)
  if (lower.includes("/og") || lower.includes("og-image")) return true;

  // Otherwise allow it anyway (Discord may still fetch it)
  return true;
}

function prettifySlug(slug) {
  const last = slug.split("/").filter(Boolean).pop() || slug;
  return last.replace(/[-_]+/g, " ").trim();
}

async function postJson(payload) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Make-Secret": SECRET,
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`Announcer HTTP ${res.status}: ${text.slice(0, 500)}`);
  return text;
}

function getChangedMarkdownFiles() {
  if (!BEFORE || !AFTER) return [];
  if (BEFORE === "0000000000000000000000000000000000000000") return [];

  const cmd = `git diff --name-only --diff-filter=AM ${BEFORE} ${AFTER} | grep -E '\\.(md|mdx)$' || true`;
  const out = run(cmd);
  if (!out) return [];
  return out.split("\n").map((s) => s.trim()).filter(Boolean);
}

function readFrontmatter(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = matter(raw);
  const fm = parsed.data || {};

  const title = pickFirstString(fm, ["title", "name", "heading"]);
  const excerpt = pickFirstString(fm, ["description", "excerpt", "summary"]);

  const imageRaw = extractImageFrontmatter(fm);
  const imageAbs = absoluteUrl(imageRaw);
  const image = isLikelyEmbeddableImageUrl(imageAbs) ? imageAbs : "";

  return { title, excerpt, image, imageRaw };
}

(async () => {
  const files = getChangedMarkdownFiles();

  if (!files.length) {
    console.log("No changed markdown/mdx files detected.");
    process.exit(0);
  }

  const announcements = [];

  for (const file of files) {
    let contentDir = "";

    if (isWithin(BLOG_CONTENT_DIR_1, file)) contentDir = BLOG_CONTENT_DIR_1;
    else if (isWithin(BLOG_CONTENT_DIR_2, file)) contentDir = BLOG_CONTENT_DIR_2;
    else continue;

    const slug = slugFromFile(contentDir, file);
    if (!slug) continue;

    const url =
      SITE_BASE_URL.replace(/\/+$/, "") +
      PUBLIC_BLOG_PREFIX +
      "/" +
      slug.replace(/^\/+/, "");

    const absPath = path.resolve(file);
    const { title, excerpt, image, imageRaw } = readFrontmatter(absPath);

    // Helpful log so you can see what image value was detected
    if (image) {
      console.log(`Image OK for ${file}: ${image}`);
    } else if (imageRaw) {
      console.log(`Image found but not usable for Discord for ${file}: ${String(imageRaw)}`);
    } else {
      console.log(`No image found in frontmatter for ${file}`);
    }

    announcements.push({
      sha: AFTER,
      requestId: url,
      post: {
        title: title || prettifySlug(slug),
        url,
        excerpt: excerpt || "",
        image: image || "",
      },
    });
  }

  if (!announcements.length) {
    console.log("No blog posts matched configured content dirs.");
    process.exit(0);
  }

  console.log(`Announcing ${announcements.length} post(s).`);

  for (const payload of announcements) {
    console.log(`POST: ${payload.post.title} -> ${payload.post.url}`);
    const resp = await postJson(payload);
    console.log(`OK: ${resp.slice(0, 200)}`);
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
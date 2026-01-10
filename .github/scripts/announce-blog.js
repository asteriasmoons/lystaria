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

function slugFromFile(contentDir, file) {
  const rel = file.slice(contentDir.length + 1);
  const noExt = stripExt(rel);
  if (noExt.endsWith("/index")) return noExt.slice(0, -"/index".length);
  return noExt;
}

function absoluteUrl(maybeUrl) {
  if (!maybeUrl || typeof maybeUrl !== "string") return "";
  const u = maybeUrl.trim();
  if (!u) return "";
  if (/^https?:\/\//i.test(u)) return u;

  const base = SITE_BASE_URL.replace(/\/+$/, "");
  if (u.startsWith("/")) return base + u;
  return base + "/" + u;
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

function pickString(fm, key) {
  const v = fm?.[key];
  return typeof v === "string" ? v.trim() : "";
}

function readFrontmatter(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = matter(raw);
  const fm = parsed.data || {};

  // Your exact keys:
  const title = pickString(fm, "title");
  const excerpt = pickString(fm, "description");
  const coverImageRaw = pickString(fm, "coverImage"); // <-- your field
  const image = absoluteUrl(coverImageRaw);

  return { title, excerpt, coverImageRaw, image };
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
    const { title, excerpt, coverImageRaw, image } = readFrontmatter(absPath);

    console.log("---- Post extracted ----");
    console.log("file:", file);
    console.log("slug:", slug);
    console.log("url:", url);
    console.log("title:", title || "(missing)");
    console.log("description:", excerpt ? "(present)" : "(missing)");
    console.log("coverImage raw:", coverImageRaw || "(missing)");
    console.log("image abs:", image || "(missing)");
    console.log("------------------------");

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
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const PUSH_WEBHOOK_URL = process.env.PUSH_WEBHOOK_URL;
const PUSH_WEBHOOK_SECRET = process.env.PUSH_WEBHOOK_SECRET;
const CHANGED_FILES = process.env.CHANGED_FILES || "";

if (!PUSH_WEBHOOK_URL || !PUSH_WEBHOOK_SECRET) {
  console.error("Missing PUSH_WEBHOOK_URL or PUSH_WEBHOOK_SECRET.");
  process.exit(1);
}

const files = CHANGED_FILES.split("\n").map((s) => s.trim()).filter(Boolean);

const isPost = (f) =>
  f.startsWith("src/content/posts/") && /\.(md|mdx)$/.test(f);

const isUpdatesAstro = (f) => f === "src/pages/updates.astro";

const targets = files.filter((f) => isPost(f) || isUpdatesAstro(f));

if (!targets.length) {
  console.log("No relevant content changes.");
  process.exit(0);
}

function slugFromFile(filePath) {
  const base = path.basename(filePath);
  return base.replace(/\.(md|mdx)$/, "");
}

function urlForFile(filePath) {
  if (isUpdatesAstro(filePath)) return "/updates";
  if (isPost(filePath)) return `/blog/${slugFromFile(filePath)}`;
  return "/";
}

function parsePushMetaFromAstro(src) {
  // Looks for:
  // PUSH_META
  // title: ...
  // message: ...
  // PUSH_META_END
  const re = /PUSH_META([\s\S]*?)PUSH_META_END/;
  const m = src.match(re);
  if (!m) return null;

  const block = m[1];
  const titleMatch = block.match(/title:\s*(.+)\s*/i);
  const messageMatch = block.match(/message:\s*(.+)\s*/i);

  return {
    title: titleMatch ? titleMatch[1].trim() : null,
    message: messageMatch ? messageMatch[1].trim() : null,
  };
}

async function sendPush({ title, message, url }) {
  const res = await fetch(PUSH_WEBHOOK_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${PUSH_WEBHOOK_SECRET}`,
    },
    body: JSON.stringify({ title, message, url }),
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`Push failed (${res.status}): ${text}`);

  console.log(`Push sent: ${title} -> ${url}`);
}

for (const file of targets) {
  if (!fs.existsSync(file)) continue;

  const raw = fs.readFileSync(file, "utf8");
  const url = urlForFile(file);

  if (isUpdatesAstro(file)) {
    const meta = parsePushMetaFromAstro(raw) || {};
    const title = meta.title || "New update";
    const message = meta.message || "A new update is live. Tap to read.";
    await sendPush({ title, message, url });
    continue;
  }

  // Posts (.md/.mdx)
  const parsed = matter(raw);
  const data = parsed.data || {};

  const title =
    typeof data.title === "string" ? data.title : "New blog post";

  const message =
    typeof data.pushMessage === "string"
      ? data.pushMessage
      : "A new blog post is live. Tap to read.";

  await sendPush({ title, message, url });
}
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

// Only react to content changes
const targets = files.filter(
  (f) =>
    f.startsWith("src/content/posts/") ||
    f.startsWith("src/content/updates/")
);

// If none, do nothing
if (!targets.length) {
  console.log("No relevant content changes.");
  process.exit(0);
}

function slugFromFile(filePath) {
  const base = path.basename(filePath);
  return base.replace(/\.(md|mdx)$/, "");
}

function urlForFile(filePath) {
  if (filePath.startsWith("src/content/updates/")) {
    return `/updates/${slugFromFile(filePath)}`;
  }
  if (filePath.startsWith("src/content/posts/")) {
    // If your posts are /blog/<slug>, keep this:
    return `/blog/${slugFromFile(filePath)}`;
  }
  return "/";
}

function kindForFile(filePath) {
  if (filePath.startsWith("src/content/updates/")) return "Update";
  if (filePath.startsWith("src/content/posts/")) return "New post";
  return "Update";
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

// If multiple files changed in one push, we'll send one notification per file.
// (We can change this to "bundle into one" later if you want.)
for (const file of targets) {
  if (!fs.existsSync(file)) continue; // deleted/renamed

  const raw = fs.readFileSync(file, "utf8");
  const parsed = matter(raw);
  const data = parsed.data || {};

  const title =
    typeof data.title === "string"
      ? data.title
      : `${kindForFile(file)} published`;

  const message =
    file.startsWith("src/content/updates/")
      ? "A new update is live. Tap to read."
      : "A new blog post is live. Tap to read.";

  const url = urlForFile(file);

  await sendPush({ title, message, url });
}
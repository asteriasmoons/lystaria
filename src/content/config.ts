// src/content/config.ts
import { defineCollection, z } from "astro:content";

/**
 * Normalize a frontmatter date so date-only strings (YYYY-MM-DD) become
 * a local-noon Date, avoiding 00:00:00 timestamps that can break RSS watchers.
 */
function normalizeDate(input: unknown): Date {
  if (!input) return new Date();

  // If it's already a Date, normalize midnight -> noon
  if (input instanceof Date) {
    if (
      input.getHours() === 0 &&
      input.getMinutes() === 0 &&
      input.getSeconds() === 0 &&
      input.getMilliseconds() === 0
    ) {
      return new Date(
        input.getFullYear(),
        input.getMonth(),
        input.getDate(),
        12,
        0,
        0,
        0
      );
    }
    return input;
  }

  const s = String(input).trim();

  // If it's exactly YYYY-MM-DD, force local noon
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d, 12, 0, 0, 0);
  }

  // Otherwise try parsing normally (ISO strings with time, etc.)
  const dt = new Date(s);
  if (isNaN(dt.getTime())) return new Date();

  // If parsing results in midnight, also normalize to noon
  if (
    dt.getHours() === 0 &&
    dt.getMinutes() === 0 &&
    dt.getSeconds() === 0 &&
    dt.getMilliseconds() === 0
  ) {
    return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), 12, 0, 0, 0);
  }

  return dt;
}

const postsCollection = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    description: z.string(),

    // Accept string or Date and normalize to Date (local noon if date-only)
    pubDate: z
      .union([z.string(), z.date()])
      .transform((val) => normalizeDate(val)),

    // Optional, same normalization
    updatedDate: z
      .union([z.string(), z.date()])
      .optional()
      .transform((val) => (val == null ? undefined : normalizeDate(val))),

    tags: z.array(z.string()).optional(),
    coverImage: z.string().optional(),
    seriesNumber: z.number().optional(),
    seriesTotal: z.number().optional(),
  }),
});

export const collections = {
  posts: postsCollection,
};

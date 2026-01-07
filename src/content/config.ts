// src/content/config.ts
import { defineCollection, z } from "astro:content";

function parseTimeString(input: string): { h: number; m: number } | null {
  const s = input.trim().toLowerCase();

  // 24h: "19:04"
  const m24 = s.match(/^(\d{1,2}):(\d{2})$/);
  if (m24) {
    const h = Number(m24[1]);
    const m = Number(m24[2]);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) return { h, m };
    return null;
  }

  // 12h: "7:04 pm" or "7:04pm"
  const m12 = s.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/);
  if (m12) {
    let h = Number(m12[1]);
    const m = Number(m12[2]);
    const ampm = m12[3];
    if (h < 1 || h > 12 || m < 0 || m > 59) return null;
    if (ampm === "pm" && h !== 12) h += 12;
    if (ampm === "am" && h === 12) h = 0;
    return { h, m };
  }

  // IMPORTANT for your choice C:
  // We do NOT accept "7:04" without AM/PM here.
  return null;
}

function buildPublishDate(pubDateRaw: unknown, pubTimeRaw?: unknown): Date {
  // Expect pubDate as YYYY-MM-DD (string) or Date
  let y: number, mo: number, d: number;

  if (pubDateRaw instanceof Date) {
    y = pubDateRaw.getFullYear();
    mo = pubDateRaw.getMonth() + 1;
    d = pubDateRaw.getDate();
  } else {
    const s = String(pubDateRaw ?? "").trim();
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) {
      const dt = new Date(s);
      return isNaN(dt.getTime()) ? new Date() : dt;
    }
    y = Number(m[1]);
    mo = Number(m[2]);
    d = Number(m[3]);
  }

  // Default to noon (safe, not 00:00:00)
  let hour = 12;
  let minute = 0;

  if (pubTimeRaw != null) {
    const parsed = parseTimeString(String(pubTimeRaw));
    if (parsed) {
      hour = parsed.h;
      minute = parsed.m;
    }
  }

  return new Date(y, mo - 1, d, hour, minute, 0, 0);
}

const postsCollection = defineCollection({
  type: "content",
  schema: z
    .object({
      title: z.string(),
      description: z.string(),

      // CHANGED: accept date-only string too
      pubDate: z.union([z.string(), z.date()]),

      // ADDED: optional human time
      pubTime: z.string().optional(),

      updatedDate: z.coerce.date().optional(),
      tags: z.array(z.string()).optional(),
      coverImage: z.string().optional(),
      series: z.enum(["spellcrafting", "zodiac"]).optional(),
      seriesNumber: z.number().optional(),
      seriesTotal: z.number().optional(),
    })
    .transform((data) => ({
      ...data,
      pubDate: buildPublishDate(data.pubDate, data.pubTime),
    })),
});

const updates = defineCollection({
  schema: z.object({
    title: z.string(),
    pubDate: z.date(),
    push: z.boolean().optional(),
    pushMessage: z.string().optional(),
  }),
});

export const collections = {
  posts,
  updates,
};

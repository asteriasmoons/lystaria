import rss from "@astrojs/rss";
import { getCollection } from "astro:content";

function normalizePubDate(input) {
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

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d, 12, 0, 0, 0);
  }

  const dt = new Date(s);
  if (isNaN(dt.getTime())) return new Date();

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

export async function GET(context) {
  const posts = await getCollection("posts");

  // Sort posts by date (newest first)
  const sortedPosts = posts.sort(
    (a, b) =>
      normalizePubDate(b.data.pubDate).valueOf() -
      normalizePubDate(a.data.pubDate).valueOf()
  );

  // Helper function to detect image type from file extension
  const getImageType = (url) => {
    if (!url) return "image/png"; // default fallback
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.endsWith(".jpg") || lowerUrl.endsWith(".jpeg"))
      return "image/jpeg";
    if (lowerUrl.endsWith(".webp")) return "image/webp";
    if (lowerUrl.endsWith(".gif")) return "image/gif";
    if (lowerUrl.endsWith(".svg")) return "image/svg+xml";
    return "image/png"; // default for .png or unknown
  };

  return rss({
    title: "Lystaria",
    description:
      "Where the mystical meets the mundane. A space for exploring magic, personal growth, mental wellness, and the philosophies that shape us.",
    site: context.site,
    xmlns: {
      atom: "http://www.w3.org/2005/Atom",
      media: "http://search.yahoo.com/mrss/",
    },
    customData: `<language>en-us</language><atom:link href="${context.site}rss.xml" rel="self" type="application/rss+xml" />`,
    items: sortedPosts.map((post) => {
      // Build absolute URL for cover image
      const coverImageUrl = post.data.coverImage
        ? new URL(post.data.coverImage, context.site).href
        : null;

      return {
        title: post.data.title,
        pubDate: normalizePubDate(post.data.pubDate),
        description: post.data.description,
        link: `/blog/${post.slug}/`,
        categories: post.data.tags || [],
        // Add cover image as enclosure with auto-detected type
        enclosure: coverImageUrl
          ? {
              url: coverImageUrl,
              type: getImageType(coverImageUrl),
              length: 0,
            }
          : undefined,
        // Also embed image in content for readers that prefer HTML
        content: coverImageUrl
          ? `<img src="${coverImageUrl}" alt="${post.data.title}" /><p>${post.data.description}</p>`
          : post.data.description,
      };
    }),
  });
}

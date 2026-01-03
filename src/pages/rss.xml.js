import rss from "@astrojs/rss";
import { getCollection } from "astro:content";

export async function GET(context) {
  const posts = await getCollection("posts");

  // Sort posts by date (newest first)
  const sortedPosts = posts.sort(
    (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf()
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
        pubDate: post.data.pubDate,
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

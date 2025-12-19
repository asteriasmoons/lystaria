// src/pages/api/horoscopes.json.ts
export const prerender = false;

const signs = [
  { name: "aries", symbol: "♈", dates: "Mar 21 - Apr 19" },
  { name: "taurus", symbol: "♉", dates: "Apr 20 - May 20" },
  { name: "gemini", symbol: "♊", dates: "May 21 - Jun 20" },
  { name: "cancer", symbol: "♋", dates: "Jun 21 - Jul 22" },
  { name: "leo", symbol: "♌", dates: "Jul 23 - Aug 22" },
  { name: "virgo", symbol: "♍", dates: "Aug 23 - Sep 22" },
  { name: "libra", symbol: "♎", dates: "Sep 23 - Oct 22" },
  { name: "scorpio", symbol: "♏", dates: "Oct 23 - Nov 21" },
  { name: "sagittarius", symbol: "♐", dates: "Nov 22 - Dec 21" },
  { name: "capricorn", symbol: "♑", dates: "Dec 22 - Jan 19" },
  { name: "aquarius", symbol: "♒", dates: "Jan 20 - Feb 18" },
  { name: "pisces", symbol: "♓", dates: "Feb 19 - Mar 20" },
];

type HoroscopeResult = {
  description: string;
  symbol: string;
  dates: string;
};

async function fetchHoroscope(sign: string): Promise<string> {
  const res = await fetch(`https://ohmanda.com/api/horoscope/${sign}`, {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    throw new Error(`Ohmanda HTTP ${res.status} for ${sign}`);
  }

  const data = await res.json();
  // Ohmanda returns: { sign, date, horoscope }
  return String(data?.horoscope ?? "");
}

export async function GET() {
  const horoscopes: Record<string, HoroscopeResult> = {};

  await Promise.all(
    signs.map(async (s) => {
      try {
        const description = await fetchHoroscope(s.name);
        horoscopes[s.name] = {
          description: description || "Horoscope unavailable at this time.",
          symbol: s.symbol,
          dates: s.dates,
        };
      } catch (err) {
        console.error(`Failed horoscope fetch for ${s.name}:`, err);
        horoscopes[s.name] = {
          description: "Horoscope unavailable at this time.",
          symbol: s.symbol,
          dates: s.dates,
        };
      }
    })
  );

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return new Response(JSON.stringify({ today, horoscopes }, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",

      // Cache daily at the edge (Vercel) + allow serving stale while refreshing.
      // This makes it feel "daily" without redeploys and avoids repeated upstream calls.
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}

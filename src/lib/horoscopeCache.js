let cached = null;
let cachedAt = 0;

// daily-ish cache; you can do 15 min too
const TTL_MS = 1000 * 60 * 30; // 30 minutes

export async function getCachedHoroscopes(fetchFn) {
  const now = Date.now();
  if (cached && now - cachedAt < TTL_MS) return cached;

  cached = await fetchFn();
  cachedAt = now;
  return cached;
}
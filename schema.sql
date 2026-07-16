/**
 * Lightweight cache so that once data is pulled from Supabase it "does not
 * change" during a session and works offline-ish across tabs, per the brief.
 * Swap this for React Query / SWR later if you want background revalidation.
 */
const PREFIX = 'braves-dash-cache:'

export function cacheGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function cacheSet<T>(key: string, value: T) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    // storage full or unavailable — fail silently, data just won't persist
  }
}

export function cacheClear(key?: string) {
  if (key) {
    localStorage.removeItem(PREFIX + key)
    return
  }
  Object.keys(localStorage)
    .filter((k) => k.startsWith(PREFIX))
    .forEach((k) => localStorage.removeItem(k))
}

/**
 * Fetch-with-cache helper: returns cached data immediately if present,
 * otherwise calls `fetcher`, caches the result, and returns it.
 */
export async function cachedFetch<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const cached = cacheGet<T>(key)
  if (cached !== null) return cached
  const fresh = await fetcher()
  cacheSet(key, fresh)
  return fresh
}

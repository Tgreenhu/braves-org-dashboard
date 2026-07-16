// Auto-detection helpers for the mass-upload flow — figure out what a CSV
// is without asking the person uploading it.

const PITCHER_SIGNAL_KEYS = ['IP', 'ERA', 'WHIP']
const HITTER_SIGNAL_KEYS = ['PA', 'AVG', 'OBP', 'SLG']

/**
 * Guesses hitter vs pitcher from column headers alone. IP/ERA/WHIP are
 * pitcher-only stats in a Fangraphs export; PA/AVG/OBP/SLG are hitter-only.
 * Returns null if neither set of signals shows up, so the caller can flag
 * the file instead of silently guessing wrong.
 */
export function detectPlayerType(headers: string[]): 'Hitter' | 'Pitcher' | null {
  const normalized = headers.map((h) => h.trim().toLowerCase())
  const hasPitcherSignal = PITCHER_SIGNAL_KEYS.some((k) => normalized.includes(k.toLowerCase()))
  const hasHitterSignal = HITTER_SIGNAL_KEYS.some((k) => normalized.includes(k.toLowerCase()))
  if (hasPitcherSignal) return 'Pitcher'
  if (hasHitterSignal) return 'Hitter'
  return null
}

/** Finds which header (if any) holds the season/year for each row. */
export function findColumnKey(headers: string[], candidates: string[]): string | null {
  const lowerCandidates = candidates.map((c) => c.trim().toLowerCase())
  return headers.find((h) => lowerCandidates.includes(h.trim().toLowerCase())) ?? null
}

const YEAR_REGEX = /(19|20)\d{2}/

/** Fallback when the CSV has no Season/Year column — pull a 4-digit year out of the filename. */
export function extractYearFromFilename(filename: string): number | null {
  const match = filename.match(YEAR_REGEX)
  return match ? Number(match[0]) : null
}

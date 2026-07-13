/**
 * Tags each row with `is_total` for players who appear more than once in
 * the same file — i.e. played at multiple levels/teams in the same season.
 * Fangraphs already includes a combined row for these players; the tricky
 * part is figuring out *which* row that is without hardcoding assumptions
 * about how Fangraphs labels it (that label can vary by report).
 *
 * Detection is data-driven instead: for each player name, compare a
 * counting stat (PA for hitters, IP for pitchers) across their rows. The
 * one row whose value equals the sum of all their other rows is the total.
 * If nothing lines up exactly (rounding, etc.) we fall back to the row
 * with the largest value, since a season total is never smaller than any
 * single-level stint.
 *
 * Players who only appear once (single level all year) get is_total=true
 * on their only row — that row already IS their season total.
 */
export function tagTotalRows(
  rows: Record<string, any>[],
  candidateStatKeys: string[],
): Record<string, any>[] {
  if (rows.length === 0) return rows

  const nameKey = findKey(rows[0], ['Name', 'name', 'Player', 'PLAYER'])
  if (!nameKey) {
    // Can't group without knowing who's who — leave everything untagged
    // rather than guess wrong.
    return rows.map((r) => ({ ...r, is_total: false }))
  }

  const statKey = findKey(rows[0], candidateStatKeys)

  const byName = new Map<string, Record<string, any>[]>()
  for (const row of rows) {
    const name = String(row[nameKey] ?? '').trim()
    if (!name) continue
    if (!byName.has(name)) byName.set(name, [])
    byName.get(name)!.push(row)
  }

  for (const group of byName.values()) {
    if (group.length === 1) {
      group[0].is_total = true
      continue
    }
    if (!statKey) {
      // Multiple rows for this player but no counting stat to compare —
      // flag none rather than silently pick the wrong one.
      group.forEach((r) => (r.is_total = false))
      continue
    }
    const values = group.map((r) => Number(r[statKey]) || 0)
    let totalIndex = values.findIndex((v, i) => {
      const sumOfOthers = values.reduce((acc, other, j) => (j === i ? acc : acc + other), 0)
      return Math.abs(sumOfOthers - v) < 0.05
    })
    if (totalIndex === -1) {
      totalIndex = values.indexOf(Math.max(...values))
    }
    group.forEach((r, i) => (r.is_total = i === totalIndex))
  }

  return rows
}

function findKey(sample: Record<string, any> | undefined, candidates: string[]): string | null {
  if (!sample) return null
  const keys = Object.keys(sample)
  for (const candidate of candidates) {
    const match = keys.find((k) => k.trim().toLowerCase() === candidate.trim().toLowerCase())
    if (match) return match
  }
  return null
}

/**
 * Same as tagTotalRows, but groups by a season column first so a multi-year
 * file (one CSV covering several seasons) doesn't accidentally treat two
 * different players' same name in different years as one "split season."
 * Mutates and returns the same row objects, so this is safe to call even
 * when rows span multiple player-type files.
 */
export function tagTotalRowsBySeason(
  rows: Record<string, any>[],
  candidateStatKeys: string[],
  seasonKey: string,
): Record<string, any>[] {
  const bySeason = new Map<string, Record<string, any>[]>()
  for (const row of rows) {
    const season = String(row[seasonKey] ?? '')
    if (!bySeason.has(season)) bySeason.set(season, [])
    bySeason.get(season)!.push(row)
  }
  for (const group of bySeason.values()) {
    tagTotalRows(group, candidateStatKeys)
  }
  return rows
}

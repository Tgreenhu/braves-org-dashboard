import type { HitterSeasonStats, PitcherSeasonStats } from '@/types'
import { ORG_LEVELS } from '@/types'
import { scoreHitters, scorePitchers, type ScoredPlayer } from '@/lib/scoring'

const INFIELD_POS = new Set(['1B', '2B', '3B', 'SS', 'IF', 'INF', 'UTIL', 'FIRST', 'SECOND', 'THIRD', 'SHORTSTOP', '3', '4', '5', '6'])
export const OUTFIELD_POS = new Set(['LF', 'CF', 'RF', 'OF', 'UTIL', 'LEFT', 'CENTER', 'RIGHT', 'OUTFIELD', '7', '8', '9'])
const CATCHER_POS = new Set(['C', 'CATCHER', '2'])

/**
 * Fangraphs' Pos column isn't always a single clean value — multi-position
 * players sometimes show as "3B/SS", casing varies, and there can be
 * stray whitespace. Take just the primary (first-listed) position and
 * normalize it so IF/OF/C matching actually works against real data.
 */
export function primaryPosition(position: string | null | undefined): string {
  if (!position) return ''
  return position.split(/[\/,]/)[0].trim().toUpperCase()
}

const HITTER_RATE_KEYS = ['avg', 'obp', 'slg', 'ops', 'wrcPlus', 'bbPct', 'kPct'] as const
const HITTER_SUM_KEYS = ['g', 'pa', 'ab', 'hr', 'sb'] as const
const PITCHER_RATE_KEYS = ['era', 'fip', 'siera', 'whip', 'kPct', 'bbPct', 'kbbPct'] as const
const PITCHER_SUM_KEYS = ['g', 'gs', 'ip'] as const

/**
 * A player who spent part of the season at more than one level (a
 * call-up, an option, a rehab stint) has a separate row per level — each
 * one correctly a full season in itself for the Players tab, but for All-
 * Org Team purposes those are the SAME person, not two different
 * competitors for two different slots. This collapses every name down to
 * one entry: stats combined (rate stats weighted by playing time, counting
 * stats summed), with the combined entry's level/position/age/team taken
 * from whichever stint had the MOST playing time — not just whichever was
 * technically the highest level. That distinction matters: a real call-up
 * with meaningful innings should be credited at that level, but a token
 * 1-PA cameo shouldn't hand an overwhelmingly-AAA player the full MLB
 * level bonus in scoring just because that stint was "higher."
 */
function combineAcrossLevels<T extends { name: string; level: (typeof ORG_LEVELS)[number] }>(
  players: T[],
  volumeKey: 'pa' | 'ip',
  rateKeys: readonly string[],
  sumKeys: readonly string[],
): T[] {
  const byName = new Map<string, T[]>()
  for (const p of players) {
    const key = p.name.trim().toLowerCase()
    if (!byName.has(key)) byName.set(key, [])
    byName.get(key)!.push(p)
  }

  const result: T[] = []
  for (const group of byName.values()) {
    if (group.length === 1) {
      result.push(group[0])
      continue
    }

    const totalVolume = group.reduce((s, p: any) => s + (p[volumeKey] ?? 0), 0)
    // Represent this player at whichever level they actually played the
    // MOST at — not just the technically-highest level they touched. A
    // real call-up with meaningful playing time (50+ IP at MLB) should
    // correctly be credited at MLB, but a 1-PA September cameo shouldn't
    // hand a mostly-AAA player the full MLB level bonus in scoring.
    const dominantRow = [...group].sort((a: any, b: any) => (b[volumeKey] ?? 0) - (a[volumeKey] ?? 0))[0]
    const combined: any = { ...dominantRow }

    for (const key of rateKeys) {
      const weightedSum = group.reduce((s, p: any) => s + (p[key] ?? 0) * (p[volumeKey] ?? 0), 0)
      let value = totalVolume > 0 ? weightedSum / totalVolume : (dominantRow as any)[key]
      if (key === 'wrcPlus') value = Math.round(value) // always a whole number
      combined[key] = value
    }
    for (const key of sumKeys) {
      combined[key] = group.reduce((s, p: any) => s + (p[key] ?? 0), 0)
    }

    result.push(combined)
  }
  return result
}

export function combineHittersAcrossLevels(hitters: HitterSeasonStats[]): HitterSeasonStats[] {
  return combineAcrossLevels(hitters, 'pa', HITTER_RATE_KEYS, HITTER_SUM_KEYS)
}
export function combinePitchersAcrossLevels(pitchers: PitcherSeasonStats[]): PitcherSeasonStats[] {
  return combineAcrossLevels(pitchers, 'ip', PITCHER_RATE_KEYS, PITCHER_SUM_KEYS)
}

export interface OrgTeamSlot {
  slotLabel: string // e.g. "1B", "OF", "C", "DH", "SP1"
  player: HitterSeasonStats | PitcherSeasonStats | null
  score: number | null
  breakdown: Record<string, number> | null
}

export interface OrgTeam {
  teamNumber: 1 | 2 | 3
  infielders: OrgTeamSlot[]
  outfielders: OrgTeamSlot[]
  catcher: OrgTeamSlot
  dh: OrgTeamSlot
  pitchers: OrgTeamSlot[]
}

/**
 * Builds the three All-Organization Teams. Position players are drafted in
 * score order into IF (4), OF (3), C (1), then the next-best remaining
 * position player (regardless of position) becomes DH — repeated for
 * Teams 1, 2, 3 so nobody is picked twice. Pitchers are a separate pool,
 * top 5 per team by composite pitcher score.
 */
export function buildAllOrgTeams(
  hitters: HitterSeasonStats[],
  pitchers: PitcherSeasonStats[],
): OrgTeam[] {
  const combinedHitters = combineHittersAcrossLevels(hitters)
  const combinedPitchers = combinePitchersAcrossLevels(pitchers)
  const scoredHitters = scoreHitters(combinedHitters)
  const scoredPitchers = scorePitchers(combinedPitchers)

  const used = new Set<string>()
  const teams: OrgTeam[] = []

  const takeNext = (pool: ScoredPlayer<HitterSeasonStats>[], predicate: (h: HitterSeasonStats) => boolean) => {
    const found = pool.find((sp) => !used.has(sp.player.playerId) && predicate(sp.player))
    if (found) used.add(found.player.playerId)
    return found ?? null
  }

  for (let teamNumber = 1 as 1 | 2 | 3; teamNumber <= 3; teamNumber++) {
    const infielders: OrgTeamSlot[] = []
    for (let i = 0; i < 4; i++) {
      const pick = takeNext(scoredHitters, (h) => INFIELD_POS.has(primaryPosition(h.position)))
      infielders.push({ slotLabel: 'IF', player: pick?.player ?? null, score: pick?.score ?? null, breakdown: pick?.breakdown ?? null })
    }
    const outfielders: OrgTeamSlot[] = []
    for (let i = 0; i < 3; i++) {
      const pick = takeNext(scoredHitters, (h) => OUTFIELD_POS.has(primaryPosition(h.position)))
      outfielders.push({ slotLabel: 'OF', player: pick?.player ?? null, score: pick?.score ?? null, breakdown: pick?.breakdown ?? null })
    }
    const cPick = takeNext(scoredHitters, (h) => CATCHER_POS.has(primaryPosition(h.position)))
    const catcher: OrgTeamSlot = { slotLabel: 'C', player: cPick?.player ?? null, score: cPick?.score ?? null, breakdown: cPick?.breakdown ?? null }

    // DH = next best remaining position player, any position
    const dhPick = takeNext(scoredHitters, () => true)
    const dh: OrgTeamSlot = { slotLabel: 'DH', player: dhPick?.player ?? null, score: dhPick?.score ?? null, breakdown: dhPick?.breakdown ?? null }

    const pitcherSlots: OrgTeamSlot[] = []
    const usedPitchers = new Set<string>()
    let taken = 0
    for (const sp of scoredPitchers) {
      if (taken >= 5) break
      const already = teams
        .flatMap((t) => t.pitchers)
        .some((slot) => slot.player && slot.player.playerId === sp.player.playerId)
      if (already || usedPitchers.has(sp.player.playerId)) continue
      usedPitchers.add(sp.player.playerId)
      pitcherSlots.push({ slotLabel: `P${taken + 1}`, player: sp.player, score: sp.score, breakdown: sp.breakdown })
      taken++
    }
    while (pitcherSlots.length < 5) {
      pitcherSlots.push({ slotLabel: `P${pitcherSlots.length + 1}`, player: null, score: null, breakdown: null })
    }

    teams.push({ teamNumber, infielders, outfielders, catcher, dh, pitchers: pitcherSlots })
  }

  return teams
}

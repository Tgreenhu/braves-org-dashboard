import type { HitterSeasonStats, PitcherSeasonStats } from '@/types'
import { scoreHitters, scorePitchers, type ScoredPlayer } from '@/lib/scoring'

const INFIELD_POS = new Set(['1B', '2B', '3B', 'SS', 'IF'])
const OUTFIELD_POS = new Set(['LF', 'CF', 'RF', 'OF'])

export interface OrgTeamSlot {
  slotLabel: string // e.g. "1B", "OF", "C", "DH", "SP1"
  player: HitterSeasonStats | PitcherSeasonStats | null
  score: number | null
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
  const scoredHitters = scoreHitters(hitters)
  const scoredPitchers = scorePitchers(pitchers)

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
      const pick = takeNext(scoredHitters, (h) => INFIELD_POS.has(h.position))
      infielders.push({ slotLabel: 'IF', player: pick?.player ?? null, score: pick?.score ?? null })
    }
    const outfielders: OrgTeamSlot[] = []
    for (let i = 0; i < 3; i++) {
      const pick = takeNext(scoredHitters, (h) => OUTFIELD_POS.has(h.position))
      outfielders.push({ slotLabel: 'OF', player: pick?.player ?? null, score: pick?.score ?? null })
    }
    const cPick = takeNext(scoredHitters, (h) => h.position === 'C')
    const catcher: OrgTeamSlot = { slotLabel: 'C', player: cPick?.player ?? null, score: cPick?.score ?? null }

    // DH = next best remaining position player, any position
    const dhPick = takeNext(scoredHitters, () => true)
    const dh: OrgTeamSlot = { slotLabel: 'DH', player: dhPick?.player ?? null, score: dhPick?.score ?? null }

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
      pitcherSlots.push({ slotLabel: `P${taken + 1}`, player: sp.player, score: sp.score })
      taken++
    }
    while (pitcherSlots.length < 5) {
      pitcherSlots.push({ slotLabel: `P${pitcherSlots.length + 1}`, player: null, score: null })
    }

    teams.push({ teamNumber, infielders, outfielders, catcher, dh, pitchers: pitcherSlots })
  }

  return teams
}

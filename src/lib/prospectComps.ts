import type { HitterSeasonStats, PitcherSeasonStats, OrgLevel } from '@/types'
import type { CompPoolHitterRow, CompPoolPitcherRow } from '@/lib/queries'

// Rough level-average ages used to compute an "age relative to level" score —
// the heaviest-weighted input per the brief. Replace with real league-wide
// averages computed from the full comp pool once it's built out.
export const LEVEL_AVG_AGE: Record<OrgLevel, number> = {
  MLB: 27.5,
  AAA: 25.5,
  AA: 23.5,
  'High-A': 21.5,
  A: 20.5,
  FCL: 19,
  DSL: 18,
}

export interface RadarMetric {
  metric: string
  player: number
  comp: number
}

export interface ProspectComp {
  compName: string
  years: string
  outcome: string
  similarityScore: number
  radar: RadarMetric[]
  blurb: string
}

function ageToLevelDelta(age: number, level: OrgLevel) {
  return age - LEVEL_AVG_AGE[level]
}

/** Normalizes a stat to a 0-100 scale within a comparison pool for radar display. */
function normalize(value: number, min: number, max: number) {
  if (max === min) return 50
  return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100))
}

export function getHitterComps(
  player: HitterSeasonStats,
  pool: CompPoolHitterRow[],
  topN = 5,
): ProspectComp[] {
  const playerAgeDelta = ageToLevelDelta(player.age, player.level)

  const scored = pool.map((comp) => {
    const compAgeDelta = ageToLevelDelta(comp.age, comp.level)
    // Weighted "distance" -> similarity. Age-to-level weighted heaviest per
    // the brief; wRC+/BB:K/ISO/K% chosen as the metrics that most consistently
    // separate MiLB hitters who stick in the big leagues from those who don't.
    const isoPlayer = player.slg - player.avg
    const isoComp = comp.slg - comp.avg
    const bbkPlayer = player.bbPct / Math.max(player.kPct, 1)
    const bbkComp = comp.bbPct / Math.max(comp.kPct, 1)

    const dist =
      2.2 * Math.abs(playerAgeDelta - compAgeDelta) +
      1.4 * (Math.abs(player.wrcPlus - comp.wrcPlus) / 20) +
      1.1 * (Math.abs(bbkPlayer - bbkComp) * 10) +
      0.9 * (Math.abs(isoPlayer - isoComp) * 10) +
      0.7 * (Math.abs(player.kPct - comp.kPct) / 5)

    const similarityScore = Math.max(0, 100 - dist * 6)

    const ages = [player.age, comp.age]
    const wrcs = [player.wrcPlus, comp.wrcPlus]
    const bbks = [bbkPlayer, bbkComp]
    const isos = [isoPlayer, isoComp]
    const ks = [player.kPct, comp.kPct]

    const radar: RadarMetric[] = [
      { metric: 'Age vs Level', player: normalize(-playerAgeDelta, -Math.min(...ages.map((a) => a)), 5), comp: normalize(-compAgeDelta, -Math.min(...ages), 5) },
      { metric: 'wRC+', player: normalize(player.wrcPlus, Math.min(...wrcs) - 10, Math.max(...wrcs) + 10), comp: normalize(comp.wrcPlus, Math.min(...wrcs) - 10, Math.max(...wrcs) + 10) },
      { metric: 'BB:K', player: normalize(bbkPlayer, Math.min(...bbks) - 0.1, Math.max(...bbks) + 0.1), comp: normalize(bbkComp, Math.min(...bbks) - 0.1, Math.max(...bbks) + 0.1) },
      { metric: 'ISO', player: normalize(isoPlayer, Math.min(...isos) - 0.05, Math.max(...isos) + 0.05), comp: normalize(isoComp, Math.min(...isos) - 0.05, Math.max(...isos) + 0.05) },
      { metric: 'Contact (inv K%)', player: normalize(-player.kPct, -Math.max(...ks) - 5, -Math.min(...ks) + 5), comp: normalize(-comp.kPct, -Math.max(...ks) - 5, -Math.min(...ks) + 5) },
    ]

    const blurb = `${comp.name} (${comp.years}) reached ${comp.level} at age ${comp.age} hitting ${comp.avg.toFixed(3)}/${comp.obp.toFixed(3)}/${comp.slg.toFixed(3)} with a ${comp.wrcPlus} wRC+. ${comp.outcome}. ${player.name} projects similarly on an age-for-level and plate-discipline basis. [Placeholder blurb — wire a Claude API call in a Supabase Edge Function to generate this dynamically.]`

    return { compName: comp.name, years: comp.years, outcome: comp.outcome, similarityScore, radar, blurb }
  })

  return scored.sort((a, b) => b.similarityScore - a.similarityScore).slice(0, topN)
}

export function getPitcherComps(
  player: PitcherSeasonStats,
  pool: CompPoolPitcherRow[],
  topN = 5,
): ProspectComp[] {
  const playerAgeDelta = ageToLevelDelta(player.age, player.level)

  const scored = pool.map((comp) => {
    const compAgeDelta = ageToLevelDelta(comp.age, comp.level)
    const dist =
      2.2 * Math.abs(playerAgeDelta - compAgeDelta) +
      1.3 * (Math.abs(player.kbbPct - comp.kbbPct) / 5) +
      1.1 * (Math.abs(player.fip - comp.fip) * 2) +
      0.9 * (Math.abs(player.whip - comp.whip) * 8) +
      0.7 * (Math.abs(player.siera - comp.siera) * 2)

    const similarityScore = Math.max(0, 100 - dist * 6)

    const kbbs = [player.kbbPct, comp.kbbPct]
    const fips = [player.fip, comp.fip]
    const whips = [player.whip, comp.whip]
    const sieras = [player.siera, comp.siera]
    const ages = [player.age, comp.age]

    const radar: RadarMetric[] = [
      { metric: 'Age vs Level', player: normalize(-playerAgeDelta, -Math.min(...ages), 5), comp: normalize(-compAgeDelta, -Math.min(...ages), 5) },
      { metric: 'K-BB%', player: normalize(player.kbbPct, Math.min(...kbbs) - 5, Math.max(...kbbs) + 5), comp: normalize(comp.kbbPct, Math.min(...kbbs) - 5, Math.max(...kbbs) + 5) },
      { metric: 'FIP (inv)', player: normalize(-player.fip, -Math.max(...fips) - 0.5, -Math.min(...fips) + 0.5), comp: normalize(-comp.fip, -Math.max(...fips) - 0.5, -Math.min(...fips) + 0.5) },
      { metric: 'WHIP (inv)', player: normalize(-player.whip, -Math.max(...whips) - 0.1, -Math.min(...whips) + 0.1), comp: normalize(-comp.whip, -Math.max(...whips) - 0.1, -Math.min(...whips) + 0.1) },
      { metric: 'SIERA (inv)', player: normalize(-player.siera, -Math.max(...sieras) - 0.5, -Math.min(...sieras) + 0.5), comp: normalize(-comp.siera, -Math.max(...sieras) - 0.5, -Math.min(...sieras) + 0.5) },
    ]

    const blurb = `${comp.name} (${comp.years}) pitched at ${comp.level} at age ${comp.age} with a ${comp.era.toFixed(2)} ERA / ${comp.fip.toFixed(2)} FIP and ${comp.kbbPct.toFixed(1)}% K-BB. ${comp.outcome}. ${player.name} profiles similarly on stuff and command markers. [Placeholder blurb — wire a Claude API call in a Supabase Edge Function to generate this dynamically.]`

    return { compName: comp.name, years: comp.years, outcome: comp.outcome, similarityScore, radar, blurb }
  })

  return scored.sort((a, b) => b.similarityScore - a.similarityScore).slice(0, topN)
}

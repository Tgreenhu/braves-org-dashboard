import type { HitterSeasonStats, PitcherSeasonStats, OrgLevel } from '@/types'

/**
 * TODO(data): This is a 12-name placeholder standing in for the real
 * 1000-player comp pool (500 notable hitters / 500 notable pitchers from the
 * last 10 years of MiLB) described in the brief. Build the real pool as a
 * Supabase table `prospect_comp_pool` with the same shape as
 * HitterSeasonStats/PitcherSeasonStats plus `ageAtLevel` and an outcome
 * label (e.g. "MLB regular", "org depth", "bust") so the similarity engine
 * below can eventually be validated against actual outcomes.
 */
export interface CompPoolHitter extends HitterSeasonStats {
  years: string // e.g. "2016-2019"
  outcome: string // one-line career outcome for the blurb
}
export interface CompPoolPitcher extends PitcherSeasonStats {
  years: string
  outcome: string
}

export const COMP_POOL_HITTERS: CompPoolHitter[] = [
  { playerId: 'c-h1', name: 'Austin Riley Comp A', level: 'AA', team: 'League Avg', position: '3B', age: 21, bats: 'R', g: 118, pa: 502, ab: 452, avg: 0.269, obp: 0.335, slg: 0.486, ops: 0.821, wrcPlus: 128, bbPct: 8.1, kPct: 24.5, hr: 22, sb: 3, mlbGamesCareer: 0, years: '2017-2018', outcome: 'Became an MLB everyday 3B / All-Star' },
  { playerId: 'c-h2', name: 'Ozzie Albies Comp', level: 'A', team: 'League Avg', position: '2B', age: 19, bats: 'S', g: 121, pa: 520, ab: 468, avg: 0.312, obp: 0.368, slg: 0.464, ops: 0.832, wrcPlus: 141, bbPct: 7.4, kPct: 11.2, hr: 9, sb: 33, mlbGamesCareer: 0, years: '2016', outcome: 'Became an MLB everyday 2B / All-Star' },
  { playerId: 'c-h3', name: 'Org Depth OF Comp', level: 'AA', team: 'League Avg', position: 'CF', age: 24, bats: 'R', g: 109, pa: 460, ab: 415, avg: 0.241, obp: 0.301, slg: 0.372, ops: 0.673, wrcPlus: 88, bbPct: 6.9, kPct: 26.8, hr: 8, sb: 11, mlbGamesCareer: 41, years: '2015-2019', outcome: 'Topped out as AAA depth, brief MLB cup of coffee' },
  { playerId: 'c-h4', name: 'Catching Prospect Comp', level: 'High-A', team: 'League Avg', position: 'C', age: 20, bats: 'L', g: 88, pa: 356, ab: 312, avg: 0.258, obp: 0.347, slg: 0.401, ops: 0.748, wrcPlus: 115, bbPct: 10.8, kPct: 19.4, hr: 9, sb: 1, mlbGamesCareer: 0, years: '2018-2019', outcome: 'Became a fringe MLB backup catcher' },
  { playerId: 'c-h5', name: 'Speedy SS Comp', level: 'A', team: 'League Avg', position: 'SS', age: 18, bats: 'R', g: 95, pa: 402, ab: 354, avg: 0.271, obp: 0.351, slg: 0.368, ops: 0.719, wrcPlus: 112, bbPct: 9.7, kPct: 18.9, hr: 3, sb: 41, mlbGamesCareer: 0, years: '2014-2015', outcome: 'Became a bench utility infielder' },
  { playerId: 'c-h6', name: 'Power Corner Comp', level: 'AAA', team: 'League Avg', position: '1B', age: 23, bats: 'R', g: 112, pa: 470, ab: 421, avg: 0.249, obp: 0.322, slg: 0.478, ops: 0.8, wrcPlus: 119, bbPct: 8.9, kPct: 27.1, hr: 24, sb: 1, mlbGamesCareer: 55, years: '2013-2016', outcome: 'Quad-A power bat, short MLB stints' },
]

export const COMP_POOL_PITCHERS: CompPoolPitcher[] = [
  { playerId: 'c-p1', name: 'Spencer Strider Comp', level: 'AA', team: 'League Avg', position: 'SP', age: 22, throws: 'R', g: 15, gs: 15, ip: 80.0, era: 2.7, fip: 2.55, siera: 2.6, whip: 0.98, kPct: 36.1, bbPct: 8.2, kbbPct: 27.9, mlbGamesCareer: 0, years: '2021', outcome: 'Became an MLB frontline SP / All-Star' },
  { playerId: 'c-p2', name: 'Bullpen Riser Comp', level: 'High-A', team: 'League Avg', position: 'RP', age: 21, throws: 'L', g: 30, gs: 0, ip: 42.0, era: 2.35, fip: 2.7, siera: 2.75, whip: 1.01, kPct: 32.4, bbPct: 9.1, kbbPct: 23.3, mlbGamesCareer: 0, years: '2019-2020', outcome: 'Became a reliable MLB middle reliever' },
  { playerId: 'c-p3', name: 'Command Lefty Comp', level: 'AA', team: 'League Avg', position: 'SP', age: 23, throws: 'L', g: 18, gs: 18, ip: 98.0, era: 3.6, fip: 3.75, siera: 3.7, whip: 1.15, kPct: 22.8, bbPct: 5.4, kbbPct: 17.4, mlbGamesCareer: 12, years: '2016-2018', outcome: 'Became a back-end MLB starter / swingman' },
  { playerId: 'c-p4', name: 'Org Arm Comp', level: 'A', team: 'League Avg', position: 'SP', age: 20, throws: 'R', g: 16, gs: 16, ip: 70.1, era: 4.5, fip: 4.4, siera: 4.35, whip: 1.32, kPct: 19.5, bbPct: 10.2, kbbPct: 9.3, mlbGamesCareer: 0, years: '2017-2018', outcome: 'Topped out at AA, never reached MLB' },
  { playerId: 'c-p5', name: 'Fireballer Comp', level: 'DSL', team: 'League Avg', position: 'SP', age: 17, throws: 'R', g: 10, gs: 8, ip: 36.0, era: 2.9, fip: 3.0, siera: 3.05, whip: 1.08, kPct: 29.7, bbPct: 9.8, kbbPct: 19.9, mlbGamesCareer: 0, years: '2015', outcome: 'Became a hard-throwing MLB reliever' },
  { playerId: 'c-p6', name: 'Sinkerballer Comp', level: 'AAA', team: 'League Avg', position: 'SP', age: 24, throws: 'R', g: 20, gs: 20, ip: 112.0, era: 4.1, fip: 4.05, siera: 4.0, whip: 1.28, kPct: 18.9, bbPct: 6.7, kbbPct: 12.2, mlbGamesCareer: 30, years: '2014-2017', outcome: 'Became a spot-starter / long reliever' },
]

// Rough level-average ages used to compute an "age relative to level" score —
// the heaviest-weighted input per the brief. Replace with real league-wide
// averages computed from the full comp pool once it's built.
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

export function getHitterComps(player: HitterSeasonStats, topN = 5): ProspectComp[] {
  const playerAgeDelta = ageToLevelDelta(player.age, player.level)
  const pool = COMP_POOL_HITTERS

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

export function getPitcherComps(player: PitcherSeasonStats, topN = 5): ProspectComp[] {
  const playerAgeDelta = ageToLevelDelta(player.age, player.level)
  const pool = COMP_POOL_PITCHERS

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

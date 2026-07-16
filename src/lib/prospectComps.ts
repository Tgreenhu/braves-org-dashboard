import type { HitterSeasonStats, PitcherSeasonStats, OrgLevel } from '@/types'
import type { CompPoolHitterRow, CompPoolPitcherRow } from '@/lib/queries'

// Rough level-average ages used to compute an "age relative to level" score
// — weighted heavily in the similarity math below per the brief, but
// deliberately NOT one of the 5 displayed radar metrics; it works in the
// background only.
export const LEVEL_AVG_AGE: Record<OrgLevel, number> = {
  MLB: 27.5,
  AAA: 25.5,
  AA: 23.5,
  'A+': 21.5,
  A: 20.5,
  FCL: 19,
  DSL: 18,
}

const AGE_WEIGHT = 2.5 // deliberately bigger than any single metric weight below

interface MetricDef {
  key: string
  label: string
  weight: number
  invert?: boolean // true when a lower raw value is better (ERA, FIP, WHIP, K%-for-pitchers-against...)
}

// Every candidate we *could* use, in priority order. Which 5 actually get
// used is decided per-request by selectMetrics() below, based on how much
// of the uploaded comp pool actually has that stat populated — so if you've
// only uploaded "Standard" comp files (no wRC+/BB%/K%), those candidates
// naturally lose out to ones with real coverage instead of showing blanks.
const HITTER_METRIC_CANDIDATES: MetricDef[] = [
  { key: 'wrcPlus', label: 'wRC+', weight: 1.4 },
  { key: 'ops', label: 'OPS', weight: 1.1 },
  { key: 'bbPct', label: 'BB%', weight: 0.95 },
  { key: 'kPct', label: 'K%', weight: 0.9, invert: true },
  { key: 'obp', label: 'OBP', weight: 0.85 },
  { key: 'slg', label: 'SLG', weight: 0.8 },
  { key: 'avg', label: 'AVG', weight: 0.6 },
]

const PITCHER_METRIC_CANDIDATES: MetricDef[] = [
  { key: 'fip', label: 'FIP', weight: 1.3, invert: true },
  { key: 'siera', label: 'SIERA', weight: 1.2, invert: true },
  { key: 'kbbPct', label: 'K-BB%', weight: 1.0 },
  { key: 'whip', label: 'WHIP', weight: 0.9, invert: true },
  { key: 'kPct', label: 'K%', weight: 0.85 },
  { key: 'era', label: 'ERA', weight: 0.75, invert: true },
  { key: 'bbPct', label: 'BB%', weight: 0.65, invert: true },
]

/** Picks the 5 candidates with the best combination of real data coverage in the pool and baseline importance. */
function selectMetrics(pool: Record<string, any>[], candidates: MetricDef[], n = 5): MetricDef[] {
  if (pool.length === 0) return candidates.slice(0, n)
  return candidates
    .map((metric) => {
      const covered = pool.filter((p) => p[metric.key] != null).length
      const coverage = covered / pool.length
      return { metric, rankScore: coverage * metric.weight }
    })
    .sort((a, b) => b.rankScore - a.rankScore)
    .slice(0, n)
    .map((s) => s.metric)
}

function ageToLevelDelta(age: number, level: OrgLevel) {
  return age - (LEVEL_AVG_AGE[level] ?? 22)
}

function normalize(value: number, min: number, max: number) {
  if (max === min) return 50
  return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100))
}

/** [min, max] across the pool for one field, including the player's own value so an outlier prospect doesn't clip at 0/100. */
function poolRange(pool: Record<string, any>[], key: string, extra: number[]): [number, number] {
  const vals = [...pool.map((p) => p[key]), ...extra].filter((v): v is number => v != null && !Number.isNaN(v))
  if (vals.length === 0) return [0, 1]
  return [Math.min(...vals), Math.max(...vals)]
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

function computeComps<TPlayer extends Record<string, any>, TComp extends Record<string, any>>(
  player: TPlayer,
  pool: TComp[],
  candidates: MetricDef[],
  topN: number,
  buildBlurb: (comp: TComp, player: TPlayer) => string,
): ProspectComp[] {
  const metrics = selectMetrics(pool, candidates)

  const playerAgeDelta = ageToLevelDelta(player.age, player.level)
  const ageExtra = pool.map((c) => ageToLevelDelta(c.age, c.level))
  const [ageMin, ageMax] = (() => {
    const vals = [playerAgeDelta, ...ageExtra]
    return [Math.min(...vals), Math.max(...vals)]
  })()
  const normPlayerAge = normalize(playerAgeDelta, ageMin, ageMax)

  // Precompute each metric's pool-wide range once (not per-comparison) so
  // every player is normalized against the same scale.
  const ranges = new Map<string, [number, number]>()
  for (const m of metrics) {
    ranges.set(m.key, poolRange(pool, m.key, [player[m.key]]))
  }

  const totalWeight = AGE_WEIGHT + metrics.reduce((sum, m) => sum + m.weight, 0)

  const scored = pool.map((comp) => {
    const compAgeDelta = ageToLevelDelta(comp.age, comp.level)
    const normCompAge = normalize(compAgeDelta, ageMin, ageMax)
    let weightedDist = AGE_WEIGHT * Math.abs(normPlayerAge - normCompAge)

    const radar: RadarMetric[] = metrics.map((m) => {
      const [min, max] = ranges.get(m.key)!
      const playerRaw = player[m.key]
      const compRaw = comp[m.key]
      const normPlayer = playerRaw == null ? 50 : m.invert ? normalize(-playerRaw, -max, -min) : normalize(playerRaw, min, max)
      const normComp = compRaw == null ? 50 : m.invert ? normalize(-compRaw, -max, -min) : normalize(compRaw, min, max)
      weightedDist += m.weight * Math.abs(normPlayer - normComp)
      return { metric: m.label, player: normPlayer, comp: normComp }
    })

    const similarityScore = Math.max(0, Math.min(100, 100 - weightedDist / totalWeight))

    return {
      compName: comp.name,
      years: comp.years,
      outcome: comp.outcome || 'Outcome not recorded yet.',
      similarityScore,
      radar,
      blurb: buildBlurb(comp, player),
    }
  })

  return scored.sort((a, b) => b.similarityScore - a.similarityScore).slice(0, topN)
}

export function getHitterComps(player: HitterSeasonStats, pool: CompPoolHitterRow[], topN = 5): ProspectComp[] {
  return computeComps(player, pool, HITTER_METRIC_CANDIDATES, topN, (comp, p) => {
    const avg = comp.avg != null ? comp.avg.toFixed(3) : '—'
    const obp = comp.obp != null ? comp.obp.toFixed(3) : '—'
    const slg = comp.slg != null ? comp.slg.toFixed(3) : '—'
    const wrc = comp.wrcPlus != null ? `${comp.wrcPlus} wRC+` : ''
    return `${comp.name} (${comp.years}) reached ${comp.level} at age ${comp.age} hitting ${avg}/${obp}/${slg}${wrc ? ` with a ${wrc}` : ''}. ${comp.outcome || 'Career outcome not recorded yet.'} ${p.name} profiles similarly on age-for-level and the metrics that best distinguish this comp pool. [Placeholder blurb — wire a Claude API call in a Supabase Edge Function to generate this dynamically.]`
  })
}

export function getPitcherComps(player: PitcherSeasonStats, pool: CompPoolPitcherRow[], topN = 5): ProspectComp[] {
  return computeComps(player, pool, PITCHER_METRIC_CANDIDATES, topN, (comp, p) => {
    const era = comp.era != null ? comp.era.toFixed(2) : '—'
    const fip = comp.fip != null ? comp.fip.toFixed(2) : '—'
    const kbb = comp.kbbPct != null ? `${comp.kbbPct.toFixed(1)}% K-BB` : ''
    return `${comp.name} (${comp.years}) pitched at ${comp.level} at age ${comp.age} with a ${era} ERA / ${fip} FIP${kbb ? ` and ${kbb}` : ''}. ${comp.outcome || 'Career outcome not recorded yet.'} ${p.name} profiles similarly on age-for-level and the metrics that best distinguish this comp pool. [Placeholder blurb — wire a Claude API call in a Supabase Edge Function to generate this dynamically.]`
  })
}

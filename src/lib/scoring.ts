import type { HitterSeasonStats, PitcherSeasonStats } from '@/types'
import { LEVEL_FACTOR, LEVEL_AVG_AGE } from '@/lib/levelBaselines'

/**
 * How much level and age-for-level shift the composite score, on top of
 * the pure stat-based z-score below. These are intentionally modest — the
 * stat score typically spans about -2 to +2, and level+age should nudge
 * that, not swamp it. (An earlier version used much bigger numbers and it
 * let a mediocre-but-young MLB player outscore genuinely good performers
 * purely on youth — these values were recalibrated after seeing that.)
 */
export const LEVEL_WEIGHT = 0.38 // multiplies LEVEL_FACTOR (0-1) — full MLB-to-DSL gap ≈ 0.29
export const AGE_WEIGHT = 0.045 // multiplied by years young/old for level, capped below — hitters only, see PITCHER_AGE_WEIGHT below
const MAX_AGE_BONUS = 0.3 // no single relative-age gap (however extreme) can swing more than this

/**
 * Pitchers get a much lighter age treatment than hitters, and NONE at all
 * once they're at MLB specifically — a 37-year-old and a 24-year-old at
 * the big-league level just both need to get hitters out; age isn't a
 * meaningful signal there the way it is for, say, a teenager dominating
 * A-ball. Still applies (lightly) below MLB, where age-for-level remains
 * a real precocity signal for pitching prospects too.
 */
const PITCHER_AGE_WEIGHT = 0.015 // about a third of the hitter weight
const PITCHER_MAX_AGE_BONUS = 0.1

/**
 * Separate from the relative "young/old for level" bonus above — this
 * rewards being notably young in ABSOLUTE terms (not just relative to
 * level peers), so a real standout in the low minors (think a 16-year-old
 * in the DSL) can still outrank an older, higher-level player with
 * similar-but-slightly-better numbers. Zero for anyone 20 or older, so it
 * never touches typical MLB/AAA/AA comparisons.
 *
 * Scales with the SQUARE of years under the threshold (not linearly) on
 * purpose: a 17-year-old should barely register (9 * weight), while a
 * 16-year-old registers noticeably more (16 * weight) — a linear version
 * gave nearly as much credit to "slightly young" as to "startlingly
 * young," which wasn't the intent.
 */
const ABSOLUTE_YOUTH_THRESHOLD = 20
const ABSOLUTE_YOUTH_WEIGHT = 0.012 // per (year under threshold)² — hitters
const MAX_ABSOLUTE_YOUTH_BONUS = 0.4
const PITCHER_ABSOLUTE_YOUTH_WEIGHT = 0.006 // half the hitter weight, same "barely register unless truly extreme" shape
const PITCHER_MAX_ABSOLUTE_YOUTH_BONUS = 0.2

/** Starter bump — total gap between an SP and an RP with identical stats/level/age. Increased from an earlier, more timid version — starters matter more, deliberately more than a token nudge now. */
const ROLE_GAP = 0.35
function roleBonus(position: string | null | undefined): number {
  const primary = (position ?? '').split(/[\/,]/)[0].trim().toUpperCase()
  if (primary === 'SP') return ROLE_GAP / 2
  if (primary === 'RP') return -ROLE_GAP / 2
  return 0
}

/**
 * Composite Hitter Score (0-100ish scale, uncapped) used to rank position
 * players for the All-Organization Teams (Tab 3).
 *
 * Weighting rationale:
 *  - wRC+ is the single best all-in-one offensive value stat (park/league
 *    adjusted), so it gets the largest weight.
 *  - OPS captures the same signal in a more familiar unit, weighted
 *    moderately so it doesn't just double-count wRC+.
 *  - AVG/OBP/SLG are included directly per the brief at small weights so
 *    they still nudge the ranking (OBP a bit above AVG/SLG — gets on base
 *    matters most for run creation).
 *  - BB%:K% ratio rewards plate discipline independent of results, which is
 *    a good "sticks in the big leagues" signal for prospects.
 * All inputs are converted to z-scores against real peers at the SAME
 * level (see zScoresByLevel below) before weighting, so unlike-scaled
 * stats (e.g. AVG ~.260 vs wRC+ ~100) combine sensibly and MLB players
 * aren't measured against complex-league statistical noise.
 */
export const HITTER_WEIGHTS = {
  wrcPlus: 0.5, // the one all-in-one, context-adjusted offensive value stat — should clearly lead
  ops: 0.15,
  obp: 0.08, // already substantially reflected in wRC+ and OPS — kept small on purpose to avoid double-counting
  avg: 0.05,
  slg: 0.07,
  bbKRatio: 0.07, // same reasoning as OBP — real signal, but shouldn't be able to outvote wRC+
}

/**
 * Composite Pitcher Score used to rank pitchers for the All-Organization
 * Teams (Tab 3). Lower ERA/FIP/SIERA/WHIP is better, so those are
 * z-scored and then inverted (negated) before weighting.
 *
 *  - SIERA is weighted highest — the most predictive/comprehensive ERA
 *    estimator (accounts for batted-ball profile and pitch mix), the
 *    pitching equivalent of wRC+'s role for hitters.
 *  - FIP still meaningful (defense-independent) but reduced — overlaps
 *    heavily with SIERA.
 *  - ERA included per the brief, but at a lower weight since it's noisier
 *    over minor-league sample sizes.
 *  - WHIP captures baserunner prevention directly.
 *  - K%:BB% ratio rewards the swing-and-miss + command combo that
 *    translates best up the ladder.
 */
export const PITCHER_WEIGHTS = {
  siera: 0.45,
  fip: 0.2,
  era: 0.1,
  whip: 0.1,
  kbbRatio: 0.15,
}

function mean(nums: number[]) {
  return nums.reduce((a, b) => a + b, 0) / (nums.length || 1)
}
function stdDev(nums: number[]) {
  const m = mean(nums)
  const variance = mean(nums.map((n) => (n - m) ** 2))
  return Math.sqrt(variance) || 1
}
/**
 * z-scores a list that may contain null/undefined (a player missing this
 * particular stat because only a partial Fangraphs report was uploaded for
 * them). Nulls are imputed with the pool mean — a neutral z-score of 0 —
 * rather than propagating NaN through every player's composite score.
 */
function zScores(nums: (number | null | undefined)[]) {
  const known = nums.filter((n): n is number => n != null && !Number.isNaN(n))
  const m = mean(known)
  const sd = stdDev(known)
  return nums.map((n) => (n == null || Number.isNaN(n) ? 0 : (n - m) / sd))
}

export interface LevelAgeBreakdown {
  levelBonus: number
  relativeAgeBonus: number
  absoluteYouthBonus: number
}

/** Level prestige + age-for-level bonus + absolute-youth bonus, for hitters. */
function hitterLevelAgeBonus(level: HitterSeasonStats['level'], age: number): LevelAgeBreakdown {
  const levelBonus = LEVEL_WEIGHT * (LEVEL_FACTOR[level] ?? 0.5)

  const ageDelta = age - (LEVEL_AVG_AGE[level] ?? 22) // positive = older than typical for level
  const relativeAgeBonus = Math.max(-MAX_AGE_BONUS, Math.min(MAX_AGE_BONUS, -AGE_WEIGHT * ageDelta))

  const yearsUnderThreshold = Math.max(0, ABSOLUTE_YOUTH_THRESHOLD - age)
  const absoluteYouthBonus = Math.min(MAX_ABSOLUTE_YOUTH_BONUS, yearsUnderThreshold ** 2 * ABSOLUTE_YOUTH_WEIGHT)

  return { levelBonus, relativeAgeBonus, absoluteYouthBonus }
}

/** Same idea, but pitchers get a much lighter age treatment — and none at all once they're at MLB specifically. */
function pitcherLevelAgeBonus(level: PitcherSeasonStats['level'], age: number): LevelAgeBreakdown {
  const levelBonus = LEVEL_WEIGHT * (LEVEL_FACTOR[level] ?? 0.5)

  let relativeAgeBonus = 0
  let absoluteYouthBonus = 0
  if (level !== 'MLB') {
    const ageDelta = age - (LEVEL_AVG_AGE[level] ?? 22)
    relativeAgeBonus = Math.max(-PITCHER_MAX_AGE_BONUS, Math.min(PITCHER_MAX_AGE_BONUS, -PITCHER_AGE_WEIGHT * ageDelta))

    const yearsUnderThreshold = Math.max(0, ABSOLUTE_YOUTH_THRESHOLD - age)
    absoluteYouthBonus = Math.min(PITCHER_MAX_ABSOLUTE_YOUTH_BONUS, yearsUnderThreshold ** 2 * PITCHER_ABSOLUTE_YOUTH_WEIGHT)
  }

  return { levelBonus, relativeAgeBonus, absoluteYouthBonus }
}

/**
 * Same as zScores(), but computes the mean/stddev separately WITHIN each
 * level instead of across the whole org at once. This matters a lot: an
 * MLB player's stats were previously being z-scored against a pool that
 * also includes complex-league and rookie-ball performances, where results
 * are far more volatile — a genuinely elite MLB SIERA could end up looking
 * mediocre purely from being compared to the wrong peer group. Comparing
 * players only to real peers at their own level, then letting the
 * separate Level bonus account for MLB being harder than A-ball, is the
 * correct way to combine "how good relative to peers" with "how hard is
 * this level" without conflating the two.
 */
function zScoresByLevel<T extends { level: string }>(players: T[], valueFn: (p: T) => number | null | undefined) {
  const indicesByLevel = new Map<string, number[]>()
  players.forEach((p, i) => {
    if (!indicesByLevel.has(p.level)) indicesByLevel.set(p.level, [])
    indicesByLevel.get(p.level)!.push(i)
  })

  const result = new Array(players.length).fill(0)
  for (const indices of indicesByLevel.values()) {
    const values = indices.map((i) => valueFn(players[i]))
    const levelZ = zScores(values)
    indices.forEach((originalIndex, j) => {
      result[originalIndex] = levelZ[j]
    })
  }
  return result
}

export interface ScoredPlayer<T> {
  player: T
  score: number
  /** Every weighted component that fed the total, for the on-screen "why this score" breakdown. */
  breakdown: Record<string, number>
}

export function scoreHitters(hitters: HitterSeasonStats[]): ScoredPlayer<HitterSeasonStats>[] {
  const bbKRatioOf = (h: HitterSeasonStats) => (h.bbPct != null && h.kPct != null ? h.bbPct / Math.max(h.kPct, 1) : null)
  const z = {
    wrcPlus: zScoresByLevel(hitters, (h) => h.wrcPlus),
    ops: zScoresByLevel(hitters, (h) => h.ops),
    obp: zScoresByLevel(hitters, (h) => h.obp),
    avg: zScoresByLevel(hitters, (h) => h.avg),
    slg: zScoresByLevel(hitters, (h) => h.slg),
    bbKRatio: zScoresByLevel(hitters, bbKRatioOf),
  }
  return hitters
    .map((player, i) => {
      const wrcPlusW = z.wrcPlus[i] * HITTER_WEIGHTS.wrcPlus
      const opsW = z.ops[i] * HITTER_WEIGHTS.ops
      const obpW = z.obp[i] * HITTER_WEIGHTS.obp
      const avgW = z.avg[i] * HITTER_WEIGHTS.avg
      const slgW = z.slg[i] * HITTER_WEIGHTS.slg
      const bbKW = z.bbKRatio[i] * HITTER_WEIGHTS.bbKRatio
      const { levelBonus, relativeAgeBonus, absoluteYouthBonus } = hitterLevelAgeBonus(player.level, player.age)
      return {
        player,
        score: wrcPlusW + opsW + obpW + avgW + slgW + bbKW + levelBonus + relativeAgeBonus + absoluteYouthBonus,
        breakdown: {
          'wRC+': wrcPlusW,
          OPS: opsW,
          OBP: obpW,
          AVG: avgW,
          SLG: slgW,
          'BB:K': bbKW,
          Level: levelBonus,
          'Age (rel)': relativeAgeBonus,
          'Age (abs youth)': absoluteYouthBonus,
        },
      }
    })
    .sort((a, b) => b.score - a.score)
}

export function scorePitchers(pitchers: PitcherSeasonStats[]): ScoredPlayer<PitcherSeasonStats>[] {
  const negate = (n: number | null | undefined) => (n == null ? null : -n)
  const z = {
    fip: zScoresByLevel(pitchers, (p) => negate(p.fip)),
    siera: zScoresByLevel(pitchers, (p) => negate(p.siera)),
    era: zScoresByLevel(pitchers, (p) => negate(p.era)),
    whip: zScoresByLevel(pitchers, (p) => negate(p.whip)),
    kbbRatio: zScoresByLevel(pitchers, (p) => p.kbbPct),
  }
  return pitchers
    .map((player, i) => {
      const fipW = z.fip[i] * PITCHER_WEIGHTS.fip
      const sieraW = z.siera[i] * PITCHER_WEIGHTS.siera
      const eraW = z.era[i] * PITCHER_WEIGHTS.era
      const whipW = z.whip[i] * PITCHER_WEIGHTS.whip
      const kbbW = z.kbbRatio[i] * PITCHER_WEIGHTS.kbbRatio
      const { levelBonus, relativeAgeBonus, absoluteYouthBonus } = pitcherLevelAgeBonus(player.level, player.age)
      const roleW = roleBonus(player.position)
      return {
        player,
        score: fipW + sieraW + eraW + whipW + kbbW + levelBonus + relativeAgeBonus + absoluteYouthBonus + roleW,
        breakdown: {
          FIP: fipW,
          SIERA: sieraW,
          ERA: eraW,
          WHIP: whipW,
          'K:BB': kbbW,
          Level: levelBonus,
          'Age (rel)': relativeAgeBonus,
          'Age (abs youth)': absoluteYouthBonus,
          'Role (SP/RP)': roleW,
        },
      }
    })
    .sort((a, b) => b.score - a.score)
}

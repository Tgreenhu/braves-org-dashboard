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
export const LEVEL_WEIGHT = 0.3 // multiplies LEVEL_FACTOR (0-1) — full MLB-to-DSL gap ≈ 0.23
export const AGE_WEIGHT = 0.03 // multiplied by years young/old for level, capped below
const MAX_AGE_BONUS = 0.3 // no single age gap (however extreme) can swing more than this

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
 * All inputs are converted to z-scores against the full player pool before
 * weighting so unlike-scaled stats (e.g. AVG ~.260 vs wRC+ ~100) combine
 * sensibly.
 */
export const HITTER_WEIGHTS = {
  wrcPlus: 0.34,
  ops: 0.22,
  obp: 0.14,
  avg: 0.08,
  slg: 0.1,
  bbKRatio: 0.12,
}

/**
 * Composite Pitcher Score used to rank pitchers for the All-Organization
 * Teams (Tab 3). Lower ERA/FIP/SIERA/WHIP is better, so those are
 * z-scored and then inverted (negated) before weighting.
 *
 *  - FIP and SIERA are weighted highest since they're more predictive /
 *    defense-independent than ERA.
 *  - ERA included per the brief, but at a lower weight since it's noisier
 *    over minor-league sample sizes.
 *  - WHIP captures baserunner prevention directly.
 *  - K%:BB% ratio rewards the swing-and-miss + command combo that
 *    translates best up the ladder.
 */
export const PITCHER_WEIGHTS = {
  fip: 0.28,
  siera: 0.26,
  era: 0.16,
  whip: 0.14,
  kbbRatio: 0.16,
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

/** Level prestige + age-for-level bonus, shared by both scoreHitters and scorePitchers. */
function levelAgeBonus(level: HitterSeasonStats['level'], age: number): number {
  const levelBonus = LEVEL_WEIGHT * (LEVEL_FACTOR[level] ?? 0.5)
  const ageDelta = age - (LEVEL_AVG_AGE[level] ?? 22) // positive = older than typical for level
  const ageBonus = Math.max(-MAX_AGE_BONUS, Math.min(MAX_AGE_BONUS, -AGE_WEIGHT * ageDelta)) // younger-for-level => positive bonus, capped
  return levelBonus + ageBonus
}

export interface ScoredPlayer<T> {
  player: T
  score: number
}

export function scoreHitters(hitters: HitterSeasonStats[]): ScoredPlayer<HitterSeasonStats>[] {
  const bbk = hitters.map((h) => (h.bbPct != null && h.kPct != null ? h.bbPct / Math.max(h.kPct, 1) : null))
  const z = {
    wrcPlus: zScores(hitters.map((h) => h.wrcPlus)),
    ops: zScores(hitters.map((h) => h.ops)),
    obp: zScores(hitters.map((h) => h.obp)),
    avg: zScores(hitters.map((h) => h.avg)),
    slg: zScores(hitters.map((h) => h.slg)),
    bbKRatio: zScores(bbk),
  }
  return hitters
    .map((player, i) => ({
      player,
      score:
        z.wrcPlus[i] * HITTER_WEIGHTS.wrcPlus +
        z.ops[i] * HITTER_WEIGHTS.ops +
        z.obp[i] * HITTER_WEIGHTS.obp +
        z.avg[i] * HITTER_WEIGHTS.avg +
        z.slg[i] * HITTER_WEIGHTS.slg +
        z.bbKRatio[i] * HITTER_WEIGHTS.bbKRatio +
        levelAgeBonus(player.level, player.age),
    }))
    .sort((a, b) => b.score - a.score)
}

export function scorePitchers(pitchers: PitcherSeasonStats[]): ScoredPlayer<PitcherSeasonStats>[] {
  const kbb = pitchers.map((p) => p.kbbPct)
  const negate = (n: number | null | undefined) => (n == null ? null : -n)
  const z = {
    fip: zScores(pitchers.map((p) => negate(p.fip))),
    siera: zScores(pitchers.map((p) => negate(p.siera))),
    era: zScores(pitchers.map((p) => negate(p.era))),
    whip: zScores(pitchers.map((p) => negate(p.whip))),
    kbbRatio: zScores(kbb),
  }
  return pitchers
    .map((player, i) => ({
      player,
      score:
        z.fip[i] * PITCHER_WEIGHTS.fip +
        z.siera[i] * PITCHER_WEIGHTS.siera +
        z.era[i] * PITCHER_WEIGHTS.era +
        z.whip[i] * PITCHER_WEIGHTS.whip +
        z.kbbRatio[i] * PITCHER_WEIGHTS.kbbRatio +
        levelAgeBonus(player.level, player.age),
    }))
    .sort((a, b) => b.score - a.score)
}

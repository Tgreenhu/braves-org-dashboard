import type { HitterSeasonStats, PitcherSeasonStats } from '@/types'

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
function zScores(nums: number[]) {
  const m = mean(nums)
  const sd = stdDev(nums)
  return nums.map((n) => (n - m) / sd)
}

export interface ScoredPlayer<T> {
  player: T
  score: number
}

export function scoreHitters(hitters: HitterSeasonStats[]): ScoredPlayer<HitterSeasonStats>[] {
  const bbk = hitters.map((h) => h.bbPct / Math.max(h.kPct, 1))
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
        z.bbKRatio[i] * HITTER_WEIGHTS.bbKRatio,
    }))
    .sort((a, b) => b.score - a.score)
}

export function scorePitchers(pitchers: PitcherSeasonStats[]): ScoredPlayer<PitcherSeasonStats>[] {
  const kbb = pitchers.map((p) => p.kbbPct)
  const z = {
    fip: zScores(pitchers.map((p) => -p.fip)),
    siera: zScores(pitchers.map((p) => -p.siera)),
    era: zScores(pitchers.map((p) => -p.era)),
    whip: zScores(pitchers.map((p) => -p.whip)),
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
        z.kbbRatio[i] * PITCHER_WEIGHTS.kbbRatio,
    }))
    .sort((a, b) => b.score - a.score)
}

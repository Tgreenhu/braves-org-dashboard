import type { OrgLevel } from '@/types'

/**
 * Roughly how much harder each level is to perform well at, on a 0-1
 * scale — used by All-Org Team scoring to give real-MLB production a
 * boost over the same numbers put up in the low minors. These are
 * reasonable defaults, not a precise science — adjust freely if a
 * particular matchup in the All-Org Teams feels wrong.
 */
export const LEVEL_FACTOR: Record<OrgLevel, number> = {
  MLB: 1.0,
  AAA: 0.85,
  AA: 0.7,
  'A+': 0.55,
  A: 0.45,
  FCL: 0.3,
  DSL: 0.25,
}

/**
 * Rough league-average age at each level — used to compute "young/old for
 * level," which rewards precocious performances (a 19-year-old in A+) over
 * merely-adequate ones from older organizational depth (a 30-year-old in
 * AAA), even when the raw stat lines look similar.
 */
export const LEVEL_AVG_AGE: Record<OrgLevel, number> = {
  MLB: 27.5,
  AAA: 25.5,
  AA: 23.5,
  'A+': 21.5,
  A: 20.5,
  FCL: 19,
  DSL: 18,
}

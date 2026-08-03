import { useRef, useState } from 'react'
import Papa from 'papaparse'
import {
  ExternalLink,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Users,
} from 'lucide-react'
import { supabase, supabaseConfigured } from '@/lib/supabaseClient'
import { cacheClear } from '@/lib/cache'
import { tagTotalRows, tagTotalRowsBySeason } from '@/lib/detectTotals'
import { detectPlayerType, findColumnKey, extractYearFromFilename } from '@/lib/csvUpload'
import {
  mapRow,
  HITTER_COLUMNS,
  PITCHER_COLUMNS,
  COMP_HITTER_COLUMNS,
  COMP_PITCHER_COLUMNS,
  PROSPECTSAVANT_HITTER_COLUMNS,
  PROSPECTSAVANT_PITCHER_COLUMNS,
  TJSTATS_HITTER_COLUMNS,
  TJSTATS_PITCHER_COLUMNS,
} from '@/lib/columnMapping'
import { slugify } from '@/lib/downloadImage'
import { upsertHitterStatsWithPriority, upsertPitcherStatsWithPriority } from '@/lib/queries'
import type { StatSource } from '@/lib/priorityMerge'

interface QuickLink {
  label: string
  url: string
}

interface UploadSource {
  id: string
  label: string
  quickLinks: QuickLink[]
  supabaseTable: 'hitter_stats' | 'pitcher_stats'
  /** Which of the three priority sources this upload counts as — drives the priority-merge logic in lib/priorityMerge.ts. */
  statSource: StatSource
  detectTotals?: boolean
  totalsStatKeys?: string[]
  /** Fangraphs' single-team MLB leaderboards (and some single-level exports) don't include a Level column at all — fill it in ourselves. */
  defaultLevel?: string
  /** Shown under the label — used for things like "RK players: split into DSL/FCL by name before uploading." */
  note?: string
}

interface UploadGroup {
  id: string
  title: string
  description: string
  sources: UploadSource[]
}

const HITTER_TOTALS_STAT_KEYS = ['PA', 'pa']
const PITCHER_TOTALS_STAT_KEYS = ['IP', 'ip']
const SEASON_COLUMN_CANDIDATES = ['Season', 'season', 'Year', 'year']

const RK_NOTE =
  'ProspectSavant lists DSL and FCL together as "RK" — filter/export this level, then split the rows into the DSL and FCL uploads below by player name before uploading each.'

// ---------------------------------------------------------------------
// ProspectSavant quick links — no filterable URL, so every level points
// at the same /leaders page. Filter to the level (and team, where
// possible) on the site itself before exporting.
// ---------------------------------------------------------------------
const PS_LEADERS_URL = 'https://prospectsavant.com/leaders'

function psSource(id: string, label: string, table: 'hitter_stats' | 'pitcher_stats', level: string, note?: string): UploadSource {
  return {
    id,
    label: `ProspectSavant — ${label}`,
    quickLinks: [{ label: 'Open ProspectSavant Leaders', url: PS_LEADERS_URL }],
    supabaseTable: table,
    statSource: 'ProspectSavant',
    defaultLevel: level,
    note,
  }
}

// ---------------------------------------------------------------------
// TJStats quick links — one URL per "tab" (a different report view on
// their site), grouped by level. Upload each tab's export into the same
// dropzone one at a time; they all merge into the same rows.
// ---------------------------------------------------------------------
function tjSource(
  id: string,
  label: string,
  table: 'hitter_stats' | 'pitcher_stats',
  level: string,
  tabUrls: string[],
): UploadSource {
  return {
    id,
    label: `TJStats — ${label}`,
    quickLinks: tabUrls.map((url, i) => ({ label: i === 0 ? 'Open Tab 0' : `Open Tab ${i}`, url })),
    supabaseTable: table,
    statSource: 'TJStats',
    defaultLevel: level,
  }
}

const UPLOAD_GROUPS: UploadGroup[] = [
  {
    id: 'milb-hitters',
    title: 'MiLB Hitters',
    description: 'Braves system minor league hitting — FanGraphs (players who split levels get one row per level plus a combined total row, detected automatically), ProspectSavant, and TJStats.',
    sources: [
      { id: 'milb-hit-standard', label: 'FanGraphs — Standard', statSource: 'FanGraphs', supabaseTable: 'hitter_stats', detectTotals: true, totalsStatKeys: HITTER_TOTALS_STAT_KEYS, quickLinks: [{ label: 'Open FanGraphs', url: 'https://www.fangraphs.com/leaders/minor-league?pos=all&stats=bat&lg=2%2C4%2C5%2C6%2C7%2C8%2C9%2C10%2C11%2C14%2C12%2C13%2C15%2C16%2C17%2C18%2C30%2C32&qual=0&type=0&season=2026&level=0&team=&seasonEnd=2026&org=16&ind=0&splitTeam=false&startdate=&enddate=' }] },
      { id: 'milb-hit-advanced', label: 'FanGraphs — Advanced', statSource: 'FanGraphs', supabaseTable: 'hitter_stats', detectTotals: true, totalsStatKeys: HITTER_TOTALS_STAT_KEYS, quickLinks: [{ label: 'Open FanGraphs', url: 'https://www.fangraphs.com/leaders/minor-league?pos=all&stats=bat&lg=2%2C4%2C5%2C6%2C7%2C8%2C9%2C10%2C11%2C14%2C12%2C13%2C15%2C16%2C17%2C18%2C30%2C32&qual=0&type=1&season=2026&level=0&team=&seasonEnd=2026&org=16&ind=0&splitTeam=false&startdate=&enddate=' }] },
      { id: 'milb-hit-batted', label: 'FanGraphs — Batted', statSource: 'FanGraphs', supabaseTable: 'hitter_stats', detectTotals: true, totalsStatKeys: HITTER_TOTALS_STAT_KEYS, quickLinks: [{ label: 'Open FanGraphs', url: 'https://www.fangraphs.com/leaders/minor-league?pos=all&stats=bat&lg=2%2C4%2C5%2C6%2C7%2C8%2C9%2C10%2C11%2C14%2C12%2C13%2C15%2C16%2C17%2C18%2C30%2C32&qual=0&type=2&season=2026&level=0&team=&seasonEnd=2026&org=16&ind=0&splitTeam=false&startdate=&enddate=' }] },

      psSource('ps-hit-aaa', 'AAA', 'hitter_stats', 'AAA'),
      psSource('ps-hit-aa', 'AA', 'hitter_stats', 'AA'),
      psSource('ps-hit-a+', 'A+', 'hitter_stats', 'A+'),
      psSource('ps-hit-a', 'A', 'hitter_stats', 'A'),
      psSource('ps-hit-dsl', 'DSL (from RK)', 'hitter_stats', 'DSL', RK_NOTE),
      psSource('ps-hit-fcl', 'FCL (from RK)', 'hitter_stats', 'FCL', RK_NOTE),

      tjSource('tj-hit-aaa', 'AAA', 'hitter_stats', 'AAA', [
        'https://tjstats.ca/leaderboard/?role=batter&season=2026&game_type=R&level=aaa&min_pa=0&team=ATL',
        'https://tjstats.ca/leaderboard/?role=batter&season=2026&game_type=R&level=aaa&min_pa=0&tab=1&team=GWN',
        'https://tjstats.ca/leaderboard/?role=batter&season=2026&game_type=R&level=aaa&min_pa=0&tab=2&team=GWN',
        'https://tjstats.ca/leaderboard/?role=batter&season=2026&game_type=R&level=aaa&min_pa=0&tab=3&team=GWN',
      ]),
      tjSource('tj-hit-aa', 'AA', 'hitter_stats', 'AA', [
        'https://tjstats.ca/leaderboard/?role=batter&season=2026&game_type=R&level=aa&min_pa=0&team=COL',
        'https://tjstats.ca/leaderboard/?role=batter&season=2026&game_type=R&level=aa&min_pa=0&tab=1&team=COL',
        'https://tjstats.ca/leaderboard/?role=batter&season=2026&game_type=R&level=aa&min_pa=0&tab=2&team=COL',
        'https://tjstats.ca/leaderboard/?role=batter&season=2026&game_type=R&level=aa&min_pa=0&tab=3&team=COL',
      ]),
      tjSource('tj-hit-a+', 'A+', 'hitter_stats', 'A+', [
        'https://tjstats.ca/leaderboard/?role=batter&season=2026&game_type=R&level=hi-a&min_pa=0&team=ROM',
        'https://tjstats.ca/leaderboard/?role=batter&season=2026&game_type=R&level=hi-a&min_pa=0&tab=1&team=ROM',
        'https://tjstats.ca/leaderboard/?role=batter&season=2026&game_type=R&level=hi-a&min_pa=0&tab=2&team=ROM',
        'https://tjstats.ca/leaderboard/?role=batter&season=2026&game_type=R&level=hi-a&min_pa=0&tab=3&team=ROM',
      ]),
      tjSource('tj-hit-a', 'A', 'hitter_stats', 'A', [
        'https://tjstats.ca/leaderboard/?role=batter&season=2026&game_type=R&level=lo-a&min_pa=0&team=AUG',
        'https://tjstats.ca/leaderboard/?role=batter&season=2026&game_type=R&level=lo-a&min_pa=0&tab=1&team=AUG',
        'https://tjstats.ca/leaderboard/?role=batter&season=2026&game_type=R&level=lo-a&min_pa=0&tab=2&team=AUG',
        'https://tjstats.ca/leaderboard/?role=batter&season=2026&game_type=R&level=lo-a&min_pa=0&tab=3&team=AUG',
      ]),
      tjSource('tj-hit-fcl', 'FCL', 'hitter_stats', 'FCL', [
        'https://tjstats.ca/leaderboard/?role=batter&season=2026&game_type=R&level=rok&min_pa=0&team=F-BRV',
        'https://tjstats.ca/leaderboard/?role=batter&season=2026&game_type=R&level=rok&min_pa=0&tab=1&team=F-BRV',
        'https://tjstats.ca/leaderboard/?role=batter&season=2026&game_type=R&level=rok&min_pa=0&tab=2&team=F-BRV',
        'https://tjstats.ca/leaderboard/?role=batter&season=2026&game_type=R&level=rok&min_pa=0&tab=3&team=F-BRV',
      ]),
    ],
  },
  {
    id: 'milb-pitchers',
    title: 'MiLB Pitchers',
    description: 'Braves system minor league pitching — FanGraphs, ProspectSavant, and TJStats.',
    sources: [
      { id: 'milb-pit-standard', label: 'FanGraphs — Standard', statSource: 'FanGraphs', supabaseTable: 'pitcher_stats', detectTotals: true, totalsStatKeys: PITCHER_TOTALS_STAT_KEYS, quickLinks: [{ label: 'Open FanGraphs', url: 'https://www.fangraphs.com/leaders/minor-league?pos=all&stats=pit&lg=2%2C4%2C5%2C6%2C7%2C8%2C9%2C10%2C11%2C14%2C12%2C13%2C15%2C16%2C17%2C18%2C30%2C32&qual=0&season=2026&level=0&team=&seasonEnd=2026&org=16&ind=0&splitTeam=false&startdate=&enddate=' }] },
      { id: 'milb-pit-advanced', label: 'FanGraphs — Advanced', statSource: 'FanGraphs', supabaseTable: 'pitcher_stats', detectTotals: true, totalsStatKeys: PITCHER_TOTALS_STAT_KEYS, quickLinks: [{ label: 'Open FanGraphs', url: 'https://www.fangraphs.com/leaders/minor-league?pos=all&stats=pit&lg=2%2C4%2C5%2C6%2C7%2C8%2C9%2C10%2C11%2C14%2C12%2C13%2C15%2C16%2C17%2C18%2C30%2C32&qual=0&season=2026&level=0&team=&seasonEnd=2026&org=16&ind=0&splitTeam=false&startdate=&enddate=&type=1' }] },
      { id: 'milb-pit-batted', label: 'FanGraphs — Batted', statSource: 'FanGraphs', supabaseTable: 'pitcher_stats', detectTotals: true, totalsStatKeys: PITCHER_TOTALS_STAT_KEYS, quickLinks: [{ label: 'Open FanGraphs', url: 'https://www.fangraphs.com/leaders/minor-league?pos=all&stats=pit&lg=2%2C4%2C5%2C6%2C7%2C8%2C9%2C10%2C11%2C14%2C12%2C13%2C15%2C16%2C17%2C18%2C30%2C32&qual=0&season=2026&level=0&team=&seasonEnd=2026&org=16&ind=0&splitTeam=false&startdate=&enddate=&type=2' }] },

      psSource('ps-pit-aaa', 'AAA', 'pitcher_stats', 'AAA'),
      psSource('ps-pit-aa', 'AA', 'pitcher_stats', 'AA'),
      psSource('ps-pit-a+', 'A+', 'pitcher_stats', 'A+'),
      psSource('ps-pit-a', 'A', 'pitcher_stats', 'A'),
      psSource('ps-pit-dsl', 'DSL (from RK)', 'pitcher_stats', 'DSL', RK_NOTE),
      psSource('ps-pit-fcl', 'FCL (from RK)', 'pitcher_stats', 'FCL', RK_NOTE),

      tjSource('tj-pit-aaa', 'AAA', 'pitcher_stats', 'AAA', [
        'https://tjstats.ca/leaderboard/?role=pitcher&season=2026&game_type=R&level=aaa&min_pa=0&team=GWN',
        'https://tjstats.ca/leaderboard/?role=pitcher&season=2026&game_type=R&level=aaa&min_pa=0&tab=1&team=GWN',
        'https://tjstats.ca/leaderboard/?role=pitcher&season=2026&game_type=R&level=aaa&min_pa=0&tab=2&team=GWN',
        'https://tjstats.ca/leaderboard/?role=pitcher&season=2026&game_type=R&level=aaa&min_pa=0&tab=3&team=GWN',
        'https://tjstats.ca/leaderboard/?role=pitcher&season=2026&game_type=R&level=aaa&min_pa=0&tab=4&team=GWN',
        'https://tjstats.ca/leaderboard/?role=pitcher&season=2026&game_type=R&level=aaa&min_pa=0&tab=5&team=GWN',
        'https://tjstats.ca/leaderboard/?role=pitcher&season=2026&game_type=R&level=aaa&min_pa=0&tab=6&team=GWN',
        'https://tjstats.ca/leaderboard/?role=pitcher&season=2026&game_type=R&level=aaa&min_pa=0&tab=7&team=GWN',
      ]),
      tjSource('tj-pit-aa', 'AA', 'pitcher_stats', 'AA', [
        'https://tjstats.ca/leaderboard/?role=pitcher&season=2026&game_type=R&level=aa&min_pa=0&team=COL',
        'https://tjstats.ca/leaderboard/?role=pitcher&season=2026&game_type=R&level=aa&min_pa=0&tab=1&team=COL',
        'https://tjstats.ca/leaderboard/?role=pitcher&season=2026&game_type=R&level=aa&min_pa=0&tab=2&team=COL',
        'https://tjstats.ca/leaderboard/?role=pitcher&season=2026&game_type=R&level=aa&min_pa=0&tab=3&team=COL',
        'https://tjstats.ca/leaderboard/?role=pitcher&season=2026&game_type=R&level=aa&min_pa=0&tab=4&team=COL',
        'https://tjstats.ca/leaderboard/?role=pitcher&season=2026&game_type=R&level=aa&min_pa=0&tab=5&team=COL',
      ]),
      tjSource('tj-pit-a+', 'A+', 'pitcher_stats', 'A+', [
        'https://tjstats.ca/leaderboard/?role=pitcher&season=2026&game_type=R&level=hi-a&min_pa=0&team=ROM',
        'https://tjstats.ca/leaderboard/?role=pitcher&season=2026&game_type=R&level=hi-a&min_pa=0&tab=1&team=ROM',
        'https://tjstats.ca/leaderboard/?role=pitcher&season=2026&game_type=R&level=hi-a&min_pa=0&tab=2&team=ROM',
        'https://tjstats.ca/leaderboard/?role=pitcher&season=2026&game_type=R&level=hi-a&min_pa=0&tab=3&team=ROM',
        'https://tjstats.ca/leaderboard/?role=pitcher&season=2026&game_type=R&level=hi-a&min_pa=0&tab=4&team=ROM',
        'https://tjstats.ca/leaderboard/?role=pitcher&season=2026&game_type=R&level=hi-a&min_pa=0&tab=5&team=ROM',
      ]),
      tjSource('tj-pit-a', 'A', 'pitcher_stats', 'A', [
        'https://tjstats.ca/leaderboard/?role=pitcher&season=2026&game_type=R&level=lo-a&min_pa=0&team=AUG',
        'https://tjstats.ca/leaderboard/?role=pitcher&season=2026&game_type=R&level=lo-a&min_pa=0&tab=1&team=AUG',
        'https://tjstats.ca/leaderboard/?role=pitcher&season=2026&game_type=R&level=lo-a&min_pa=0&tab=2&team=AUG',
        'https://tjstats.ca/leaderboard/?role=pitcher&season=2026&game_type=R&level=lo-a&min_pa=0&tab=3&team=AUG',
        'https://tjstats.ca/leaderboard/?role=pitcher&season=2026&game_type=R&level=lo-a&min_pa=0&tab=4&team=AUG',
      ]),
      tjSource('tj-pit-fcl', 'FCL', 'pitcher_stats', 'FCL', [
        'https://tjstats.ca/leaderboard/?role=pitcher&season=2026&game_type=R&level=rok&min_pa=0&team=F-BRV',
        'https://tjstats.ca/leaderboard/?role=pitcher&season=2026&game_type=R&level=rok&min_pa=0&tab=1&team=F-BRV',
        'https://tjstats.ca/leaderboard/?role=pitcher&season=2026&game_type=R&level=rok&min_pa=0&tab=2&team=F-BRV',
        'https://tjstats.ca/leaderboard/?role=pitcher&season=2026&game_type=R&level=rok&min_pa=0&tab=3&team=F-BRV',
        'https://tjstats.ca/leaderboard/?role=pitcher&season=2026&game_type=R&level=rok&min_pa=0&tab=4&team=F-BRV',
        'https://tjstats.ca/leaderboard/?role=pitcher&season=2026&game_type=R&level=rok&min_pa=0&tab=5&team=F-BRV',
        'https://tjstats.ca/leaderboard/?role=pitcher&season=2026&game_type=R&level=rok&min_pa=0&tab=6&team=F-BRV',
        'https://tjstats.ca/leaderboard/?role=pitcher&season=2026&game_type=R&level=rok&min_pa=0&tab=7&team=F-BRV',
      ]),
    ],
  },
  {
    id: 'mlb-hitters',
    title: 'MLB Hitters',
    description: 'Atlanta Braves major league hitting — FanGraphs and TJStats. (ProspectSavant not included at MLB per your spec.)',
    sources: [
      { id: 'mlb-hit-standard', label: 'FanGraphs — Standard', statSource: 'FanGraphs', supabaseTable: 'hitter_stats', defaultLevel: 'MLB', quickLinks: [{ label: 'Open FanGraphs', url: 'https://www.fangraphs.com/leaders/major-league?pos=all&stats=bat&lg=all&type=0&season=2026&season1=2026&ind=0&month=0&qual=0&team=16' }] },
      { id: 'mlb-hit-batted', label: 'FanGraphs — Batted Ball', statSource: 'FanGraphs', supabaseTable: 'hitter_stats', defaultLevel: 'MLB', quickLinks: [{ label: 'Open FanGraphs', url: 'https://www.fangraphs.com/leaders/major-league?pos=all&stats=bat&lg=all&type=2&season=2026&season1=2026&ind=0&month=0&qual=0&team=16' }] },
      { id: 'mlb-hit-advanced', label: 'FanGraphs — Advanced', statSource: 'FanGraphs', supabaseTable: 'hitter_stats', defaultLevel: 'MLB', quickLinks: [{ label: 'Open FanGraphs', url: 'https://www.fangraphs.com/leaders/major-league?pos=all&stats=bat&lg=all&type=1&season=2026&season1=2026&ind=0&month=0&qual=0&team=16' }] },
      { id: 'mlb-hit-statcast', label: 'FanGraphs — Statcast', statSource: 'FanGraphs', supabaseTable: 'hitter_stats', defaultLevel: 'MLB', quickLinks: [{ label: 'Open FanGraphs', url: 'https://www.fangraphs.com/leaders/major-league?pos=all&stats=bat&lg=all&type=24&season=2026&season1=2026&ind=0&month=0&qual=0&team=16' }] },
      { id: 'mlb-hit-battrack', label: 'FanGraphs — Bat Tracking', statSource: 'FanGraphs', supabaseTable: 'hitter_stats', defaultLevel: 'MLB', quickLinks: [{ label: 'Open FanGraphs', url: 'https://www.fangraphs.com/leaders/major-league?pos=all&stats=bat&lg=all&type=80&season=2026&season1=2026&ind=0&month=0&qual=0&team=16' }] },

      tjSource('tj-mlb-hit', 'MLB', 'hitter_stats', 'MLB', [
        'https://tjstats.ca/leaderboard/?role=batter&season=2026&game_type=R&level=mlb&min_pa=0&team=ATL',
        'https://tjstats.ca/leaderboard/?role=batter&season=2026&game_type=R&level=mlb&min_pa=0&tab=1&team=ATL',
        'https://tjstats.ca/leaderboard/?role=batter&season=2026&game_type=R&level=mlb&min_pa=0&tab=2&team=ATL',
        'https://tjstats.ca/leaderboard/?role=batter&season=2026&game_type=R&level=mlb&min_pa=0&tab=3&team=ATL',
      ]),
    ],
  },
  {
    id: 'mlb-pitchers',
    title: 'MLB Pitchers',
    description: 'Atlanta Braves major league pitching — FanGraphs and TJStats.',
    sources: [
      { id: 'mlb-pit-standard', label: 'FanGraphs — Standard', statSource: 'FanGraphs', supabaseTable: 'pitcher_stats', defaultLevel: 'MLB', quickLinks: [{ label: 'Open FanGraphs', url: 'https://www.fangraphs.com/leaders/major-league?pos=all&stats=pit&lg=all&type=0&season=2026&season1=2026&ind=0&qual=0&team=16&startdate=&enddate=&month=0' }] },
      { id: 'mlb-pit-advanced', label: 'FanGraphs — Advanced', statSource: 'FanGraphs', supabaseTable: 'pitcher_stats', defaultLevel: 'MLB', quickLinks: [{ label: 'Open FanGraphs', url: 'https://www.fangraphs.com/leaders/major-league?pos=all&stats=pit&lg=all&type=1&season=2026&season1=2026&ind=0&qual=0&team=16&startdate=&enddate=&month=0' }] },
      { id: 'mlb-pit-batted', label: 'FanGraphs — Batted Ball', statSource: 'FanGraphs', supabaseTable: 'pitcher_stats', defaultLevel: 'MLB', quickLinks: [{ label: 'Open FanGraphs', url: 'https://www.fangraphs.com/leaders/major-league?pos=all&stats=pit&lg=all&type=2&season=2026&season1=2026&ind=0&qual=0&team=16&startdate=&enddate=&month=0' }] },
      { id: 'mlb-pit-statcast', label: 'FanGraphs — Statcast', statSource: 'FanGraphs', supabaseTable: 'pitcher_stats', defaultLevel: 'MLB', quickLinks: [{ label: 'Open FanGraphs', url: 'https://www.fangraphs.com/leaders/major-league?pos=all&stats=pit&lg=all&type=24&season=2026&season1=2026&ind=0&qual=0&team=16&startdate=&enddate=&month=0' }] },
      { id: 'mlb-pit-battrack', label: 'FanGraphs — Bat Tracking', statSource: 'FanGraphs', supabaseTable: 'pitcher_stats', defaultLevel: 'MLB', quickLinks: [{ label: 'Open FanGraphs', url: 'https://www.fangraphs.com/leaders/major-league?pos=all&stats=pit&lg=all&type=80&season=2026&season1=2026&ind=0&qual=0&team=16&startdate=&enddate=&month=0' }] },
      { id: 'mlb-pit-pitchpct', label: 'FanGraphs — Pitch %', statSource: 'FanGraphs', supabaseTable: 'pitcher_stats', defaultLevel: 'MLB', quickLinks: [{ label: 'Open FanGraphs', url: 'https://www.fangraphs.com/leaders/major-league?pos=all&stats=pit&lg=all&type=9&season=2026&season1=2026&ind=0&qual=0&team=16&startdate=&enddate=&month=0' }] },
      { id: 'mlb-pit-velo', label: 'FanGraphs — Pitch Velo', statSource: 'FanGraphs', supabaseTable: 'pitcher_stats', defaultLevel: 'MLB', quickLinks: [{ label: 'Open FanGraphs', url: 'https://www.fangraphs.com/leaders/major-league?pos=all&stats=pit&lg=all&type=10&season=2026&season1=2026&ind=0&qual=0&team=16&startdate=&enddate=&month=0' }] },
      { id: 'mlb-pit-hmove', label: 'FanGraphs — H Movement', statSource: 'FanGraphs', supabaseTable: 'pitcher_stats', defaultLevel: 'MLB', quickLinks: [{ label: 'Open FanGraphs', url: 'https://www.fangraphs.com/leaders/major-league?pos=all&stats=pit&lg=all&type=11&season=2026&season1=2026&ind=0&qual=0&team=16&startdate=&enddate=&month=0' }] },
      { id: 'mlb-pit-vmove', label: 'FanGraphs — V Movement', statSource: 'FanGraphs', supabaseTable: 'pitcher_stats', defaultLevel: 'MLB', quickLinks: [{ label: 'Open FanGraphs', url: 'https://www.fangraphs.com/leaders/major-league?pos=all&stats=pit&lg=all&type=12&season=2026&season1=2026&ind=0&qual=0&team=16&startdate=&enddate=&month=0' }] },
      { id: 'mlb-pit-spin', label: 'FanGraphs — Spin', statSource: 'FanGraphs', supabaseTable: 'pitcher_stats', defaultLevel: 'MLB', quickLinks: [{ label: 'Open FanGraphs', url: 'https://www.fangraphs.com/leaders/major-league?pos=all&stats=pit&lg=all&type=82&season=2026&season1=2026&ind=0&qual=0&team=16&startdate=&enddate=&month=0' }] },
      { id: 'mlb-pit-stuffplus', label: 'FanGraphs — Stuff+', statSource: 'FanGraphs', supabaseTable: 'pitcher_stats', defaultLevel: 'MLB', quickLinks: [{ label: 'Open FanGraphs', url: 'https://www.fangraphs.com/leaders/major-league?pos=all&stats=pit&lg=all&type=36&season=2026&season1=2026&ind=0&qual=0&team=16&startdate=&enddate=&month=0' }] },
      { id: 'mlb-pit-locationplus', label: 'FanGraphs — Location+', statSource: 'FanGraphs', supabaseTable: 'pitcher_stats', defaultLevel: 'MLB', quickLinks: [{ label: 'Open FanGraphs', url: 'https://www.fangraphs.com/leaders/major-league?pos=all&stats=pit&lg=all&type=37&season=2026&season1=2026&ind=0&qual=0&team=16&startdate=&enddate=&month=0' }] },
      { id: 'mlb-pit-pitchingplus', label: 'FanGraphs — Pitching+', statSource: 'FanGraphs', supabaseTable: 'pitcher_stats', defaultLevel: 'MLB', quickLinks: [{ label: 'Open FanGraphs', url: 'https://www.fangraphs.com/leaders/major-league?pos=all&stats=pit&lg=all&type=38&season=2026&season1=2026&ind=0&qual=0&team=16&startdate=&enddate=&month=0' }] },

      tjSource('tj-mlb-pit', 'MLB', 'pitcher_stats', 'MLB', [
        'https://tjstats.ca/leaderboard/?role=pitcher&season=2026&game_type=R&level=mlb&min_pa=0&team=ATL',
        'https://tjstats.ca/leaderboard/?role=pitcher&season=2026&game_type=R&level=mlb&min_pa=0&tab=1&team=ATL',
        'https://tjstats.ca/leaderboard/?role=pitcher&season=2026&game_type=R&level=mlb&min_pa=0&tab=2&team=ATL',
        'https://tjstats.ca/leaderboard/?role=pitcher&season=2026&game_type=R&level=mlb&min_pa=0&tab=3&team=ATL',
        'https://tjstats.ca/leaderboard/?role=pitcher&season=2026&game_type=R&level=mlb&min_pa=0&tab=4&team=ATL',
        'https://tjstats.ca/leaderboard/?role=pitcher&season=2026&game_type=R&level=mlb&min_pa=0&tab=5&team=ATL',
        'https://tjstats.ca/leaderboard/?role=pitcher&season=2026&game_type=R&level=mlb&min_pa=0&tab=6&team=ATL',
      ]),
    ],
  },
]

type RowStatus = 'idle' | 'parsing' | 'uploading' | 'success' | 'error'

export default function Upload() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-navy-900 sm:text-xl">Upload Center</h2>
        <p className="text-xs text-navy-900/50 sm:text-sm">
          Open the source, export/download the file, then drop it here — it's parsed and merged
          into Supabase using each stat's priority order (ProspectSavant → TJStats → FanGraphs,
          per-stat — see lib/priorityMerge.ts) so every other tab updates.
        </p>
        {!supabaseConfigured && (
          <p className="mt-1.5 rounded-lg bg-brave-gold/10 px-2.5 py-1.5 text-[11px] text-brave-gold">
            Supabase isn't connected yet (see <code>.env.example</code>), so uploads will parse and
            preview locally but won't be written to the database until you add your project keys.
          </p>
        )}
      </div>

      <CompPoolUploadSection />

      {UPLOAD_GROUPS.map((group) => (
        <div key={group.id} className="space-y-2.5">
          <div>
            <h3 className="text-sm font-semibold text-navy-900 sm:text-base">{group.title}</h3>
            <p className="text-[11px] text-navy-900/45">{group.description}</p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {group.sources.map((source) => (
              <UploadRow key={source.id} source={source} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function columnSpecFor(source: UploadSource) {
  if (source.statSource === 'ProspectSavant') {
    return source.supabaseTable === 'hitter_stats' ? PROSPECTSAVANT_HITTER_COLUMNS : PROSPECTSAVANT_PITCHER_COLUMNS
  }
  if (source.statSource === 'TJStats') {
    return source.supabaseTable === 'hitter_stats' ? TJSTATS_HITTER_COLUMNS : TJSTATS_PITCHER_COLUMNS
  }
  return source.supabaseTable === 'hitter_stats' ? HITTER_COLUMNS : PITCHER_COLUMNS
}

function UploadRow({ source }: { source: UploadSource }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<RowStatus>('idle')
  const [rowCount, setRowCount] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFile = (file: File) => {
    setStatus('parsing')
    setError(null)
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          let rows = results.data as Record<string, any>[]
          if (source.detectTotals && source.totalsStatKeys) {
            rows = tagTotalRows(rows, source.totalsStatKeys)
          }

          const columnSpec = columnSpecFor(source)
          const mappedRows = rows
            .map((r) => {
              const mapped = mapRow(r, columnSpec)
              return {
                name: mapped.name as string | undefined,
                team: (mapped.team as string | undefined) ?? 'ATL',
                level: (mapped.level as string | undefined) ?? source.defaultLevel ?? null,
                isTotal: (r as any).is_total !== false, // tagTotalRows marks explicit false for a level-split row; true/undefined = total or single-level
                stats: mapped,
              }
            })
            .filter((r) => r.name && r.level)

          // Same player + same resolved level can appear twice in one file
          // (e.g. a split-level "Total" row whose comma-joined level
          // collapses down to match one of that player's individual-level
          // rows) — collapse to one per key before processing, preferring
          // the total row, so a same-batch collision can't hit the
          // database as a literal duplicate insert.
          const dedupedByKey = new Map<string, (typeof mappedRows)[number]>()
          for (const row of mappedRows) {
            const key = `${row.name}|${row.team}|${row.level}`
            const existing = dedupedByKey.get(key)
            if (!existing || (row.isTotal && !existing.isTotal)) {
              dedupedByKey.set(key, row)
            }
          }
          const dedupedRows = Array.from(dedupedByKey.values())

          setRowCount(dedupedRows.length)

          if (supabaseConfigured) {
            setStatus('uploading')
            const upsertFn = source.supabaseTable === 'hitter_stats' ? upsertHitterStatsWithPriority : upsertPitcherStatsWithPriority
            const { errors } = await (upsertFn as any)(
              dedupedRows.map((r) => ({ name: r.name!, team: r.team, level: r.level!, stats: r.stats })),
              source.statSource,
            )
            if (errors.length > 0) {
              throw new Error(`${errors.length} of ${dedupedRows.length} row(s) failed to save — first error: ${errors[0]?.error?.message ?? 'unknown'}`)
            }
          }

          cacheClear()
          setStatus('success')
        } catch (e: any) {
          setError(e.message ?? 'Upload failed')
          setStatus('error')
        }
      },
      error: (err) => {
        setError(err.message)
        setStatus('error')
      },
    })
  }

  return (
    <div className="card flex flex-col gap-2.5 p-3.5">
      <h4 className="text-sm font-semibold text-navy-950">{source.label}</h4>
      {source.note && <p className="text-[10px] text-brave-gold">{source.note}</p>}
      <div className="flex flex-wrap gap-1.5">
        {source.quickLinks.map((link) => (
          <a key={link.url + link.label} href={link.url} target="_blank" rel="noreferrer" className="pill-button flex-1 justify-center">
            {link.label} <ExternalLink size={12} />
          </a>
        ))}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />
      <button
        onClick={() => inputRef.current?.click()}
        className="flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-navy-950/15 py-2.5 text-xs font-medium text-navy-900/60 hover:border-navy-600 hover:text-navy-900"
      >
        <UploadCloud size={14} /> Upload CSV
      </button>
      {(status === 'parsing' || status === 'uploading') && (
        <p className="text-[11px] text-navy-900/50">{status === 'uploading' ? 'Saving...' : 'Parsing...'}</p>
      )}
      {status === 'success' && (
        <p className="flex items-center gap-1 text-[11px] text-emerald-600">
          <CheckCircle2 size={12} /> Loaded {rowCount} rows
          {!supabaseConfigured && ' (local preview only)'}
        </p>
      )}
      {status === 'error' && (
        <p className="flex items-center gap-1 text-[11px] text-brave-red">
          <AlertCircle size={12} /> {error}
        </p>
      )}
    </div>
  )
}

// =====================================================================
// Comp Pool Upload (Tab 4) — the "notable" MiLB player pool used purely
// for similarity comps. Deliberately separate from every other table:
// nothing else in the app reads prospect_comp_pool_hitters/pitchers, so
// this data will never show up in Players, All-Org Team, or anywhere
// else — it exists only to be compared against, never displayed as a
// Braves org player.
//
// NOTE — NOT YET EXTENDED to ProspectSavant/TJStats specifically: this
// still only maps the original FanGraphs-era comp pool columns
// (COMP_HITTER_COLUMNS / COMP_PITCHER_COLUMNS). Making this pool actually
// use ProspectSavant/TJStats data for comps needs two more things: (1) the
// prospect_comp_pool_hitters/pitchers tables need the same richer stat
// columns added via a migration, and (2) lib/prospectComps.ts's candidate
// metric lists need to include them. Flagged as the next follow-up rather
// than guessed at here.
//
// Same auto-detection as before (type + season/year per file), and
// generates a stable player_id client-side by slugifying name+level+years,
// since Fangraphs exports don't include one. That way re-uploading a
// different report for the same player merges into their existing row
// instead of creating a duplicate.
// =====================================================================

interface FileUploadState {
  id: string
  fileName: string
  status: RowStatus
  detectedType: 'Hitter' | 'Pitcher' | null
  seasons: number[]
  rowsProcessed: number
  totalRows: number
  error?: string
}

const BATCH_SIZE = 500

function CompPoolUploadSection() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<FileUploadState[]>([])

  const updateFile = (id: string, patch: Partial<FileUploadState>) => {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)))
  }

  const processFile = (file: File, id: string) =>
    new Promise<void>((resolve) => {
      updateFile(id, { status: 'parsing' })
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          try {
            const headers = results.meta.fields ?? []
            const detectedType = detectPlayerType(headers)
            if (!detectedType) {
              updateFile(id, { status: 'error', error: "Couldn't tell hitter vs pitcher from the columns in this file." })
              return
            }

            let rows = results.data as Record<string, any>[]
            const seasonKey = findColumnKey(headers, SEASON_COLUMN_CANDIDATES)
            if (seasonKey) {
              rows = rows.map((r) => ({ ...r, season: Number(r[seasonKey]) || null }))
            } else {
              const yearFromName = extractYearFromFilename(file.name)
              if (!yearFromName) {
                updateFile(id, {
                  status: 'error',
                  detectedType,
                  error: 'No Season/Year column, and no 4-digit year in the filename. Rename it, e.g. "2019_top_hitters.csv".',
                })
                return
              }
              rows = rows.map((r) => ({ ...r, season: yearFromName }))
            }

            rows = rows.filter((r) => r.season != null)
            const seasons = Array.from(new Set(rows.map((r) => r.season as number))).sort()

            const statKeys = detectedType === 'Hitter' ? HITTER_TOTALS_STAT_KEYS : PITCHER_TOTALS_STAT_KEYS
            tagTotalRowsBySeason(rows, statKeys, 'season')

            const columnSpec = detectedType === 'Hitter' ? COMP_HITTER_COLUMNS : COMP_PITCHER_COLUMNS
            const mappedRows: Record<string, any>[] = rows
              .filter((r) => r.is_total !== false)
              .map((r) => {
                const mapped = mapRow(r, columnSpec)
                const years = String(r.season)
                return {
                  ...mapped,
                  years,
                  player_id: slugify(`${mapped.name ?? 'unknown'}-${years}`),
                } as Record<string, any>
              })
              .filter((r) => r.name)

            const table = detectedType === 'Hitter' ? 'prospect_comp_pool_hitters' : 'prospect_comp_pool_pitchers'
            updateFile(id, { status: 'uploading', detectedType, seasons, totalRows: mappedRows.length })

            if (supabaseConfigured) {
              for (let i = 0; i < mappedRows.length; i += BATCH_SIZE) {
                const batch = mappedRows.slice(i, i + BATCH_SIZE)
                const { error: upsertError } = await supabase.from(table).upsert(batch, { onConflict: 'player_id' })
                if (upsertError) throw upsertError
                updateFile(id, { rowsProcessed: Math.min(i + BATCH_SIZE, mappedRows.length) })
              }
            } else {
              updateFile(id, { rowsProcessed: mappedRows.length })
            }

            cacheClear()
            updateFile(id, { status: 'success' })
          } catch (e: any) {
            updateFile(id, { status: 'error', error: e.message ?? 'Upload failed' })
          } finally {
            resolve()
          }
        },
        error: (err) => {
          updateFile(id, { status: 'error', error: err.message })
          resolve()
        },
      })
    })

  const handleFiles = async (fileList: FileList) => {
    const incoming = Array.from(fileList).map((file) => ({
      id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
    }))
    setFiles((prev) => [
      ...prev,
      ...incoming.map(({ id, file }) => ({
        id,
        fileName: file.name,
        status: 'parsing' as RowStatus,
        detectedType: null,
        seasons: [] as number[],
        rowsProcessed: 0,
        totalRows: 0,
      })),
    ])
    for (const { id, file } of incoming) {
      await processFile(file, id)
    }
  }

  return (
    <div className="card border-l-4 border-brave-gold p-3.5 sm:p-4">
      <div className="mb-3 flex items-start gap-2.5">
        <Users size={18} className="mt-0.5 shrink-0 text-brave-gold" />
        <div>
          <h3 className="text-sm font-semibold text-navy-950 sm:text-base">
            Prospect Comp Pool (Tab 4 only)
          </h3>
          <p className="text-[11px] text-navy-900/50 sm:text-xs">
            League-wide "notable" MiLB player exports — not Braves-specific — used only to
            generate similarity comps on the Prospect Comps tab. This never appears in Players,
            All-Org Team, or any org-facing view. Currently FanGraphs-only — extending this to
            ProspectSavant/TJStats data is a planned follow-up, not yet built.
          </p>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && e.target.files.length > 0 && handleFiles(e.target.files)}
      />
      <button
        onClick={() => inputRef.current?.click()}
        className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-navy-950/15 py-3 text-xs font-medium text-navy-900/60 hover:border-brave-gold hover:text-navy-900"
      >
        <UploadCloud size={16} /> Select comp pool CSVs (any number at once)
      </button>
      {files.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {files.map((f) => (
            <FileRow key={f.id} file={f} />
          ))}
        </div>
      )}
    </div>
  )
}

function FileRow({ file }: { file: FileUploadState }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-navy-950/8 bg-white px-3 py-2 text-xs">
      <span className="min-w-0 flex-1 truncate font-medium text-navy-950">{file.fileName}</span>
      {file.detectedType && (
        <span className="shrink-0 rounded-full bg-navy-950/5 px-2 py-0.5 text-[10px] font-medium text-navy-900/60">
          {file.detectedType}
          {file.seasons.length > 0 &&
            ` · ${file.seasons.length === 1 ? file.seasons[0] : `${file.seasons[0]}–${file.seasons[file.seasons.length - 1]}`}`}
        </span>
      )}
      <span className="shrink-0">
        {(file.status === 'parsing' || file.status === 'uploading') && (
          <span className="flex items-center gap-1 text-navy-900/50">
            {file.status === 'uploading' && file.totalRows > 0
              ? `${file.rowsProcessed.toLocaleString()}/${file.totalRows.toLocaleString()}`
              : 'Reading...'}
          </span>
        )}
        {file.status === 'success' && (
          <span className="flex items-center gap-1 text-emerald-600">
            <CheckCircle2 size={12} /> {file.rowsProcessed.toLocaleString()} rows
          </span>
        )}
        {file.status === 'error' && (
          <span className="flex items-center gap-1 text-brave-red" title={file.error}>
            <AlertCircle size={12} /> {file.error}
          </span>
        )}
      </span>
    </div>
  )
}

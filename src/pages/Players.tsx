import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUpDown, ChevronDown, ChevronUp, Loader2, Inbox, X } from 'lucide-react'
import DownloadableCard from '@/components/shared/DownloadableCard'
import { fetchHitters, fetchPitchers, fetchAvailableSeasons, fetchTeamGamesByLevel, updateHitterPosition, updatePitcherPosition } from '@/lib/queries'
import { cacheClear } from '@/lib/cache'
import { supabaseConfigured } from '@/lib/supabaseClient'
import { CURRENT_SEASON } from '@/lib/constants'
import { useClickOutside } from '@/lib/useClickOutside'
import { ORG_LEVELS, type HitterSeasonStats, type PitcherSeasonStats, type OrgLevel } from '@/types'

type PlayerMode = 'Hitter' | 'Pitcher'
type HitterView = 'Standard' | 'Batted Ball' | 'Statcast' | 'Bat Tracking'
type PitcherView = 'Standard' | 'Batted Ball' | 'Statcast' | 'Pitch Grades'

const HITTER_VIEWS: HitterView[] = ['Standard', 'Batted Ball', 'Statcast', 'Bat Tracking']
const PITCHER_VIEWS: PitcherView[] = ['Standard', 'Batted Ball', 'Statcast', 'Pitch Grades']

type Col<T> = { key: keyof T; label: string; numeric?: boolean; fmt?: (v: any) => string }

const HITTER_POSITION_OPTIONS = ['C', '1B', '2B', '3B', 'SS', 'INF', 'LF', 'CF', 'RF', 'OF', 'UTIL', 'DH']
const PITCHER_POSITION_OPTIONS = ['SP', 'RP']

const pct = (v: any) => (v == null ? '—' : `${Number(v).toFixed(2)}%`)
const dec3 = (v: any) => (v == null ? '—' : Number(v).toFixed(3))
const dec2 = (v: any) => (v == null ? '—' : Number(v).toFixed(2))
const dec1 = (v: any) => (v == null ? '—' : Number(v).toFixed(1))
const int0 = (v: any) => (v == null ? '—' : String(Math.round(Number(v))))

const HITTER_ID_COLS: Col<HitterSeasonStats>[] = [
  { key: 'name', label: 'Name' },
  { key: 'season', label: 'Year', numeric: true },
  { key: 'level', label: 'Lvl' },
  { key: 'position', label: 'Pos' },
]

const HITTER_COLUMN_SETS: Record<HitterView, Col<HitterSeasonStats>[]> = {
  Standard: [
    ...HITTER_ID_COLS,
    { key: 'age', label: 'Age', numeric: true },
    { key: 'g', label: 'G', numeric: true },
    { key: 'pa', label: 'PA', numeric: true },
    { key: 'avg', label: 'AVG', numeric: true, fmt: dec3 },
    { key: 'obp', label: 'OBP', numeric: true, fmt: dec3 },
    { key: 'slg', label: 'SLG', numeric: true, fmt: dec3 },
    { key: 'ops', label: 'OPS', numeric: true, fmt: dec3 },
    { key: 'wrcPlus', label: 'wRC+', numeric: true },
    { key: 'bbPct', label: 'BB%', numeric: true, fmt: pct },
    { key: 'kPct', label: 'K%', numeric: true, fmt: pct },
    { key: 'hr', label: 'HR', numeric: true },
    { key: 'sb', label: 'SB', numeric: true },
  ],
  'Batted Ball': [
    ...HITTER_ID_COLS,
    { key: 'gbPct', label: 'GB%', numeric: true, fmt: pct },
    { key: 'fbPct', label: 'FB%', numeric: true, fmt: pct },
    { key: 'ldPct', label: 'LD%', numeric: true, fmt: pct },
    { key: 'hrFbPct', label: 'HR/FB', numeric: true, fmt: pct },
    { key: 'pullPct', label: 'Pull%', numeric: true, fmt: pct },
    { key: 'centPct', label: 'Cent%', numeric: true, fmt: pct },
    { key: 'oppoPct', label: 'Oppo%', numeric: true, fmt: pct },
    { key: 'hardPct', label: 'Hard%', numeric: true, fmt: pct },
  ],
  Statcast: [
    ...HITTER_ID_COLS,
    { key: 'evAvg', label: 'EV', numeric: true, fmt: dec1 },
    { key: 'evMax', label: 'Max EV', numeric: true, fmt: dec1 },
    { key: 'laAvg', label: 'LA', numeric: true, fmt: dec1 },
    { key: 'barrelPct', label: 'Barrel%', numeric: true, fmt: pct },
    { key: 'hardHitPct', label: 'HardHit%', numeric: true, fmt: pct },
    { key: 'xba', label: 'xBA', numeric: true, fmt: dec3 },
    { key: 'xslg', label: 'xSLG', numeric: true, fmt: dec3 },
    { key: 'xwoba', label: 'xwOBA', numeric: true, fmt: dec3 },
  ],
  'Bat Tracking': [
    ...HITTER_ID_COLS,
    { key: 'batSpeed', label: 'Bat Speed', numeric: true, fmt: dec1 },
    { key: 'swingLength', label: 'Swing Len', numeric: true, fmt: dec1 },
    { key: 'squaredUpPct', label: 'Squared-Up%', numeric: true, fmt: pct },
    { key: 'blastPct', label: 'Blast%', numeric: true, fmt: pct },
  ],
}

const PITCHER_ID_COLS: Col<PitcherSeasonStats>[] = [
  { key: 'name', label: 'Name' },
  { key: 'season', label: 'Year', numeric: true },
  { key: 'level', label: 'Lvl' },
  { key: 'position', label: 'Role' },
]

const PITCHER_COLUMN_SETS: Record<PitcherView, Col<PitcherSeasonStats>[]> = {
  Standard: [
    ...PITCHER_ID_COLS,
    { key: 'age', label: 'Age', numeric: true },
    { key: 'g', label: 'G', numeric: true },
    { key: 'gs', label: 'GS', numeric: true },
    { key: 'ip', label: 'IP', numeric: true, fmt: dec1 },
    { key: 'era', label: 'ERA', numeric: true, fmt: dec2 },
    { key: 'fip', label: 'FIP', numeric: true, fmt: dec2 },
    { key: 'siera', label: 'SIERA', numeric: true, fmt: dec2 },
    { key: 'whip', label: 'WHIP', numeric: true, fmt: dec2 },
    { key: 'kPct', label: 'K%', numeric: true, fmt: pct },
    { key: 'bbPct', label: 'BB%', numeric: true, fmt: pct },
    { key: 'kbbPct', label: 'K-BB%', numeric: true, fmt: pct },
  ],
  'Batted Ball': [
    ...PITCHER_ID_COLS,
    { key: 'gbPct', label: 'GB%', numeric: true, fmt: pct },
    { key: 'fbPct', label: 'FB%', numeric: true, fmt: pct },
    { key: 'ldPct', label: 'LD%', numeric: true, fmt: pct },
    { key: 'hrFbPct', label: 'HR/FB', numeric: true, fmt: pct },
    { key: 'hardPct', label: 'Hard%', numeric: true, fmt: pct },
  ],
  Statcast: [
    ...PITCHER_ID_COLS,
    { key: 'barrelPct', label: 'Barrel%', numeric: true, fmt: pct },
    { key: 'hardHitPct', label: 'HardHit%', numeric: true, fmt: pct },
    { key: 'xera', label: 'xERA', numeric: true, fmt: dec2 },
    { key: 'xba', label: 'xBA', numeric: true, fmt: dec3 },
    { key: 'whiffPct', label: 'Whiff%', numeric: true, fmt: pct },
    { key: 'chasePct', label: 'Chase%', numeric: true, fmt: pct },
  ],
  'Pitch Grades': [
    ...PITCHER_ID_COLS,
    { key: 'stuffPlus', label: 'Stuff+', numeric: true, fmt: int0 },
    { key: 'locationPlus', label: 'Location+', numeric: true, fmt: int0 },
    { key: 'pitchingPlus', label: 'Pitching+', numeric: true, fmt: int0 },
  ],
}

export default function Players() {
  const [mode, setMode] = useState<PlayerMode>('Hitter')
  const [hitterView, setHitterView] = useState<HitterView>('Standard')
  const [pitcherView, setPitcherView] = useState<PitcherView>('Standard')
  const [levelFilter, setLevelFilter] = useState<OrgLevel[]>([])
  const [yearFilter, setYearFilter] = useState<number[]>([CURRENT_SEASON])
  const [minPA, setMinPA] = useState(0)
  const [minIP, setMinIP] = useState(0)
  const [qualifiedOnly, setQualifiedOnly] = useState(false)
  const [sortKey, setSortKey] = useState<string>('ops')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [search, setSearch] = useState('')

  const [availableYears, setAvailableYears] = useState<number[]>([CURRENT_SEASON])
  const [hitters, setHitters] = useState<HitterSeasonStats[] | null>(null)
  const [pitchers, setPitchers] = useState<PitcherSeasonStats[] | null>(null)
  const [teamGamesByLevel, setTeamGamesByLevel] = useState<Record<string, number>>({})

  useEffect(() => {
    fetchAvailableSeasons().then(setAvailableYears)
    fetchTeamGamesByLevel().then(setTeamGamesByLevel)
  }, [])

  // Current season lives in hitter_stats/pitcher_stats; any other year comes
  // from historical_hitter_stats/historical_pitcher_stats — separate tables,
  // so this refetches whenever the year selection changes.
  useEffect(() => {
    setHitters(null)
    setPitchers(null)
    Promise.all([fetchHitters(yearFilter), fetchPitchers(yearFilter)]).then(([h, p]) => {
      setHitters(h)
      setPitchers(p)
    })
  }, [yearFilter])

  const loading = hitters === null || pitchers === null

  const columns = mode === 'Hitter' ? HITTER_COLUMN_SETS[hitterView] : PITCHER_COLUMN_SETS[pitcherView]

  const rows = useMemo(() => {
    const base: (HitterSeasonStats | PitcherSeasonStats)[] = (mode === 'Hitter' ? hitters : pitchers) ?? []

    let filtered = base.filter((p) => {
      if (levelFilter.length && !levelFilter.includes(p.level)) return false
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false

      if (mode === 'Hitter') {
        const h = p as HitterSeasonStats
        if (h.pa < minPA) return false
        if (qualifiedOnly) {
          const teamGames = teamGamesByLevel[h.level] ?? 130
          if (h.pa < 3.1 * teamGames) return false
        }
      } else {
        const pit = p as PitcherSeasonStats
        if (pit.ip < minIP) return false
        if (qualifiedOnly) {
          const teamGames = teamGamesByLevel[pit.level] ?? 130
          if (pit.ip < 1.0 * teamGames) return false
        }
      }
      return true
    })

    filtered = [...filtered].sort((a: any, b: any) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      if (typeof av === 'string') {
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      }
      return sortDir === 'asc' ? av - bv : bv - av
    })

    return filtered
  }, [mode, hitters, pitchers, levelFilter, search, minPA, minIP, qualifiedOnly, teamGamesByLevel, sortKey, sortDir])

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const handlePositionEdit = async (row: HitterSeasonStats | PitcherSeasonStats, newPosition: string) => {
    if (row.season !== CURRENT_SEASON) return // only current-season rows can be edited
    if (mode === 'Hitter') {
      await updateHitterPosition(row.dbId, newPosition)
      setHitters((prev) => prev?.map((h) => (h.dbId === row.dbId ? { ...h, position: newPosition as any } : h)) ?? prev)
    } else {
      await updatePitcherPosition(row.dbId, newPosition)
      setPitchers((prev) => prev?.map((p) => (p.dbId === row.dbId ? { ...p, position: newPosition as any } : p)) ?? prev)
    }
    cacheClear() // otherwise other tabs (All-Org Team, Top 30) keep serving the stale cached position
  }

  const switchMode = (m: PlayerMode) => {
    setMode(m)
    setSortKey(m === 'Hitter' ? 'ops' : 'era')
    setSortDir(m === 'Hitter' ? 'desc' : 'asc')
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-navy-900 sm:text-xl">Players</h2>
        <p className="text-xs text-navy-900/50 sm:text-sm">
          Full organizational player database — sortable, filterable, exportable. Defaults to the
          current season; add past years from the Historical Archive to compare.
        </p>
      </div>

      {/* Controls */}
      <div className="card space-y-3 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          {/* Hitter / Pitcher toggle */}
          <div className="flex overflow-hidden rounded-full border border-navy-950/10">
            <button
              onClick={() => switchMode('Hitter')}
              className={`px-4 py-1.5 text-xs font-semibold transition ${
                mode === 'Hitter' ? 'bg-navy text-white' : 'bg-white text-navy-800'
              }`}
            >
              Hitters
            </button>
            <button
              onClick={() => switchMode('Pitcher')}
              className={`px-4 py-1.5 text-xs font-semibold transition ${
                mode === 'Pitcher' ? 'bg-navy text-white' : 'bg-white text-navy-800'
              }`}
            >
              Pitchers
            </button>
          </div>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search player…"
            className="min-w-[140px] flex-1 rounded-full border border-navy-950/10 px-3 py-1.5 text-xs sm:max-w-[220px]"
          />

          <label className="flex items-center gap-1.5 text-xs text-navy-900/70">
            {mode === 'Hitter' ? 'Min PA' : 'Min IP'}
            <input
              type="number"
              min={0}
              value={mode === 'Hitter' ? minPA : minIP}
              onChange={(e) =>
                mode === 'Hitter' ? setMinPA(Number(e.target.value)) : setMinIP(Number(e.target.value))
              }
              className="w-16 rounded-md border border-navy-950/10 px-2 py-1 text-xs"
            />
          </label>

          <label className="flex items-center gap-1.5 rounded-full border border-navy-950/10 px-3 py-1.5 text-xs font-medium text-navy-800">
            <input
              type="checkbox"
              checked={qualifiedOnly}
              onChange={(e) => setQualifiedOnly(e.target.checked)}
              className="accent-brave-red"
            />
            Qualified
          </label>
        </div>

        {/* View tabs — swap which columns show instead of one giant scrolling table */}
        <div className="flex flex-wrap gap-1.5">
          {(mode === 'Hitter' ? HITTER_VIEWS : PITCHER_VIEWS).map((v) => (
            <button
              key={v}
              onClick={() => (mode === 'Hitter' ? setHitterView(v as HitterView) : setPitcherView(v as PitcherView))}
              className="pill-button"
              data-active={mode === 'Hitter' ? hitterView === v : pitcherView === v}
            >
              {v}
            </button>
          ))}
        </div>

        {/* Multi-select filters */}
        <div className="flex flex-wrap gap-3">
          <MultiSelectFilter
            label="Year"
            options={availableYears.map(String)}
            selected={yearFilter.map(String)}
            onChange={(v) => setYearFilter(v.map(Number))}
          />
          <MultiSelectFilter
            label="Level"
            options={ORG_LEVELS}
            selected={levelFilter}
            onChange={(v) => setLevelFilter(v as OrgLevel[])}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-navy-900/40">
          <Loader2 size={16} className="animate-spin" /> Loading players…
        </div>
      ) : !supabaseConfigured ? (
        <EmptyState
          title="Supabase isn't connected"
          detail="Add your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see .env.example) to see real players here."
        />
      ) : (hitters?.length ?? 0) === 0 && (pitchers?.length ?? 0) === 0 ? (
        <EmptyState
          title="No players uploaded yet"
          detail="Head to the Upload tab and pull in a Fangraphs export to populate this table."
        />
      ) : (
        <DownloadableCard
          title={`Braves Org ${mode}s — ${mode === 'Hitter' ? hitterView : pitcherView}`}
          subtitle={`${rows.length} players shown`}
          filename={`braves-org-players-${mode.toLowerCase()}-${(mode === 'Hitter' ? hitterView : pitcherView).toLowerCase().replace(/\s+/g, '-')}`}
        >
          <div className="max-h-[70vh] overflow-auto">
            <table className="stat-table">
              <thead>
                <tr>
                  {columns.map((col) => (
                    <th key={String(col.key)}>
                      <button onClick={() => toggleSort(String(col.key))} className="inline-flex items-center gap-1">
                        {col.label}
                        {sortKey === col.key ? (
                          sortDir === 'asc' ? (
                            <ChevronUp size={11} />
                          ) : (
                            <ChevronDown size={11} />
                          )
                        ) : (
                          <ArrowUpDown size={10} className="opacity-30" />
                        )}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row: any) => (
                  <tr key={`${row.playerId}-${row.season}`}>
                    {columns.map((col) => (
                      <td key={String(col.key)}>
                        {col.key === 'position' && row.season === CURRENT_SEASON ? (
                          <select
                            value={row.position ?? ''}
                            onChange={(e) => handlePositionEdit(row, e.target.value)}
                            className="rounded border border-navy-950/10 bg-white px-1 py-0.5 text-xs"
                          >
                            <option value="" disabled>
                              —
                            </option>
                            {(mode === 'Hitter' ? HITTER_POSITION_OPTIONS : PITCHER_POSITION_OPTIONS).map((p) => (
                              <option key={p} value={p}>
                                {p}
                              </option>
                            ))}
                          </select>
                        ) : col.fmt ? (
                          col.fmt(row[col.key])
                        ) : (
                          row[col.key] ?? '—'
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={columns.length} className="py-6 text-center text-navy-900/40">
                      No players match these filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </DownloadableCard>
      )}
    </div>
  )
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="card flex flex-col items-center gap-2 px-6 py-14 text-center">
      <Inbox size={22} className="text-navy-950/20" />
      <p className="text-sm font-medium text-navy-900">{title}</p>
      <p className="max-w-md text-xs text-navy-900/50">{detail}</p>
    </div>
  )
}

function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
}: {
  label: string
  options: string[]
  selected: string[]
  onChange: (v: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  useClickOutside(wrapperRef, () => setOpen(false), open)
  const toggle = (opt: string) => {
    onChange(selected.includes(opt) ? selected.filter((o) => o !== opt) : [...selected, opt])
  }
  return (
    <div className="relative" ref={wrapperRef}>
      <button onClick={() => setOpen((o) => !o)} className="pill-button" data-active={selected.length > 0}>
        {label}
        {selected.length > 0 && (
          <span className="ml-1 rounded-full bg-white/20 px-1.5 text-[10px]">{selected.length}</span>
        )}
        <ChevronDown size={12} />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-44 rounded-lg border border-navy-950/10 bg-white p-2 shadow-lg">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase text-navy-900/40">{label}</span>
            {selected.length > 0 && (
              <button onClick={() => onChange([])} className="text-navy-900/40 hover:text-brave-red">
                <X size={12} />
              </button>
            )}
          </div>
          <div className="max-h-48 space-y-0.5 overflow-auto">
            {options.map((opt) => (
              <label key={opt} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-brave-cream">
                <input
                  type="checkbox"
                  checked={selected.includes(opt)}
                  onChange={() => toggle(opt)}
                  className="accent-brave-red"
                />
                {opt}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

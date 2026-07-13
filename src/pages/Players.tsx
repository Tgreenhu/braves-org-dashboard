import { useMemo, useState } from 'react'
import { ArrowUpDown, ChevronDown, ChevronUp, X } from 'lucide-react'
import DownloadableCard from '@/components/shared/DownloadableCard'
import { MOCK_HITTERS, MOCK_PITCHERS } from '@/data/mockData'
import { ORG_LEVELS, type HitterSeasonStats, type PitcherSeasonStats, type OrgLevel } from '@/types'

type PlayerMode = 'Hitter' | 'Pitcher'

const HITTER_COLUMNS: { key: keyof HitterSeasonStats; label: string; numeric?: boolean; fmt?: (v: number) => string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'level', label: 'Lvl' },
  { key: 'team', label: 'Team' },
  { key: 'position', label: 'Pos' },
  { key: 'age', label: 'Age', numeric: true },
  { key: 'g', label: 'G', numeric: true },
  { key: 'pa', label: 'PA', numeric: true },
  { key: 'avg', label: 'AVG', numeric: true, fmt: (v) => v.toFixed(3) },
  { key: 'obp', label: 'OBP', numeric: true, fmt: (v) => v.toFixed(3) },
  { key: 'slg', label: 'SLG', numeric: true, fmt: (v) => v.toFixed(3) },
  { key: 'ops', label: 'OPS', numeric: true, fmt: (v) => v.toFixed(3) },
  { key: 'wrcPlus', label: 'wRC+', numeric: true },
  { key: 'bbPct', label: 'BB%', numeric: true, fmt: (v) => `${v.toFixed(1)}%` },
  { key: 'kPct', label: 'K%', numeric: true, fmt: (v) => `${v.toFixed(1)}%` },
  { key: 'hr', label: 'HR', numeric: true },
  { key: 'sb', label: 'SB', numeric: true },
]

const PITCHER_COLUMNS: { key: keyof PitcherSeasonStats; label: string; numeric?: boolean; fmt?: (v: number) => string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'level', label: 'Lvl' },
  { key: 'team', label: 'Team' },
  { key: 'position', label: 'Role' },
  { key: 'age', label: 'Age', numeric: true },
  { key: 'g', label: 'G', numeric: true },
  { key: 'gs', label: 'GS', numeric: true },
  { key: 'ip', label: 'IP', numeric: true, fmt: (v) => v.toFixed(1) },
  { key: 'era', label: 'ERA', numeric: true, fmt: (v) => v.toFixed(2) },
  { key: 'fip', label: 'FIP', numeric: true, fmt: (v) => v.toFixed(2) },
  { key: 'siera', label: 'SIERA', numeric: true, fmt: (v) => v.toFixed(2) },
  { key: 'whip', label: 'WHIP', numeric: true, fmt: (v) => v.toFixed(2) },
  { key: 'kPct', label: 'K%', numeric: true, fmt: (v) => `${v.toFixed(1)}%` },
  { key: 'bbPct', label: 'BB%', numeric: true, fmt: (v) => `${v.toFixed(1)}%` },
  { key: 'kbbPct', label: 'K-BB%', numeric: true, fmt: (v) => `${v.toFixed(1)}%` },
]

export default function Players() {
  // TODO(supabase): replace with useOrgData() reading `hitter_stats` /
  // `pitcher_stats` tables (see supabase/schema.sql)
  const [mode, setMode] = useState<PlayerMode>('Hitter')
  const [levelFilter, setLevelFilter] = useState<OrgLevel[]>([])
  const [teamFilter, setTeamFilter] = useState<string[]>([])
  const [minPA, setMinPA] = useState(0)
  const [minIP, setMinIP] = useState(0)
  const [sortKey, setSortKey] = useState<string>(mode === 'Hitter' ? 'ops' : 'era')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [search, setSearch] = useState('')

  const allTeams = useMemo(
    () => Array.from(new Set([...MOCK_HITTERS, ...MOCK_PITCHERS].map((p) => p.team))).sort(),
    [],
  )

  const columns = mode === 'Hitter' ? HITTER_COLUMNS : PITCHER_COLUMNS

  const rows = useMemo(() => {
    const base: (HitterSeasonStats | PitcherSeasonStats)[] =
      mode === 'Hitter' ? MOCK_HITTERS : MOCK_PITCHERS

    let filtered = base.filter((p) => {
      if (levelFilter.length && !levelFilter.includes(p.level)) return false
      if (teamFilter.length && !teamFilter.includes(p.team)) return false
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false
      if (mode === 'Hitter' && (p as HitterSeasonStats).pa < minPA) return false
      if (mode === 'Pitcher' && (p as PitcherSeasonStats).ip < minIP) return false
      return true
    })

    filtered = [...filtered].sort((a: any, b: any) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      if (typeof av === 'string') {
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      }
      return sortDir === 'asc' ? av - bv : bv - av
    })

    return filtered
  }, [mode, levelFilter, teamFilter, search, minPA, minIP, sortKey, sortDir])

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
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
          Full organizational player database — sortable, filterable, exportable.
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
                mode === 'Hitter'
                  ? setMinPA(Number(e.target.value))
                  : setMinIP(Number(e.target.value))
              }
              className="w-16 rounded-md border border-navy-950/10 px-2 py-1 text-xs"
            />
          </label>
        </div>

        {/* Multi-select filters */}
        <div className="flex flex-wrap gap-3">
          <MultiSelectFilter
            label="Level"
            options={ORG_LEVELS}
            selected={levelFilter}
            onChange={(v) => setLevelFilter(v as OrgLevel[])}
          />
          <MultiSelectFilter
            label="Team"
            options={allTeams}
            selected={teamFilter}
            onChange={setTeamFilter}
          />
        </div>
      </div>

      <DownloadableCard
        title={`Braves Org ${mode}s`}
        subtitle={`${rows.length} players shown`}
        filename={`braves-org-players-${mode.toLowerCase()}`}
      >
        <div className="max-h-[70vh] overflow-auto">
          <table className="stat-table">
            <thead>
              <tr>
                {columns.map((col) => (
                  <th key={String(col.key)}>
                    <button
                      onClick={() => toggleSort(String(col.key))}
                      className="inline-flex items-center gap-1"
                    >
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
                <tr key={row.playerId}>
                  {columns.map((col) => (
                    <td key={String(col.key)}>
                      {col.fmt ? col.fmt(row[col.key]) : row[col.key]}
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
  const toggle = (opt: string) => {
    onChange(selected.includes(opt) ? selected.filter((o) => o !== opt) : [...selected, opt])
  }
  return (
    <div className="relative">
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
              <label
                key={opt}
                className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-brave-cream"
              >
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

import { useEffect, useMemo, useRef, useState } from 'react'
import Papa from 'papaparse'
import {
  ScatterChart,
  Scatter,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ZAxis,
} from 'recharts'
import {
  Loader2,
  Inbox,
  ChevronDown,
  X,
  ArrowUpDown,
  ChevronUp,
  Download,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
import DownloadableCard from '@/components/shared/DownloadableCard'
import { fetchDevRankings, fetchDevCareerWar, upsertDevRankings, upsertDevCareerWar, upsertDevDebuts } from '@/lib/queries'
import { cacheClear } from '@/lib/cache'
import { useClickOutside } from '@/lib/useClickOutside'
import { extractYearFromFilename } from '@/lib/csvUpload'
import {
  buildPlayerDevRecords,
  summarizeByOrg,
  normalizeOrg,
  RANK_BUCKETS,
  type RankingRow,
  type CareerWarRow,
  type PlayerDevRecord,
  type OrgSummary,
} from '@/lib/mlbDev'

type SubPage = 'overview' | 'organizations' | 'players' | 'development' | 'rankings' | 'methodology' | 'upload'
const SUB_PAGES: { id: SubPage; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'organizations', label: 'Organizations' },
  { id: 'players', label: 'Players' },
  { id: 'development', label: 'Development' },
  { id: 'rankings', label: 'Rankings' },
  { id: 'methodology', label: 'Methodology' },
  { id: 'upload', label: 'Upload' },
]

const CHART_COLORS = ['#CE1141', '#13274F', '#8DBCE6', '#D4A32C', '#5B8C5A', '#8B5CF6', '#EC4899', '#0EA5E9']

export default function MLBDev() {
  const [subPage, setSubPage] = useState<SubPage>('overview')
  const [rankings, setRankings] = useState<RankingRow[] | null>(null)
  const [careerWar, setCareerWar] = useState<CareerWarRow[] | null>(null)

  const load = () => {
    fetchDevRankings().then(setRankings)
    fetchDevCareerWar().then(setCareerWar)
  }
  useEffect(load, [])

  // Global filters — drive every sub-page below.
  const [yearFilter, setYearFilter] = useState<number[]>([])
  const [orgFilter, setOrgFilter] = useState<string[]>([])
  const [positionFilter, setPositionFilter] = useState<string[]>([])
  const [bucketFilter, setBucketFilter] = useState<string[]>([])
  const [playerTypeFilter, setPlayerTypeFilter] = useState<'All' | 'Hitter' | 'Pitcher'>('All')
  const [search, setSearch] = useState('')

  const loading = rankings === null || careerWar === null

  const allRecords = useMemo(() => {
    if (!rankings || !careerWar) return []
    return buildPlayerDevRecords(rankings, careerWar)
  }, [rankings, careerWar])

  const availableYears = useMemo(() => Array.from(new Set((rankings ?? []).map((r) => r.year))).sort((a, b) => b - a), [rankings])
  const availableOrgs = useMemo(() => Array.from(new Set(allRecords.map((r) => r.organization ?? 'UNK'))).sort(), [allRecords])
  const availablePositions = useMemo(
    () => Array.from(new Set(allRecords.map((r) => r.position).filter((p): p is string => !!p))).sort(),
    [allRecords],
  )

  // Year filtering is special: a player's "highest rank" and "years
  // ranked" depend on WHICH years are in scope, so when years are
  // filtered we rebuild records from only the selected years' ranking
  // rows, rather than filtering the already-built records.
  const filteredRecords = useMemo(() => {
    const scopedRankings = yearFilter.length ? (rankings ?? []).filter((r) => yearFilter.includes(r.year)) : rankings ?? []
    const records = yearFilter.length ? buildPlayerDevRecords(scopedRankings, careerWar ?? []) : allRecords

    return records.filter((r) => {
      if (orgFilter.length && !orgFilter.includes(r.organization ?? 'UNK')) return false
      if (positionFilter.length && !positionFilter.includes(r.position ?? '')) return false
      if (bucketFilter.length && !bucketFilter.includes(r.rankBucket)) return false
      if (playerTypeFilter !== 'All' && r.playerType !== playerTypeFilter) return false
      if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [allRecords, rankings, careerWar, yearFilter, orgFilter, positionFilter, bucketFilter, playerTypeFilter, search])

  const orgSummaries = useMemo(() => summarizeByOrg(filteredRecords), [filteredRecords])

  const hasAnyData = (rankings?.length ?? 0) > 0 || (careerWar?.length ?? 0) > 0

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-navy-900 sm:text-xl">MLB Dev</h2>
        <p className="text-xs text-navy-900/50 sm:text-sm">
          League-wide player development analytics — how well every organization turns Top 100
          prospects into MLB value, relative to expectation.
        </p>
      </div>

      {/* Sub-page nav */}
      <div className="flex flex-wrap gap-1.5">
        {SUB_PAGES.map((p) => (
          <button key={p.id} onClick={() => setSubPage(p.id)} className="pill-button" data-active={subPage === p.id}>
            {p.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-navy-900/40">
          <Loader2 size={16} className="animate-spin" /> Loading…
        </div>
      ) : !hasAnyData && subPage !== 'upload' && subPage !== 'methodology' ? (
        <EmptyState
          title="No data uploaded yet"
          detail="Head to the Upload sub-tab here and drop in FanGraphs' Preseason Top 100 lists and Career fWAR sheets to populate this."
        />
      ) : (
        <>
          {subPage !== 'methodology' && subPage !== 'upload' && (
            <GlobalFilters
              availableYears={availableYears}
              availableOrgs={availableOrgs}
              availablePositions={availablePositions}
              yearFilter={yearFilter}
              setYearFilter={setYearFilter}
              orgFilter={orgFilter}
              setOrgFilter={setOrgFilter}
              positionFilter={positionFilter}
              setPositionFilter={setPositionFilter}
              bucketFilter={bucketFilter}
              setBucketFilter={setBucketFilter}
              playerTypeFilter={playerTypeFilter}
              setPlayerTypeFilter={setPlayerTypeFilter}
              search={search}
              setSearch={setSearch}
            />
          )}

          {subPage === 'overview' && <OverviewPage records={filteredRecords} orgSummaries={orgSummaries} />}
          {subPage === 'organizations' && <OrganizationsPage orgSummaries={orgSummaries} records={filteredRecords} />}
          {subPage === 'players' && <PlayersPage records={filteredRecords} />}
          {subPage === 'development' && <DevelopmentPage records={filteredRecords} orgSummaries={orgSummaries} />}
          {subPage === 'rankings' && <RankingsPage records={filteredRecords} />}
          {subPage === 'methodology' && <MethodologyPage />}
          {subPage === 'upload' && <UploadPage onUploaded={load} />}
        </>
      )}
    </div>
  )
}

// =====================================================================
// Global filter bar
// =====================================================================

function GlobalFilters({
  availableYears,
  availableOrgs,
  availablePositions,
  yearFilter,
  setYearFilter,
  orgFilter,
  setOrgFilter,
  positionFilter,
  setPositionFilter,
  bucketFilter,
  setBucketFilter,
  playerTypeFilter,
  setPlayerTypeFilter,
  search,
  setSearch,
}: {
  availableYears: number[]
  availableOrgs: string[]
  availablePositions: string[]
  yearFilter: number[]
  setYearFilter: (v: number[]) => void
  orgFilter: string[]
  setOrgFilter: (v: string[]) => void
  positionFilter: string[]
  setPositionFilter: (v: string[]) => void
  bucketFilter: string[]
  setBucketFilter: (v: string[]) => void
  playerTypeFilter: 'All' | 'Hitter' | 'Pitcher'
  setPlayerTypeFilter: (v: 'All' | 'Hitter' | 'Pitcher') => void
  search: string
  setSearch: (v: string) => void
}) {
  return (
    <div className="card flex flex-wrap items-center gap-2 p-3 sm:p-4">
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search player…"
        className="min-w-[140px] flex-1 rounded-full border border-navy-950/10 px-3 py-1.5 text-xs sm:max-w-[200px]"
      />
      <MultiSelectFilter label="Year" options={availableYears.map(String)} selected={yearFilter.map(String)} onChange={(v) => setYearFilter(v.map(Number))} />
      <MultiSelectFilter label="Org" options={availableOrgs} selected={orgFilter} onChange={setOrgFilter} />
      <MultiSelectFilter label="Position" options={availablePositions} selected={positionFilter} onChange={setPositionFilter} />
      <MultiSelectFilter label="Rank Bucket" options={[...RANK_BUCKETS]} selected={bucketFilter} onChange={setBucketFilter} />
      <div className="flex overflow-hidden rounded-full border border-navy-950/10">
        {(['All', 'Hitter', 'Pitcher'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setPlayerTypeFilter(t)}
            className={`px-3 py-1.5 text-xs font-semibold transition ${playerTypeFilter === t ? 'bg-navy text-white' : 'bg-white text-navy-800'}`}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  )
}

// =====================================================================
// Overview
// =====================================================================

function OverviewPage({ records, orgSummaries }: { records: PlayerDevRecord[]; orgSummaries: OrgSummary[] }) {
  const totalWar = records.reduce((s, r) => s + r.careerFwar, 0)
  const totalXwar = records.reduce((s, r) => s + r.careerXwar, 0)
  const avgDevIndex = totalXwar !== 0 ? totalWar / totalXwar : null
  const positiveRate = records.length ? records.filter((r) => r.careerFwar > 0).length / records.length : 0

  const topSurplus = [...orgSummaries].sort((a, b) => b.developmentSurplus - a.developmentSurplus).slice(0, 10)
  const topWar = [...orgSummaries].sort((a, b) => b.totalWar - a.totalWar).slice(0, 10)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <KpiCard label="Prospects" value={records.length} />
        <KpiCard label="Total fWAR" value={totalWar.toFixed(1)} />
        <KpiCard label="Total xWAR" value={totalXwar.toFixed(1)} />
        <KpiCard label="Avg Dev Index" value={avgDevIndex != null ? avgDevIndex.toFixed(2) : '—'} />
        <KpiCard label="Positive WAR Rate" value={`${(positiveRate * 100).toFixed(0)}%`} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DownloadableCard title="Top 10 Orgs — Development Surplus" subtitle="Career fWAR minus expected" filename="mlbdev-top-surplus">
          <div className="h-72 p-3 sm:p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topSurplus} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#13274F11" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="organization" tick={{ fontSize: 11 }} width={45} />
                <Tooltip formatter={(v: number) => v.toFixed(1)} />
                <Bar dataKey="developmentSurplus" name="Surplus" radius={[0, 4, 4, 0]}>
                  {topSurplus.map((entry, i) => (
                    <Cell key={i} fill={entry.developmentSurplus >= 0 ? '#5B8C5A' : '#CE1141'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </DownloadableCard>

        <DownloadableCard title="Top 10 Orgs — Total fWAR" subtitle="Raw accumulated value" filename="mlbdev-top-war">
          <div className="h-72 p-3 sm:p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topWar} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#13274F11" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="organization" tick={{ fontSize: 11 }} width={45} />
                <Tooltip formatter={(v: number) => v.toFixed(1)} />
                <Bar dataKey="totalWar" name="Total fWAR" radius={[0, 4, 4, 0]}>
                  {topWar.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </DownloadableCard>
      </div>
    </div>
  )
}

function KpiCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card p-3 text-center">
      <div className="truncate text-[10px] uppercase tracking-wide text-navy-900/45">{label}</div>
      <div className="font-display text-lg font-semibold text-navy-950">{value}</div>
    </div>
  )
}

// =====================================================================
// Organizations
// =====================================================================

function OrganizationsPage({ orgSummaries, records }: { orgSummaries: OrgSummary[]; records: PlayerDevRecord[] }) {
  const [sortKey, setSortKey] = useState<keyof OrgSummary>('totalWar')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [drilldown, setDrilldown] = useState<string | null>(null)

  const sorted = useMemo(() => {
    return [...orgSummaries].sort((a, b) => {
      const av = a[sortKey] ?? -Infinity
      const bv = b[sortKey] ?? -Infinity
      return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number)
    })
  }, [orgSummaries, sortKey, sortDir])

  const toggleSort = (key: keyof OrgSummary) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const cols: { key: keyof OrgSummary; label: string; fmt?: (v: any) => string }[] = [
    { key: 'organization', label: 'Org' },
    { key: 'prospectCount', label: 'Prospects' },
    { key: 'totalWar', label: 'Total WAR', fmt: (v) => v.toFixed(1) },
    { key: 'totalXwar', label: 'Total xWAR', fmt: (v) => v.toFixed(1) },
    { key: 'developmentSurplus', label: 'Surplus', fmt: (v) => v.toFixed(1) },
    { key: 'developmentIndex', label: 'Dev Index', fmt: (v) => (v == null ? '—' : v.toFixed(2)) },
    { key: 'avgWar', label: 'Avg WAR', fmt: (v) => v.toFixed(1) },
    { key: 'medianWar', label: 'Median WAR', fmt: (v) => v.toFixed(1) },
    { key: 'positiveWarRate', label: 'Positive%', fmt: (v) => `${(v * 100).toFixed(0)}%` },
    { key: 'rate2Plus', label: '2+ WAR%', fmt: (v) => `${(v * 100).toFixed(0)}%` },
    { key: 'rate5Plus', label: '5+ WAR%', fmt: (v) => `${(v * 100).toFixed(0)}%` },
    { key: 'rate10Plus', label: '10+ WAR%', fmt: (v) => `${(v * 100).toFixed(0)}%` },
    { key: 'rate20Plus', label: '20+ WAR%', fmt: (v) => `${(v * 100).toFixed(0)}%` },
  ]

  const drilldownPlayers = drilldown ? records.filter((r) => r.organization === drilldown).sort((a, b) => b.careerFwar - a.careerFwar) : []

  return (
    <div className="space-y-3">
      <DownloadableCard title="Organization Report Cards" subtitle={`${sorted.length} orgs · click a row to drill down`} filename="mlbdev-organizations">
        <div className="flex items-center justify-end p-2">
          <ExportCsvButton filename="mlbdev-organizations.csv" rows={sorted} columns={cols.map((c) => ({ key: c.key as string, label: c.label }))} />
        </div>
        <div className="max-h-[60vh] overflow-auto">
          <table className="stat-table">
            <thead>
              <tr>
                {cols.map((c) => (
                  <th key={String(c.key)}>
                    <button onClick={() => toggleSort(c.key)} className="inline-flex items-center gap-1">
                      {c.label}
                      {sortKey === c.key ? sortDir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} /> : <ArrowUpDown size={10} className="opacity-30" />}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => (
                <tr key={row.organization} onClick={() => setDrilldown(drilldown === row.organization ? null : row.organization)} className="cursor-pointer hover:bg-brave-cream">
                  {cols.map((c) => (
                    <td key={String(c.key)}>{c.fmt ? c.fmt(row[c.key]) : String(row[c.key])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DownloadableCard>

      {drilldown && (
        <DownloadableCard title={`${drilldown} — Players`} subtitle={`${drilldownPlayers.length} prospects`} filename={`mlbdev-${drilldown}-players`}>
          <div className="max-h-96 overflow-auto">
            <table className="stat-table">
              <thead>
                <tr>
                  <th className="text-left">Name</th>
                  <th>Pos</th>
                  <th>Highest Rank</th>
                  <th>Years Ranked</th>
                  <th>MLB Seasons</th>
                  <th>fWAR</th>
                  <th>xWAR</th>
                  <th>Surplus</th>
                </tr>
              </thead>
              <tbody>
                {drilldownPlayers.map((p) => (
                  <tr key={p.name}>
                    <td className="text-left">{p.name}</td>
                    <td>{p.position ?? '—'}</td>
                    <td>{p.highestRank === Infinity ? 'NR' : p.highestRank}</td>
                    <td>{p.yearsRanked.join(', ')}</td>
                    <td>{p.mlbSeasons}</td>
                    <td>{p.careerFwar.toFixed(1)}</td>
                    <td>{p.careerXwar.toFixed(1)}</td>
                    <td>{p.developmentSurplus.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DownloadableCard>
      )}
    </div>
  )
}

// =====================================================================
// Players
// =====================================================================

function PlayersPage({ records }: { records: PlayerDevRecord[] }) {
  const [sortKey, setSortKey] = useState<string>('careerFwar')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const sorted = useMemo(() => {
    return [...records].sort((a: any, b: any) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      return sortDir === 'asc' ? av - bv : bv - av
    })
  }, [records, sortKey, sortDir])

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const cols: { key: string; label: string; fmt?: (v: any) => string }[] = [
    { key: 'name', label: 'Name' },
    { key: 'position', label: 'Pos', fmt: (v) => v ?? '—' },
    { key: 'organization', label: 'Org' },
    { key: 'highestRank', label: 'Highest Rank', fmt: (v) => (v === Infinity ? 'NR' : v) },
    { key: 'rankBucket', label: 'Bucket' },
    { key: 'mlbSeasons', label: 'MLB Seasons' },
    { key: 'careerFwar', label: 'fWAR', fmt: (v) => v.toFixed(1) },
    { key: 'careerXwar', label: 'xWAR', fmt: (v) => v.toFixed(1) },
    { key: 'developmentSurplus', label: 'Surplus', fmt: (v) => v.toFixed(1) },
    { key: 'developmentIndex', label: 'Dev Index', fmt: (v) => (v == null ? '—' : v.toFixed(2)) },
  ]

  if (records.length === 0) {
    return <EmptyState title="No players match these filters" detail="Try clearing some filters above." />
  }

  return (
    <DownloadableCard title="Player Explorer" subtitle={`${sorted.length} players`} filename="mlbdev-players">
      <div className="flex items-center justify-end p-2">
        <ExportCsvButton filename="mlbdev-players.csv" rows={sorted} columns={cols.map((c) => ({ key: c.key, label: c.label }))} />
      </div>
      <div className="max-h-[70vh] overflow-auto">
        <table className="stat-table">
          <thead>
            <tr>
              {cols.map((c) => (
                <th key={c.key}>
                  <button onClick={() => toggleSort(c.key)} className="inline-flex items-center gap-1">
                    {c.label}
                    {sortKey === c.key ? sortDir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} /> : <ArrowUpDown size={10} className="opacity-30" />}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row: any) => (
              <tr key={row.name}>
                {cols.map((c) => (
                  <td key={c.key} className={c.key === 'name' ? 'text-left' : ''}>
                    {c.fmt ? c.fmt(row[c.key]) : row[c.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DownloadableCard>
  )
}

// =====================================================================
// Development — the 5 scatter plots from the spec
// =====================================================================

function DevelopmentPage({ records, orgSummaries }: { records: PlayerDevRecord[]; orgSummaries: OrgSummary[] }) {
  const orgData = orgSummaries.map((o) => ({ ...o, avgRank: avgHighestRank(records.filter((r) => r.organization === o.organization)) }))
  const playerData = records.filter((r) => Number.isFinite(r.highestRank)).map((r) => ({ ...r, x: r.careerXwar, y: r.careerFwar }))

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <ScatterCard title="xWAR vs Actual WAR" subtitle="Player-level · dashed line = expectation met" filename="mlbdev-scatter-xwar-actual">
        <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#13274F11" />
          <XAxis type="number" dataKey="x" name="xWAR" tick={{ fontSize: 11 }} />
          <YAxis type="number" dataKey="y" name="fWAR" tick={{ fontSize: 11 }} />
          <Tooltip cursor={{ strokeDasharray: '3 3' }} content={<PlayerScatterTooltip />} />
          <Scatter data={playerData} fill="#CE1141" fillOpacity={0.6} />
        </ScatterChart>
      </ScatterCard>

      <ScatterCard title="Prospect Count vs Average WAR" subtitle="Org-level" filename="mlbdev-scatter-count-avgwar">
        <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#13274F11" />
          <XAxis type="number" dataKey="prospectCount" name="Prospects" tick={{ fontSize: 11 }} />
          <YAxis type="number" dataKey="avgWar" name="Avg WAR" tick={{ fontSize: 11 }} />
          <Tooltip cursor={{ strokeDasharray: '3 3' }} content={<OrgScatterTooltip />} />
          <Scatter data={orgData} fill="#13274F" fillOpacity={0.7} />
        </ScatterChart>
      </ScatterCard>

      <ScatterCard title="Prospect Count vs Development Surplus" subtitle="Org-level" filename="mlbdev-scatter-count-surplus">
        <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#13274F11" />
          <XAxis type="number" dataKey="prospectCount" name="Prospects" tick={{ fontSize: 11 }} />
          <YAxis type="number" dataKey="developmentSurplus" name="Surplus" tick={{ fontSize: 11 }} />
          <Tooltip cursor={{ strokeDasharray: '3 3' }} content={<OrgScatterTooltip />} />
          <Scatter data={orgData} fill="#5B8C5A" fillOpacity={0.7} />
        </ScatterChart>
      </ScatterCard>

      <ScatterCard title="Average Rank vs Development Index" subtitle="Org-level · lower avg rank = more elite talent" filename="mlbdev-scatter-rank-index">
        <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#13274F11" />
          <XAxis type="number" dataKey="avgRank" name="Avg Rank" reversed tick={{ fontSize: 11 }} />
          <YAxis type="number" dataKey="developmentIndex" name="Dev Index" tick={{ fontSize: 11 }} />
          <Tooltip cursor={{ strokeDasharray: '3 3' }} content={<OrgScatterTooltip />} />
          <Scatter data={orgData.filter((o) => o.developmentIndex != null)} fill="#D4A32C" fillOpacity={0.7} />
        </ScatterChart>
      </ScatterCard>

      <ScatterCard title="Average Rank vs Development Surplus" subtitle="Org-level" filename="mlbdev-scatter-rank-surplus">
        <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#13274F11" />
          <XAxis type="number" dataKey="avgRank" name="Avg Rank" reversed tick={{ fontSize: 11 }} />
          <YAxis type="number" dataKey="developmentSurplus" name="Surplus" tick={{ fontSize: 11 }} />
          <Tooltip cursor={{ strokeDasharray: '3 3' }} content={<OrgScatterTooltip />} />
          <Scatter data={orgData} fill="#8B5CF6" fillOpacity={0.7} />
        </ScatterChart>
      </ScatterCard>
    </div>
  )
}

function avgHighestRank(records: PlayerDevRecord[]) {
  const finite = records.map((r) => r.highestRank).filter((r) => Number.isFinite(r))
  if (finite.length === 0) return 0
  return finite.reduce((s, r) => s + r, 0) / finite.length
}

function ScatterCard({ title, subtitle, filename, children }: { title: string; subtitle: string; filename: string; children: React.ReactElement }) {
  return (
    <DownloadableCard title={title} subtitle={subtitle} filename={filename}>
      <div className="h-72 p-3 sm:p-4">
        <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
      </div>
    </DownloadableCard>
  )
}

function PlayerScatterTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="rounded-md border border-navy-950/10 bg-white px-2.5 py-1.5 text-xs shadow-lg">
      <div className="font-semibold text-navy-950">{p.name}</div>
      <div className="text-navy-900/60">
        fWAR {p.careerFwar.toFixed(1)} · xWAR {p.careerXwar.toFixed(1)}
      </div>
    </div>
  )
}

function OrgScatterTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const o = payload[0].payload
  return (
    <div className="rounded-md border border-navy-950/10 bg-white px-2.5 py-1.5 text-xs shadow-lg">
      <div className="font-semibold text-navy-950">{o.organization}</div>
      <div className="text-navy-900/60">{o.prospectCount} prospects</div>
    </div>
  )
}

// =====================================================================
// Rankings — performance by rank bucket
// =====================================================================

function RankingsPage({ records }: { records: PlayerDevRecord[] }) {
  const byBucket = useMemo(() => {
    return RANK_BUCKETS.map((bucket) => {
      const players = records.filter((r) => r.rankBucket === bucket)
      const totalWar = players.reduce((s, p) => s + p.careerFwar, 0)
      const totalXwar = players.reduce((s, p) => s + p.careerXwar, 0)
      return {
        bucket,
        count: players.length,
        avgWar: players.length ? totalWar / players.length : 0,
        totalWar,
        totalXwar,
        developmentIndex: totalXwar !== 0 ? totalWar / totalXwar : null,
        positiveRate: players.length ? players.filter((p) => p.careerFwar > 0).length / players.length : 0,
      }
    })
  }, [records])

  return (
    <div className="space-y-4">
      <DownloadableCard title="Performance by Rank Bucket" subtitle="How well each tier of prospect actually hit" filename="mlbdev-rankings">
        <div className="h-72 p-3 sm:p-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byBucket}>
              <CartesianGrid strokeDasharray="3 3" stroke="#13274F11" />
              <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => v.toFixed(2)} />
              <Bar dataKey="avgWar" name="Avg WAR" radius={[4, 4, 0, 0]}>
                {byBucket.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </DownloadableCard>

      <DownloadableCard title="Rank Bucket Summary Table" subtitle={`${records.length} players`} filename="mlbdev-rank-bucket-table">
        <div className="overflow-x-auto">
          <table className="stat-table">
            <thead>
              <tr>
                <th>Bucket</th>
                <th>Count</th>
                <th>Avg WAR</th>
                <th>Total WAR</th>
                <th>Total xWAR</th>
                <th>Dev Index</th>
                <th>Positive WAR%</th>
              </tr>
            </thead>
            <tbody>
              {byBucket.map((b) => (
                <tr key={b.bucket}>
                  <td>{b.bucket}</td>
                  <td>{b.count}</td>
                  <td>{b.avgWar.toFixed(2)}</td>
                  <td>{b.totalWar.toFixed(1)}</td>
                  <td>{b.totalXwar.toFixed(1)}</td>
                  <td>{b.developmentIndex == null ? '—' : b.developmentIndex.toFixed(2)}</td>
                  <td>{(b.positiveRate * 100).toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DownloadableCard>
    </div>
  )
}

// =====================================================================
// Methodology — static reference
// =====================================================================

function MethodologyPage() {
  return (
    <div className="card space-y-4 p-4 text-sm text-navy-900/80 sm:p-6">
      <section>
        <h3 className="mb-1 font-semibold text-navy-950">Annual xWAR (by highest Top 100 rank ever achieved)</h3>
        <table className="stat-table max-w-sm">
          <thead>
            <tr><th className="text-left">Rank</th><th>Annual xWAR</th></tr>
          </thead>
          <tbody>
            <tr><td className="text-left">1–10</td><td>4.0</td></tr>
            <tr><td className="text-left">11–25</td><td>3.5</td></tr>
            <tr><td className="text-left">26–50</td><td>3.0</td></tr>
            <tr><td className="text-left">51–100</td><td>2.5</td></tr>
            <tr><td className="text-left">NR (never ranked)</td><td>1.0</td></tr>
          </tbody>
        </table>
      </section>
      <section>
        <h3 className="mb-1 font-semibold text-navy-950">Derived formulas</h3>
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>Career xWAR</strong> = Annual xWAR × MLB Seasons (any MLB appearance counts as a season)</li>
          <li><strong>Development Surplus</strong> = Career fWAR − Career xWAR</li>
          <li><strong>Development Index</strong> = Career fWAR ÷ Career xWAR</li>
        </ul>
      </section>
      <section>
        <h3 className="mb-1 font-semibold text-navy-950">Data cleaning</h3>
        <p>
          Player names are normalized to merge spelling variations and suffixes. A player's
          "highest rank" is the best (lowest-numbered) rank they ever achieved across every year
          uploaded. Organization abbreviations are normalized for franchise moves/renames since
          2018: LA→LAD, OAK→ATH, SD→SDP, TB→TBR, WSN→WAS.
        </p>
      </section>
      <section>
        <h3 className="mb-1 font-semibold text-navy-950">Sources</h3>
        <p>FanGraphs Preseason Top 100 Prospect Lists (2018 onward) and FanGraphs Hitter/Pitcher Career fWAR leaderboards, uploaded via the Upload sub-tab here.</p>
      </section>
    </div>
  )
}

// =====================================================================
// Upload
// =====================================================================

function UploadPage({ onUploaded }: { onUploaded: () => void }) {
  return (
    <div className="space-y-4">
      <RankingsUpload onUploaded={onUploaded} />
      <DebutUpload onUploaded={onUploaded} />
      <CareerWarUpload playerType="Hitter" onUploaded={onUploaded} />
      <CareerWarUpload playerType="Pitcher" onUploaded={onUploaded} />
    </div>
  )
}

function findHeader(headers: string[], candidates: string[]): string | undefined {
  return headers.find((h) => candidates.some((c) => c.trim().toLowerCase() === h.trim().toLowerCase()))
}

function RankingsUpload({ onUploaded }: { onUploaded: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<'idle' | 'working' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  const handleFiles = async (files: FileList) => {
    setStatus('working')
    let totalRows = 0
    try {
      for (const file of Array.from(files)) {
        const yearFromName = extractYearFromFilename(file.name)
        const parsed = await new Promise<Papa.ParseResult<any>>((resolve) => Papa.parse(file, { header: true, skipEmptyLines: true, complete: resolve }))
        const headers = parsed.meta.fields ?? []
        const nameKey = findHeader(headers, ['Name', 'Player'])
        const rankKey = findHeader(headers, ['Rank', '#'])
        const posKey = findHeader(headers, ['Pos', 'Position'])
        const orgKey = findHeader(headers, ['Org', 'Team', 'Organization'])
        const yearKey = findHeader(headers, ['Year', 'Season'])

        if (!nameKey || !rankKey) {
          throw new Error(`${file.name}: couldn't find Name/Rank columns. Found: ${headers.join(', ')}`)
        }

        const rows = (parsed.data as any[])
          .map((r) => ({
            year: (yearKey ? Number(r[yearKey]) : yearFromName) as number | null,
            rank: Number(r[rankKey]),
            name: String(r[nameKey] ?? '').trim(),
            position: posKey ? String(r[posKey] ?? '').trim() || null : null,
            organization: normalizeOrg(orgKey ? r[orgKey] : null),
          }))
          .filter((r): r is { year: number; rank: number; name: string; position: string | null; organization: string } => !!(r.name && r.year && !Number.isNaN(r.rank)))

        if (rows.length === 0) continue
        const { error } = await upsertDevRankings(rows)
        if (error) throw error
        totalRows += rows.length
      }
      cacheClear()
      setStatus('success')
      setMessage(`Uploaded ${totalRows} ranking rows.`)
      onUploaded()
    } catch (e: any) {
      setStatus('error')
      setMessage(e.message ?? 'Upload failed')
    }
  }

  return (
    <div className="card border-l-4 border-brave-gold p-3.5 sm:p-4">
      <h3 className="mb-1 text-sm font-semibold text-navy-950 sm:text-base">Preseason Top 100 Lists</h3>
      <p className="mb-3 text-[11px] text-navy-900/50 sm:text-xs">
        One combined CSV covering every year (2018 onward) works fine — just needs a Year/Season
        column so each row's year is known. Needs Name and Rank at minimum; Position and Org/Team
        if available. Only each player's single best (lowest-numbered) rank across every year gets
        used — uploading every year they appeared is fine, that's handled automatically. If a file
        has no Year/Season column, it falls back to a year in the filename instead (e.g.
        "2019_top100.csv").
      </p>
      <input ref={inputRef} type="file" accept=".csv" multiple className="hidden" onChange={(e) => e.target.files && handleFiles(e.target.files)} />
      <button onClick={() => inputRef.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-navy-950/15 py-3 text-xs font-medium text-navy-900/60 hover:border-brave-gold hover:text-navy-900">
        <UploadCloud size={16} /> Select Top 100 CSV(s)
      </button>
      <UploadStatus status={status} message={message} />
    </div>
  )
}

function DebutUpload({ onUploaded }: { onUploaded: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<'idle' | 'working' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  const handleFile = async (file: File) => {
    setStatus('working')
    try {
      const parsed = await new Promise<Papa.ParseResult<any>>((resolve) => Papa.parse(file, { header: true, skipEmptyLines: true, complete: resolve }))
      const headers = parsed.meta.fields ?? []
      const nameKey = findHeader(headers, ['Name', 'Player'])
      const debutSeasonKey = findHeader(headers, ['Debut Season', 'Debut Year', 'Debut', 'MLB Debut'])
      const debutTeamKey = findHeader(headers, ['Debut Team', 'Team', 'Org', 'Organization'])

      if (!nameKey || !debutSeasonKey) {
        throw new Error(`Couldn't find Name/Debut Season columns. Found: ${headers.join(', ')}`)
      }

      const rows = (parsed.data as any[])
        .map((r) => ({
          name: String(r[nameKey] ?? '').trim(),
          debutSeason: Number(String(r[debutSeasonKey] ?? '').slice(0, 4)), // handles a full date like "2021-06-14" or just a year
          debutTeam: debutTeamKey ? normalizeOrg(r[debutTeamKey]) : null,
        }))
        .filter((r) => r.name && !Number.isNaN(r.debutSeason))

      const { error } = await upsertDevDebuts(rows)
      if (error) throw error
      cacheClear()
      setStatus('success')
      setMessage(`Uploaded debut info for ${rows.length} players.`)
      onUploaded()
    } catch (e: any) {
      setStatus('error')
      setMessage(e.message ?? 'Upload failed')
    }
  }

  return (
    <div className="card border-l-4 border-brave-sky p-3.5 sm:p-4">
      <h3 className="mb-1 text-sm font-semibold text-navy-950 sm:text-base">Player Debuts</h3>
      <p className="mb-3 text-[11px] text-navy-900/50 sm:text-xs">
        Every player you want accounted for, with their MLB debut season and debut team. Drives
        both MLB Seasons (computed as years since debut) and which org gets development credit —
        debut team takes priority over whichever org had them when they were ranked, since a
        player can get traded before debuting.
      </p>
      <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
      <button onClick={() => inputRef.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-navy-950/15 py-3 text-xs font-medium text-navy-900/60 hover:border-brave-sky hover:text-navy-900">
        <UploadCloud size={16} /> Select Debuts CSV
      </button>
      <UploadStatus status={status} message={message} />
    </div>
  )
}

function CareerWarUpload({ playerType, onUploaded }: { playerType: 'Hitter' | 'Pitcher'; onUploaded: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<'idle' | 'working' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  const handleFile = async (file: File) => {
    setStatus('working')
    try {
      const parsed = await new Promise<Papa.ParseResult<any>>((resolve) => Papa.parse(file, { header: true, skipEmptyLines: true, complete: resolve }))
      const headers = parsed.meta.fields ?? []
      const nameKey = findHeader(headers, ['Name', 'Player'])
      const warKey = findHeader(headers, ['WAR', 'fWAR', 'Career WAR'])
      const seasonsKey = findHeader(headers, ['Seasons', 'Yrs', 'MLB Seasons', 'Years'])
      const orgKey = findHeader(headers, ['Org', 'Team', 'Organization'])

      if (!nameKey || !warKey) {
        throw new Error(`Couldn't find Name/WAR columns. Found: ${headers.join(', ')}`)
      }

      const rows = (parsed.data as any[])
        .map((r) => ({
          name: String(r[nameKey] ?? '').trim(),
          playerType,
          careerFwar: Number(r[warKey]) || 0,
          mlbSeasons: seasonsKey ? Number(r[seasonsKey]) || 0 : 0,
          organization: orgKey ? normalizeOrg(r[orgKey]) : null,
        }))
        .filter((r) => r.name)

      const { error } = await upsertDevCareerWar(rows)
      if (error) throw error
      cacheClear()
      setStatus('success')
      setMessage(`Uploaded ${rows.length} ${playerType.toLowerCase()} career WAR rows.`)
      onUploaded()
    } catch (e: any) {
      setStatus('error')
      setMessage(e.message ?? 'Upload failed')
    }
  }

  return (
    <div className="card border-l-4 border-navy-600 p-3.5 sm:p-4">
      <h3 className="mb-1 text-sm font-semibold text-navy-950 sm:text-base">{playerType} Career fWAR</h3>
      <p className="mb-3 text-[11px] text-navy-900/50 sm:text-xs">
        FanGraphs {playerType.toLowerCase()} career WAR leaderboard — upload every MLB player here,
        not just former Top 100 prospects. Anyone who shows up here but never made a Top 100 list
        gets bucketed as "NR" automatically, which is exactly how the spec's "all debuted players"
        enhancement works. Needs Name and WAR columns; a Seasons/Yrs column is used as a fallback
        only for players who don't have debut data uploaded (see the Debuts upload above, which is
        more accurate).
      </p>
      <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
      <button onClick={() => inputRef.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-navy-950/15 py-3 text-xs font-medium text-navy-900/60 hover:border-navy-600 hover:text-navy-900">
        <UploadCloud size={16} /> Select {playerType} Career fWAR CSV
      </button>
      <UploadStatus status={status} message={message} />
    </div>
  )
}

function UploadStatus({ status, message }: { status: 'idle' | 'working' | 'success' | 'error'; message: string }) {
  if (status === 'idle') return null
  return (
    <div className={`mt-2 flex items-center gap-1.5 text-xs ${status === 'error' ? 'text-brave-red' : status === 'success' ? 'text-emerald-700' : 'text-navy-900/50'}`}>
      {status === 'working' && <Loader2 size={12} className="animate-spin" />}
      {status === 'success' && <CheckCircle2 size={12} />}
      {status === 'error' && <AlertCircle size={12} />}
      {status === 'working' ? 'Uploading…' : message}
    </div>
  )
}

// =====================================================================
// Shared bits
// =====================================================================

function ExportCsvButton({ filename, rows, columns }: { filename: string; rows: any[]; columns: { key: string; label: string }[] }) {
  const handleExport = () => {
    const header = columns.map((c) => c.label).join(',')
    const body = rows
      .map((r) => columns.map((c) => `"${String(r[c.key] ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([header + '\n' + body], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }
  return (
    <button onClick={handleExport} className="pill-button">
      <Download size={13} /> Export CSV
    </button>
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

function MultiSelectFilter({ label, options, selected, onChange }: { label: string; options: string[]; selected: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  useClickOutside(wrapperRef, () => setOpen(false), open)
  const toggle = (opt: string) => onChange(selected.includes(opt) ? selected.filter((o) => o !== opt) : [...selected, opt])
  return (
    <div className="relative" ref={wrapperRef}>
      <button onClick={() => setOpen((o) => !o)} className="pill-button" data-active={selected.length > 0}>
        {label}
        {selected.length > 0 && <span className="ml-1 rounded-full bg-white/20 px-1.5 text-[10px]">{selected.length}</span>}
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
                <input type="checkbox" checked={selected.includes(opt)} onChange={() => toggle(opt)} className="accent-brave-red" />
                {opt}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

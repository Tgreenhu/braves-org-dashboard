import { useEffect, useMemo, useState } from 'react'
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend, ResponsiveContainer } from 'recharts'
import { Loader2, Inbox, Search, X } from 'lucide-react'
import DownloadableCard from '@/components/shared/DownloadableCard'
import { fetchEligibleProspects, fetchProspectCompPool, type CompPoolHitterRow, type CompPoolPitcherRow } from '@/lib/queries'
import { supabaseConfigured } from '@/lib/supabaseClient'
import { getHitterComps, getPitcherComps, type ProspectComp } from '@/lib/prospectComps'
import type { HitterSeasonStats, PitcherSeasonStats } from '@/types'

const MLB_GAMES_ELIGIBILITY_CAP = 162

export default function ProspectComps() {
  const [eligibleHitters, setEligibleHitters] = useState<HitterSeasonStats[] | null>(null)
  const [eligiblePitchers, setEligiblePitchers] = useState<PitcherSeasonStats[] | null>(null)
  const [compPoolHitters, setCompPoolHitters] = useState<CompPoolHitterRow[]>([])
  const [compPoolPitchers, setCompPoolPitchers] = useState<CompPoolPitcherRow[]>([])
  const [selectedId, setSelectedId] = useState<string>('')

  useEffect(() => {
    fetchEligibleProspects().then(({ hitters, pitchers }) => {
      setEligibleHitters(hitters)
      setEligiblePitchers(pitchers)
      if (hitters.length > 0) setSelectedId(hitters[0].playerId)
      else if (pitchers.length > 0) setSelectedId(pitchers[0].playerId)
    })
    fetchProspectCompPool().then(({ hitters, pitchers }) => {
      setCompPoolHitters(hitters)
      setCompPoolPitchers(pitchers)
    })
  }, [])

  const loading = eligibleHitters === null || eligiblePitchers === null

  const selected = useMemo(() => {
    const h = eligibleHitters?.find((p) => p.playerId === selectedId)
    if (h) return { type: 'Hitter' as const, player: h }
    const p = eligiblePitchers?.find((p) => p.playerId === selectedId)
    if (p) return { type: 'Pitcher' as const, player: p }
    return null
  }, [selectedId, eligibleHitters, eligiblePitchers])

  const comps: ProspectComp[] = useMemo(() => {
    if (!selected) return []
    return selected.type === 'Hitter'
      ? getHitterComps(selected.player as HitterSeasonStats, compPoolHitters)
      : getPitcherComps(selected.player as PitcherSeasonStats, compPoolPitchers)
  }, [selected, compPoolHitters, compPoolPitchers])

  const hasCompPool = compPoolHitters.length > 0 || compPoolPitchers.length > 0

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-navy-900 sm:text-xl">Prospect Comps</h2>
        <p className="text-xs text-navy-900/50 sm:text-sm">
          Players with fewer than {MLB_GAMES_ELIGIBILITY_CAP} career MLB games, matched against a
          historical MiLB pool by a weighted Similarity Score (age-to-level weighted heaviest).
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-navy-900/40">
          <Loader2 size={16} className="animate-spin" /> Loading prospects…
        </div>
      ) : !supabaseConfigured ? (
        <EmptyState
          title="Supabase isn't connected"
          detail="Add your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see .env.example) to see real prospects here."
        />
      ) : (eligibleHitters?.length ?? 0) === 0 && (eligiblePitchers?.length ?? 0) === 0 ? (
        <EmptyState
          title="No eligible prospects yet"
          detail="Upload current-season stats in Tab 6 first — this list is every hitter/pitcher with under 162 career MLB games."
        />
      ) : (
        <>
          {/* Player selector — type-to-search instead of a plain dropdown */}
          <div className="card p-3 sm:p-4">
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-navy-900/50">
              Select a prospect
            </label>
            <ProspectSearch
              hitters={eligibleHitters ?? []}
              pitchers={eligiblePitchers ?? []}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </div>

          {!hasCompPool ? (
            <EmptyState
              title="No comparison pool uploaded yet"
              detail="Head to the Upload tab's 'Prospect Comp Pool' section and drop in league-wide (non-Braves) MiLB leaderboards to build this out."
            />
          ) : (
            selected && (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {comps.map((comp, i) => (
                  <CompCard key={comp.compName} rank={i + 1} playerName={selected.player.name} comp={comp} />
                ))}
              </div>
            )
          )}
        </>
      )}
    </div>
  )
}

function ProspectSearch({
  hitters,
  pitchers,
  selectedId,
  onSelect,
}: {
  hitters: HitterSeasonStats[]
  pitchers: PitcherSeasonStats[]
  selectedId: string
  onSelect: (id: string) => void
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const selectedPlayer =
    hitters.find((h) => h.playerId === selectedId) ?? pitchers.find((p) => p.playerId === selectedId)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    const allHitters = hitters.map((h) => ({ ...h, playerType: 'Hitter' as const }))
    const allPitchers = pitchers.map((p) => ({ ...p, playerType: 'Pitcher' as const }))
    const combined = [...allHitters, ...allPitchers]
    const filtered = q ? combined.filter((p) => p.name.toLowerCase().includes(q)) : combined
    return filtered.slice(0, 8)
  }, [query, hitters, pitchers])

  return (
    <div className="relative sm:max-w-sm">
      <div className="relative">
        <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-navy-950/30" />
        <input
          value={open ? query : selectedPlayer ? `${selectedPlayer.name} — ${selectedPlayer.level} ${selectedPlayer.position}` : query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => {
            setQuery('')
            setOpen(true)
          }}
          placeholder="Type a player's name…"
          className="w-full rounded-lg border border-navy-950/10 py-2 pl-8 pr-7 text-sm"
        />
        {open && (
          <button
            onClick={() => setOpen(false)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-navy-950/30 hover:text-navy-900"
          >
            <X size={14} />
          </button>
        )}
      </div>
      {open && (
        <div className="absolute z-20 mt-1 max-h-64 w-full space-y-0.5 overflow-auto rounded-lg border border-navy-950/10 bg-white p-1.5 shadow-lg">
          {results.length === 0 && <p className="px-2 py-2 text-xs text-navy-900/40">No match.</p>}
          {results.map((p) => (
            <button
              key={p.playerId}
              onClick={() => {
                onSelect(p.playerId)
                setQuery('')
                setOpen(false)
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-brave-cream"
            >
              <span className="min-w-0 flex-1 truncate">
                <span className="font-medium text-navy-950">{p.name}</span>
                <span className="ml-1.5 text-navy-900/45">
                  {p.playerType} · {p.level} {p.position}
                </span>
              </span>
            </button>
          ))}
        </div>
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

function CompCard({
  rank,
  playerName,
  comp,
}: {
  rank: number
  playerName: string
  comp: ProspectComp
}) {
  return (
    <DownloadableCard
      title={`#${rank} Comp — ${comp.compName}`}
      subtitle={`${comp.years} · Similarity ${comp.similarityScore.toFixed(1)}`}
      filename={`prospect-comp-${rank}-${comp.compName}`}
    >
      <div className="p-3 sm:p-4">
        <div className="h-56 w-full sm:h-64">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={comp.radar} outerRadius="75%">
              <PolarGrid stroke="#13274F22" />
              <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10, fill: '#13274F99' }} />
              <PolarRadiusAxis tick={false} axisLine={false} domain={[0, 100]} />
              <Radar name={playerName} dataKey="player" stroke="#CE1141" fill="#CE1141" fillOpacity={0.35} />
              <Radar name={comp.compName} dataKey="comp" stroke="#13274F" fill="#13274F" fillOpacity={0.2} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 rounded-lg bg-brave-cream p-2.5 text-xs leading-relaxed text-navy-900/80">
          {comp.blurb}
        </p>
      </div>
    </DownloadableCard>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend, ResponsiveContainer } from 'recharts'
import { Loader2, Inbox } from 'lucide-react'
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
          {/* Player selector */}
          <div className="card p-3 sm:p-4">
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-navy-900/50">
              Select a prospect
            </label>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full rounded-lg border border-navy-950/10 px-3 py-2 text-sm sm:max-w-sm"
            >
              <optgroup label="Hitters">
                {eligibleHitters?.map((h) => (
                  <option key={h.playerId} value={h.playerId}>
                    {h.name} — {h.level} {h.position}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Pitchers">
                {eligiblePitchers?.map((p) => (
                  <option key={p.playerId} value={p.playerId}>
                    {p.name} — {p.level} {p.position}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          {!hasCompPool ? (
            <EmptyState
              title="No comparison pool built yet"
              detail="This tab compares each prospect against prospect_comp_pool_hitters / prospect_comp_pool_pitchers, which are empty until you populate them — see supabase/schema.sql. There's no CSV upload flow for this yet since it's a one-time historical research exercise rather than a recurring stat pull; happy to build that next if you want it."
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

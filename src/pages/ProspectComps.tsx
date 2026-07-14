import { useMemo, useState } from 'react'
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend, ResponsiveContainer } from 'recharts'
import DownloadableCard from '@/components/shared/DownloadableCard'
import { MOCK_HITTERS, MOCK_PITCHERS, CURRENT_SEASON } from '@/data/mockData'
import { getHitterComps, getPitcherComps, type ProspectComp } from '@/lib/prospectComps'
import type { HitterSeasonStats, PitcherSeasonStats } from '@/types'

const MLB_GAMES_ELIGIBILITY_CAP = 162

export default function ProspectComps() {
  // TODO(supabase): eligible players = every org hitter/pitcher where
  // career mlb_games_career < 162 (any team, any season) — enforce this
  // filter in the SQL view, not just client-side, once real data lands.
  const eligibleHitters = MOCK_HITTERS.filter(
    (h) => h.season === CURRENT_SEASON && h.mlbGamesCareer < MLB_GAMES_ELIGIBILITY_CAP,
  )
  const eligiblePitchers = MOCK_PITCHERS.filter(
    (p) => p.season === CURRENT_SEASON && p.mlbGamesCareer < MLB_GAMES_ELIGIBILITY_CAP,
  )

  const [selectedId, setSelectedId] = useState<string>(eligibleHitters[0]?.playerId ?? '')

  const selected = useMemo(() => {
    const h = eligibleHitters.find((p) => p.playerId === selectedId)
    if (h) return { type: 'Hitter' as const, player: h }
    const p = eligiblePitchers.find((p) => p.playerId === selectedId)
    if (p) return { type: 'Pitcher' as const, player: p }
    return null
  }, [selectedId, eligibleHitters, eligiblePitchers])

  const comps: ProspectComp[] = useMemo(() => {
    if (!selected) return []
    return selected.type === 'Hitter'
      ? getHitterComps(selected.player as HitterSeasonStats)
      : getPitcherComps(selected.player as PitcherSeasonStats)
  }, [selected])

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-navy-900 sm:text-xl">Prospect Comps</h2>
        <p className="text-xs text-navy-900/50 sm:text-sm">
          Players with fewer than {MLB_GAMES_ELIGIBILITY_CAP} career MLB games, matched against a
          historical MiLB pool by a weighted Similarity Score (age-to-level weighted heaviest).
        </p>
      </div>

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
            {eligibleHitters.map((h) => (
              <option key={h.playerId} value={h.playerId}>
                {h.name} — {h.level} {h.position}
              </option>
            ))}
          </optgroup>
          <optgroup label="Pitchers">
            {eligiblePitchers.map((p) => (
              <option key={p.playerId} value={p.playerId}>
                {p.name} — {p.level} {p.position}
              </option>
            ))}
          </optgroup>
        </select>
      </div>

      {selected && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {comps.map((comp, i) => (
            <CompCard key={comp.compName} rank={i + 1} playerName={selected.player.name} comp={comp} />
          ))}
        </div>
      )}
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

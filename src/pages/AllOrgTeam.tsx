import { useEffect, useState } from 'react'
import { Loader2, Inbox } from 'lucide-react'
import DownloadableCard from '@/components/shared/DownloadableCard'
import { fetchHitters, fetchPitchers } from '@/lib/queries'
import { supabaseConfigured } from '@/lib/supabaseClient'
import { CURRENT_SEASON } from '@/lib/constants'
import { buildAllOrgTeams, primaryPosition, OUTFIELD_POS, type OrgTeam, type OrgTeamSlot } from '@/lib/allOrgTeam'
import type { HitterSeasonStats, PitcherSeasonStats } from '@/types'

const TEAM_LABEL = { 1: 'First Team', 2: 'Second Team', 3: 'Third Team' } as const
const TEAM_ACCENT = { 1: 'border-brave-gold', 2: 'border-navy-600', 3: 'border-brave-sky' } as const

const MIN_PA = 60
const MIN_IP = 10.0

function isPitcher(p: HitterSeasonStats | PitcherSeasonStats): p is PitcherSeasonStats {
  return 'ip' in p
}

export default function AllOrgTeam() {
  const [teams, setTeams] = useState<OrgTeam[] | null>(null)
  const [hasAnyData, setHasAnyData] = useState(false)
  const [sampleHitters, setSampleHitters] = useState<HitterSeasonStats[]>([])
  const [poolStats, setPoolStats] = useState<{
    totalHitters: number
    qualifiedHitters: number
    qualifiedOF: number
    totalPitchers: number
    qualifiedPitchers: number
  } | null>(null)

  useEffect(() => {
    Promise.all([fetchHitters([CURRENT_SEASON]), fetchPitchers([CURRENT_SEASON])]).then(
      ([hitters, pitchers]) => {
        setHasAnyData(hitters.length > 0 || pitchers.length > 0)
        setSampleHitters(hitters)

        // Qualified only — minimum 60 PA for hitters, 10.0 IP for pitchers,
        // to filter out tiny-sample-size outliers while still keeping a
        // reasonably deep pool (looser than the earlier per-team-game rate,
        // which was excluding too many legitimate players).
        const qualifiedHitters = hitters.filter((h) => h.pa >= MIN_PA)
        const qualifiedPitchers = pitchers.filter((p) => p.ip >= MIN_IP)

        setPoolStats({
          totalHitters: hitters.length,
          qualifiedHitters: qualifiedHitters.length,
          qualifiedOF: qualifiedHitters.filter((h) => OUTFIELD_POS.has(primaryPosition(h.position))).length,
          totalPitchers: pitchers.length,
          qualifiedPitchers: qualifiedPitchers.length,
        })

        setTeams(buildAllOrgTeams(qualifiedHitters, qualifiedPitchers))
      },
    )
  }, [])

  // If every position-player slot came up empty despite having hitters,
  // something's off with how "position" is being read — show what's
  // actually in the data instead of guessing again.
  const allPositionSlotsEmpty =
    teams !== null &&
    sampleHitters.length > 0 &&
    teams.every((t) => [...t.infielders, ...t.outfielders, t.catcher].every((s) => s.player === null))

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-navy-900 sm:text-xl">All-Organization Teams</h2>
        <p className="text-xs text-navy-900/50 sm:text-sm">
          Qualified players only — minimum {MIN_PA} PA for position players, {MIN_IP.toFixed(1)} IP
          for pitchers — ranked by composite score: wRC+, OPS, OBP/AVG/SLG &amp; BB:K for hitters;
          FIP, SIERA, ERA, WHIP &amp; K:BB for pitchers; plus a level bonus (MLB production counts
          for more than the same line in the low minors) and an age-for-level bonus (young for your
          level beats merely-adequate and old). See <code>src/lib/scoring.ts</code> for the exact
          weighting.
        </p>
      </div>

      {poolStats && hasAnyData && (
        <div className="card p-3 text-xs sm:p-4">
          <p className="mb-1.5 font-semibold text-navy-950">Qualified pool sizes (org-wide, all levels combined)</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-navy-900/70 sm:grid-cols-4">
            <span>Hitters: {poolStats.qualifiedHitters} / {poolStats.totalHitters} qualified</span>
            <span>— of which OF-eligible: {poolStats.qualifiedOF}</span>
            <span>Pitchers: {poolStats.qualifiedPitchers} / {poolStats.totalPitchers} qualified</span>
            <span className="text-navy-900/40">(9 OF / 15 pitcher slots needed for 3 full teams)</span>
          </div>
        </div>
      )}

      {allPositionSlotsEmpty && (
        <div className="card border-l-4 border-brave-gold p-3 text-xs sm:p-4">
          <p className="mb-2 font-semibold text-navy-950">
            Every infield/outfield/catcher slot came up empty even though {sampleHitters.length}{' '}
            hitters were found — that means the "position" field itself is likely blank in the
            database, not a matching bug. Here's what's actually stored for the first 10:
          </p>
          <div className="space-y-0.5 font-mono text-[11px] text-navy-900/70">
            {sampleHitters.slice(0, 10).map((h) => (
              <div key={h.playerId}>
                {h.name}: position="{h.position ?? 'null'}" → reads as "{primaryPosition(h.position) || '(empty)'}"
              </div>
            ))}
          </div>
          <p className="mt-2 text-navy-900/50">
            If these all say "null" or "(empty)", send this to Claude — it means the "Pos" column
            isn't being found in your Fangraphs CSVs and the mapping needs adjusting.
          </p>
        </div>
      )}

      {teams === null ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-navy-900/40">
          <Loader2 size={16} className="animate-spin" /> Loading players…
        </div>
      ) : !supabaseConfigured ? (
        <EmptyState
          title="Supabase isn't connected"
          detail="Add your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see .env.example) to see real teams here."
        />
      ) : !hasAnyData ? (
        <EmptyState
          title="No current-season players uploaded yet"
          detail="Head to the Upload tab and pull in this season's Fangraphs exports first."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {teams.map((team) => (
            <TeamCard key={team.teamNumber} team={team} />
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

function TeamCard({ team }: { team: OrgTeam }) {
  const slots: OrgTeamSlot[] = [
    ...team.infielders,
    ...team.outfielders,
    team.catcher,
    team.dh,
    ...team.pitchers,
  ]

  return (
    <DownloadableCard
      title={TEAM_LABEL[team.teamNumber]}
      subtitle="Position players + top 5 pitchers"
      filename={`braves-all-org-team-${team.teamNumber}`}
      className={`border-t-4 ${TEAM_ACCENT[team.teamNumber]}`}
    >
      <div className="divide-y divide-navy-950/5">
        {slots.map((slot, i) => (
          <SlotRow key={i} slot={slot} />
        ))}
      </div>
    </DownloadableCard>
  )
}

function SlotRow({ slot }: { slot: OrgTeamSlot }) {
  const { player, score } = slot
  return (
    <div className="flex items-center gap-3 px-3 py-2 sm:px-4">
      <span className="w-9 shrink-0 rounded bg-navy px-1.5 py-0.5 text-center text-[10px] font-semibold text-white">
        {slot.slotLabel}
      </span>
      {player ? (
        <>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-navy-950">{player.name}</div>
            <div className="truncate text-[11px] text-navy-900/45">
              {player.level} · {player.team} · Age {player.age}
            </div>
          </div>
          <div className="shrink-0 text-right text-xs text-navy-900/70">
            {isPitcher(player) ? (
              <span>
                {player.era?.toFixed(2) ?? '—'} ERA / {player.fip?.toFixed(2) ?? '—'} FIP
              </span>
            ) : (
              <span>{player.ops?.toFixed(3) ?? '—'} OPS</span>
            )}
            {score !== null && (
              <div className="text-[10px] text-navy-900/40">score {score.toFixed(2)}</div>
            )}
          </div>
        </>
      ) : (
        <div className="flex-1 text-xs italic text-navy-900/30">
          Not enough data yet — upload more stats in Tab 6
        </div>
      )}
    </div>
  )
}

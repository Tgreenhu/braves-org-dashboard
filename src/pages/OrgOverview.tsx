import { useEffect, useState } from 'react'
import { Loader2, Inbox } from 'lucide-react'
import DownloadableCard from '@/components/shared/DownloadableCard'
import { fetchTeamLevelRecords } from '@/lib/queries'
import { supabaseConfigured } from '@/lib/supabaseClient'
import type { TeamLevelRecord } from '@/types'

const LEVEL_COLOR: Record<string, string> = {
  MLB: 'bg-level-mlb',
  AAA: 'bg-level-aaa',
  AA: 'bg-level-aa',
  'High-A': 'bg-level-highA',
  A: 'bg-level-a',
  FCL: 'bg-brave-sky',
  DSL: 'bg-level-dsl',
}

export default function OrgOverview() {
  const [records, setRecords] = useState<TeamLevelRecord[] | null>(null)

  useEffect(() => {
    fetchTeamLevelRecords().then(setRecords)
  }, [])

  return (
    <div className="space-y-4">
      <PageIntro />

      {records === null ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-navy-900/40">
          <Loader2 size={16} className="animate-spin" /> Loading team records…
        </div>
      ) : !supabaseConfigured ? (
        <EmptyState
          title="Supabase isn't connected"
          detail="Add your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see .env.example) to see real records here."
        />
      ) : records.length === 0 ? (
        <EmptyState
          title="No team records yet"
          detail={
            <>
              This tab reads from the <code>team_level_records</code> table, which doesn't have a
              CSV upload flow yet in Tab 6 — win/loss and split data isn't part of Fangraphs'
              standard player leaderboard exports. For now, insert rows directly in the Supabase
              Table Editor (or SQL Editor) matching the columns in{' '}
              <code>supabase/schema.sql</code>. Happy to build a dedicated upload/edit form for
              this table next if you want it.
            </>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {records.map((rec) => (
            <LevelCard key={rec.level} record={rec} />
          ))}
        </div>
      )}
    </div>
  )
}

function PageIntro() {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-lg font-semibold text-navy-900 sm:text-xl">Organization Overview</h2>
        <p className="text-xs text-navy-900/50 sm:text-sm">
          Record, splits, and team stat lines for every affiliate — MLB down to DSL.
        </p>
      </div>
    </div>
  )
}

function EmptyState({ title, detail }: { title: string; detail: React.ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-2 px-6 py-14 text-center">
      <Inbox size={22} className="text-navy-950/20" />
      <p className="text-sm font-medium text-navy-900">{title}</p>
      <p className="max-w-md text-xs text-navy-900/50">{detail}</p>
    </div>
  )
}

function LevelCard({ record }: { record: TeamLevelRecord }) {
  const winPct = record.wins / (record.wins + record.losses || 1)
  const diff = record.runsScored - record.runsAllowed

  return (
    <DownloadableCard
      title={`${record.level} — ${record.teamName}`}
      subtitle={`Updated ${record.updatedAt}`}
      filename={`braves-org-${record.level.toLowerCase()}`}
    >
      <div className="p-3 sm:p-4">
        {/* Record header row */}
        <div className="mb-3 flex items-center gap-3">
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${LEVEL_COLOR[record.level]}`} />
          <div>
            <div className="font-display text-xl font-semibold text-navy-950">
              {record.wins}-{record.losses}
              <span className="ml-1.5 text-xs font-body font-normal text-navy-950/50">
                ({(winPct * 100).toFixed(1)}%)
              </span>
            </div>
          </div>
          <div className="ml-auto text-right">
            <StreakBadge streak={record.streak} />
          </div>
        </div>

        {/* Splits grid */}
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          <MiniStat label="Home" value={`${record.homeWins}-${record.homeLosses}`} />
          <MiniStat label="Away" value={`${record.awayWins}-${record.awayLosses}`} />
          <MiniStat label="L5" value={record.last5} />
          <MiniStat label="L10" value={record.last10} />
          <MiniStat label="L15" value={record.last15} />
          <MiniStat
            label="Diff"
            value={`${diff > 0 ? '+' : ''}${diff}`}
            valueClass={diff >= 0 ? 'text-emerald-600' : 'text-brave-red'}
          />
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <MiniStat label="Runs Scored" value={record.runsScored} />
          <MiniStat label="Runs Allowed" value={record.runsAllowed} />
        </div>

        {/* Slash + pitching line */}
        <div className="mt-3 overflow-x-auto">
          <table className="stat-table">
            <thead>
              <tr>
                <th>Split</th>
                <th>AVG</th>
                <th>OBP</th>
                <th>SLG</th>
                <th>OPS</th>
                <th>ERA</th>
                <th>FIP</th>
                <th>SIERA</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Team</td>
                <td>{record.avg.toFixed(3)}</td>
                <td>{record.obp.toFixed(3)}</td>
                <td>{record.slg.toFixed(3)}</td>
                <td>{record.ops.toFixed(3)}</td>
                <td>{record.era.toFixed(2)}</td>
                <td>{record.fip.toFixed(2)}</td>
                <td>{record.siera.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </DownloadableCard>
  )
}

function MiniStat({
  label,
  value,
  valueClass = 'text-navy-950',
}: {
  label: string
  value: string | number
  valueClass?: string
}) {
  return (
    <div className="rounded-lg bg-brave-cream px-2 py-1.5 text-center">
      <div className="text-[9px] uppercase tracking-wide text-navy-950/45">{label}</div>
      <div className={`font-display text-sm font-semibold ${valueClass}`}>{value}</div>
    </div>
  )
}

function StreakBadge({ streak }: { streak: string }) {
  const isWin = streak.startsWith('W')
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
        isWin ? 'bg-emerald-100 text-emerald-700' : 'bg-brave-red/10 text-brave-red'
      }`}
    >
      {streak}
    </span>
  )
}

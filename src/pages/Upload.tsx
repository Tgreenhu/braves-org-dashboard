import { useRef, useState } from 'react'
import Papa from 'papaparse'
import { ExternalLink, UploadCloud, CheckCircle2, AlertCircle } from 'lucide-react'
import { supabase, supabaseConfigured } from '@/lib/supabaseClient'
import { cacheClear } from '@/lib/cache'

interface UploadSource {
  id: string
  label: string
  fangraphsUrl: string
  supabaseTable: string
}

interface UploadGroup {
  id: string
  title: string
  description: string
  sources: UploadSource[]
}

// TODO(data mapping): Fangraphs' exported CSV column headers won't match
// the Supabase column names 1:1 (e.g. Fangraphs exports "Name", "PA", "wRC+"
// -- schema.sql uses "name", "pa", "wrc_plus"). Each of these reports also
// only carries a slice of a player's full stat line (Standard vs Advanced
// vs Statcast, etc.), so uploading several reports for the same player
// should upsert into the same hitter_stats/pitcher_stats row rather than
// overwrite it. Build that header-mapping + partial-upsert logic in
// handleFile() below before wiring this up for real.
const UPLOAD_GROUPS: UploadGroup[] = [
  {
    id: 'milb-hitters',
    title: 'MiLB Hitters',
    description: 'Braves system minor league hitting leaderboards',
    sources: [
      { id: 'milb-hit-standard', label: 'Standard', supabaseTable: 'hitter_stats', fangraphsUrl: 'https://www.fangraphs.com/leaders/minor-league?pos=all&stats=bat&lg=2%2C4%2C5%2C6%2C7%2C8%2C9%2C10%2C11%2C14%2C12%2C13%2C15%2C16%2C17%2C18%2C30%2C32&qual=0&type=0&season=2026&level=0&team=&seasonEnd=2026&org=16&ind=0&splitTeam=false&startdate=&enddate=' },
      { id: 'milb-hit-advanced', label: 'Advanced', supabaseTable: 'hitter_stats', fangraphsUrl: 'https://www.fangraphs.com/leaders/minor-league?pos=all&stats=bat&lg=2%2C4%2C5%2C6%2C7%2C8%2C9%2C10%2C11%2C14%2C12%2C13%2C15%2C16%2C17%2C18%2C30%2C32&qual=0&type=1&season=2026&level=0&team=&seasonEnd=2026&org=16&ind=0&splitTeam=false&startdate=&enddate=' },
      { id: 'milb-hit-batted', label: 'Batted', supabaseTable: 'hitter_stats', fangraphsUrl: 'https://www.fangraphs.com/leaders/minor-league?pos=all&stats=bat&lg=2%2C4%2C5%2C6%2C7%2C8%2C9%2C10%2C11%2C14%2C12%2C13%2C15%2C16%2C17%2C18%2C30%2C32&qual=0&type=2&season=2026&level=0&team=&seasonEnd=2026&org=16&ind=0&splitTeam=false&startdate=&enddate=' },
    ],
  },
  {
    id: 'milb-pitchers',
    title: 'MiLB Pitchers',
    description: 'Braves system minor league pitching leaderboards',
    sources: [
      { id: 'milb-pit-standard', label: 'Standard', supabaseTable: 'pitcher_stats', fangraphsUrl: 'https://www.fangraphs.com/leaders/minor-league?pos=all&stats=pit&lg=2%2C4%2C5%2C6%2C7%2C8%2C9%2C10%2C11%2C14%2C12%2C13%2C15%2C16%2C17%2C18%2C30%2C32&qual=0&season=2026&level=0&team=&seasonEnd=2026&org=16&ind=0&splitTeam=false&startdate=&enddate=' },
      { id: 'milb-pit-advanced', label: 'Advanced', supabaseTable: 'pitcher_stats', fangraphsUrl: 'https://www.fangraphs.com/leaders/minor-league?pos=all&stats=pit&lg=2%2C4%2C5%2C6%2C7%2C8%2C9%2C10%2C11%2C14%2C12%2C13%2C15%2C16%2C17%2C18%2C30%2C32&qual=0&season=2026&level=0&team=&seasonEnd=2026&org=16&ind=0&splitTeam=false&startdate=&enddate=&type=1' },
      { id: 'milb-pit-batted', label: 'Batted', supabaseTable: 'pitcher_stats', fangraphsUrl: 'https://www.fangraphs.com/leaders/minor-league?pos=all&stats=pit&lg=2%2C4%2C5%2C6%2C7%2C8%2C9%2C10%2C11%2C14%2C12%2C13%2C15%2C16%2C17%2C18%2C30%2C32&qual=0&season=2026&level=0&team=&seasonEnd=2026&org=16&ind=0&splitTeam=false&startdate=&enddate=&type=2' },
    ],
  },
  {
    id: 'mlb-hitters',
    title: 'MLB Hitters',
    description: 'Atlanta Braves major league hitting leaderboards',
    sources: [
      { id: 'mlb-hit-standard', label: 'Standard', supabaseTable: 'hitter_stats', fangraphsUrl: 'https://www.fangraphs.com/leaders/major-league?pos=all&stats=bat&lg=all&type=0&season=2026&season1=2026&ind=0&month=0&qual=0&team=16' },
      { id: 'mlb-hit-batted', label: 'Batted Ball', supabaseTable: 'hitter_stats', fangraphsUrl: 'https://www.fangraphs.com/leaders/major-league?pos=all&stats=bat&lg=all&type=2&season=2026&season1=2026&ind=0&month=0&qual=0&team=16' },
      { id: 'mlb-hit-advanced', label: 'Advanced', supabaseTable: 'hitter_stats', fangraphsUrl: 'https://www.fangraphs.com/leaders/major-league?pos=all&stats=bat&lg=all&type=1&season=2026&season1=2026&ind=0&month=0&qual=0&team=16' },
      { id: 'mlb-hit-statcast', label: 'Statcast', supabaseTable: 'hitter_stats', fangraphsUrl: 'https://www.fangraphs.com/leaders/major-league?pos=all&stats=bat&lg=all&type=24&season=2026&season1=2026&ind=0&month=0&qual=0&team=16' },
      { id: 'mlb-hit-battrack', label: 'Bat Tracking', supabaseTable: 'hitter_stats', fangraphsUrl: 'https://www.fangraphs.com/leaders/major-league?pos=all&stats=bat&lg=all&type=80&season=2026&season1=2026&ind=0&month=0&qual=0&team=16' },
    ],
  },
  {
    id: 'mlb-pitchers',
    title: 'MLB Pitchers',
    description: 'Atlanta Braves major league pitching leaderboards',
    sources: [
      { id: 'mlb-pit-standard', label: 'Standard', supabaseTable: 'pitcher_stats', fangraphsUrl: 'https://www.fangraphs.com/leaders/major-league?pos=all&stats=pit&lg=all&type=0&season=2026&season1=2026&ind=0&qual=0&team=16&startdate=&enddate=&month=0' },
      { id: 'mlb-pit-advanced', label: 'Advanced', supabaseTable: 'pitcher_stats', fangraphsUrl: 'https://www.fangraphs.com/leaders/major-league?pos=all&stats=pit&lg=all&type=1&season=2026&season1=2026&ind=0&qual=0&team=16&startdate=&enddate=&month=0' },
      { id: 'mlb-pit-batted', label: 'Batted Ball', supabaseTable: 'pitcher_stats', fangraphsUrl: 'https://www.fangraphs.com/leaders/major-league?pos=all&stats=pit&lg=all&type=2&season=2026&season1=2026&ind=0&qual=0&team=16&startdate=&enddate=&month=0' },
      { id: 'mlb-pit-statcast', label: 'Statcast', supabaseTable: 'pitcher_stats', fangraphsUrl: 'https://www.fangraphs.com/leaders/major-league?pos=all&stats=pit&lg=all&type=24&season=2026&season1=2026&ind=0&qual=0&team=16&startdate=&enddate=&month=0' },
      { id: 'mlb-pit-battrack', label: 'Bat Tracking', supabaseTable: 'pitcher_stats', fangraphsUrl: 'https://www.fangraphs.com/leaders/major-league?pos=all&stats=pit&lg=all&type=80&season=2026&season1=2026&ind=0&qual=0&team=16&startdate=&enddate=&month=0' },
      { id: 'mlb-pit-pitchpct', label: 'Pitch %', supabaseTable: 'pitcher_stats', fangraphsUrl: 'https://www.fangraphs.com/leaders/major-league?pos=all&stats=pit&lg=all&type=9&season=2026&season1=2026&ind=0&qual=0&team=16&startdate=&enddate=&month=0' },
      { id: 'mlb-pit-velo', label: 'Pitch Velo', supabaseTable: 'pitcher_stats', fangraphsUrl: 'https://www.fangraphs.com/leaders/major-league?pos=all&stats=pit&lg=all&type=10&season=2026&season1=2026&ind=0&qual=0&team=16&startdate=&enddate=&month=0' },
      { id: 'mlb-pit-hmove', label: 'H Movement', supabaseTable: 'pitcher_stats', fangraphsUrl: 'https://www.fangraphs.com/leaders/major-league?pos=all&stats=pit&lg=all&type=11&season=2026&season1=2026&ind=0&qual=0&team=16&startdate=&enddate=&month=0' },
      { id: 'mlb-pit-vmove', label: 'V Movement', supabaseTable: 'pitcher_stats', fangraphsUrl: 'https://www.fangraphs.com/leaders/major-league?pos=all&stats=pit&lg=all&type=12&season=2026&season1=2026&ind=0&qual=0&team=16&startdate=&enddate=&month=0' },
      { id: 'mlb-pit-spin', label: 'Spin', supabaseTable: 'pitcher_stats', fangraphsUrl: 'https://www.fangraphs.com/leaders/major-league?pos=all&stats=pit&lg=all&type=82&season=2026&season1=2026&ind=0&qual=0&team=16&startdate=&enddate=&month=0' },
      { id: 'mlb-pit-stuffplus', label: 'Stuff+', supabaseTable: 'pitcher_stats', fangraphsUrl: 'https://www.fangraphs.com/leaders/major-league?pos=all&stats=pit&lg=all&type=36&season=2026&season1=2026&ind=0&qual=0&team=16&startdate=&enddate=&month=0' },
      { id: 'mlb-pit-locationplus', label: 'Location+', supabaseTable: 'pitcher_stats', fangraphsUrl: 'https://www.fangraphs.com/leaders/major-league?pos=all&stats=pit&lg=all&type=37&season=2026&season1=2026&ind=0&qual=0&team=16&startdate=&enddate=&month=0' },
      { id: 'mlb-pit-pitchingplus', label: 'Pitching+', supabaseTable: 'pitcher_stats', fangraphsUrl: 'https://www.fangraphs.com/leaders/major-league?pos=all&stats=pit&lg=all&type=38&season=2026&season1=2026&ind=0&qual=0&team=16&startdate=&enddate=&month=0' },
    ],
  },
]

type RowStatus = 'idle' | 'parsing' | 'success' | 'error'

export default function Upload() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-navy-900 sm:text-xl">Upload Center</h2>
        <p className="text-xs text-navy-900/50 sm:text-sm">
          Open the Fangraphs export, download the CSV, then drop it here -- it's parsed and pushed
          straight into Supabase so every other tab updates.
        </p>
        {!supabaseConfigured && (
          <p className="mt-1.5 rounded-lg bg-brave-gold/10 px-2.5 py-1.5 text-[11px] text-brave-gold">
            Supabase isn't connected yet (see <code>.env.example</code>), so uploads will parse and
            preview locally but won't be written to the database until you add your project keys.
          </p>
        )}
      </div>

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
          setRowCount(results.data.length)
          if (supabaseConfigured) {
            // TODO: map Fangraphs' column headers to your Supabase schema
            // columns before inserting -- Fangraphs exports don't match 1:1,
            // and each report here only covers part of a player's stat
            // line, so this should be a partial upsert keyed on player_id,
            // not a blind overwrite.
            const { error: upsertError } = await supabase
              .from(source.supabaseTable)
              .upsert(results.data as any[])
            if (upsertError) throw upsertError
          }
          cacheClear() // invalidate cached reads so other tabs re-fetch fresh data
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

      <a href={source.fangraphsUrl} target="_blank" rel="noreferrer" className="pill-button justify-center">
        Open Fangraphs table <ExternalLink size={12} />
      </a>

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

      {status === 'parsing' && <p className="text-[11px] text-navy-900/50">Parsing...</p>}
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

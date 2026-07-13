import { useRef, useState } from 'react'
import Papa from 'papaparse'
import { ExternalLink, UploadCloud, CheckCircle2, AlertCircle } from 'lucide-react'
import { supabase, supabaseConfigured } from '@/lib/supabaseClient'
import { cacheClear } from '@/lib/cache'

interface UploadSource {
  id: string
  label: string
  description: string
  // TODO: paste the exact Fangraphs leaderboard URL for each of these once
  // you've built them (splits, minimums, and columns configured the way you
  // want). Left blank for now so the shell doesn't link anywhere wrong.
  fangraphsUrl: string | null
  supabaseTable: string
}

const UPLOAD_SOURCES: UploadSource[] = [
  { id: 'mlb-hitting', label: 'MLB Hitting', description: 'Team + player hitting leaderboard', fangraphsUrl: null, supabaseTable: 'hitter_stats' },
  { id: 'mlb-pitching', label: 'MLB Pitching', description: 'Team + player pitching leaderboard', fangraphsUrl: null, supabaseTable: 'pitcher_stats' },
  { id: 'aaa-hitting', label: 'AAA Hitting', description: 'Gwinnett Stripers hitting', fangraphsUrl: null, supabaseTable: 'hitter_stats' },
  { id: 'aaa-pitching', label: 'AAA Pitching', description: 'Gwinnett Stripers pitching', fangraphsUrl: null, supabaseTable: 'pitcher_stats' },
  { id: 'aa-hitting', label: 'AA Hitting', description: 'Columbus Clingstones hitting', fangraphsUrl: null, supabaseTable: 'hitter_stats' },
  { id: 'aa-pitching', label: 'AA Pitching', description: 'Columbus Clingstones pitching', fangraphsUrl: null, supabaseTable: 'pitcher_stats' },
  { id: 'higha-hitting', label: 'High-A Hitting', description: 'Rome Emperors hitting', fangraphsUrl: null, supabaseTable: 'hitter_stats' },
  { id: 'higha-pitching', label: 'High-A Pitching', description: 'Rome Emperors pitching', fangraphsUrl: null, supabaseTable: 'pitcher_stats' },
  { id: 'a-hitting', label: 'A Hitting', description: 'Augusta GreenJackets hitting', fangraphsUrl: null, supabaseTable: 'hitter_stats' },
  { id: 'a-pitching', label: 'A Pitching', description: 'Augusta GreenJackets pitching', fangraphsUrl: null, supabaseTable: 'pitcher_stats' },
  { id: 'complex-hitting', label: 'FCL / DSL Hitting', description: 'Complex-level hitting', fangraphsUrl: null, supabaseTable: 'hitter_stats' },
  { id: 'complex-pitching', label: 'FCL / DSL Pitching', description: 'Complex-level pitching', fangraphsUrl: null, supabaseTable: 'pitcher_stats' },
  { id: 'team-records', label: 'Team Records / Standings', description: 'W-L, splits, streaks per level', fangraphsUrl: null, supabaseTable: 'team_level_records' },
]

type RowStatus = 'idle' | 'parsing' | 'success' | 'error'

export default function Upload() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-navy-900 sm:text-xl">Upload Center</h2>
        <p className="text-xs text-navy-900/50 sm:text-sm">
          Open the Fangraphs export, download the CSV, then drop it here — it's parsed and pushed
          straight into Supabase so every other tab updates.
        </p>
        {!supabaseConfigured && (
          <p className="mt-1.5 rounded-lg bg-brave-gold/10 px-2.5 py-1.5 text-[11px] text-brave-gold">
            Supabase isn't connected yet (see <code>.env.example</code>), so uploads will parse and
            preview locally but won't be written to the database until you add your project keys.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {UPLOAD_SOURCES.map((source) => (
          <UploadRow key={source.id} source={source} />
        ))}
      </div>
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
            // columns before inserting — Fangraphs exports don't match 1:1.
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
      <div>
        <h4 className="text-sm font-semibold text-navy-950">{source.label}</h4>
        <p className="text-[11px] text-navy-900/45">{source.description}</p>
      </div>

      {source.fangraphsUrl ? (
        <a
          href={source.fangraphsUrl}
          target="_blank"
          rel="noreferrer"
          className="pill-button justify-center"
        >
          Open Fangraphs table <ExternalLink size={12} />
        </a>
      ) : (
        <span className="pill-button justify-center cursor-not-allowed opacity-50">
          Link not set yet <ExternalLink size={12} />
        </span>
      )}

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

      {status === 'parsing' && <p className="text-[11px] text-navy-900/50">Parsing…</p>}
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

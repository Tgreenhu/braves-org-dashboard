import { useState } from 'react'
import {
  LayoutGrid,
  Users,
  Trophy,
  Radar,
  ListOrdered,
  UploadCloud,
  PenLine,
  RefreshCw,
} from 'lucide-react'
import OrgOverview from '@/pages/OrgOverview'
import Players from '@/pages/Players'
import AllOrgTeam from '@/pages/AllOrgTeam'
import ProspectComps from '@/pages/ProspectComps'
import Top30 from '@/pages/Top30'
import Upload from '@/pages/Upload'
import Writer from '@/pages/Writer'
import { supabaseConfigured } from '@/lib/supabaseClient'
import { cacheClear } from '@/lib/cache'

const TABS = [
  { id: 'overview', label: 'Org Overview', short: 'Overview', icon: LayoutGrid, Component: OrgOverview },
  { id: 'players', label: 'Players', short: 'Players', icon: Users, Component: Players },
  { id: 'all-org', label: 'All-Org Team', short: 'All-Org', icon: Trophy, Component: AllOrgTeam },
  { id: 'prospects', label: 'Prospect Comps', short: 'Comps', icon: Radar, Component: ProspectComps },
  { id: 'top30', label: 'My Top 50', short: 'Top 50', icon: ListOrdered, Component: Top30 },
  { id: 'upload', label: 'Upload', short: 'Upload', icon: UploadCloud, Component: Upload },
  { id: 'writer', label: 'Writer', short: 'Writer', icon: PenLine, Component: Writer },
] as const

type TabId = (typeof TABS)[number]['id']

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const active = TABS.find((t) => t.id === activeTab)!

  return (
    <div className="min-h-screen bg-brave-cream pb-20 sm:pb-0">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-navy text-white shadow-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-3 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <TomahawkMark />
            <div className="leading-tight">
              <h1 className="text-base font-display font-semibold tracking-wide sm:text-lg">
                BRAVES ORG DASHBOARD
              </h1>
              <p className="hidden text-[11px] text-white/50 sm:block">
                MLB &rarr; DSL, one source of truth
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!supabaseConfigured && (
              <span className="rounded-full border border-brave-gold/40 bg-brave-gold/10 px-2.5 py-1 text-[10px] font-medium text-brave-gold sm:text-xs">
                Supabase not connected
              </span>
            )}
            <RefreshDataButton />
          </div>
        </div>
        {/* Desktop tab row */}
        <nav className="mx-auto hidden max-w-7xl gap-1 px-6 sm:flex">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition ${
                activeTab === tab.id
                  ? 'border-brave-red text-white'
                  : 'border-transparent text-white/60 hover:text-white'
              }`}
            >
              <tab.icon size={15} />
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      {/* Active tab content */}
      <main className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-6">
        <active.Component />
      </main>

      {/* Mobile bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-navy-950/10 bg-white/95 backdrop-blur sm:hidden">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex flex-1 flex-col items-center gap-0.5 py-2"
          >
            <tab.icon
              size={18}
              className={activeTab === tab.id ? 'text-brave-red' : 'text-navy-950/40'}
            />
            <span
              className={`text-[10px] font-medium ${
                activeTab === tab.id ? 'text-brave-red' : 'text-navy-950/40'
              }`}
            >
              {tab.short}
            </span>
          </button>
        ))}
      </nav>
    </div>
  )
}

function TomahawkMark() {
  return (
    <svg width="26" height="26" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path
        d="M4 26 L22 6 L27 9 L23 13 L27 15 L20 18 L6 28 Z"
        fill="#CE1141"
        stroke="#F4F1E8"
        strokeWidth="1"
      />
    </svg>
  )
}

function RefreshDataButton() {
  const [justRefreshed, setJustRefreshed] = useState(false)

  const handleRefresh = () => {
    cacheClear() // wipes the local cache — needed because data can now change from outside the app (manual SQL, the standings/position automations), which this browser has no other way of knowing about
    setJustRefreshed(true)
    setTimeout(() => window.location.reload(), 400)
  }

  return (
    <button
      onClick={handleRefresh}
      title="Clear cached data and reload — use this after editing the database directly (SQL, automations) so the app picks up the changes"
      className="flex items-center gap-1.5 rounded-full border border-white/15 px-2.5 py-1 text-[10px] font-medium text-white/70 transition hover:border-white/30 hover:text-white sm:text-xs"
    >
      <RefreshCw size={12} className={justRefreshed ? 'animate-spin' : ''} />
      <span className="hidden sm:inline">{justRefreshed ? 'Refreshing…' : 'Refresh Data'}</span>
    </button>
  )
}

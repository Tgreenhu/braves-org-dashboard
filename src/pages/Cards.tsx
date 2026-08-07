import { useEffect, useMemo, useState } from 'react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import {
  Loader2,
  Inbox,
  Plus,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Package,
  CheckCircle2,
  X,
  ExternalLink,
  Trash2,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
} from 'lucide-react'
import DownloadableCard from '@/components/shared/DownloadableCard'
import {
  fetchTradingCards,
  addTradingCard,
  markCardSold,
  updateCardStatus,
  updateCardEstimatedValue,
  deleteTradingCard,
  type NewCardInput,
  type SaleInput,
} from '@/lib/queries'
import { parseEbayLink } from '@/lib/ebayLinkParser'
import { supabaseConfigured } from '@/lib/supabaseClient'
import type { TradingCard, CardStatus } from '@/types'

const CHART_COLORS = ['#CE1141', '#13274F', '#8DBCE6', '#D4A32C', '#5B8C5A', '#8B5CF6', '#EC4899', '#0EA5E9']

function individualProfit(c: TradingCard): number | null {
  if (c.status !== 'sold' || c.salePrice == null) return null
  return c.salePrice - c.purchasePrice - c.purchaseFees - c.saleFees - c.shippingCost
}

export default function Cards() {
  const [cards, setCards] = useState<TradingCard[] | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [sellingCard, setSellingCard] = useState<TradingCard | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | CardStatus>('all')
  const [sortKey, setSortKey] = useState<string>('purchaseDate')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const load = () => {
    fetchTradingCards().then(setCards)
  }
  useEffect(load, [])

  const loading = cards === null

  const filteredCards = useMemo(() => {
    let filtered = (cards ?? []).filter((c) => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false
      if (search) {
        const q = search.toLowerCase()
        const haystack = `${c.playerName} ${c.setName ?? ''} ${c.parallel ?? ''} ${c.year ?? ''}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
    filtered = [...filtered].sort((a: any, b: any) => {
      let av = sortKey === 'profit' ? individualProfit(a) : a[sortKey]
      let bv = sortKey === 'profit' ? individualProfit(b) : b[sortKey]
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      return sortDir === 'asc' ? av - bv : bv - av
    })
    return filtered
  }, [cards, search, statusFilter, sortKey, sortDir])

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const stats = useMemo(() => {
    const all = cards ?? []
    const sold = all.filter((c) => c.status === 'sold')
    const owned = all.filter((c) => c.status !== 'sold')

    const totalSpent = all.reduce((s, c) => s + c.purchasePrice + c.purchaseFees, 0)
    const totalRevenue = sold.reduce((s, c) => s + (c.salePrice ?? 0), 0)
    const netProfit = sold.reduce((s, c) => s + (individualProfit(c) ?? 0), 0)
    const soldCostBasis = sold.reduce((s, c) => s + c.purchasePrice + c.purchaseFees, 0)
    const roi = soldCostBasis > 0 ? (netProfit / soldCostBasis) * 100 : null
    const winRate = sold.length > 0 ? (sold.filter((c) => (individualProfit(c) ?? 0) > 0).length / sold.length) * 100 : null
    const unrealizedValue = owned.reduce((s, c) => s + (c.estimatedCurrentValue ?? c.purchasePrice), 0)
    const holdingDays = sold
      .filter((c) => c.saleDate)
      .map((c) => (new Date(c.saleDate!).getTime() - new Date(c.purchaseDate).getTime()) / 86400000)
    const avgHoldingDays = holdingDays.length > 0 ? holdingDays.reduce((s, d) => s + d, 0) / holdingDays.length : null

    return { totalSpent, totalRevenue, netProfit, roi, winRate, unrealizedValue, avgHoldingDays, ownedCount: owned.length, soldCount: sold.length }
  }, [cards])

  const cumulativeProfitData = useMemo(() => {
    const sold = (cards ?? [])
      .filter((c) => c.status === 'sold' && c.saleDate)
      .sort((a, b) => new Date(a.saleDate!).getTime() - new Date(b.saleDate!).getTime())
    let running = 0
    return sold.map((c) => {
      running += individualProfit(c) ?? 0
      return { date: c.saleDate!, cumulativeProfit: Number(running.toFixed(2)), player: c.playerName }
    })
  }, [cards])

  const profitByPlayerData = useMemo(() => {
    const map = new Map<string, number>()
    for (const c of cards ?? []) {
      const p = individualProfit(c)
      if (p == null) continue
      map.set(c.playerName, (map.get(c.playerName) ?? 0) + p)
    }
    return Array.from(map.entries())
      .map(([player, profit]) => ({ player, profit: Number(profit.toFixed(2)) }))
      .sort((a, b) => Math.abs(b.profit) - Math.abs(a.profit))
      .slice(0, 10)
  }, [cards])

  const monthlyVolumeData = useMemo(() => {
    const map = new Map<string, { month: string; purchases: number; sales: number }>()
    const monthKey = (d: string) => d.slice(0, 7) // YYYY-MM
    for (const c of cards ?? []) {
      const pk = monthKey(c.purchaseDate)
      if (!map.has(pk)) map.set(pk, { month: pk, purchases: 0, sales: 0 })
      map.get(pk)!.purchases += 1
      if (c.saleDate) {
        const sk = monthKey(c.saleDate)
        if (!map.has(sk)) map.set(sk, { month: sk, purchases: 0, sales: 0 })
        map.get(sk)!.sales += 1
      }
    }
    return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month))
  }, [cards])

  const bestWorstFlips = useMemo(() => {
    const sold = (cards ?? [])
      .filter((c) => c.status === 'sold')
      .map((c) => ({ card: c, profit: individualProfit(c) ?? 0 }))
      .sort((a, b) => b.profit - a.profit)
    return { best: sold.slice(0, 5), worst: sold.slice(-5).reverse() }
  }, [cards])

  const hasAnyData = (cards?.length ?? 0) > 0

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-navy-900 sm:text-xl">Cards</h2>
          <p className="text-xs text-navy-900/50 sm:text-sm">Trading card collection tracking and P&L.</p>
        </div>
        <button onClick={() => setShowAddForm(true)} className="pill-button !bg-brave-red !text-white !border-brave-red">
          <Plus size={14} /> Add Card
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-navy-900/40">
          <Loader2 size={16} className="animate-spin" /> Loading…
        </div>
      ) : !hasAnyData ? (
        <EmptyState onAdd={() => setShowAddForm(true)} />
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
            <KpiCard icon={DollarSign} label="Total Spent" value={`$${stats.totalSpent.toFixed(0)}`} />
            <KpiCard icon={DollarSign} label="Total Revenue" value={`$${stats.totalRevenue.toFixed(0)}`} />
            <KpiCard
              icon={stats.netProfit >= 0 ? TrendingUp : TrendingDown}
              label="Net Profit"
              value={`${stats.netProfit >= 0 ? '+' : ''}$${stats.netProfit.toFixed(0)}`}
              tone={stats.netProfit >= 0 ? 'good' : 'bad'}
            />
            <KpiCard label="ROI" value={stats.roi != null ? `${stats.roi >= 0 ? '+' : ''}${stats.roi.toFixed(1)}%` : '—'} tone={stats.roi != null && stats.roi >= 0 ? 'good' : stats.roi != null ? 'bad' : undefined} />
            <KpiCard label="Win Rate" value={stats.winRate != null ? `${stats.winRate.toFixed(0)}%` : '—'} />
            <KpiCard icon={Package} label="Owned" value={String(stats.ownedCount)} />
            <KpiCard icon={CheckCircle2} label="Sold" value={String(stats.soldCount)} />
            <KpiCard label="Avg Hold" value={stats.avgHoldingDays != null ? `${Math.round(stats.avgHoldingDays)}d` : '—'} />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <DownloadableCard title="Cumulative Realized Profit" subtitle="Running total, by sale date" filename="cards-cumulative-profit">
              <div className="h-64 p-3 sm:p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={cumulativeProfitData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#13274F11" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => `$${v.toFixed(2)}`} />
                    <Line type="monotone" dataKey="cumulativeProfit" stroke="#CE1141" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </DownloadableCard>

            <DownloadableCard title="Profit by Player" subtitle="Top 10 by magnitude, sold cards" filename="cards-profit-by-player">
              <div className="h-64 p-3 sm:p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={profitByPlayerData} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#13274F11" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="player" tick={{ fontSize: 10 }} width={100} />
                    <Tooltip formatter={(v: number) => `$${v.toFixed(2)}`} />
                    <Bar dataKey="profit" radius={[0, 4, 4, 0]}>
                      {profitByPlayerData.map((entry, i) => (
                        <Cell key={i} fill={entry.profit >= 0 ? '#5B8C5A' : '#CE1141'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </DownloadableCard>

            <DownloadableCard title="Purchases vs. Sales Volume" subtitle="By month" filename="cards-monthly-volume">
              <div className="h-64 p-3 sm:p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyVolumeData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#13274F11" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="purchases" name="Purchases" fill="#13274F" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="sales" name="Sales" fill="#5B8C5A" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </DownloadableCard>

            <DownloadableCard title="Best & Worst Flips" subtitle="Top 5 each, sold cards" filename="cards-best-worst">
              <div className="grid grid-cols-2 gap-3 p-3 sm:p-4">
                <div>
                  <h4 className="mb-1.5 text-[11px] font-semibold uppercase text-emerald-600">Best</h4>
                  <div className="space-y-1">
                    {bestWorstFlips.best.map(({ card, profit }) => (
                      <div key={card.id} className="flex items-center justify-between text-xs">
                        <span className="truncate text-navy-900/70">{card.playerName}</span>
                        <span className="shrink-0 font-semibold text-emerald-600">+${profit.toFixed(0)}</span>
                      </div>
                    ))}
                    {bestWorstFlips.best.length === 0 && <p className="text-xs text-navy-900/40">No sold cards yet</p>}
                  </div>
                </div>
                <div>
                  <h4 className="mb-1.5 text-[11px] font-semibold uppercase text-brave-red">Worst</h4>
                  <div className="space-y-1">
                    {bestWorstFlips.worst.map(({ card, profit }) => (
                      <div key={card.id} className="flex items-center justify-between text-xs">
                        <span className="truncate text-navy-900/70">{card.playerName}</span>
                        <span className="shrink-0 font-semibold text-brave-red">${profit.toFixed(0)}</span>
                      </div>
                    ))}
                    {bestWorstFlips.worst.length === 0 && <p className="text-xs text-navy-900/40">No sold cards yet</p>}
                  </div>
                </div>
              </div>
            </DownloadableCard>
          </div>

          {/* Collection table */}
          <div className="card space-y-3 p-3 sm:p-4">
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search player, set…"
                className="min-w-[140px] flex-1 rounded-full border border-navy-950/10 px-3 py-1.5 text-xs sm:max-w-[220px]"
              />
              <div className="flex overflow-hidden rounded-full border border-navy-950/10">
                {(['all', 'owned', 'listed', 'sold'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`px-3 py-1.5 text-xs font-semibold capitalize transition ${statusFilter === s ? 'bg-navy text-white' : 'bg-white text-navy-800'}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="max-h-[60vh] overflow-auto">
              <table className="stat-table">
                <thead>
                  <tr>
                    {[
                      ['playerName', 'Player'],
                      ['year', 'Yr'],
                      ['setName', 'Set'],
                      ['parallel', 'Parallel'],
                      ['gradingCompany', 'Grade'],
                      ['status', 'Status'],
                      ['purchaseDate', 'Purchased'],
                      ['purchasePrice', 'Paid'],
                      ['saleDate', 'Sold'],
                      ['salePrice', 'Sale $'],
                      ['profit', 'Profit'],
                    ].map(([key, label]) => (
                      <th key={key}>
                        <button onClick={() => toggleSort(key)} className="inline-flex items-center gap-1">
                          {label}
                          {sortKey === key ? sortDir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} /> : <ArrowUpDown size={10} className="opacity-30" />}
                        </button>
                      </th>
                    ))}
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCards.map((c) => {
                    const profit = individualProfit(c)
                    return (
                      <tr key={c.id}>
                        <td className="text-left">
                          {c.purchaseUrl ? (
                            <a href={c.purchaseUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-brave-red">
                              {c.playerName} <ExternalLink size={10} />
                            </a>
                          ) : (
                            c.playerName
                          )}
                        </td>
                        <td>{c.year ?? '—'}</td>
                        <td>{c.setName ?? '—'}</td>
                        <td>{c.parallel ?? '—'}</td>
                        <td>{c.gradingCompany ? `${c.gradingCompany} ${c.grade ?? ''}` : 'Raw'}</td>
                        <td>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${c.status === 'sold' ? 'bg-emerald-100 text-emerald-700' : c.status === 'listed' ? 'bg-brave-gold/20 text-brave-gold' : 'bg-navy-950/5 text-navy-900/60'}`}>
                            {c.status}
                          </span>
                        </td>
                        <td>{c.purchaseDate}</td>
                        <td>${c.purchasePrice.toFixed(0)}</td>
                        <td>{c.saleDate ?? '—'}</td>
                        <td>{c.salePrice != null ? `$${c.salePrice.toFixed(0)}` : '—'}</td>
                        <td className={profit == null ? '' : profit >= 0 ? 'font-semibold text-emerald-600' : 'font-semibold text-brave-red'}>
                          {profit != null ? `${profit >= 0 ? '+' : ''}$${profit.toFixed(0)}` : '—'}
                        </td>
                        <td>
                          <div className="flex items-center gap-1.5">
                            {c.status !== 'sold' && (
                              <button onClick={() => setSellingCard(c)} className="text-[10px] font-semibold text-brave-red hover:underline">
                                Mark Sold
                              </button>
                            )}
                            <button
                              onClick={async () => {
                                if (!confirm(`Delete ${c.playerName}?`)) return
                                await deleteTradingCard(c.id)
                                load()
                              }}
                              className="text-navy-900/30 hover:text-brave-red"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {filteredCards.length === 0 && (
                    <tr>
                      <td colSpan={12} className="py-6 text-center text-navy-900/40">
                        No cards match these filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {showAddForm && <AddCardModal onClose={() => setShowAddForm(false)} onAdded={load} />}
      {sellingCard && <SellCardModal card={sellingCard} onClose={() => setSellingCard(null)} onSold={load} />}
    </div>
  )
}

function KpiCard({ icon: Icon, label, value, tone }: { icon?: any; label: string; value: string; tone?: 'good' | 'bad' }) {
  return (
    <div className="card flex flex-col items-center gap-0.5 p-3 text-center">
      {Icon && <Icon size={14} className="mb-0.5 text-navy-900/30" />}
      <div className="truncate text-[10px] uppercase tracking-wide text-navy-900/45">{label}</div>
      <div className={`font-display text-base font-semibold ${tone === 'good' ? 'text-emerald-600' : tone === 'bad' ? 'text-brave-red' : 'text-navy-950'}`}>{value}</div>
    </div>
  )
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-14 text-center">
      <Inbox size={22} className="text-navy-950/20" />
      <p className="text-sm font-medium text-navy-900">No cards yet</p>
      <p className="max-w-md text-xs text-navy-900/50">Add your first card to start tracking your collection and P&L.</p>
      <button onClick={onAdd} className="pill-button !bg-brave-red !text-white !border-brave-red">
        <Plus size={14} /> Add Card
      </button>
    </div>
  )
}

// =====================================================================
// Add Card modal
// =====================================================================

const GRADING_COMPANIES = ['', 'PSA', 'BGS', 'SGC', 'CGC']

function AddCardModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [link, setLink] = useState('')
  const [form, setForm] = useState({
    playerName: '',
    year: '',
    setName: '',
    cardNumber: '',
    parallel: '',
    sport: 'Baseball',
    gradingCompany: '',
    grade: '',
    imageUrl: '',
    notes: '',
    purchaseDate: new Date().toISOString().slice(0, 10),
    purchasePrice: '',
    purchasePlatform: 'eBay',
    purchaseFees: '0',
  })
  const [itemId, setItemId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const handleLinkChange = (value: string) => {
    setLink(value)
    const parsed = parseEbayLink(value)
    if (parsed.isValidEbayUrl) {
      setItemId(parsed.itemId)
      // Only auto-fill the name field if the user hasn't already typed
      // something themselves — never clobber a manual entry.
      if (parsed.draftTitle && !form.playerName) {
        setForm((f) => ({ ...f, playerName: parsed.draftTitle! }))
      }
    } else {
      setItemId(null)
    }
  }

  const handleSubmit = async () => {
    if (!form.playerName || !form.purchasePrice) return
    setSaving(true)
    const input: NewCardInput = {
      playerName: form.playerName,
      year: form.year ? Number(form.year) : null,
      setName: form.setName || null,
      cardNumber: form.cardNumber || null,
      parallel: form.parallel || null,
      sport: form.sport,
      gradingCompany: form.gradingCompany || null,
      grade: form.grade ? Number(form.grade) : null,
      imageUrl: form.imageUrl || null,
      notes: form.notes || null,
      purchaseDate: form.purchaseDate,
      purchasePrice: Number(form.purchasePrice),
      purchasePlatform: form.purchasePlatform,
      purchaseUrl: link || null,
      purchaseItemId: itemId,
      purchaseFees: Number(form.purchaseFees) || 0,
    }
    await addTradingCard(input)
    setSaving(false)
    onAdded()
    onClose()
  }

  return (
    <Modal title="Add Card" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-navy-900/70">
            eBay listing link <span className="text-navy-900/40">(optional — pastes in a draft title, doesn't fetch price/details)</span>
          </label>
          <input
            value={link}
            onChange={(e) => handleLinkChange(e.target.value)}
            placeholder="https://www.ebay.com/itm/..."
            className="w-full rounded-lg border border-navy-950/10 px-3 py-2 text-sm"
          />
          {itemId && <p className="mt-1 text-[11px] text-emerald-600">Detected eBay item #{itemId}</p>}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Player Name *" value={form.playerName} onChange={(v) => setForm((f) => ({ ...f, playerName: v }))} span2 />
          <Field label="Year" value={form.year} onChange={(v) => setForm((f) => ({ ...f, year: v }))} type="number" />
          <Field label="Sport" value={form.sport} onChange={(v) => setForm((f) => ({ ...f, sport: v }))} />
          <Field label="Set" value={form.setName} onChange={(v) => setForm((f) => ({ ...f, setName: v }))} />
          <Field label="Card #" value={form.cardNumber} onChange={(v) => setForm((f) => ({ ...f, cardNumber: v }))} />
          <Field label="Parallel/Variation" value={form.parallel} onChange={(v) => setForm((f) => ({ ...f, parallel: v }))} span2 />
          <div>
            <label className="mb-1 block text-xs font-medium text-navy-900/70">Grading Co.</label>
            <select value={form.gradingCompany} onChange={(e) => setForm((f) => ({ ...f, gradingCompany: e.target.value }))} className="w-full rounded-lg border border-navy-950/10 px-3 py-2 text-sm">
              {GRADING_COMPANIES.map((g) => (
                <option key={g} value={g}>
                  {g || 'Raw / Ungraded'}
                </option>
              ))}
            </select>
          </div>
          <Field label="Grade" value={form.grade} onChange={(v) => setForm((f) => ({ ...f, grade: v }))} type="number" />
          <Field label="Purchase Date *" value={form.purchaseDate} onChange={(v) => setForm((f) => ({ ...f, purchaseDate: v }))} type="date" />
          <Field label="Purchase Price *" value={form.purchasePrice} onChange={(v) => setForm((f) => ({ ...f, purchasePrice: v }))} type="number" />
          <Field label="Platform" value={form.purchasePlatform} onChange={(v) => setForm((f) => ({ ...f, purchasePlatform: v }))} />
          <Field label="Fees (buyer premium etc.)" value={form.purchaseFees} onChange={(v) => setForm((f) => ({ ...f, purchaseFees: v }))} type="number" />
          <Field label="Image URL" value={form.imageUrl} onChange={(v) => setForm((f) => ({ ...f, imageUrl: v }))} span2 />
          <Field label="Notes" value={form.notes} onChange={(v) => setForm((f) => ({ ...f, notes: v }))} span2 />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="pill-button">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={saving || !form.playerName || !form.purchasePrice} className="pill-button !bg-brave-red !text-white !border-brave-red disabled:opacity-40">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add Card
          </button>
        </div>
      </div>
    </Modal>
  )
}

// =====================================================================
// Sell Card modal
// =====================================================================

function SellCardModal({ card, onClose, onSold }: { card: TradingCard; onClose: () => void; onSold: () => void }) {
  const [link, setLink] = useState('')
  const [itemId, setItemId] = useState<string | null>(null)
  const [form, setForm] = useState({
    saleDate: new Date().toISOString().slice(0, 10),
    salePrice: '',
    salePlatform: 'eBay',
    saleFees: '0',
    shippingCost: '0',
  })
  const [saving, setSaving] = useState(false)

  const handleLinkChange = (value: string) => {
    setLink(value)
    const parsed = parseEbayLink(value)
    setItemId(parsed.isValidEbayUrl ? parsed.itemId : null)
  }

  const handleSubmit = async () => {
    if (!form.salePrice) return
    setSaving(true)
    const sale: SaleInput = {
      saleDate: form.saleDate,
      salePrice: Number(form.salePrice),
      salePlatform: form.salePlatform,
      saleUrl: link || null,
      saleItemId: itemId,
      saleFees: Number(form.saleFees) || 0,
      shippingCost: Number(form.shippingCost) || 0,
    }
    await markCardSold(card.id, sale)
    setSaving(false)
    onSold()
    onClose()
  }

  const projectedProfit = form.salePrice
    ? Number(form.salePrice) - card.purchasePrice - card.purchaseFees - (Number(form.saleFees) || 0) - (Number(form.shippingCost) || 0)
    : null

  return (
    <Modal title={`Mark "${card.playerName}" as Sold`} onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-navy-900/70">
            eBay sale link <span className="text-navy-900/40">(optional)</span>
          </label>
          <input
            value={link}
            onChange={(e) => handleLinkChange(e.target.value)}
            placeholder="https://www.ebay.com/itm/..."
            className="w-full rounded-lg border border-navy-950/10 px-3 py-2 text-sm"
          />
          {itemId && <p className="mt-1 text-[11px] text-emerald-600">Detected eBay item #{itemId}</p>}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Sale Date *" value={form.saleDate} onChange={(v) => setForm((f) => ({ ...f, saleDate: v }))} type="date" />
          <Field label="Sale Price *" value={form.salePrice} onChange={(v) => setForm((f) => ({ ...f, salePrice: v }))} type="number" />
          <Field label="Platform" value={form.salePlatform} onChange={(v) => setForm((f) => ({ ...f, salePlatform: v }))} />
          <Field label="Fees (final value fee etc.)" value={form.saleFees} onChange={(v) => setForm((f) => ({ ...f, saleFees: v }))} type="number" />
          <Field label="Shipping cost (you paid)" value={form.shippingCost} onChange={(v) => setForm((f) => ({ ...f, shippingCost: v }))} type="number" span2 />
        </div>

        {projectedProfit != null && (
          <div className={`rounded-lg px-3 py-2 text-sm font-semibold ${projectedProfit >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-brave-red'}`}>
            Projected profit: {projectedProfit >= 0 ? '+' : ''}${projectedProfit.toFixed(2)}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="pill-button">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={saving || !form.salePrice} className="pill-button !bg-brave-red !text-white !border-brave-red disabled:opacity-40">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Confirm Sale
          </button>
        </div>
      </div>
    </Modal>
  )
}

// =====================================================================
// Shared bits
// =====================================================================

function Field({
  label,
  value,
  onChange,
  type = 'text',
  span2 = false,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  span2?: boolean
}) {
  return (
    <div className={span2 ? 'col-span-2' : ''}>
      <label className="mb-1 block text-xs font-medium text-navy-900/70">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-navy-950/10 px-3 py-2 text-sm"
      />
    </div>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold text-navy-950">{title}</h3>
          <button onClick={onClose} className="text-navy-900/40 hover:text-brave-red">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

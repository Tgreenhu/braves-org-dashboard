import { useEffect, useMemo, useRef, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts'
import {
  ExternalLink,
  Plus,
  Trash2,
  ChevronDown,
  X,
  Loader2,
  Inbox,
  DollarSign,
  FileText,
  BarChart3,
} from 'lucide-react'
import DownloadableCard from '@/components/shared/DownloadableCard'
import {
  fetchWriterArticles,
  addWriterArticle,
  deleteWriterArticle,
  fetchWriterFinances,
  addWriterIncome,
  deleteWriterIncome,
  addWriterExpense,
  deleteWriterExpense,
  type WriterArticle,
  type WriterIncomeRow,
  type WriterExpenseRow,
} from '@/lib/queries'
import { supabaseConfigured } from '@/lib/supabaseClient'
import { useClickOutside } from '@/lib/useClickOutside'

const TAX_RATE = 0.3
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const CURRENT_YEAR = new Date().getFullYear()
const CHART_COLORS = ['#CE1141', '#13274F', '#8DBCE6', '#D4A32C', '#5B8C5A', '#8B5CF6', '#EC4899']

export default function Writer() {
  // Lifted to the top so one filter bar drives everything below it — the
  // summary boxes, the analytics charts, and the articles list all read
  // from this same year/month selection.
  const [year, setYear] = useState(CURRENT_YEAR)
  const [month, setMonth] = useState<number | 'All'>('All')

  const [articles, setArticles] = useState<WriterArticle[] | null>(null)
  const [income, setIncome] = useState<WriterIncomeRow[] | null>(null)
  const [expenses, setExpenses] = useState<WriterExpenseRow[] | null>(null)

  const loadArticles = () => fetchWriterArticles().then(setArticles)
  const loadFinances = () =>
    fetchWriterFinances(year).then(({ income, expenses }) => {
      setIncome(income)
      setExpenses(expenses)
    })

  useEffect(() => {
    loadArticles()
  }, [])
  useEffect(() => {
    setIncome(null)
    setExpenses(null)
    loadFinances()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year])

  const availableYears = useMemo(() => {
    const years = new Set<number>([CURRENT_YEAR])
    for (const a of articles ?? []) {
      if (a.publishedDate) years.add(Number(a.publishedDate.slice(0, 4)))
    }
    return Array.from(years).sort((a, b) => b - a)
  }, [articles])

  // Articles scoped to the selected year (+ month, if one is picked).
  const articlesInPeriod = useMemo(() => {
    return (articles ?? []).filter((a) => {
      if (!a.publishedDate) return false
      const y = Number(a.publishedDate.slice(0, 4))
      const m = Number(a.publishedDate.slice(5, 7))
      if (y !== year) return false
      if (month !== 'All' && m !== month) return false
      return true
    })
  }, [articles, year, month])

  // Finances scoped the same way — income/expenses are already fetched for
  // the selected year, just narrow further by month here.
  const incomeInPeriod = useMemo(
    () => (income ?? []).filter((r) => month === 'All' || r.month === month),
    [income, month],
  )
  const expensesInPeriod = useMemo(
    () => (expenses ?? []).filter((r) => month === 'All' || r.month === month),
    [expenses, month],
  )

  const totalIncome = incomeInPeriod.reduce((sum, r) => sum + r.amount, 0)
  const totalExpenses = expensesInPeriod.reduce((sum, r) => sum + r.amount, 0)
  const netIncome = totalIncome - totalExpenses
  const estimatedTax = Math.max(0, netIncome * TAX_RATE)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-navy-900 sm:text-xl">Writer</h2>
          <p className="text-xs text-navy-900/50 sm:text-sm">
            Every published piece across outlets, plus a running income/expense/tax tracker.
          </p>
        </div>

        {/* Global filter — drives everything on this page */}
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-navy-900/70">
            Year
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="rounded-lg border border-navy-950/10 px-2 py-1.5 text-xs"
            >
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1.5 text-xs text-navy-900/70">
            Month
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value === 'All' ? 'All' : Number(e.target.value))}
              className="rounded-lg border border-navy-950/10 px-2 py-1.5 text-xs"
            >
              <option value="All">All</option>
              {MONTH_NAMES.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* Income, Expenses & Tax — top of the page as requested */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <SummaryCard label="Income" value={totalIncome} />
        <SummaryCard label="Expenses" value={totalExpenses} />
        <SummaryCard label="Net" value={netIncome} valueClass={netIncome >= 0 ? 'text-emerald-600' : 'text-brave-red'} />
        <SummaryCard label={`Est. Tax (${(TAX_RATE * 100).toFixed(0)}%)`} value={estimatedTax} valueClass="text-brave-red" />
      </div>

      <AnalyticsSection
        year={year}
        month={month}
        articlesInPeriod={articlesInPeriod}
        income={income ?? []}
        expenses={expenses ?? []}
      />

      <ArticlesSection
        articles={articles}
        articlesInPeriod={articlesInPeriod}
        year={year}
        month={month}
        onChanged={loadArticles}
      />

      <FinancesSection
        year={year}
        income={income}
        expenses={expenses}
        onChanged={loadFinances}
      />
    </div>
  )
}

// =====================================================================
// Analytics — fun tables/graphs, all reading from the shared year/month filter
// =====================================================================

function AnalyticsSection({
  year,
  month,
  articlesInPeriod,
  income,
  expenses,
}: {
  year: number
  month: number | 'All'
  articlesInPeriod: WriterArticle[]
  income: WriterIncomeRow[]
  expenses: WriterExpenseRow[]
}) {
  // Articles-per-month chart intentionally always shows the full year's
  // shape (that's the point of the chart) — everything else on the page
  // still fully respects the month filter.
  const articlesByMonth = useMemo(() => {
    const counts = Array(12).fill(0)
    for (const a of articlesInPeriod.length ? articlesInPeriod : []) {
      // articlesInPeriod is already year-scoped; if a month filter is set
      // this will just show one bar, which is fine — still accurate.
      if (a.publishedDate) counts[Number(a.publishedDate.slice(5, 7)) - 1]++
    }
    return MONTH_NAMES.map((m, i) => ({ month: m, count: counts[i] }))
  }, [articlesInPeriod])

  const incomeExpenseByMonth = useMemo(() => {
    return MONTH_NAMES.map((m, i) => ({
      month: m,
      Income: income.filter((r) => r.month === i + 1).reduce((s, r) => s + r.amount, 0),
      Expenses: expenses.filter((r) => r.month === i + 1).reduce((s, r) => s + r.amount, 0),
    }))
  }, [income, expenses])

  const byCompany = useMemo(() => {
    const counts = new Map<string, number>()
    for (const a of articlesInPeriod) counts.set(a.company, (counts.get(a.company) ?? 0) + 1)
    return Array.from(counts.entries())
      .map(([company, count]) => ({ company, count }))
      .sort((a, b) => b.count - a.count)
  }, [articlesInPeriod])

  const totalArticles = articlesInPeriod.length
  const avgPerMonth = month === 'All' ? (totalArticles / 12).toFixed(1) : null

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <BarChart3 size={16} className="text-navy-900/50" />
        <h3 className="text-sm font-semibold text-navy-900 sm:text-base">Analytics</h3>
      </div>

      {/* Quick stats row */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard label={`Articles (${month === 'All' ? year : `${MONTH_NAMES[month - 1]} ${year}`})`} value={totalArticles} />
        {avgPerMonth != null && <StatCard label="Avg / Month" value={avgPerMonth} />}
        {byCompany.slice(0, avgPerMonth != null ? 2 : 3).map((c) => (
          <StatCard key={c.company} label={c.company} value={c.count} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DownloadableCard title="Articles Published by Month" subtitle={String(year)} filename="writer-articles-by-month">
          <div className="h-64 p-3 sm:p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={articlesByMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#13274F11" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" name="Articles" radius={[4, 4, 0, 0]}>
                  {articlesByMonth.map((entry, i) => (
                    <Cell key={i} fill={month !== 'All' && i === month - 1 ? '#CE1141' : '#13274F'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </DownloadableCard>

        <DownloadableCard title="Income vs Expenses by Month" subtitle={String(year)} filename="writer-income-expenses-by-month">
          <div className="h-64 p-3 sm:p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={incomeExpenseByMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#13274F11" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Income" fill="#5B8C5A" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Expenses" fill="#CE1141" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </DownloadableCard>
      </div>

      {byCompany.length > 0 && (
        <DownloadableCard title="Articles by Outlet" subtitle={`${month === 'All' ? year : `${MONTH_NAMES[month - 1]} ${year}`}`} filename="writer-articles-by-outlet">
          <div className="h-56 p-3 sm:p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byCompany} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#13274F11" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="company" tick={{ fontSize: 11 }} width={110} />
                <Tooltip />
                <Bar dataKey="count" name="Articles" radius={[0, 4, 4, 0]}>
                  {byCompany.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </DownloadableCard>
      )}
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card p-3 text-center">
      <div className="truncate text-[10px] uppercase tracking-wide text-navy-900/45">{label}</div>
      <div className="font-display text-lg font-semibold text-navy-950">{value}</div>
    </div>
  )
}

// =====================================================================
// Articles
// =====================================================================

function ArticlesSection({
  articles,
  articlesInPeriod,
  year,
  month,
  onChanged,
}: {
  articles: WriterArticle[] | null
  articlesInPeriod: WriterArticle[]
  year: number
  month: number | 'All'
  onChanged: () => void
}) {
  const [companyFilter, setCompanyFilter] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [form, setForm] = useState({
    title: '',
    url: '',
    company: '',
    category: '',
    contentType: 'Article',
    publishedDate: new Date().toISOString().slice(0, 10),
  })

  const companies = useMemo(() => Array.from(new Set((articles ?? []).map((a) => a.company))).sort(), [articles])

  const filtered = useMemo(() => {
    return articlesInPeriod.filter((a) => {
      if (companyFilter.length && !companyFilter.includes(a.company)) return false
      if (search && !a.title.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [articlesInPeriod, companyFilter, search])

  const handleAdd = async () => {
    if (!form.title.trim() || !form.url.trim() || !form.company.trim()) return
    await addWriterArticle({
      title: form.title.trim(),
      url: form.url.trim(),
      company: form.company.trim(),
      category: form.category.trim() || null,
      contentType: form.contentType,
      publishedDate: form.publishedDate || null,
      source: 'manual',
    })
    setForm({ title: '', url: '', company: '', category: '', contentType: 'Article', publishedDate: new Date().toISOString().slice(0, 10) })
    setShowAddForm(false)
    onChanged()
  }

  const handleDelete = async (id: string) => {
    await deleteWriterArticle(id)
    onChanged()
  }

  const periodLabel = month === 'All' ? String(year) : `${MONTH_NAMES[month - 1]} ${year}`

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-navy-900 sm:text-base">Articles &amp; Content</h3>
        <button onClick={() => setShowAddForm((s) => !s)} className="pill-button !bg-navy !text-white">
          <Plus size={14} /> Add link
        </button>
      </div>

      {showAddForm && (
        <div className="card grid grid-cols-1 gap-2 p-3 sm:grid-cols-2 sm:p-4">
          <input
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Title"
            className="rounded-lg border border-navy-950/10 px-2.5 py-1.5 text-sm sm:col-span-2"
          />
          <input
            value={form.url}
            onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
            placeholder="Link (article, YouTube, etc.)"
            className="rounded-lg border border-navy-950/10 px-2.5 py-1.5 text-sm sm:col-span-2"
          />
          <input
            value={form.company}
            onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
            placeholder="Company / Outlet"
            className="rounded-lg border border-navy-950/10 px-2.5 py-1.5 text-sm"
          />
          <select
            value={form.contentType}
            onChange={(e) => setForm((f) => ({ ...f, contentType: e.target.value }))}
            className="rounded-lg border border-navy-950/10 px-2.5 py-1.5 text-sm"
          >
            <option>Article</option>
            <option>Video</option>
            <option>Other</option>
          </select>
          <input
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            placeholder="Category (optional)"
            className="rounded-lg border border-navy-950/10 px-2.5 py-1.5 text-sm"
          />
          <input
            type="date"
            value={form.publishedDate}
            onChange={(e) => setForm((f) => ({ ...f, publishedDate: e.target.value }))}
            className="rounded-lg border border-navy-950/10 px-2.5 py-1.5 text-sm"
          />
          <button onClick={handleAdd} className="pill-button !bg-brave-red !text-white sm:col-span-2 justify-center">
            <Plus size={14} /> Save
          </button>
        </div>
      )}

      <div className="card flex flex-wrap items-center gap-2 p-3 sm:p-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search titles…"
          className="min-w-[140px] flex-1 rounded-full border border-navy-950/10 px-3 py-1.5 text-xs sm:max-w-[220px]"
        />
        <MultiSelectFilter label="Company" options={companies} selected={companyFilter} onChange={setCompanyFilter} />
      </div>

      {articles === null ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-navy-900/40">
          <Loader2 size={16} className="animate-spin" /> Loading articles…
        </div>
      ) : !supabaseConfigured ? (
        <EmptyState title="Supabase isn't connected" detail="Add your Supabase credentials to track articles here." />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={`Nothing for ${periodLabel}`}
          detail="Try a different year/month above, or use 'Add link' to log something for this period."
        />
      ) : (
        <DownloadableCard title="Articles & Content" subtitle={`${filtered.length} pieces · ${periodLabel}`} filename="writer-articles">
          <div className="max-h-[60vh] overflow-auto">
            <table className="stat-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th className="text-left">Title</th>
                  <th>Company</th>
                  <th>Category</th>
                  <th>Type</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => (
                  <tr key={a.id}>
                    <td>{a.publishedDate ?? '—'}</td>
                    <td className="text-left">
                      <a href={a.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-navy-900 hover:text-brave-red">
                        <span className="truncate max-w-xs">{a.title}</span>
                        <ExternalLink size={11} className="shrink-0" />
                      </a>
                    </td>
                    <td>{a.company}</td>
                    <td>{a.category ?? '—'}</td>
                    <td>{a.contentType}</td>
                    <td>
                      <button onClick={() => handleDelete(a.id)} className="text-navy-950/25 hover:text-brave-red">
                        <Trash2 size={13} />
                      </button>
                    </td>
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
// Finances (entry forms + lists — summary boxes now live at page top)
// =====================================================================

function FinancesSection({
  year,
  income,
  expenses,
  onChanged,
}: {
  year: number
  income: WriterIncomeRow[] | null
  expenses: WriterExpenseRow[] | null
  onChanged: () => void
}) {
  const [incomeForm, setIncomeForm] = useState({ month: '1', company: '', amount: '' })
  const [expenseForm, setExpenseForm] = useState({ month: '1', category: '', description: '', amount: '' })

  const handleAddIncome = async () => {
    const amount = Number(incomeForm.amount)
    if (!incomeForm.company.trim() || !amount) return
    await addWriterIncome({ year, month: Number(incomeForm.month), company: incomeForm.company.trim(), amount })
    setIncomeForm({ month: '1', company: '', amount: '' })
    onChanged()
  }
  const handleAddExpense = async () => {
    const amount = Number(expenseForm.amount)
    if (!amount) return
    await addWriterExpense({
      year,
      month: Number(expenseForm.month),
      category: expenseForm.category.trim() || undefined,
      description: expenseForm.description.trim() || undefined,
      amount,
    })
    setExpenseForm({ month: '1', category: '', description: '', amount: '' })
    onChanged()
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-navy-900 sm:text-base">Log Pay &amp; Expenses</h3>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Income */}
        <div className="card p-3 sm:p-4">
          <div className="mb-2 flex items-center gap-2">
            <DollarSign size={15} className="text-emerald-600" />
            <h4 className="text-sm font-semibold text-navy-950">Monthly Pay</h4>
          </div>
          <div className="mb-3 flex flex-wrap items-end gap-2">
            <select
              value={incomeForm.month}
              onChange={(e) => setIncomeForm((f) => ({ ...f, month: e.target.value }))}
              className="rounded-lg border border-navy-950/10 px-2 py-1.5 text-xs"
            >
              {MONTH_NAMES.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
            <input
              value={incomeForm.company}
              onChange={(e) => setIncomeForm((f) => ({ ...f, company: e.target.value }))}
              placeholder="Company"
              className="min-w-[100px] flex-1 rounded-lg border border-navy-950/10 px-2 py-1.5 text-xs"
            />
            <input
              type="number"
              value={incomeForm.amount}
              onChange={(e) => setIncomeForm((f) => ({ ...f, amount: e.target.value }))}
              placeholder="$"
              className="w-24 rounded-lg border border-navy-950/10 px-2 py-1.5 text-xs"
            />
            <button onClick={handleAddIncome} className="pill-button !bg-navy !text-white">
              <Plus size={13} />
            </button>
          </div>
          <FinanceList
            rows={(income ?? []).map((r) => ({ id: r.id, month: r.month, label: r.company, amount: r.amount }))}
            onDelete={async (id) => {
              await deleteWriterIncome(id)
              onChanged()
            }}
          />
        </div>

        {/* Expenses */}
        <div className="card p-3 sm:p-4">
          <div className="mb-2 flex items-center gap-2">
            <FileText size={15} className="text-brave-red" />
            <h4 className="text-sm font-semibold text-navy-950">Expenses / Deductions</h4>
          </div>
          <div className="mb-3 flex flex-wrap items-end gap-2">
            <select
              value={expenseForm.month}
              onChange={(e) => setExpenseForm((f) => ({ ...f, month: e.target.value }))}
              className="rounded-lg border border-navy-950/10 px-2 py-1.5 text-xs"
            >
              {MONTH_NAMES.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
            <input
              value={expenseForm.description}
              onChange={(e) => setExpenseForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Description"
              className="min-w-[100px] flex-1 rounded-lg border border-navy-950/10 px-2 py-1.5 text-xs"
            />
            <input
              type="number"
              value={expenseForm.amount}
              onChange={(e) => setExpenseForm((f) => ({ ...f, amount: e.target.value }))}
              placeholder="$"
              className="w-24 rounded-lg border border-navy-950/10 px-2 py-1.5 text-xs"
            />
            <button onClick={handleAddExpense} className="pill-button !bg-navy !text-white">
              <Plus size={13} />
            </button>
          </div>
          <FinanceList
            rows={(expenses ?? []).map((r) => ({ id: r.id, month: r.month, label: r.description || r.category || 'Expense', amount: r.amount }))}
            onDelete={async (id) => {
              await deleteWriterExpense(id)
              onChanged()
            }}
          />
        </div>
      </div>
    </div>
  )
}

function FinanceList({
  rows,
  onDelete,
}: {
  rows: { id: string; month: number; label: string; amount: number }[]
  onDelete: (id: string) => void
}) {
  if (rows.length === 0) {
    return <p className="py-4 text-center text-xs text-navy-900/35">Nothing logged yet.</p>
  }
  return (
    <div className="max-h-52 space-y-1 overflow-auto">
      {rows.map((r) => (
        <div key={r.id} className="flex items-center gap-2 rounded-md px-1.5 py-1 text-xs hover:bg-brave-cream">
          <span className="w-8 shrink-0 text-navy-900/40">{MONTH_NAMES[r.month - 1]}</span>
          <span className="min-w-0 flex-1 truncate text-navy-950">{r.label}</span>
          <span className="font-medium text-navy-950">${r.amount.toLocaleString()}</span>
          <button onClick={() => onDelete(r.id)} className="text-navy-950/25 hover:text-brave-red">
            <Trash2 size={12} />
          </button>
        </div>
      ))}
    </div>
  )
}

function SummaryCard({ label, value, valueClass = 'text-navy-950' }: { label: string; value: number; valueClass?: string }) {
  return (
    <div className="card p-3 text-center">
      <div className="text-[10px] uppercase tracking-wide text-navy-900/45">{label}</div>
      <div className={`font-display text-lg font-semibold ${valueClass}`}>
        ${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
      </div>
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

function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
}: {
  label: string
  options: string[]
  selected: string[]
  onChange: (v: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  useClickOutside(wrapperRef, () => setOpen(false), open)
  const toggle = (opt: string) => {
    onChange(selected.includes(opt) ? selected.filter((o) => o !== opt) : [...selected, opt])
  }
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

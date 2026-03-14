'use client'
import { useState, useMemo, useEffect } from 'react'
import { signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'

interface Trade {
  _id: string
  date: string
  day: string
  entryTime: string
  exitTime: string
  symbol: string
  type: string
  expiry: string
  strike: number
  lots: number
  lotSize: number
  entry: number
  exit: number
  grossPnL: number
  charges: number
  netPnL: number
  setupValid: boolean
  rulesFollowed: boolean
  notes?: string
}

export default function DashboardClient({
  trades,
  userName,
}: {
  trades: Trade[]
  userName: string
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Modal States
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null)

  // Filtering states
  const [filterPeriod, setFilterPeriod] = useState<'all' | 'today' | 'weekly' | 'monthly' | 'custom'>('all')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    entryTime: '',
    exitTime: '',
    symbol: 'NIFTY',
    type: 'CE' as 'CE' | 'PE',
    expiry: new Date().toISOString().split('T')[0],
    strike: '',
    lots: '',
    lotSize: 25,
    entry: '',
    exit: '',
    charges: '',
    setupValid: false,
    rulesFollowed: false,
    notes: '',
  })

  const lotsNum = Number(form.lots) || 0
  const lotSizeNum = Number(form.lotSize) || 0
  const entryNum = Number(form.entry) || 0
  const exitNum = Number(form.exit) || 0
  const chargesNum = Number(form.charges) || 0
  const grossPnLCalc = (exitNum - entryNum) * lotsNum * lotSizeNum
  const netPnLCalc = grossPnLCalc - chargesNum

  // Simple toast auto-hide
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
  }

  async function deleteTrade(id: string) {
    if (!confirm('Are you sure you want to delete this trade?')) return
    const res = await fetch(`/api/trades/${id}`, { method: 'DELETE' })
    if (res.ok) {
      showToast('Trade deleted successfully', 'success')
      router.refresh()
    } else {
      showToast('Failed to delete trade', 'error')
    }
  }

  async function handleAddTrade(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const day = new Date(form.date).toLocaleDateString('en-US', { weekday: 'long' })

    const payload = {
      ...form,
      day,
      strike: Number(form.strike),
      lots: Number(form.lots),
      lotSize: Number(form.lotSize),
      entry: Number(form.entry),
      exit: Number(form.exit),
      charges: Number(form.charges),
    }

    const res = await fetch('/api/trades', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
    })

    if (res.ok) {
      setForm({
        ...form,
        entryTime: '',
        exitTime: '',
        strike: '',
        lots: '',
        entry: '',
        exit: '',
        charges: '',
        notes: '',
        setupValid: false,
        rulesFollowed: false,
      })
      setIsModalOpen(false)
      showToast('Trade saved successfully!', 'success')
      router.refresh()
    } else {
      showToast('Failed to save trade', 'error')
    }
    setLoading(false)
  }

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 6

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [filterPeriod, customStart, customEnd])

  // Derived filtered trades
  const filteredTrades = useMemo(() => {
    return trades.filter((t) => {
      const tradeDate = new Date(t.date)
      const now = new Date()
      // Reset hours for pure date matching
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

      if (filterPeriod === 'today') {
        const td = new Date(tradeDate.getFullYear(), tradeDate.getMonth(), tradeDate.getDate())
        return td.getTime() === today.getTime()
      } else if (filterPeriod === 'weekly') {
        // Simple: within last 7 days from today
        const maxPast = new Date(today)
        maxPast.setDate(maxPast.getDate() - 7)
        return tradeDate >= maxPast && tradeDate <= now
      } else if (filterPeriod === 'monthly') {
        // Within current month
        return tradeDate.getFullYear() === now.getFullYear() && tradeDate.getMonth() === now.getMonth()
      } else if (filterPeriod === 'custom') {
        if (!customStart && !customEnd) return true
        let isValid = true
        if (customStart) {
          isValid = isValid && tradeDate >= new Date(customStart)
        }
        if (customEnd) {
          isValid = isValid && tradeDate <= new Date(customEnd)
        }
        return isValid
      }
      return true
    })
  }, [trades, filterPeriod, customStart, customEnd])

  // Calculate paginated trades
  const totalPages = Math.max(1, Math.ceil(filteredTrades.length / itemsPerPage))
  const paginatedTrades = useMemo(() => {
    const startIdx = (currentPage - 1) * itemsPerPage
    return filteredTrades.slice(startIdx, startIdx + itemsPerPage)
  }, [filteredTrades, currentPage, itemsPerPage])

  // Recalculate stats based on ALL filtered trades (not just current page)
  const currentStats = useMemo(() => {
    const validTrades = filteredTrades.filter(t => typeof t.netPnL === 'number')
    const totalTrades = validTrades.length

    const totalPnL = validTrades.reduce((sum, t) => sum + (t.netPnL ?? 0), 0)
    const winningTrades = validTrades.filter((t) => (t.netPnL ?? 0) > 0)
    const losingTrades = validTrades.filter((t) => (t.netPnL ?? 0) < 0)

    const winRate = totalTrades > 0 ? Math.round((winningTrades.length / totalTrades) * 100) : 0

    const avgWin = winningTrades.length > 0
      ? winningTrades.reduce((sum, t) => sum + t.netPnL, 0) / winningTrades.length
      : 0

    const avgLoss = losingTrades.length > 0
      ? Math.abs(losingTrades.reduce((sum, t) => sum + t.netPnL, 0)) / losingTrades.length
      : 0

    const grossProfit = winningTrades.reduce((sum, t) => sum + t.grossPnL, 0)
    const grossLoss = losingTrades.reduce((sum, t) => sum + Math.abs(t.grossPnL), 0)
    const profitFactor = grossLoss !== 0 ? (grossProfit / grossLoss).toFixed(2) : (grossProfit > 0 ? '∞' : '0')
    const totalBrokerage = validTrades.reduce((sum, t) => sum + (t.charges ?? 0), 0)

    let maxProfitId = null
    let maxLossId = null

    if (winningTrades.length > 0) {
      maxProfitId = winningTrades.reduce((max, t) => (t.netPnL > max.netPnL ? t : max), winningTrades[0])._id
    }
    if (losingTrades.length > 0) {
      maxLossId = losingTrades.reduce((min, t) => (t.netPnL < min.netPnL ? t : min), losingTrades[0])._id
    }

    return { totalTrades, winRate, totalPnL, avgWin, avgLoss, profitFactor, totalBrokerage, maxProfitId, maxLossId }
  }, [filteredTrades])

  return (
    <div className="min-h-screen bg-gray-50/50 text-gray-900 font-sans relative">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-lg shadow-xl font-medium text-sm transition-all animate-fade-in-down ${toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
          }`}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <header className="border-b border-gray-200 bg-white shadow-sm sticky top-0 z-10 w-full">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Option Tracker
          </h1>
          <div className="flex items-center gap-4">
            <span className="text-gray-600 text-sm font-medium">Hello, {userName}</span>
            <button
              onClick={() => signOut({ callbackUrl: '/' })}
              className="text-sm font-medium text-gray-500 hover:text-red-600 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">

        {/* Controls Row */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-gray-600 mr-2">Filter:</span>
            {[
              { id: 'all', label: 'All Time' },
              { id: 'today', label: 'Today' },
              { id: 'weekly', label: '7 Days' },
              { id: 'monthly', label: 'This Month' },
              { id: 'custom', label: 'Custom' },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setFilterPeriod(f.id as any)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${filterPeriod === f.id ? 'bg-indigo-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
              >
                {f.label}
              </button>
            ))}

            {filterPeriod === 'custom' && (
              <div className="flex items-center gap-2 ml-2 animate-fade-in">
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="rounded border border-gray-300 bg-gray-50 text-xs px-2 py-1.5"
                />
                <span className="text-gray-400 text-xs">to</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="rounded border border-gray-300 bg-gray-50 text-xs px-2 py-1.5"
                />
              </div>
            )}
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2.5 rounded-xl shadow-sm transition-colors text-sm flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            Log New Trade
          </button>
        </div>

        {/* Dashboard Stats Bar */}
        <div className="grid grid-cols-2 lg:grid-cols-7 gap-4 mb-8">
          {[
            { label: 'Trades Logged', value: currentStats.totalTrades },
            { label: 'Win Rate', value: `${currentStats.winRate}%` },
            {
              label: 'Net P&L',
              value: `₹${currentStats.totalPnL.toFixed(2)}`,
              color: currentStats.totalPnL >= 0 ? 'text-emerald-600' : 'text-red-500',
            },
            { label: 'Avg Win', value: `₹${currentStats.avgWin.toFixed(2)}`, color: 'text-emerald-600' },
            { label: 'Avg Loss', value: `₹${currentStats.avgLoss.toFixed(2)}`, color: 'text-red-500' },
            { label: 'Profit Factor', value: currentStats.profitFactor },
            { label: 'Brokerage', value: `₹${currentStats.totalBrokerage.toFixed(2)}`, color: 'text-orange-500' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white border text-center border-gray-100 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
              <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-1">{label}</p>
              <p className={`text-xl md:text-2xl font-bold ${color ?? 'text-gray-900'}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Trade Journal Table Full Width */}
        <div className="bg-white shadow-sm border border-gray-200 overflow-hidden w-full mb-8">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50/80">
            <h2 className="text-lg font-bold text-gray-800">Trade Journal</h2>
            <span className="text-sm text-gray-500 font-medium bg-white border border-gray-200 shadow-sm px-3 py-1 rounded-md">{filteredTrades.length} records found</span>
          </div>

          {filteredTrades.length === 0 ? (
            <div className="text-center py-20 text-gray-500 bg-white">
              <svg className="mx-auto h-12 w-12 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
              <p className="text-base font-semibold text-gray-700">No trades found</p>
              <p className="text-sm mt-1">Try adjusting your filters or log a new trade.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead className="bg-gray-100 text-gray-600 border-b-2 border-gray-200 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4 font-semibold whitespace-nowrap border-r border-gray-200">Date & Time</th>
                    <th className="py-3 px-4 font-semibold border-r border-gray-200">Symbol</th>
                    <th className="py-3 px-4 font-semibold border-r border-gray-200">Details</th>
                    <th className="py-3 px-4 font-semibold text-right border-r border-gray-200">Entry / Exit</th>
                    <th className="py-3 px-4 font-semibold text-right whitespace-nowrap border-r border-gray-200">Net P&L</th>
                    <th className="py-3 px-4 font-semibold text-center w-24">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {paginatedTrades.map((trade) => {
                    const isProfit = trade.netPnL >= 0
                    const isMaxProfit = trade._id === currentStats.maxProfitId
                    const isMaxLoss = trade._id === currentStats.maxLossId

                    return (
                      <tr
                        key={trade._id}
                        className={`hover:bg-blue-50/30 transition-colors ${isProfit ? 'bg-emerald-50/5' : 'bg-red-50/5'
                          } ${isMaxProfit ? 'border-l-4 border-l-emerald-500' : ''}
                           ${isMaxLoss ? 'border-l-4 border-l-red-500' : ''}`}
                      >
                        <td className="py-3 px-4 align-top border-r border-gray-200">
                          <p className="font-semibold text-gray-800 whitespace-nowrap">
                            <span suppressHydrationWarning>{new Date(trade.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                          </p>
                          <p className="text-xs text-gray-500 font-medium">{trade.entryTime} - {trade.exitTime}</p>
                        </td>
                        <td className="py-3 px-4 align-top border-r border-gray-200">
                          <p className="font-bold text-gray-800">{trade.symbol}</p>
                        </td>
                        <td className="py-3 px-4 align-top max-w-[250px] border-r border-gray-200">
                          <div className="flex items-center gap-1.5 mb-1 text-xs">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${trade.type === 'CE' ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-red-100 text-red-700 border border-red-200'
                              }`}>
                              {trade.type}
                            </span>
                            <span className="font-medium text-gray-700">Strike: {trade.strike}</span>
                          </div>
                          <p className="text-[11px] text-gray-600 whitespace-nowrap">
                            {trade.lots} lots ({trade.lots * trade.lotSize} qty) • exp {new Date(trade.expiry).toLocaleDateString(undefined, { month: '2-digit', day: '2-digit' })}
                          </p>
                        </td>
                        <td className="py-3 px-4 text-right align-top border-r border-gray-200">
                          <p className="text-gray-800 font-medium">₹{trade.entry}</p>
                          <p className="text-gray-500 text-xs">₹{trade.exit}</p>
                        </td>
                        <td className="py-3 px-4 text-right align-top border-r border-gray-200">
                          <div className="flex flex-col items-end">
                            <p className={`font-bold text-base ${isProfit ? 'text-emerald-700' : 'text-red-600'}`}>
                              {isProfit ? '+' : ''}₹{trade.netPnL.toFixed(2)}
                            </p>
                            {isMaxProfit && <span className="mt-0.5 px-1.5 py-0.5 bg-emerald-100 text-emerald-800 text-[9px] font-bold rounded border border-emerald-200 uppercase tracking-widest shadow-sm">Highest Profit</span>}
                            {isMaxLoss && <span className="mt-0.5 px-1.5 py-0.5 bg-red-100 text-red-800 text-[9px] font-bold rounded border border-red-200 uppercase tracking-widest shadow-sm">Highest Loss</span>}
                            {trade.charges > 0 && !isMaxProfit && !isMaxLoss && (
                              <p className="text-[10px] text-gray-500 mt-0.5">chg: ₹{trade.charges}</p>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center align-middle">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => setSelectedTrade(trade)}
                              title="View Trade"
                              className="text-gray-400 hover:text-indigo-600 p-1.5 rounded hover:bg-indigo-50 transition-colors inline-flex justify-center"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                            </button>
                            <button
                              onClick={() => deleteTrade(trade._id)}
                              title="Delete Trade"
                              className="text-gray-400 hover:text-red-600 p-1.5 rounded hover:bg-red-50 transition-colors inline-flex justify-center"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="px-6 py-4 bg-gray-50 flex items-center justify-between border-t border-gray-200">
                  <span className="text-sm font-medium text-gray-600">
                    Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredTrades.length)} of {filteredTrades.length} trades
                  </span>
                  <div className="flex gap-1 shadow-sm rounded-md">
                    <button
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      className="px-3 py-1.5 text-sm font-medium rounded-l-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Previous
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`w-10 h-auto flex items-center justify-center text-sm font-medium border-y border-r border-gray-300 transition-colors ${currentPage === page
                          ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700'
                          : 'bg-white text-gray-700 hover:bg-gray-50'
                          }`}
                      >
                        {page}
                      </button>
                    ))}
                    <button
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      className="px-3 py-1.5 text-sm font-medium rounded-r-md border-y border-r border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Modal - New Trade */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto overflow-x-hidden p-6 relative">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 p-2 rounded-full hover:bg-gray-100 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>

            <h2 className="text-xl font-bold text-gray-800 border-b border-gray-100 pb-4 mb-6 pr-8">Log New Trade</h2>

            <form onSubmit={handleAddTrade} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="w-full rounded-lg border-gray-300 bg-gray-50 text-sm focus:ring-2 focus:ring-indigo-500 p-2 border"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Entry Time*</label>
                  <input
                    type="time"
                    required
                    value={form.entryTime}
                    onChange={(e) => setForm({ ...form, entryTime: e.target.value })}
                    className="w-full rounded-lg border-gray-300 bg-gray-50 text-sm focus:ring-2 focus:ring-indigo-500 p-2 border"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Exit Time*</label>
                  <input
                    type="time"
                    required
                    value={form.exitTime}
                    onChange={(e) => setForm({ ...form, exitTime: e.target.value })}
                    className="w-full rounded-lg border-gray-300 bg-gray-50 text-sm focus:ring-2 focus:ring-indigo-500 p-2 border"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Symbol</label>
                  <select
                    value={form.symbol}
                    onChange={(e) => setForm({ ...form, symbol: e.target.value })}
                    className="w-full rounded-lg border-gray-300 bg-gray-50 text-sm focus:ring-2 focus:ring-indigo-500 p-2 border"
                  >
                    {['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY', 'SENSEX', 'BANKEX'].map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value as 'CE' | 'PE' })}
                    className="w-full rounded-lg border-gray-300 bg-gray-50 text-sm focus:ring-2 focus:ring-indigo-500 p-2 border"
                  >
                    <option value="CE">CE (Call)</option>
                    <option value="PE">PE (Put)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Expiry Date</label>
                  <input
                    type="date"
                    required
                    value={form.expiry}
                    onChange={(e) => setForm({ ...form, expiry: e.target.value })}
                    className="w-full rounded-lg border-gray-300 bg-gray-50 text-sm focus:ring-2 focus:ring-indigo-500 p-2 border"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Strike Price</label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 21000"
                    value={form.strike}
                    onChange={(e) => setForm({ ...form, strike: e.target.value })}
                    className="w-full rounded-lg border-gray-300 bg-gray-50 text-sm focus:ring-2 focus:ring-indigo-500 p-2 border"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Lots</label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 2"
                    value={form.lots}
                    onChange={(e) => setForm({ ...form, lots: e.target.value })}
                    className="w-full rounded-lg border-gray-300 bg-gray-50 text-sm focus:ring-2 focus:ring-indigo-500 p-2 border"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Lot Size</label>
                  <input
                    type="number"
                    required
                    value={form.lotSize}
                    onChange={(e) => setForm({ ...form, lotSize: Number(e.target.value) })}
                    className="w-full rounded-lg border-gray-300 bg-gray-50 text-sm focus:ring-2 focus:ring-indigo-500 p-2 border"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Entry Price (₹)</label>
                  <input
                    type="number"
                    required
                    step="0.05"
                    value={form.entry}
                    onChange={(e) => setForm({ ...form, entry: e.target.value })}
                    className="w-full rounded-lg border-gray-300 bg-gray-50 text-sm focus:ring-2 focus:ring-indigo-500 p-2 border"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Exit Price (₹)</label>
                  <input
                    type="number"
                    required
                    step="0.05"
                    value={form.exit}
                    onChange={(e) => setForm({ ...form, exit: e.target.value })}
                    className="w-full rounded-lg border-gray-300 bg-gray-50 text-sm focus:ring-2 focus:ring-indigo-500 p-2 border"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Brokerage & Charges (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={form.charges}
                    onChange={(e) => setForm({ ...form, charges: e.target.value })}
                    className="w-full rounded-lg border-gray-300 bg-gray-50 text-sm focus:ring-2 focus:ring-indigo-500 p-2 border"
                  />
                </div>
              </div>

              <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-between">
                <div className="text-sm">
                  <span className="text-gray-500 block text-xs">Gross P&L</span>
                  <span className={`font-semibold ${grossPnLCalc >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    ₹{grossPnLCalc.toFixed(2)}
                  </span>
                </div>
                <div className="text-right text-sm">
                  <span className="text-gray-500 block text-xs">Net P&L</span>
                  <span className={`font-bold text-lg ${netPnLCalc >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    ₹{netPnLCalc.toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="flex gap-6 py-2">
                <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.setupValid}
                    onChange={(e) => setForm({ ...form, setupValid: e.target.checked })}
                    className="rounded text-indigo-600 focus:ring-indigo-500 border-gray-300 w-4 h-4 cursor-pointer"
                  />
                  Setup Valid
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.rulesFollowed}
                    onChange={(e) => setForm({ ...form, rulesFollowed: e.target.checked })}
                    className="rounded text-indigo-600 focus:ring-indigo-500 border-gray-300 w-4 h-4 cursor-pointer"
                  />
                  Rules Followed
                </label>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                <textarea
                  rows={4}
                  placeholder="What went well? Mistakes?"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full rounded-lg border-gray-300 bg-gray-50 text-sm focus:ring-2 focus:ring-indigo-500 p-2 border resize-y min-h-[100px]"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition-all shadow-sm shadow-indigo-200 active:scale-[0.98]"
                >
                  {loading ? 'Saving Trade...' : 'Save Trade'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal - View Trade Details */}
      {selectedTrade && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden relative animate-fade-in-down border border-gray-100">

            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-gray-50/50">
              <div>
                <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  {selectedTrade.symbol}
                  <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${selectedTrade.type === 'CE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                    {selectedTrade.type}
                  </span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5" suppressHydrationWarning>
                  {new Date(selectedTrade.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}<br />
                  <span className="font-semibold">{selectedTrade.entryTime}</span> to <span className="font-semibold">{selectedTrade.exitTime}</span>
                </p>
              </div>
              <button
                onClick={() => setSelectedTrade(null)}
                className="text-gray-400 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 p-2 rounded-full transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-5">

              {/* Core Details Grid */}
              <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                <div>
                  <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1">Contract</p>
                  <p className="font-semibold text-gray-800 text-sm">Strike {selectedTrade.strike}</p>
                  <p className="text-xs text-gray-600 mt-0.5">{selectedTrade.lots} lots × {selectedTrade.lotSize}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1">Expiry</p>
                  <p className="font-semibold text-gray-800 text-sm" suppressHydrationWarning>
                    {new Date(selectedTrade.expiry).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {/* Financials Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white border text-center border-gray-100 rounded-xl p-3 shadow-sm">
                  <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1">Entry</p>
                  <p className="font-bold text-gray-800 text-lg">₹{selectedTrade.entry}</p>
                </div>
                <div className="bg-white border text-center border-gray-100 rounded-xl p-3 shadow-sm">
                  <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1">Exit</p>
                  <p className="font-bold text-gray-800 text-lg">₹{selectedTrade.exit}</p>
                </div>
              </div>

              {/* P&L Breakdown */}
              <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm flex flex-col gap-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500 font-medium">Gross P&L</span>
                  <span className={`font-semibold ${selectedTrade.grossPnL >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {selectedTrade.grossPnL >= 0 ? '+' : ''}₹{selectedTrade.grossPnL.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500 font-medium">Charges / Brokerage</span>
                  <span className="font-semibold text-orange-500">- ₹{(selectedTrade.charges || 0).toFixed(2)}</span>
                </div>
                <div className="pt-2 border-t border-gray-100 flex justify-between items-center">
                  <span className="text-gray-800 font-bold uppercase text-xs tracking-wider">Net P&L</span>
                  <span className={`font-black text-xl ${selectedTrade.netPnL >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {selectedTrade.netPnL >= 0 ? '+' : ''}₹{selectedTrade.netPnL.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Rules & Notes */}
              <div className="space-y-4 pt-2">
                <div className="flex gap-4">
                  <div className={`flex-1 flex flex-col items-center justify-center p-3 rounded-xl border ${selectedTrade.setupValid ? 'bg-emerald-50/50 border-emerald-100' : 'bg-gray-50 border-gray-200'}`}>
                    <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1">Setup Valid</span>
                    {selectedTrade.setupValid ? (
                      <svg className="w-6 h-6 text-emerald-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                    ) : (
                      <svg className="w-6 h-6 text-gray-300" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>
                    )}
                  </div>
                  <div className={`flex-1 flex flex-col items-center justify-center p-3 rounded-xl border ${selectedTrade.rulesFollowed ? 'bg-emerald-50/50 border-emerald-100' : 'bg-red-50/30 border-red-100'}`}>
                    <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1">Rules Followed</span>
                    {selectedTrade.rulesFollowed ? (
                      <svg className="w-6 h-6 text-emerald-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    ) : (
                      <svg className="w-6 h-6 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    )}
                  </div>
                </div>

                {selectedTrade.notes && (
                  <div className="bg-yellow-50/50 border border-yellow-100 p-4 rounded-xl">
                    <h4 className="text-[10px] uppercase font-bold text-yellow-600 tracking-wider mb-2 flex items-center gap-1.5">
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                      Trade Notes
                    </h4>
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                      {selectedTrade.notes}
                    </p>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      )}
      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes fadeInDown {
          0% { opacity: 0; transform: translate(-50%, -20px); }
          100% { opacity: 1; transform: translate(-50%, 0); }
        }
        @keyframes fadeIn {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        .animate-fade-in-down {
          animation: fadeInDown 0.3s ease-out forwards;
        }
        .animate-fade-in {
          animation: fadeIn 0.3s ease-out forwards;
        }
      `}} />
    </div>
  )
}

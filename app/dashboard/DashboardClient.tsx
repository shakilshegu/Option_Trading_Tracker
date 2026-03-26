'use client'
import { useState, useMemo, useEffect, useRef } from 'react'
import { signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'

interface Trade {
  _id: string
  date: string
  day: string
  entryTime: string
  exitTime: string
  symbol: string
  direction: 'BUY' | 'SELL'
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
  isChallengeTrade?: boolean
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
  const [isChallengeModal, setIsChallengeModal] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Modal States
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null)

  // Delete Confirmation State
  const [tradeToDelete, setTradeToDelete] = useState<string | null>(null)
  const [deletePassword, setDeletePassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Tab State
  const [activeTab, setActiveTab] = useState<'journal' | 'challenge'>('journal')

  // Filtering states
  const [filterPeriod, setFilterPeriod] = useState<'all' | 'today' | 'weekly' | 'monthly' | 'custom' | 'profitable' | 'loss'>('all')
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false)
  const filterMenuRef = useRef<HTMLDivElement>(null)
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    entryTime: '',
    exitTime: '',
    symbol: 'NIFTY',
    direction: 'BUY' as 'BUY' | 'SELL',
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

  const validLots = Number(form.lots) || 0
  const validLotSize = Number(form.lotSize) || 0
  const validEntry = Number(form.entry) || 0
  const validExit = Number(form.exit) || 0
  const validCharges = Number(form.charges) || 0

  const grossPnLCalc = form.direction === 'BUY'
    ? (validExit - validEntry) * validLots * validLotSize
    : (validEntry - validExit) * validLots * validLotSize

  const netPnLCalc = grossPnLCalc - validCharges

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

  function promptDeleteTrade(id: string) {
    setTradeToDelete(id)
    setDeletePassword('')
  }

  async function confirmDeleteTrade() {
    if (!tradeToDelete) return
    if (!deletePassword) {
      showToast('Please enter your password', 'error')
      return
    }

    setIsDeleting(true)
    const res = await fetch(`/api/trades/${tradeToDelete}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: deletePassword })
    })

    if (res.ok) {
      showToast('Trade deleted successfully', 'success')
      setTradeToDelete(null)
      setDeletePassword('')
      router.refresh()
    } else {
      const data = await res.json()
      showToast(data.error || 'Failed to delete trade', 'error')
    }
    setIsDeleting(false)
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
      isChallengeTrade: isChallengeModal,
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

  // Close filter dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (filterMenuRef.current && !filterMenuRef.current.contains(event.target as Node)) {
        setIsFilterMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Derived filtered trades
  const filteredTrades = useMemo(() => {
    return trades.filter((t) => {
      // Tab-specific split
      if (activeTab === 'journal' && t.isChallengeTrade) return false
      if (activeTab === 'challenge' && !t.isChallengeTrade) return false

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
      } else if (filterPeriod === 'profitable') {
        return (t.netPnL ?? 0) > 0
      } else if (filterPeriod === 'loss') {
        return (t.netPnL ?? 0) < 0
      }
      return true
    })
  }, [trades, filterPeriod, customStart, customEnd, activeTab])

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

  // Real-time Rule Validation
  const ruleChecks = useMemo(() => {
    const isNifty50 = form.symbol === 'NIFTY'
    const isBuy = form.direction === 'BUY'
    const instrumentValid = isNifty50 && isBuy
    
    const premiumVal = Number(form.entry) || 0
    const premiumValid = premiumVal >= 100 && premiumVal <= 160
    
    let timeValid = false
    if (form.entryTime) {
      const [h, m] = form.entryTime.split(':').map(Number)
      const minutes = h * 60 + m
      const window1 = minutes >= (9 * 60 + 30) && minutes <= (11 * 60 + 30)
      const window2 = minutes >= (14 * 60) && minutes <= (15 * 60 + 15)
      timeValid = window1 || window2
    }

    const lotsValid = Number(form.lots) === 1

    const tradesOnDate = trades.filter(t => new Date(t.date).toISOString().split('T')[0] === form.date)
    const limitValid = tradesOnDate.length === 0

    return {
      instrumentValid,
      premiumValid,
      timeValid,
      lotsValid,
      limitValid,
      allValid: instrumentValid && premiumValid && timeValid && lotsValid && limitValid
    }
  }, [form.symbol, form.direction, form.entry, form.entryTime, form.lots, form.date, trades])

  useEffect(() => {
    if (isChallengeModal) {
      setForm(prev => ({ ...prev, rulesFollowed: ruleChecks.allValid }))
    }
  }, [ruleChecks.allValid, isChallengeModal])

  // Tracker Logic
  const trackerData = useMemo(() => {
    const activeDates = new Map<string, Trade[]>()
    trades.filter(t => t.isChallengeTrade).forEach(t => {
      const d = new Date(t.date).toISOString().split('T')[0]
      if (!activeDates.has(d)) activeDates.set(d, [])
      activeDates.get(d)!.push(t)
    })

    const sortedDates = Array.from(activeDates.keys()).sort()
    let currentStreak = 0

    sortedDates.forEach(dateStr => {
      const dayTrades = activeDates.get(dateStr)!
      let isWin = false
      
      if (dayTrades.length === 1 && dayTrades[0].rulesFollowed) {
        isWin = true
      }

      if (isWin) {
        currentStreak += 1
      } else {
        currentStreak = 0
      }
    })

    return { currentStreak: Math.min(currentStreak, 100) }
  }, [trades])

  return (
    <div className="min-h-screen bg-gray-50/50 text-gray-900 font-sans relative">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-lg shadow-xl font-medium text-sm transition-all animate-fade-in-down ${toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
          }`}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <header className="border-b border-gray-200 bg-white shadow-sm sticky top-0 z-10 w-full">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent hidden sm:block">
            Option Tracker
          </h1>
          
          <div className="flex bg-gray-100/80 p-1 rounded-xl border border-gray-200/60 shadow-inner">
            <button
              onClick={() => setActiveTab('journal')}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${activeTab === 'journal' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Trade Journal
            </button>
            <button
              onClick={() => setActiveTab('challenge')}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${activeTab === 'challenge' ? 'bg-indigo-600 shadow text-white' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
              100-Day Challenge
            </button>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-gray-600 text-sm font-medium hidden md:inline-block">Hello, {userName}</span>
            <button
              onClick={() => signOut({ callbackUrl: '/' })}
              className="text-sm font-medium text-gray-400 hover:text-red-600 transition-colors"
              title="Sign out"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">

        {/* Controls Row */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
          <div className="flex flex-wrap items-center gap-2 relative" ref={filterMenuRef}>
            <span className="text-sm font-semibold text-gray-600 mr-2">Filter:</span>
            {[
              { id: 'all', label: 'All Time' },
              { id: 'today', label: 'Today' },
              { id: 'weekly', label: '7 Days' },
              { id: 'monthly', label: 'This Month' },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => {
                  setFilterPeriod(f.id as any)
                  setIsFilterMenuOpen(false)
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${filterPeriod === f.id ? 'bg-indigo-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
              >
                {f.label}
              </button>
            ))}

            {/* Advanced Filters Dropdown button */}
            <button
              onClick={() => setIsFilterMenuOpen(!isFilterMenuOpen)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${['profitable', 'loss', 'custom'].includes(filterPeriod) || isFilterMenuOpen
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
              Advanced
            </button>

            {/* Dropdown Menu */}
            {isFilterMenuOpen && (
              <div className="absolute top-full lg:left-full mt-2 lg:ml-2 bg-white border border-gray-100 shadow-xl rounded-xl p-3 z-20 min-w-[200px] animate-fade-in-down">
                <div className="flex flex-col gap-1.5">
                  <h4 className="text-[10px] uppercase font-bold text-gray-400 tracking-wider px-2 py-1">Outcome</h4>
                  <button
                    onClick={() => { setFilterPeriod('profitable'); setIsFilterMenuOpen(false); }}
                    className={`text-left px-3 py-1.5 text-xs font-medium rounded-md hover:bg-gray-50 transition-colors ${filterPeriod === 'profitable' ? 'text-indigo-600 bg-indigo-50/50' : 'text-gray-700'}`}
                  >
                    Most Profitable
                  </button>
                  <button
                    onClick={() => { setFilterPeriod('loss'); setIsFilterMenuOpen(false); }}
                    className={`text-left px-3 py-1.5 text-xs font-medium rounded-md hover:bg-gray-50 transition-colors ${filterPeriod === 'loss' ? 'text-indigo-600 bg-indigo-50/50' : 'text-gray-700'}`}
                  >
                    Most Loss
                  </button>

                  <div className="h-px bg-gray-100 my-1"></div>

                  <h4 className="text-[10px] uppercase font-bold text-gray-400 tracking-wider px-2 py-1">Time Range</h4>
                  <button
                    onClick={() => setFilterPeriod('custom')}
                    className={`text-left px-3 py-1.5 text-xs font-medium rounded-md hover:bg-gray-50 transition-colors ${filterPeriod === 'custom' ? 'text-indigo-600 bg-indigo-50/50' : 'text-gray-700'}`}
                  >
                    Custom Dates
                  </button>

                  {filterPeriod === 'custom' && (
                    <div className="flex flex-col gap-2 mt-1 px-2 pb-1">
                      <input
                        type="date"
                        value={customStart}
                        onChange={(e) => setCustomStart(e.target.value)}
                        className="rounded border border-gray-300 bg-gray-50 text-[11px] px-2 py-1.5 w-full focus:ring-1 focus:ring-indigo-500"
                      />
                      <span className="text-gray-400 text-[10px] text-center">to</span>
                      <input
                        type="date"
                        value={customEnd}
                        onChange={(e) => setCustomEnd(e.target.value)}
                        className="rounded border border-gray-300 bg-gray-50 text-[11px] px-2 py-1.5 w-full focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            {activeTab === 'journal' ? (
              <button
                onClick={() => { setIsChallengeModal(false); setIsModalOpen(true); }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2.5 rounded-xl shadow-sm transition-colors text-sm flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                Log New Trade
              </button>
            ) : (
              <button
                onClick={() => { setIsChallengeModal(true); setIsModalOpen(true); }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2.5 rounded-xl shadow-sm transition-colors text-sm flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                Log Challenge Trade
              </button>
            )}
          </div>
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

        {/* 100-Day Discipline Challenge Card */}
        <div style={{ display: activeTab === 'challenge' ? 'block' : 'none' }}>
        <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 shadow-xl shadow-indigo-900/10 mb-8 relative overflow-hidden ring-1 ring-white/10">
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
            <svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
          </div>
          
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-5">
              <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest flex items-center gap-1.5 shadow-inner">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                </span>
                Active Challenge
              </span>
              <h2 className="text-xl font-bold text-white tracking-tight">100-Day Nifty 50 Discipline</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Box 1 */}
              <div className="bg-white/5 rounded-xl p-4 backdrop-blur-md border border-white/10 hover:bg-white/10 transition-colors shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-4 h-4 text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <h3 className="text-indigo-200 text-xs font-bold uppercase tracking-wider">Setup & Instrument</h3>
                </div>
                <ul className="space-y-2 text-sm text-gray-300">
                  <li className="flex items-start gap-2"><span className="text-indigo-500 mt-0.5">•</span> <span><strong className="text-white font-medium">Nifty 50 Options</strong> (CE/PE Buy Only)</span></li>
                  <li className="flex items-start gap-2"><span className="text-indigo-500 mt-0.5">•</span> <span>Premium: <strong className="text-white font-medium">₹100 – ₹160</strong></span></li>
                  <li className="flex items-start gap-2"><span className="text-indigo-500 mt-0.5">•</span> <span>Delta: <strong className="text-white font-medium">0.4 – 0.6</strong> (Balanced Risk)</span></li>
                </ul>
              </div>
              
              {/* Box 2 */}
              <div className="bg-white/5 rounded-xl p-4 backdrop-blur-md border border-white/10 hover:bg-white/10 transition-colors shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-4 h-4 text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <h3 className="text-indigo-200 text-xs font-bold uppercase tracking-wider">Execution Timing</h3>
                </div>
                <ul className="space-y-2 text-sm text-gray-300">
                  <li className="flex items-start gap-2"><span className="text-emerald-400 mt-0.5">✓</span> <span>Morning: <strong className="text-white font-medium">9:30 AM – 11:30 AM</strong></span></li>
                  <li className="flex items-start gap-2"><span className="text-emerald-400 mt-0.5">✓</span> <span>Afternoon: <strong className="text-white font-medium">2:00 PM – 3:15 PM</strong></span></li>
                  <li className="flex items-start gap-2"><span className="text-indigo-500 mt-0.5">•</span> <span>Limit: <strong className="text-white font-medium bg-white/10 px-1.5 py-0.5 rounded">1 Trade/Day</strong> | <strong className="text-white font-medium bg-white/10 px-1.5 py-0.5 rounded">1 Lot</strong></span></li>
                </ul>
              </div>

              {/* Box 3 - Strict Rule */}
              <div className="bg-gradient-to-br from-red-500/10 to-red-900/20 rounded-xl p-4 backdrop-blur-md border border-red-500/20 hover:border-red-500/30 transition-colors flex flex-col justify-center relative overflow-hidden group shadow-sm">
                <div className="absolute inset-0 bg-red-500/5 group-hover:bg-red-500/10 transition-colors pointer-events-none"></div>
                <div className="relative z-10 flex flex-col gap-3 h-full justify-between">
                  <div className="flex items-center justify-between">
                     <h3 className="text-red-300 text-xs font-bold uppercase tracking-widest bg-red-500/10 px-2 py-1 rounded inline-block border border-red-500/20">Target Rule</h3>
                  </div>
                  <div className="text-center bg-black/20 rounded-lg py-2.5 border border-red-500/10 shadow-inner">
                    <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-1 font-medium">Risk : Reward Min</p>
                    <p className="text-2xl font-black text-white tracking-tight drop-shadow-sm">1 : 2</p>
                  </div>
                  <div className="bg-red-500/20 px-3 py-2.5 rounded-lg border border-red-500/30 flex items-center gap-2.5 shadow-sm">
                    <span className="text-lg animate-pulse drop-shadow-md">🚨</span>
                    <p className="text-xs font-medium text-red-100 leading-tight">
                      Break any rule → <span className="text-white font-bold bg-gradient-to-r from-red-600 to-red-700 px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap">Restart Day 1 ✅</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Visual 100-Day Tracker Grid */}
            <div className="mt-8 pt-6 border-t border-white/10">
              <div className="flex flex-col md:flex-row items-start md:items-end justify-between mb-4 gap-4">
                <div>
                  <h3 className="text-white font-bold tracking-wide text-lg flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                    Current Streak: <span className="text-emerald-400">{trackerData.currentStreak} <span className="text-gray-400 text-sm font-medium">/ 100 Days</span></span>
                  </h3>
                  <p className="text-xs text-gray-400 font-medium mt-1">Completing 1 trade strictly following all rules adds a day. Any deviation resets to 0.</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 md:gap-2 bg-black/20 p-4 rounded-xl border border-white/5">
                {Array.from({ length: 100 }).map((_, i) => {
                  const isCompleted = i < trackerData.currentStreak;
                  const isCurrent = i === trackerData.currentStreak;
                  return (
                    <div 
                      key={i} 
                      className={`w-[18px] h-[18px] md:w-5 md:h-5 rounded-[4px] md:rounded-md transition-all ${
                        isCompleted ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.7)]' : 
                        isCurrent ? 'bg-indigo-500 animate-pulse ring-2 ring-indigo-400 ring-offset-2 ring-offset-slate-900 shadow-[0_0_12px_rgba(99,102,241,0.8)] z-10 scale-110' : 
                        'bg-white/5 border border-white/10'
                      }`}
                      title={`Day ${i + 1}${isCompleted ? ' (Completed)' : ''}`}
                    />
                  );
                })}
              </div>
            </div>

          </div>
        </div>
        </div>

        {/* Trade Journal Table Full Width */}
        <div className="bg-white shadow-sm border border-gray-200 overflow-hidden w-full mb-8">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50/80">
            <h2 className="text-lg font-bold text-gray-800">{activeTab === 'challenge' ? 'Challenge Trade Journal' : 'Trade Journal'}</h2>
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
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${trade.direction === 'BUY' ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'bg-purple-100 text-purple-700 border border-purple-200'
                              }`}>
                              {trade.direction === 'BUY' ? 'B' : 'S'}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${trade.type === 'CE' ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-red-100 text-red-700 border border-red-200'
                              }`}>
                              {trade.type}
                            </span>
                            <span className="font-medium text-gray-700">Strike: {trade.strike}</span>
                          </div>
                          <p className="text-[11px] text-gray-600 whitespace-nowrap" suppressHydrationWarning>
                            {trade.lots} lots ({trade.lots * trade.lotSize} qty) {trade.expiry ? `• exp ${new Date(trade.expiry).toLocaleDateString(undefined, { month: '2-digit', day: '2-digit' })}` : ''}
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
                              onClick={() => setTradeToDelete(trade._id)}
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

      {/* Delete Confirmation Modal */}
      {tradeToDelete && (
        <div className="fixed inset-0 bg-gray-900/60 flex items-center justify-center p-4 z-50 animate-fade-in backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-scale-in border border-gray-100">
            <div className="p-6">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4 mx-auto">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-600"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900 text-center mb-2">Delete Trade?</h2>
              <p className="text-sm text-gray-500 text-center mb-6">
                This action cannot be undone. Please enter your login password to confirm deletion.
              </p>

              <div className="mb-6">
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide">Enter Password</label>
                  <button
                    onClick={() => {
                      showToast('To reset your password, please sign out and use the forgot password flow (if implemented) or contact support.', 'error')
                    }}
                    className="text-[10px] text-indigo-600 font-semibold hover:underline"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    className="w-full rounded-lg border-gray-300 bg-gray-50/50 text-sm focus:ring-2 focus:ring-red-500 p-2.5 pr-10 border transition-all"
                    placeholder="••••••••"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1"
                    title={showPassword ? "Hide Password" : "Show Password"}
                  >
                    {showPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setTradeToDelete(null)
                    setDeletePassword('')
                    setShowPassword(false)
                  }}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition-all text-sm disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteTrade}
                  disabled={isDeleting || !deletePassword}
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 shadow-md shadow-red-500/30 transition-all text-sm flex justify-center items-center disabled:opacity-50"
                >
                  {isDeleting ? (
                    <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  ) : (
                    'Delete'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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

            <h2 className="text-xl font-bold text-gray-800 border-b border-gray-100 pb-4 mb-6 pr-8">
              {isChallengeModal ? 'Log Challenge Trade' : 'Log New Trade'}
            </h2>

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
                    min="09:15"
                    max="15:30"
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
                    min="09:15"
                    max="15:30"
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
                  <label className="block text-xs font-medium text-gray-600 mb-1">Direction</label>
                  <select
                    value={form.direction}
                    onChange={(e) => setForm({ ...form, direction: e.target.value as 'BUY' | 'SELL' })}
                    className="w-full rounded-lg border-gray-300 bg-gray-50 text-sm focus:ring-2 focus:ring-indigo-500 p-2 border"
                  >
                    <option value="BUY">Buy (Long)</option>
                    <option value="SELL">Sell (Short)</option>
                  </select>
                </div>
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
                {isChallengeModal ? (
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 opacity-60 cursor-not-allowed">
                    <input
                      type="checkbox"
                      checked={form.rulesFollowed}
                      readOnly
                      className="rounded text-indigo-600 border-gray-300 w-4 h-4 cursor-not-allowed pointer-events-none"
                    />
                    Rules Followed (Auto)
                  </label>
                ) : (
                  <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-700">
                    <input
                      type="checkbox"
                      checked={form.rulesFollowed}
                      onChange={(e) => setForm({ ...form, rulesFollowed: e.target.checked })}
                      className="rounded text-indigo-600 focus:ring-indigo-500 border-gray-300 w-4 h-4 cursor-pointer"
                    />
                    Rules Followed
                  </label>
                )}
              </div>

              {/* Real-Time Rule Tracker */}
              {isChallengeModal && (
                <div className="bg-slate-900 rounded-xl p-4 border border-indigo-500/30 shadow-inner mt-2">
                  <h4 className="text-indigo-200 text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                    100-Day Challenge Live Validator
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-[11px] md:text-xs">
                    <div className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg border font-medium ${ruleChecks.instrumentValid ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                      <span>{ruleChecks.instrumentValid ? '✓' : '×'}</span> Nifty 50 Buy (CE/PE)
                    </div>
                    <div className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg border font-medium ${ruleChecks.premiumValid ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                      <span>{ruleChecks.premiumValid ? '✓' : '×'}</span> Premium ₹100-160
                    </div>
                    <div className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg border font-medium ${ruleChecks.timeValid ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                      <span>{ruleChecks.timeValid ? '✓' : '×'}</span> Correct Time Window
                    </div>
                    <div className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg border font-medium ${ruleChecks.lotsValid && ruleChecks.limitValid ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                      <span>{ruleChecks.lotsValid && ruleChecks.limitValid ? '✓' : '×'}</span> 1 Trade & 1 Lot Only
                    </div>
                  </div>
                </div>
              )}

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
                  <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${selectedTrade.direction === 'BUY' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                    }`}>
                    {selectedTrade.direction === 'BUY' ? 'LONG' : 'SHORT'}
                  </span>
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
                    {selectedTrade.expiry ? new Date(selectedTrade.expiry).toLocaleDateString() : 'N/A'}
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

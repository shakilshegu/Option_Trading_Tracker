# Indian Market Trade Schema Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the generic option trade schema with an Indian derivatives market schema (NIFTY/BANKNIFTY etc., CE/PE, lot-based P&L) and update all related files.

**Architecture:** Replace the Trade Mongoose model entirely, update both API route handlers to compute grossPnL/netPnL server-side, rewrite TradeForm for new fields with live P&L preview, and update Dashboard stats/table for the new shape.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, Mongoose, NextAuth v4

---

## Task 1: Update Trade Mongoose Model

**Files:**
- Modify: `models/Trade.ts`

**Step 1: Read current file**

Read `models/Trade.ts` to understand existing content.

**Step 2: Replace entire file with new schema**

```ts
import mongoose, { Schema, Document, models } from 'mongoose'

export interface ITrade extends Document {
  userId: mongoose.Types.ObjectId
  date: Date
  day: string
  time: string
  symbol: 'NIFTY' | 'BANKNIFTY' | 'FINNIFTY' | 'MIDCPNIFTY' | 'SENSEX' | 'BANKEX'
  type: 'CE' | 'PE'
  expiry: Date
  strike: number
  lots: number
  lotSize: number
  entry: number
  exit: number
  charges: number
  grossPnL: number
  netPnL: number
  setupValid: boolean
  rulesFollowed: boolean
  notes?: string
  createdAt: Date
  updatedAt: Date
}

const SYMBOLS = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY', 'SENSEX', 'BANKEX'] as const

const TradeSchema = new Schema<ITrade>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, required: true },
    day: { type: String, required: true },
    time: { type: String, required: true },
    symbol: { type: String, enum: SYMBOLS, required: true },
    type: { type: String, enum: ['CE', 'PE'], required: true },
    expiry: { type: Date, required: true },
    strike: { type: Number, required: true },
    lots: { type: Number, required: true },
    lotSize: { type: Number, required: true, default: 25 },
    entry: { type: Number, required: true },
    exit: { type: Number, required: true },
    charges: { type: Number, required: true, default: 0 },
    grossPnL: { type: Number, required: true },
    netPnL: { type: Number, required: true },
    setupValid: { type: Boolean, required: true, default: false },
    rulesFollowed: { type: Boolean, required: true, default: false },
    notes: { type: String },
  },
  { timestamps: true }
)

export default models.Trade || mongoose.model<ITrade>('Trade', TradeSchema)
```

**Step 3: Commit**

```bash
git add models/Trade.ts
git commit -m "feat: replace Trade schema with Indian market fields"
```

---

## Task 2: Update Trades POST/GET API

**Files:**
- Modify: `app/api/trades/route.ts`

**Step 1: Read current file**

Read `app/api/trades/route.ts`.

**Step 2: Replace entire file**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import Trade from '@/models/Trade'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await connectDB()
    const trades = await Trade.find({ userId: session.user.id }).sort({ date: -1, time: -1 })
    return NextResponse.json(trades)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const {
      date, time, symbol, type, expiry, strike,
      lots, lotSize, entry, exit, charges,
      setupValid, rulesFollowed, notes,
    } = body

    const parsedDate = new Date(date)
    const day = parsedDate.toLocaleDateString('en-US', { weekday: 'long' })
    const grossPnL = (exit - entry) * lots * lotSize
    const netPnL = grossPnL - charges

    await connectDB()
    const trade = await Trade.create({
      userId: session.user.id,
      date: parsedDate,
      day,
      time,
      symbol,
      type,
      expiry: new Date(expiry),
      strike,
      lots,
      lotSize,
      entry,
      exit,
      charges,
      grossPnL,
      netPnL,
      setupValid: !!setupValid,
      rulesFollowed: !!rulesFollowed,
      notes: notes || undefined,
    })
    return NextResponse.json(trade, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

**Step 3: Commit**

```bash
git add app/api/trades/route.ts
git commit -m "feat: update trades API for Indian market schema"
```

---

## Task 3: Update Trades GET/PUT/DELETE API

**Files:**
- Modify: `app/api/trades/[id]/route.ts`

**Step 1: Read current file**

Read `app/api/trades/[id]/route.ts`.

**Step 2: Replace entire file**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import Trade from '@/models/Trade'

async function getOwned(id: string, userId: string) {
  await connectDB()
  return Trade.findOne({ _id: id, userId })
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const trade = await getOwned(id, session.user.id)
    if (!trade) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(trade)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const trade = await getOwned(id, session.user.id)
    if (!trade) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = await req.json()
    const {
      date, time, symbol, type, expiry, strike,
      lots, lotSize, entry, exit, charges,
      setupValid, rulesFollowed, notes,
    } = body

    const parsedDate = date ? new Date(date) : trade.date
    const day = parsedDate.toLocaleDateString('en-US', { weekday: 'long' })
    const effectiveLots = lots ?? trade.lots
    const effectiveLotSize = lotSize ?? trade.lotSize
    const effectiveEntry = entry ?? trade.entry
    const effectiveExit = exit ?? trade.exit
    const effectiveCharges = charges ?? trade.charges
    const grossPnL = (effectiveExit - effectiveEntry) * effectiveLots * effectiveLotSize
    const netPnL = grossPnL - effectiveCharges

    Object.assign(trade, {
      date: parsedDate,
      day,
      time: time ?? trade.time,
      symbol: symbol ?? trade.symbol,
      type: type ?? trade.type,
      expiry: expiry ? new Date(expiry) : trade.expiry,
      strike: strike ?? trade.strike,
      lots: effectiveLots,
      lotSize: effectiveLotSize,
      entry: effectiveEntry,
      exit: effectiveExit,
      charges: effectiveCharges,
      grossPnL,
      netPnL,
      setupValid: setupValid !== undefined ? !!setupValid : trade.setupValid,
      rulesFollowed: rulesFollowed !== undefined ? !!rulesFollowed : trade.rulesFollowed,
      notes: notes !== undefined ? notes : trade.notes,
    })
    await trade.save()
    return NextResponse.json(trade)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const trade = await getOwned(id, session.user.id)
    if (!trade) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await trade.deleteOne()
    return NextResponse.json({ message: 'Deleted' })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

**Step 3: Commit**

```bash
git add "app/api/trades/[id]/route.ts"
git commit -m "feat: update trade detail API for Indian market schema"
```

---

## Task 4: Rewrite TradeForm Component

**Files:**
- Modify: `components/TradeForm.tsx`

**Step 1: Read current file**

Read `components/TradeForm.tsx`.

**Step 2: Replace entire file**

```tsx
'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const SYMBOLS = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY', 'SENSEX', 'BANKEX'] as const

interface TradeFormProps {
  initialValues?: Partial<{
    date: string; time: string; symbol: string; type: string
    expiry: string; strike: number | string; lots: number | string
    lotSize: number | string; entry: number | string; exit: number | string
    charges: number | string; setupValid: boolean; rulesFollowed: boolean; notes: string
  }>
  tradeId?: string
}

const defaultValues = {
  date: '', time: '', symbol: 'NIFTY', type: 'CE',
  expiry: '', strike: '', lots: '', lotSize: '25',
  entry: '', exit: '', charges: '0',
  setupValid: false, rulesFollowed: false, notes: '',
}

function getDayName(dateStr: string): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long' })
}

export default function TradeForm({ initialValues, tradeId }: TradeFormProps) {
  const router = useRouter()
  const [form, setForm] = useState({ ...defaultValues, ...initialValues })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const isEdit = !!tradeId

  const lots = Number(form.lots) || 0
  const lotSize = Number(form.lotSize) || 0
  const entry = Number(form.entry) || 0
  const exit = Number(form.exit) || 0
  const charges = Number(form.charges) || 0
  const grossPnL = (exit - entry) * lots * lotSize
  const netPnL = grossPnL - charges

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const payload = {
      date: form.date,
      time: form.time,
      symbol: form.symbol,
      type: form.type,
      expiry: form.expiry,
      strike: Number(form.strike),
      lots,
      lotSize,
      entry,
      exit,
      charges,
      setupValid: form.setupValid,
      rulesFollowed: form.rulesFollowed,
      notes: form.notes || undefined,
    }

    try {
      const res = await fetch(isEdit ? `/api/trades/${tradeId}` : '/api/trades', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to save trade')
        setLoading(false)
        return
      }
      router.push('/dashboard')
      router.refresh()
    } catch {
      setError('Network error. Please try again.')
      setLoading(false)
    }
  }

  const inputCls = 'w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500'
  const labelCls = 'block text-sm font-medium text-gray-300 mb-1'

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-900/40 border border-red-700 text-red-300 rounded-lg px-4 py-3 text-sm">{error}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Date */}
        <div>
          <label className={labelCls}>Date</label>
          <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required className={inputCls} />
        </div>

        {/* Day — read only */}
        <div>
          <label className={labelCls}>Day</label>
          <input type="text" value={getDayName(form.date)} readOnly className={`${inputCls} cursor-not-allowed opacity-60`} placeholder="Auto" />
        </div>

        {/* Time */}
        <div>
          <label className={labelCls}>Time</label>
          <input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} required className={inputCls} />
        </div>

        {/* Symbol */}
        <div>
          <label className={labelCls}>Symbol</label>
          <select value={form.symbol} onChange={(e) => setForm({ ...form, symbol: e.target.value })} className={inputCls}>
            {SYMBOLS.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>

        {/* Type */}
        <div>
          <label className={labelCls}>Type</label>
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className={inputCls}>
            <option>CE</option>
            <option>PE</option>
          </select>
        </div>

        {/* Expiry */}
        <div>
          <label className={labelCls}>Expiry</label>
          <input type="date" value={form.expiry} onChange={(e) => setForm({ ...form, expiry: e.target.value })} required className={inputCls} />
        </div>

        {/* Strike */}
        <div>
          <label className={labelCls}>Strike</label>
          <input type="number" step="any" value={form.strike} onChange={(e) => setForm({ ...form, strike: e.target.value })} required className={inputCls} />
        </div>

        {/* Lots */}
        <div>
          <label className={labelCls}>Lots</label>
          <input type="number" step="1" min="1" value={form.lots} onChange={(e) => setForm({ ...form, lots: e.target.value })} required className={inputCls} />
        </div>

        {/* Lot Size */}
        <div>
          <label className={labelCls}>Lot Size</label>
          <input type="number" step="1" min="1" value={form.lotSize} onChange={(e) => setForm({ ...form, lotSize: e.target.value })} required className={inputCls} />
        </div>

        {/* Entry */}
        <div>
          <label className={labelCls}>Entry ₹</label>
          <input type="number" step="any" value={form.entry} onChange={(e) => setForm({ ...form, entry: e.target.value })} required className={inputCls} />
        </div>

        {/* Exit */}
        <div>
          <label className={labelCls}>Exit ₹</label>
          <input type="number" step="any" value={form.exit} onChange={(e) => setForm({ ...form, exit: e.target.value })} required className={inputCls} />
        </div>

        {/* Charges */}
        <div>
          <label className={labelCls}>Charges ₹</label>
          <input type="number" step="any" min="0" value={form.charges} onChange={(e) => setForm({ ...form, charges: e.target.value })} required className={inputCls} />
        </div>
      </div>

      {/* Setup Valid + Rules Followed */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Setup Valid</label>
          <div className="flex gap-2 mt-1">
            {(['Yes', 'No'] as const).map((opt) => (
              <button key={opt} type="button"
                onClick={() => setForm({ ...form, setupValid: opt === 'Yes' })}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold border transition-colors ${
                  form.setupValid === (opt === 'Yes')
                    ? opt === 'Yes' ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-red-700 border-red-600 text-white'
                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'
                }`}>
                {opt}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className={labelCls}>Rules Followed</label>
          <div className="flex gap-2 mt-1">
            {(['Yes', 'No'] as const).map((opt) => (
              <button key={opt} type="button"
                onClick={() => setForm({ ...form, rulesFollowed: opt === 'Yes' })}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold border transition-colors ${
                  form.rulesFollowed === (opt === 'Yes')
                    ? opt === 'Yes' ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-red-700 border-red-600 text-white'
                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'
                }`}>
                {opt}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className={labelCls}>Notes</label>
        <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
          rows={3} placeholder="Optional trade notes…"
          className={`${inputCls} resize-none`} />
      </div>

      {/* Live P&L Preview */}
      <div className="grid grid-cols-2 gap-4 bg-gray-900 border border-gray-800 rounded-xl p-4">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Gross P&L</p>
          <p className={`text-xl font-bold ${grossPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            ₹{grossPnL >= 0 ? '+' : ''}{grossPnL.toFixed(2)}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Net P&L</p>
          <p className={`text-xl font-bold ${netPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            ₹{netPnL >= 0 ? '+' : ''}{netPnL.toFixed(2)}
          </p>
        </div>
      </div>

      <div className="flex gap-3">
        <button type="submit" disabled={loading}
          className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold px-6 py-2.5 rounded-lg transition-colors">
          {loading ? 'Saving…' : isEdit ? 'Update Trade' : 'Add Trade'}
        </button>
        <button type="button" onClick={() => router.back()}
          className="bg-gray-800 hover:bg-gray-700 text-white font-semibold px-6 py-2.5 rounded-lg transition-colors border border-gray-700">
          Cancel
        </button>
      </div>
    </form>
  )
}
```

**Step 3: Commit**

```bash
git add components/TradeForm.tsx
git commit -m "feat: rewrite TradeForm for Indian market fields with live P&L preview"
```

---

## Task 5: Update Dashboard Server Component

**Files:**
- Modify: `app/dashboard/page.tsx`

**Step 1: Read current file**

Read `app/dashboard/page.tsx`.

**Step 2: Replace entire file**

```tsx
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { connectDB } from '@/lib/mongodb'
import Trade from '@/models/Trade'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/auth/signin')

  await connectDB()
  const trades = await Trade.find({ userId: session.user.id }).sort({ date: -1, time: -1 }).lean()

  const serialized = (trades as any[]).map((t) => ({
    ...t,
    _id: t._id.toString(),
    userId: t.userId.toString(),
    date: t.date?.toISOString(),
    expiry: t.expiry?.toISOString(),
    createdAt: t.createdAt?.toISOString(),
    updatedAt: t.updatedAt?.toISOString(),
  }))

  const totalNetPnL = serialized.reduce((sum, t) => sum + (t.netPnL ?? 0), 0)
  const wins = serialized.filter((t) => (t.netPnL ?? 0) > 0).length
  const winRate = serialized.length ? Math.round((wins / serialized.length) * 100) : 0
  const avgNetPnL = serialized.length ? totalNetPnL / serialized.length : 0

  return (
    <DashboardClient
      trades={serialized}
      stats={{ totalNetPnL, winRate, total: serialized.length, avgNetPnL }}
      userName={session.user.name ?? 'Trader'}
    />
  )
}
```

**Step 3: Commit**

```bash
git add app/dashboard/page.tsx
git commit -m "feat: update dashboard stats for Indian market schema"
```

---

## Task 6: Update Dashboard Client Component

**Files:**
- Modify: `app/dashboard/DashboardClient.tsx`

**Step 1: Read current file**

Read `app/dashboard/DashboardClient.tsx`.

**Step 2: Replace entire file**

```tsx
'use client'
import Link from 'next/link'
import { signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'

interface Trade {
  _id: string
  date: string
  day: string
  time: string
  symbol: string
  type: string
  expiry: string
  strike: number
  lots: number
  lotSize: number
  entry: number
  exit: number
  charges: number
  grossPnL: number
  netPnL: number
  setupValid: boolean
  rulesFollowed: boolean
  notes?: string
}

interface Stats {
  totalNetPnL: number
  winRate: number
  total: number
  avgNetPnL: number
}

export default function DashboardClient({
  trades, stats, userName,
}: { trades: Trade[]; stats: Stats; userName: string }) {
  const router = useRouter()

  async function deleteTrade(id: string) {
    if (!confirm('Delete this trade?')) return
    const res = await fetch(`/api/trades/${id}`, { method: 'DELETE' })
    if (res.ok) router.refresh()
  }

  const pnlColor = (v: number) => v >= 0 ? 'text-emerald-400' : 'text-red-400'
  const fmt = (v: number) => `₹${v >= 0 ? '+' : ''}${v.toFixed(2)}`

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">📈 Option Tracker</h1>
          <div className="flex items-center gap-4">
            <span className="text-gray-400 text-sm">Hi, {userName}</span>
            <button
              onClick={() => signOut({ callbackUrl: '/' })}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Trades', value: String(stats.total), color: 'text-white' },
            { label: 'Net P&L', value: fmt(stats.totalNetPnL), color: pnlColor(stats.totalNetPnL) },
            { label: 'Win Rate', value: `${stats.winRate}%`, color: 'text-white' },
            { label: 'Avg Net P&L', value: fmt(stats.avgNetPnL), color: pnlColor(stats.avgNetPnL) },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">{label}</p>
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">My Trades</h2>
          <Link
            href="/trades/new"
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            + New Trade
          </Link>
        </div>

        {/* Trades Table */}
        {trades.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p className="text-lg">No trades yet.</p>
            <Link href="/trades/new" className="text-emerald-400 hover:underline text-sm mt-2 inline-block">
              Log your first trade →
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-800">
                  {['Date', 'Day', 'Time', 'Symbol', 'Type', 'Strike', 'Expiry', 'Lots', 'Entry', 'Exit', 'Gross P&L', 'Net P&L', 'Valid', 'Rules', ''].map((h) => (
                    <th key={h} className="py-3 px-2 font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {trades.map((trade) => (
                  <tr key={trade._id} className="border-b border-gray-800/50 hover:bg-gray-900/50">
                    <td className="py-3 px-2 text-gray-300 whitespace-nowrap">{new Date(trade.date).toLocaleDateString('en-IN')}</td>
                    <td className="py-3 px-2 text-gray-400 text-xs">{trade.day}</td>
                    <td className="py-3 px-2 text-gray-400 text-xs">{trade.time}</td>
                    <td className="py-3 px-2 font-semibold text-white">{trade.symbol}</td>
                    <td className="py-3 px-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${trade.type === 'CE' ? 'bg-blue-900/50 text-blue-300' : 'bg-purple-900/50 text-purple-300'}`}>
                        {trade.type}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-gray-300">{trade.strike}</td>
                    <td className="py-3 px-2 text-gray-300 whitespace-nowrap">{new Date(trade.expiry).toLocaleDateString('en-IN')}</td>
                    <td className="py-3 px-2 text-gray-300">{trade.lots}</td>
                    <td className="py-3 px-2 text-gray-300">₹{trade.entry}</td>
                    <td className="py-3 px-2 text-gray-300">₹{trade.exit}</td>
                    <td className={`py-3 px-2 font-medium ${pnlColor(trade.grossPnL)}`}>{fmt(trade.grossPnL)}</td>
                    <td className={`py-3 px-2 font-medium ${pnlColor(trade.netPnL)}`}>{fmt(trade.netPnL)}</td>
                    <td className="py-3 px-2 text-center">
                      {trade.setupValid ? <span className="text-emerald-400 text-xs">✓</span> : <span className="text-red-500 text-xs">✗</span>}
                    </td>
                    <td className="py-3 px-2 text-center">
                      {trade.rulesFollowed ? <span className="text-emerald-400 text-xs">✓</span> : <span className="text-red-500 text-xs">✗</span>}
                    </td>
                    <td className="py-3 px-2">
                      <div className="flex gap-2">
                        <Link href={`/trades/${trade._id}`} className="text-gray-400 hover:text-white text-xs">Edit</Link>
                        <button onClick={() => deleteTrade(trade._id)} className="text-red-500 hover:text-red-400 text-xs">Del</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
```

**Step 3: Commit**

```bash
git add app/dashboard/DashboardClient.tsx
git commit -m "feat: update dashboard table for Indian market trade fields"
```

---

## Task 7: Update Edit Trade Page

**Files:**
- Modify: `app/trades/[id]/page.tsx`

**Step 1: Read current file**

Read `app/trades/[id]/page.tsx`.

**Step 2: Replace entire file**

```tsx
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { connectDB } from '@/lib/mongodb'
import Trade from '@/models/Trade'
import Link from 'next/link'
import TradeForm from '@/components/TradeForm'

export default async function EditTradePage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/auth/signin')

  await connectDB()
  const trade = await Trade.findOne({ _id: params.id, userId: session.user.id }).lean() as any
  if (!trade) notFound()

  const initial = {
    date: trade.date ? new Date(trade.date).toISOString().split('T')[0] : '',
    time: trade.time ?? '',
    symbol: trade.symbol,
    type: trade.type,
    expiry: trade.expiry ? new Date(trade.expiry).toISOString().split('T')[0] : '',
    strike: trade.strike,
    lots: trade.lots,
    lotSize: trade.lotSize,
    entry: trade.entry,
    exit: trade.exit,
    charges: trade.charges,
    setupValid: trade.setupValid,
    rulesFollowed: trade.rulesFollowed,
    notes: trade.notes ?? '',
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <header className="border-b border-gray-800 bg-gray-900">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/dashboard" className="text-gray-400 hover:text-white text-lg">←</Link>
          <h1 className="text-xl font-bold text-white">Edit Trade — {trade.symbol}</h1>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-8">
        <TradeForm initialValues={initial} tradeId={trade._id.toString()} />
      </main>
    </div>
  )
}
```

**Step 3: Commit**

```bash
git add "app/trades/[id]/page.tsx"
git commit -m "feat: update edit trade page for Indian market schema"
```

---

## Task 8: TypeScript Check & Final Commit

**Step 1: Run TypeScript check**

```bash
cd /Users/shakil/Desktop/work/Option_Trading_Tracker && npx tsc --noEmit 2>&1 | head -60
```

Expected: zero errors. If errors appear, fix them and re-run.

**Step 2: Verify dev server starts**

```bash
npm run dev
```

Open `http://localhost:3000`. Sign in, click "+ New Trade". Verify:
- Date picker shows, Day auto-fills on selection
- Symbol dropdown shows NIFTY/BANKNIFTY/etc.
- Type shows CE/PE
- Gross P&L and Net P&L update live as Entry/Exit/Lots/LotSize/Charges change
- Dashboard table shows new columns

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete Indian market trade schema migration"
```

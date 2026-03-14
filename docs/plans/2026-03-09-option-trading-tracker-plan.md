# Option Trading Tracker Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a full-stack option trade journal with auth, CRUD trades, and P&L dashboard using Next.js 14 App Router + MongoDB Atlas.

**Architecture:** Next.js App Router with server components for data fetching, Route Handlers for the REST API, Mongoose for MongoDB schemas, and NextAuth Credentials provider with JWT sessions. All protected pages use `getServerSession` server-side and redirect unauthenticated users.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS v4, Mongoose, NextAuth v4, bcryptjs, MongoDB Atlas

---

## Task 1: Environment & DB Connection

**Files:**
- Create: `.env.local`
- Create: `lib/mongodb.ts`

**Step 1: Create `.env.local`**

```
MONGODB_URI=mongodb+srv://muhammadshakil1968_db_user:ZjqyEVzUcvqwTxak@cluster0.ohospby.mongodb.net/option_tracker?retryWrites=true&w=majority
NEXTAUTH_SECRET=super-secret-option-tracker-key-2026
NEXTAUTH_URL=http://localhost:3000
```

**Step 2: Create `lib/mongodb.ts`**

```ts
import mongoose from 'mongoose'

const MONGODB_URI = process.env.MONGODB_URI!

if (!MONGODB_URI) throw new Error('MONGODB_URI not defined')

let cached = (global as any).mongoose as { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null }

if (!cached) {
  cached = (global as any).mongoose = { conn: null, promise: null }
}

export async function connectDB() {
  if (cached.conn) return cached.conn
  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI).then((m) => m)
  }
  cached.conn = await cached.promise
  return cached.conn
}
```

**Step 3: Commit**

```bash
git add lib/mongodb.ts .env.local
git commit -m "feat: add MongoDB connection utility"
```

---

## Task 2: Mongoose Models

**Files:**
- Create: `models/User.ts`
- Create: `models/Trade.ts`

**Step 1: Create `models/User.ts`**

```ts
import mongoose, { Schema, Document, models } from 'mongoose'

export interface IUser extends Document {
  name: string
  email: string
  password: string
  createdAt: Date
}

const UserSchema = new Schema<IUser>({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
})

export default models.User || mongoose.model<IUser>('User', UserSchema)
```

**Step 2: Create `models/Trade.ts`**

```ts
import mongoose, { Schema, Document, models } from 'mongoose'

export interface ITrade extends Document {
  userId: mongoose.Types.ObjectId
  symbol: string
  type: 'Call' | 'Put'
  action: 'Buy' | 'Sell'
  strike: number
  expiry: Date
  premium: number
  quantity: number
  status: 'Open' | 'Closed'
  closePrice?: number
  pnl?: number
  createdAt: Date
  updatedAt: Date
}

const TradeSchema = new Schema<ITrade>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    symbol: { type: String, required: true, uppercase: true },
    type: { type: String, enum: ['Call', 'Put'], required: true },
    action: { type: String, enum: ['Buy', 'Sell'], required: true },
    strike: { type: Number, required: true },
    expiry: { type: Date, required: true },
    premium: { type: Number, required: true },
    quantity: { type: Number, required: true },
    status: { type: String, enum: ['Open', 'Closed'], default: 'Open' },
    closePrice: { type: Number },
    pnl: { type: Number },
  },
  { timestamps: true }
)

export default models.Trade || mongoose.model<ITrade>('Trade', TradeSchema)
```

**Step 3: Commit**

```bash
git add models/
git commit -m "feat: add User and Trade Mongoose models"
```

---

## Task 3: NextAuth Configuration

**Files:**
- Create: `lib/auth.ts`
- Create: `app/api/auth/[...nextauth]/route.ts`
- Create: `types/next-auth.d.ts`

**Step 1: Create `lib/auth.ts`**

```ts
import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { connectDB } from './mongodb'
import User from '@/models/User'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        await connectDB()
        const user = await User.findOne({ email: credentials.email.toLowerCase() })
        if (!user) return null
        const valid = await bcrypt.compare(credentials.password, user.password)
        if (!valid) return null
        return { id: user._id.toString(), name: user.name, email: user.email }
      },
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.id = user.id
      return token
    },
    async session({ session, token }) {
      if (token && session.user) session.user.id = token.id as string
      return session
    },
  },
  pages: {
    signIn: '/auth/signin',
  },
  secret: process.env.NEXTAUTH_SECRET,
}
```

**Step 2: Create `app/api/auth/[...nextauth]/route.ts`**

```ts
import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth'

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
```

**Step 3: Create `types/next-auth.d.ts`**

```ts
import NextAuth from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
    }
  }
}
```

**Step 4: Commit**

```bash
git add lib/auth.ts app/api/auth/ types/
git commit -m "feat: configure NextAuth with Credentials provider"
```

---

## Task 4: Register API Endpoint

**Files:**
- Create: `app/api/auth/register/route.ts`

**Step 1: Create `app/api/auth/register/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { connectDB } from '@/lib/mongodb'
import User from '@/models/User'

export async function POST(req: NextRequest) {
  const { name, email, password } = await req.json()

  if (!name || !email || !password) {
    return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
  }

  await connectDB()
  const existing = await User.findOne({ email: email.toLowerCase() })
  if (existing) {
    return NextResponse.json({ error: 'Email already in use' }, { status: 409 })
  }

  const hashed = await bcrypt.hash(password, 12)
  await User.create({ name, email: email.toLowerCase(), password: hashed })

  return NextResponse.json({ message: 'Account created' }, { status: 201 })
}
```

**Step 2: Commit**

```bash
git add app/api/auth/register/
git commit -m "feat: add user registration API endpoint"
```

---

## Task 5: Trades CRUD API

**Files:**
- Create: `app/api/trades/route.ts`
- Create: `app/api/trades/[id]/route.ts`

**Step 1: Create `app/api/trades/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import Trade from '@/models/Trade'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  const trades = await Trade.find({ userId: session.user.id }).sort({ createdAt: -1 })
  return NextResponse.json(trades)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { symbol, type, action, strike, expiry, premium, quantity, status, closePrice } = body

  let pnl: number | undefined
  if (status === 'Closed' && closePrice != null) {
    pnl =
      action === 'Buy'
        ? (closePrice - premium) * quantity * 100
        : (premium - closePrice) * quantity * 100
  }

  await connectDB()
  const trade = await Trade.create({
    userId: session.user.id,
    symbol, type, action, strike, expiry, premium, quantity, status,
    closePrice: status === 'Closed' ? closePrice : undefined,
    pnl,
  })
  return NextResponse.json(trade, { status: 201 })
}
```

**Step 2: Create `app/api/trades/[id]/route.ts`**

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

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const trade = await getOwned(params.id, session.user.id)
  if (!trade) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(trade)
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const trade = await getOwned(params.id, session.user.id)
  if (!trade) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const { symbol, type, action, strike, expiry, premium, quantity, status, closePrice } = body

  let pnl: number | undefined
  if ((status ?? trade.status) === 'Closed' && closePrice != null) {
    const a = action ?? trade.action
    const p = premium ?? trade.premium
    const q = quantity ?? trade.quantity
    pnl = a === 'Buy' ? (closePrice - p) * q * 100 : (p - closePrice) * q * 100
  }

  Object.assign(trade, {
    symbol: symbol ?? trade.symbol,
    type: type ?? trade.type,
    action: action ?? trade.action,
    strike: strike ?? trade.strike,
    expiry: expiry ?? trade.expiry,
    premium: premium ?? trade.premium,
    quantity: quantity ?? trade.quantity,
    status: status ?? trade.status,
    closePrice: (status ?? trade.status) === 'Closed' ? closePrice : undefined,
    pnl,
  })
  await trade.save()
  return NextResponse.json(trade)
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const trade = await getOwned(params.id, session.user.id)
  if (!trade) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await trade.deleteOne()
  return NextResponse.json({ message: 'Deleted' })
}
```

**Step 3: Commit**

```bash
git add app/api/trades/
git commit -m "feat: add trades CRUD API endpoints"
```

---

## Task 6: Root Layout with SessionProvider

**Files:**
- Create: `components/SessionProvider.tsx`
- Modify: `app/layout.tsx`

**Step 1: Create `components/SessionProvider.tsx`**

```tsx
'use client'
import { SessionProvider as NextSessionProvider } from 'next-auth/react'
export default function SessionProvider({ children }: { children: React.ReactNode }) {
  return <NextSessionProvider>{children}</NextSessionProvider>
}
```

**Step 2: Replace `app/layout.tsx`**

```tsx
import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import SessionProvider from '@/components/SessionProvider'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Option Trading Tracker',
  description: 'Track your option trades and P&L',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-950 text-gray-100`}>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  )
}
```

**Step 3: Commit**

```bash
git add components/SessionProvider.tsx app/layout.tsx
git commit -m "feat: add SessionProvider to root layout"
```

---

## Task 7: Sign Up Page

**Files:**
- Create: `app/auth/signup/page.tsx`

**Step 1: Create `app/auth/signup/page.tsx`**

```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function SignUpPage() {
  const router = useRouter()
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Registration failed')
      setLoading(false)
      return
    }
    router.push('/auth/signin?registered=true')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-md bg-gray-900 rounded-2xl p-8 shadow-xl border border-gray-800">
        <h1 className="text-2xl font-bold text-white mb-2">Create Account</h1>
        <p className="text-gray-400 text-sm mb-6">Start tracking your option trades</p>

        {error && (
          <div className="bg-red-900/40 border border-red-700 text-red-300 rounded-lg px-4 py-3 mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {(['name', 'email', 'password'] as const).map((field) => (
            <div key={field}>
              <label className="block text-sm font-medium text-gray-300 mb-1 capitalize">{field}</label>
              <input
                type={field === 'password' ? 'password' : field === 'email' ? 'email' : 'text'}
                value={form[field]}
                onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                required
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                placeholder={field === 'name' ? 'Your name' : field === 'email' ? 'you@example.com' : '••••••••'}
              />
            </div>
          ))}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold rounded-lg py-2.5 transition-colors"
          >
            {loading ? 'Creating account…' : 'Sign Up'}
          </button>
        </form>

        <p className="mt-6 text-sm text-gray-400 text-center">
          Already have an account?{' '}
          <Link href="/auth/signin" className="text-emerald-400 hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add app/auth/signup/
git commit -m "feat: add sign up page"
```

---

## Task 8: Sign In Page

**Files:**
- Create: `app/auth/signin/page.tsx`

**Step 1: Create `app/auth/signin/page.tsx`**

```tsx
'use client'
import { useState, Suspense } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

function SignInForm() {
  const router = useRouter()
  const params = useSearchParams()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await signIn('credentials', {
      email: form.email,
      password: form.password,
      redirect: false,
    })
    if (res?.error) {
      setError('Invalid email or password')
      setLoading(false)
      return
    }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-md bg-gray-900 rounded-2xl p-8 shadow-xl border border-gray-800">
        <h1 className="text-2xl font-bold text-white mb-2">Welcome Back</h1>
        <p className="text-gray-400 text-sm mb-6">Sign in to your trading dashboard</p>

        {params.get('registered') && (
          <div className="bg-emerald-900/40 border border-emerald-700 text-emerald-300 rounded-lg px-4 py-3 mb-4 text-sm">
            Account created! Please sign in.
          </div>
        )}
        {error && (
          <div className="bg-red-900/40 border border-red-700 text-red-300 rounded-lg px-4 py-3 mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Password</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold rounded-lg py-2.5 transition-colors"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p className="mt-6 text-sm text-gray-400 text-center">
          No account?{' '}
          <Link href="/auth/signup" className="text-emerald-400 hover:underline">Create one</Link>
        </p>
      </div>
    </div>
  )
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  )
}
```

**Step 2: Commit**

```bash
git add app/auth/signin/
git commit -m "feat: add sign in page"
```

---

## Task 9: Landing Page

**Files:**
- Modify: `app/page.tsx`

**Step 1: Replace `app/page.tsx`**

```tsx
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function Home() {
  const session = await getServerSession(authOptions)
  if (session) redirect('/dashboard')

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-4 text-center">
      <div className="mb-4 text-5xl">📈</div>
      <h1 className="text-4xl font-extrabold text-white mb-4">Option Trading Tracker</h1>
      <p className="text-gray-400 text-lg max-w-md mb-8">
        Log your option trades, track P&L, and review your performance — all in one place.
      </p>
      <div className="flex gap-4">
        <Link
          href="/auth/signup"
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
        >
          Get Started
        </Link>
        <Link
          href="/auth/signin"
          className="bg-gray-800 hover:bg-gray-700 text-white font-semibold px-6 py-3 rounded-xl transition-colors border border-gray-700"
        >
          Sign In
        </Link>
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add app/page.tsx
git commit -m "feat: add landing page with auth redirect"
```

---

## Task 10: Dashboard Page

**Files:**
- Create: `app/dashboard/page.tsx`
- Create: `app/dashboard/DashboardClient.tsx`

**Step 1: Create `app/dashboard/page.tsx`**

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
  const trades = await Trade.find({ userId: session.user.id }).sort({ createdAt: -1 }).lean()

  const serialized = (trades as any[]).map((t) => ({
    ...t,
    _id: t._id.toString(),
    userId: t.userId.toString(),
    expiry: t.expiry?.toISOString(),
    createdAt: t.createdAt?.toISOString(),
    updatedAt: t.updatedAt?.toISOString(),
  }))

  const closedTrades = serialized.filter((t) => t.status === 'Closed')
  const totalPnL = closedTrades.reduce((sum, t) => sum + (t.pnl ?? 0), 0)
  const winRate = closedTrades.length
    ? Math.round((closedTrades.filter((t) => (t.pnl ?? 0) > 0).length / closedTrades.length) * 100)
    : 0

  return (
    <DashboardClient
      trades={serialized}
      stats={{ totalPnL, winRate, total: serialized.length, closed: closedTrades.length }}
      userName={session.user.name ?? 'Trader'}
    />
  )
}
```

**Step 2: Create `app/dashboard/DashboardClient.tsx`**

```tsx
'use client'
import Link from 'next/link'
import { signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'

interface Trade {
  _id: string
  symbol: string
  type: string
  action: string
  strike: number
  expiry: string
  premium: number
  quantity: number
  status: string
  pnl?: number
}

interface Stats {
  totalPnL: number
  winRate: number
  total: number
  closed: number
}

export default function DashboardClient({
  trades, stats, userName,
}: { trades: Trade[]; stats: Stats; userName: string }) {
  const router = useRouter()

  async function deleteTrade(id: string) {
    if (!confirm('Delete this trade?')) return
    await fetch(`/api/trades/${id}`, { method: 'DELETE' })
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
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

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Trades', value: String(stats.total) },
            { label: 'Closed', value: String(stats.closed) },
            {
              label: 'Total P&L',
              value: `$${stats.totalPnL >= 0 ? '+' : ''}${stats.totalPnL.toFixed(2)}`,
              color: stats.totalPnL >= 0 ? 'text-emerald-400' : 'text-red-400',
            },
            { label: 'Win Rate', value: `${stats.winRate}%` },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">{label}</p>
              <p className={`text-2xl font-bold ${color ?? 'text-white'}`}>{value}</p>
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
                  {['Symbol', 'Type', 'Action', 'Strike', 'Expiry', 'Premium', 'Qty', 'Status', 'P&L', ''].map((h) => (
                    <th key={h} className="py-3 px-2 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {trades.map((trade) => (
                  <tr key={trade._id} className="border-b border-gray-800/50 hover:bg-gray-900/50">
                    <td className="py-3 px-2 font-semibold text-white">{trade.symbol}</td>
                    <td className="py-3 px-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${trade.type === 'Call' ? 'bg-blue-900/50 text-blue-300' : 'bg-purple-900/50 text-purple-300'}`}>
                        {trade.type}
                      </span>
                    </td>
                    <td className="py-3 px-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${trade.action === 'Buy' ? 'bg-emerald-900/50 text-emerald-300' : 'bg-orange-900/50 text-orange-300'}`}>
                        {trade.action}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-gray-300">${trade.strike}</td>
                    <td className="py-3 px-2 text-gray-300">{new Date(trade.expiry).toLocaleDateString()}</td>
                    <td className="py-3 px-2 text-gray-300">${trade.premium}</td>
                    <td className="py-3 px-2 text-gray-300">{trade.quantity}</td>
                    <td className="py-3 px-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${trade.status === 'Open' ? 'bg-yellow-900/50 text-yellow-300' : 'bg-gray-700 text-gray-300'}`}>
                        {trade.status}
                      </span>
                    </td>
                    <td className={`py-3 px-2 font-medium ${(trade.pnl ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {trade.pnl != null ? `$${trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}` : '—'}
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
git add app/dashboard/
git commit -m "feat: add dashboard with stats and trade table"
```

---

## Task 11: Trade Form Component + New Trade Page

**Files:**
- Create: `components/TradeForm.tsx`
- Create: `app/trades/new/page.tsx`

**Step 1: Create `components/TradeForm.tsx`**

```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface TradeFormProps {
  initialValues?: Partial<{
    symbol: string; type: string; action: string; strike: number | string
    expiry: string; premium: number | string; quantity: number | string
    status: string; closePrice: number | string
  }>
  tradeId?: string
}

const defaultValues = {
  symbol: '', type: 'Call', action: 'Buy',
  strike: '', expiry: '', premium: '', quantity: '',
  status: 'Open', closePrice: '',
}

export default function TradeForm({ initialValues, tradeId }: TradeFormProps) {
  const router = useRouter()
  const [form, setForm] = useState({ ...defaultValues, ...initialValues })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const isEdit = !!tradeId

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const payload = {
      ...form,
      strike: Number(form.strike),
      premium: Number(form.premium),
      quantity: Number(form.quantity),
      closePrice: form.closePrice !== '' ? Number(form.closePrice) : undefined,
    }

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
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-900/40 border border-red-700 text-red-300 rounded-lg px-4 py-3 text-sm">{error}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Symbol */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Symbol (e.g. AAPL)</label>
          <input type="text" value={form.symbol} onChange={(e) => setForm({ ...form, symbol: e.target.value })} required
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>

        {/* Type */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Option Type</label>
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
            <option>Call</option>
            <option>Put</option>
          </select>
        </div>

        {/* Action */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Action</label>
          <select value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value })}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
            <option>Buy</option>
            <option>Sell</option>
          </select>
        </div>

        {/* Strike */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Strike Price</label>
          <input type="number" step="any" value={form.strike} onChange={(e) => setForm({ ...form, strike: e.target.value })} required
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>

        {/* Expiry */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Expiry Date</label>
          <input type="date" value={form.expiry} onChange={(e) => setForm({ ...form, expiry: e.target.value })} required
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>

        {/* Premium */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Premium per Contract ($)</label>
          <input type="number" step="any" value={form.premium} onChange={(e) => setForm({ ...form, premium: e.target.value })} required
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>

        {/* Quantity */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Quantity (contracts)</label>
          <input type="number" step="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>

        {/* Status */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Status</label>
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
            <option>Open</option>
            <option>Closed</option>
          </select>
        </div>

        {/* Close Price — only when Closed */}
        {form.status === 'Closed' && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Close Price ($)</label>
            <input type="number" step="any" value={form.closePrice} onChange={(e) => setForm({ ...form, closePrice: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
        )}
      </div>

      <div className="flex gap-3 pt-2">
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

**Step 2: Create `app/trades/new/page.tsx`**

```tsx
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import TradeForm from '@/components/TradeForm'

export default async function NewTradePage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/auth/signin')

  return (
    <div className="min-h-screen bg-gray-950">
      <header className="border-b border-gray-800 bg-gray-900">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/dashboard" className="text-gray-400 hover:text-white text-lg">←</Link>
          <h1 className="text-xl font-bold text-white">New Trade</h1>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-8">
        <TradeForm />
      </main>
    </div>
  )
}
```

**Step 3: Commit**

```bash
git add components/TradeForm.tsx app/trades/new/
git commit -m "feat: add trade form component and new trade page"
```

---

## Task 12: Edit Trade Page

**Files:**
- Create: `app/trades/[id]/page.tsx`

**Step 1: Create `app/trades/[id]/page.tsx`**

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
    symbol: trade.symbol,
    type: trade.type,
    action: trade.action,
    strike: trade.strike,
    expiry: trade.expiry ? new Date(trade.expiry).toISOString().split('T')[0] : '',
    premium: trade.premium,
    quantity: trade.quantity,
    status: trade.status,
    closePrice: trade.closePrice ?? '',
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

**Step 2: Commit**

```bash
git add app/trades/[id]/
git commit -m "feat: add edit trade page"
```

---

## Task 13: Final Verification

**Step 1: Start dev server**

```bash
npm run dev
```

**Step 2: Test end-to-end**
1. `http://localhost:3000` — landing, logged out → shows buttons
2. Click "Get Started" → sign up form, register a user
3. Redirected to sign in → sign in with those credentials
4. Dashboard loads (empty state, all stats 0)
5. Click "+ New Trade" → fill all fields, submit → redirected to dashboard, trade appears
6. Click "Edit" → change Status to Closed, enter Close Price → P&L auto-calculates
7. Click "Del" → trade removed
8. Sign out → redirected to `/`

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: complete option trading tracker — UI and API"
```

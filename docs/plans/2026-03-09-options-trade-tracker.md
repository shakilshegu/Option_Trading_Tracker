# Options Trade Tracker — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a full-stack Options Trade Tracker with Next.js 14, MongoDB Atlas, NextAuth, and Tailwind CSS — deployed on Vercel.

**Architecture:** Next.js App Router handles both frontend and API routes in a single project. NextAuth with CredentialsProvider manages auth via JWT sessions. MongoDB Atlas stores users and trades; Mongoose provides schema validation. A middleware file protects the `/dashboard` route.

**Tech Stack:** Next.js 14 (App Router), Tailwind CSS, MongoDB Atlas + Mongoose, NextAuth.js, bcryptjs, TypeScript

---

## Task 1: Scaffold Next.js Project

**Files:**
- Create: `/Users/shakil/Desktop/work/Option_Trading_Tracker/` (project root)

**Step 1: Scaffold the project**

```bash
cd /Users/shakil/Desktop/work/Option_Trading_Tracker
npx create-next-app@latest . --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*"
```

Expected: Next.js 14 project created with App Router and Tailwind.

**Step 2: Install dependencies**

```bash
npm install mongoose next-auth bcryptjs
npm install --save-dev @types/bcryptjs
```

**Step 3: Create .env.local**

```bash
cat > .env.local << 'EOF'
MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/trade-tracker?retryWrites=true&w=majority
NEXTAUTH_SECRET=your-secret-here-change-in-production
NEXTAUTH_URL=http://localhost:3000
EOF
```

**Step 4: Verify dev server starts**

```bash
npm run dev
```
Expected: Server running at http://localhost:3000

**Step 5: Commit**

```bash
git init
git add .
git commit -m "feat: scaffold Next.js 14 project with Tailwind and deps"
```

---

## Task 2: MongoDB Connection

**Files:**
- Create: `lib/mongodb.ts`

**Step 1: Create the connection utility**

```typescript
// lib/mongodb.ts
import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI!;

if (!MONGODB_URI) {
  throw new Error("Please define MONGODB_URI in .env.local");
}

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var mongoose: MongooseCache | undefined;
}

const cached: MongooseCache = global.mongoose ?? { conn: null, promise: null };
global.mongoose = cached;

export async function connectDB(): Promise<typeof mongoose> {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI).then((m) => m);
  }

  cached.conn = await cached.promise;
  return cached.conn;
}
```

**Step 2: Commit**

```bash
git add lib/mongodb.ts
git commit -m "feat: add MongoDB connection utility"
```

---

## Task 3: Mongoose Models

**Files:**
- Create: `lib/models/User.ts`
- Create: `lib/models/Trade.ts`

**Step 1: Create User model**

```typescript
// lib/models/User.ts
import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  createdAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true },
  },
  { timestamps: true }
);

export const User = mongoose.models.User || mongoose.model<IUser>("User", UserSchema);
```

**Step 2: Create Trade model**

```typescript
// lib/models/Trade.ts
import mongoose, { Schema, Document } from "mongoose";

export interface ITrade extends Document {
  userId: mongoose.Types.ObjectId;
  date: string;
  day: string;
  time: string;
  symbol: string;
  type: "CE" | "PE";
  expiry: string;
  strike: number;
  lots: number;
  lotSize: number;
  entry: number;
  exit: number;
  grossPnL: number;
  charges: number;
  netPnL: number;
  setupValid: boolean;
  rulesFollowed: boolean;
  notes: string;
  createdAt: Date;
}

const TradeSchema = new Schema<ITrade>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: String, required: true },
    day: { type: String, required: true },
    time: { type: String, required: true },
    symbol: { type: String, required: true },
    type: { type: String, enum: ["CE", "PE"], required: true },
    expiry: { type: String, required: true },
    strike: { type: Number, required: true },
    lots: { type: Number, required: true },
    lotSize: { type: Number, required: true },
    entry: { type: Number, required: true },
    exit: { type: Number, required: true },
    grossPnL: { type: Number, required: true },
    charges: { type: Number, required: true },
    netPnL: { type: Number, required: true },
    setupValid: { type: Boolean, default: false },
    rulesFollowed: { type: Boolean, default: false },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

export const Trade = mongoose.models.Trade || mongoose.model<ITrade>("Trade", TradeSchema);
```

**Step 3: Commit**

```bash
git add lib/models/
git commit -m "feat: add User and Trade Mongoose models"
```

---

## Task 4: NextAuth Configuration

**Files:**
- Create: `app/api/auth/[...nextauth]/route.ts`
- Create: `lib/auth.ts` (shared NextAuth config)

**Step 1: Create shared auth config**

```typescript
// lib/auth.ts
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { connectDB } from "./mongodb";
import { User } from "./models/User";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        await connectDB();
        const user = await User.findOne({ email: credentials.email.toLowerCase() });
        if (!user) return null;

        const isValid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!isValid) return null;

        return { id: user._id.toString(), email: user.email };
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        (session.user as { id?: string }).id = token.id as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
};
```

**Step 2: Create NextAuth route handler**

```typescript
// app/api/auth/[...nextauth]/route.ts
import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
```

**Step 3: Commit**

```bash
git add lib/auth.ts app/api/auth/
git commit -m "feat: configure NextAuth with CredentialsProvider and JWT"
```

---

## Task 5: Register API Route

**Files:**
- Create: `app/api/auth/register/route.ts`

**Step 1: Create register endpoint**

```typescript
// app/api/auth/register/route.ts
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/lib/models/User";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    await connectDB();

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await User.create({ email: email.toLowerCase(), passwordHash });

    return NextResponse.json({ message: "Account created" }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
```

**Step 2: Commit**

```bash
git add app/api/auth/register/route.ts
git commit -m "feat: add user registration API endpoint"
```

---

## Task 6: Trades API Routes

**Files:**
- Create: `app/api/trades/route.ts`
- Create: `app/api/trades/[id]/route.ts`

**Step 1: Create GET + POST trades route**

```typescript
// app/api/trades/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { Trade } from "@/lib/models/Trade";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const trades = await Trade.find({ userId: (session.user as { id: string }).id })
    .sort({ createdAt: -1 })
    .lean();

  return NextResponse.json(trades);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    await connectDB();

    const trade = await Trade.create({
      ...body,
      userId: (session.user as { id: string }).id,
    });

    return NextResponse.json(trade, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to save trade" }, { status: 500 });
  }
}
```

**Step 2: Create DELETE trades/[id] route**

```typescript
// app/api/trades/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { Trade } from "@/lib/models/Trade";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const trade = await Trade.findOneAndDelete({
    _id: params.id,
    userId: (session.user as { id: string }).id,
  });

  if (!trade) return NextResponse.json({ error: "Trade not found" }, { status: 404 });

  return NextResponse.json({ message: "Deleted" });
}
```

**Step 3: Commit**

```bash
git add app/api/trades/
git commit -m "feat: add GET, POST, DELETE trades API routes"
```

---

## Task 7: Middleware — Protect Dashboard

**Files:**
- Create: `middleware.ts` (project root)

**Step 1: Create middleware**

```typescript
// middleware.ts
export { default } from "next-auth/middleware";

export const config = {
  matcher: ["/dashboard/:path*"],
};
```

**Step 2: Commit**

```bash
git add middleware.ts
git commit -m "feat: add middleware to protect /dashboard route"
```

---

## Task 8: Root Layout + Providers

**Files:**
- Modify: `app/layout.tsx`
- Create: `components/Providers.tsx`

**Step 1: Create SessionProvider wrapper**

```typescript
// components/Providers.tsx
"use client";
import { SessionProvider } from "next-auth/react";

export default function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
```

**Step 2: Update root layout**

```typescript
// app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Options Trade Tracker",
  description: "Track your options trades",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-50 min-h-screen`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

**Step 3: Commit**

```bash
git add components/Providers.tsx app/layout.tsx
git commit -m "feat: add session provider and root layout"
```

---

## Task 9: Root Page — Redirect

**Files:**
- Modify: `app/page.tsx`

**Step 1: Replace root page with redirect**

```typescript
// app/page.tsx
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default async function Home() {
  const session = await getServerSession(authOptions);
  if (session) redirect("/dashboard");
  else redirect("/login");
}
```

**Step 2: Commit**

```bash
git add app/page.tsx
git commit -m "feat: redirect root page to dashboard or login"
```

---

## Task 10: Navbar Component

**Files:**
- Create: `components/Navbar.tsx`

**Step 1: Create Navbar**

```typescript
// components/Navbar.tsx
"use client";
import { signOut, useSession } from "next-auth/react";

export default function Navbar() {
  const { data: session } = useSession();

  return (
    <nav className="bg-white border-b border-gray-200 px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold text-gray-900">TradeTracker</span>
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Options</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500 hidden sm:block">{session?.user?.email}</span>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </nav>
  );
}
```

**Step 2: Commit**

```bash
git add components/Navbar.tsx
git commit -m "feat: add Navbar component with sign out"
```

---

## Task 11: StatsBar Component

**Files:**
- Create: `components/StatsBar.tsx`

**Step 1: Create StatsBar**

```typescript
// components/StatsBar.tsx
import { ITrade } from "@/lib/models/Trade";

interface Props {
  trades: ITrade[];
}

function fmt(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export default function StatsBar({ trades }: Props) {
  const wins = trades.filter((t) => t.netPnL > 0);
  const losses = trades.filter((t) => t.netPnL < 0);
  const totalNetPnL = trades.reduce((s, t) => s + t.netPnL, 0);
  const avgWin = wins.length ? wins.reduce((s, t) => s + t.netPnL, 0) / wins.length : 0;
  const avgLoss = losses.length ? losses.reduce((s, t) => s + t.netPnL, 0) / losses.length : 0;
  const grossWins = wins.reduce((s, t) => s + t.netPnL, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.netPnL, 0));
  const profitFactor = grossLoss > 0 ? (grossWins / grossLoss).toFixed(2) : wins.length > 0 ? "∞" : "—";
  const winRate = trades.length > 0 ? ((wins.length / trades.length) * 100).toFixed(1) : "0";

  const stats = [
    { label: "Total Trades", value: trades.length.toString(), neutral: true },
    { label: "Win Rate", value: `${winRate}%`, positive: parseFloat(winRate) >= 50 },
    {
      label: "Net P&L",
      value: `₹${fmt(totalNetPnL)}`,
      positive: totalNetPnL >= 0,
      colored: true,
    },
    { label: "Avg Win", value: `₹${fmt(avgWin)}`, positive: true, colored: true },
    { label: "Avg Loss", value: `₹${fmt(avgLoss)}`, positive: false, colored: true },
    { label: "Profit Factor", value: profitFactor.toString(), neutral: true },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
      {stats.map((s) => (
        <div key={s.label} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <p className="text-xs text-gray-500 mb-1">{s.label}</p>
          <p
            className={`text-lg font-bold ${
              s.neutral
                ? "text-gray-800"
                : s.colored
                ? s.positive
                  ? "text-green-600"
                  : "text-red-500"
                : s.positive
                ? "text-green-600"
                : "text-red-500"
            }`}
          >
            {s.value}
          </p>
        </div>
      ))}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add components/StatsBar.tsx
git commit -m "feat: add StatsBar component with trade statistics"
```

---

## Task 12: TradeForm Component

**Files:**
- Create: `components/TradeForm.tsx`

**Step 1: Create TradeForm**

```typescript
// components/TradeForm.tsx
"use client";
import { useState } from "react";

const SYMBOLS = ["NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY", "SENSEX"];
const LOT_SIZES: Record<string, number> = {
  NIFTY: 75,
  BANKNIFTY: 30,
  FINNIFTY: 40,
  MIDCPNIFTY: 120,
  SENSEX: 20,
};

function getDayName(dateStr: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][d.getDay()];
}

interface Props {
  onAdd: (trade: Record<string, unknown>) => void;
}

export default function TradeForm({ onAdd }: Props) {
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({
    date: today,
    time: "",
    symbol: "NIFTY",
    type: "CE",
    expiry: "",
    strike: "",
    lots: "",
    lotSize: "75",
    entry: "",
    exit: "",
    charges: "20",
    setupValid: false,
    rulesFollowed: false,
    notes: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const day = getDayName(form.date);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setForm((prev) => {
      const updated = { ...prev, [name]: type === "checkbox" ? checked : value };
      if (name === "symbol") updated.lotSize = String(LOT_SIZES[value] ?? "");
      return updated;
    });
  }

  function calcPnL() {
    const entry = parseFloat(form.entry);
    const exit = parseFloat(form.exit);
    const lots = parseFloat(form.lots);
    const lotSize = parseFloat(form.lotSize);
    const charges = parseFloat(form.charges) || 0;
    if (!entry || !exit || !lots || !lotSize) return { gross: 0, net: 0 };
    const gross = (exit - entry) * lots * lotSize;
    const net = gross - charges;
    return { gross, net };
  }

  const { gross, net } = calcPnL();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const payload = {
      date: form.date,
      day,
      time: form.time,
      symbol: form.symbol,
      type: form.type,
      expiry: form.expiry,
      strike: parseFloat(form.strike),
      lots: parseFloat(form.lots),
      lotSize: parseFloat(form.lotSize),
      entry: parseFloat(form.entry),
      exit: parseFloat(form.exit),
      grossPnL: gross,
      charges: parseFloat(form.charges) || 0,
      netPnL: net,
      setupValid: form.setupValid,
      rulesFollowed: form.rulesFollowed,
      notes: form.notes,
    };

    try {
      const res = await fetch("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to save trade");
      const saved = await res.json();
      onAdd(saved);

      setForm({
        date: today,
        time: "",
        symbol: "NIFTY",
        type: "CE",
        expiry: "",
        strike: "",
        lots: "",
        lotSize: "75",
        entry: "",
        exit: "",
        charges: "20",
        setupValid: false,
        rulesFollowed: false,
        notes: "",
      });
    } catch {
      setError("Failed to save trade. Try again.");
    } finally {
      setLoading(false);
    }
  }

  const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white";
  const labelCls = "block text-xs font-medium text-gray-600 mb-1";

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
      <h2 className="text-base font-semibold text-gray-800 mb-4">Add Trade</h2>

      {error && <div className="text-red-500 text-sm mb-3 bg-red-50 px-3 py-2 rounded-lg">{error}</div>}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-3">
        <div>
          <label className={labelCls}>Date</label>
          <input type="date" name="date" value={form.date} onChange={handleChange} className={inputCls} required />
        </div>
        <div>
          <label className={labelCls}>Day</label>
          <input type="text" value={day} readOnly className={`${inputCls} bg-gray-50 text-gray-500`} />
        </div>
        <div>
          <label className={labelCls}>Time</label>
          <input type="time" name="time" value={form.time} onChange={handleChange} className={inputCls} required />
        </div>
        <div>
          <label className={labelCls}>Symbol</label>
          <select name="symbol" value={form.symbol} onChange={handleChange} className={inputCls}>
            {SYMBOLS.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Type</label>
          <select name="type" value={form.type} onChange={handleChange} className={inputCls}>
            <option value="CE">CE</option>
            <option value="PE">PE</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Expiry</label>
          <input type="date" name="expiry" value={form.expiry} onChange={handleChange} className={inputCls} required />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-3">
        <div>
          <label className={labelCls}>Strike</label>
          <input type="number" name="strike" value={form.strike} onChange={handleChange} placeholder="21500" className={inputCls} required />
        </div>
        <div>
          <label className={labelCls}>Lots</label>
          <input type="number" name="lots" value={form.lots} onChange={handleChange} placeholder="1" className={inputCls} required />
        </div>
        <div>
          <label className={labelCls}>Lot Size</label>
          <input type="number" name="lotSize" value={form.lotSize} onChange={handleChange} className={inputCls} required />
        </div>
        <div>
          <label className={labelCls}>Entry</label>
          <input type="number" step="0.05" name="entry" value={form.entry} onChange={handleChange} placeholder="120.00" className={inputCls} required />
        </div>
        <div>
          <label className={labelCls}>Exit</label>
          <input type="number" step="0.05" name="exit" value={form.exit} onChange={handleChange} placeholder="150.00" className={inputCls} required />
        </div>
        <div>
          <label className={labelCls}>Charges (₹)</label>
          <input type="number" name="charges" value={form.charges} onChange={handleChange} className={inputCls} />
        </div>
      </div>

      {/* Live P&L preview */}
      <div className="flex gap-4 mb-3 bg-gray-50 px-4 py-3 rounded-xl">
        <div>
          <span className="text-xs text-gray-500">Gross P&L: </span>
          <span className={`text-sm font-bold ${gross >= 0 ? "text-green-600" : "text-red-500"}`}>
            ₹{gross.toLocaleString("en-IN")}
          </span>
        </div>
        <div>
          <span className="text-xs text-gray-500">Net P&L: </span>
          <span className={`text-sm font-bold ${net >= 0 ? "text-green-600" : "text-red-500"}`}>
            ₹{net.toLocaleString("en-IN")}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div className="flex items-center gap-2">
          <input type="checkbox" id="setupValid" name="setupValid" checked={form.setupValid} onChange={handleChange} className="w-4 h-4 accent-blue-500" />
          <label htmlFor="setupValid" className="text-sm text-gray-700">Setup Valid</label>
        </div>
        <div className="flex items-center gap-2">
          <input type="checkbox" id="rulesFollowed" name="rulesFollowed" checked={form.rulesFollowed} onChange={handleChange} className="w-4 h-4 accent-blue-500" />
          <label htmlFor="rulesFollowed" className="text-sm text-gray-700">Rules Followed</label>
        </div>
        <div>
          <textarea name="notes" value={form.notes} onChange={handleChange} placeholder="Notes..." rows={1} className={`${inputCls} resize-none`} />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium px-6 py-2 rounded-lg text-sm transition-colors"
      >
        {loading ? "Saving..." : "Add Trade"}
      </button>
    </form>
  );
}
```

**Step 2: Commit**

```bash
git add components/TradeForm.tsx
git commit -m "feat: add TradeForm component with live P&L preview"
```

---

## Task 13: TradeTable Component

**Files:**
- Create: `components/TradeTable.tsx`

**Step 1: Create TradeTable**

```typescript
// components/TradeTable.tsx
"use client";

interface Trade {
  _id: string;
  date: string;
  day: string;
  time: string;
  symbol: string;
  type: "CE" | "PE";
  expiry: string;
  strike: number;
  lots: number;
  lotSize: number;
  entry: number;
  exit: number;
  grossPnL: number;
  charges: number;
  netPnL: number;
  setupValid: boolean;
  rulesFollowed: boolean;
  notes: string;
  isNew?: boolean;
}

interface Props {
  trades: Trade[];
  onDelete: (id: string) => void;
}

function fmt(n: number) {
  const sign = n >= 0 ? "+" : "";
  return `${sign}₹${Math.abs(n).toLocaleString("en-IN")}`;
}

export default function TradeTable({ trades, onDelete }: Props) {
  if (trades.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center text-gray-400 text-sm">
        No trades yet. Add your first trade above.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {["Date","Day","Time","Symbol","Type","Expiry","Strike","Lots","Entry","Exit","Gross","Charges","Net P&L","Setup","Rules","Notes",""].map((h) => (
                <th key={h} className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {trades.map((t) => (
              <tr
                key={t._id}
                className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${t.isNew ? "animate-pulse-once bg-blue-50" : ""}`}
              >
                <td className="px-3 py-2.5 text-gray-700 whitespace-nowrap">{t.date}</td>
                <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{t.day}</td>
                <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{t.time}</td>
                <td className="px-3 py-2.5 font-medium text-gray-800">{t.symbol}</td>
                <td className="px-3 py-2.5">
                  <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${t.type === "CE" ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-600"}`}>
                    {t.type}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{t.expiry}</td>
                <td className="px-3 py-2.5 text-gray-700">{t.strike}</td>
                <td className="px-3 py-2.5 text-gray-700">{t.lots}</td>
                <td className="px-3 py-2.5 text-gray-700">{t.entry}</td>
                <td className="px-3 py-2.5 text-gray-700">{t.exit}</td>
                <td className={`px-3 py-2.5 font-medium ${t.grossPnL >= 0 ? "text-green-600" : "text-red-500"}`}>{fmt(t.grossPnL)}</td>
                <td className="px-3 py-2.5 text-gray-500">₹{t.charges}</td>
                <td className={`px-3 py-2.5 font-bold ${t.netPnL >= 0 ? "text-green-600" : "text-red-500"}`}>{fmt(t.netPnL)}</td>
                <td className="px-3 py-2.5 text-center">{t.setupValid ? "✓" : "—"}</td>
                <td className="px-3 py-2.5 text-center">{t.rulesFollowed ? "✓" : "—"}</td>
                <td className="px-3 py-2.5 text-gray-400 max-w-[150px] truncate">{t.notes}</td>
                <td className="px-3 py-2.5">
                  <button
                    onClick={() => onDelete(t._id)}
                    className="text-gray-300 hover:text-red-500 transition-colors text-base leading-none"
                    title="Delete trade"
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add components/TradeTable.tsx
git commit -m "feat: add TradeTable component with P&L coloring and delete"
```

---

## Task 14: Dashboard Page

**Files:**
- Create: `app/dashboard/page.tsx`

**Step 1: Create dashboard page**

```typescript
// app/dashboard/page.tsx
"use client";
import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import StatsBar from "@/components/StatsBar";
import TradeForm from "@/components/TradeForm";
import TradeTable from "@/components/TradeTable";

interface Trade {
  _id: string;
  date: string;
  day: string;
  time: string;
  symbol: string;
  type: "CE" | "PE";
  expiry: string;
  strike: number;
  lots: number;
  lotSize: number;
  entry: number;
  exit: number;
  grossPnL: number;
  charges: number;
  netPnL: number;
  setupValid: boolean;
  rulesFollowed: boolean;
  notes: string;
  isNew?: boolean;
}

export default function Dashboard() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/trades")
      .then((r) => r.json())
      .then((data) => {
        setTrades(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  function handleAdd(trade: Record<string, unknown>) {
    const newTrade = { ...(trade as Trade), isNew: true };
    setTrades((prev) => [newTrade, ...prev]);
    // Remove highlight after 3s
    setTimeout(() => {
      setTrades((prev) => prev.map((t) => (t._id === newTrade._id ? { ...t, isNew: false } : t)));
    }, 3000);
  }

  async function handleDelete(id: string) {
    await fetch(`/api/trades/${id}`, { method: "DELETE" });
    setTrades((prev) => prev.filter((t) => t._id !== id));
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>
        {loading ? (
          <div className="text-center py-20 text-gray-400">Loading trades...</div>
        ) : (
          <>
            <StatsBar trades={trades as Parameters<typeof StatsBar>[0]["trades"]} />
            <TradeForm onAdd={handleAdd} />
            <TradeTable trades={trades} onDelete={handleDelete} />
          </>
        )}
      </main>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add app/dashboard/page.tsx
git commit -m "feat: add Dashboard page with stats, form, and trade table"
```

---

## Task 15: Login Page

**Files:**
- Create: `app/login/page.tsx`

**Step 1: Create login page**

```typescript
// app/login/page.tsx
"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (res?.error) {
      setError("Invalid email or password");
      setLoading(false);
    } else {
      router.push("/dashboard");
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">TradeTracker</h1>
          <p className="text-gray-500 text-sm mt-1">Options Trading Journal</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-5">Sign in</h2>

          {error && <div className="text-red-500 text-sm mb-4 bg-red-50 px-3 py-2 rounded-lg">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="you@example.com"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="••••••••"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2 rounded-lg text-sm transition-colors"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-4">
            No account?{" "}
            <Link href="/register" className="text-blue-600 hover:underline font-medium">
              Register
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add app/login/page.tsx
git commit -m "feat: add login page with NextAuth credentials sign-in"
```

---

## Task 16: Register Page

**Files:**
- Create: `app/register/page.tsx`

**Step 1: Create register page**

```typescript
// app/register/page.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Registration failed");
      setLoading(false);
    } else {
      router.push("/login?registered=1");
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">TradeTracker</h1>
          <p className="text-gray-500 text-sm mt-1">Options Trading Journal</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-5">Create account</h2>

          {error && <div className="text-red-500 text-sm mb-4 bg-red-50 px-3 py-2 rounded-lg">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="you@example.com"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="Min 6 characters"
                required
                minLength={6}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2 rounded-lg text-sm transition-colors"
            >
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-4">
            Have an account?{" "}
            <Link href="/login" className="text-blue-600 hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add app/register/page.tsx
git commit -m "feat: add register page"
```

---

## Task 17: Final Polish — next.config + TypeScript fixes

**Files:**
- Modify: `next.config.ts` (or `next.config.js`)
- Modify: `tsconfig.json` if needed

**Step 1: Update next.config if needed**

The default config from create-next-app is fine. No changes needed.

**Step 2: Add NextAuth type augmentation**

```typescript
// types/next-auth.d.ts
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & { id: string };
  }
}
```

**Step 3: Add to tsconfig paths if not present**

Verify `tsconfig.json` has:
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

**Step 4: Run build to check for TS errors**

```bash
npm run build
```
Expected: Build succeeds with no errors.

**Step 5: Final commit**

```bash
git add types/ tsconfig.json
git commit -m "feat: add NextAuth type augmentation"
```

---

## Task 18: Deployment Setup

**Files:**
- No code changes needed

**Step 1: Push to GitHub**

```bash
git remote add origin https://github.com/<your-username>/trade-tracker.git
git branch -M main
git push -u origin main
```

**Step 2: Deploy on Vercel**
1. Go to https://vercel.com/new
2. Import your GitHub repo
3. Add environment variables:
   - `MONGODB_URI` — your MongoDB Atlas connection string
   - `NEXTAUTH_SECRET` — run `openssl rand -base64 32` to generate
   - `NEXTAUTH_URL` — your Vercel domain (e.g. `https://trade-tracker.vercel.app`)
4. Click Deploy

**Step 3: MongoDB Atlas setup (if not done)**
1. Create free cluster at https://cloud.mongodb.com
2. Create database user with password
3. Whitelist all IPs: `0.0.0.0/0` (for Vercel)
4. Get connection string: Clusters → Connect → Drivers → copy URI

---

## Summary

| Task | Description |
|------|-------------|
| 1 | Scaffold Next.js project |
| 2 | MongoDB connection utility |
| 3 | User + Trade Mongoose models |
| 4 | NextAuth configuration |
| 5 | Register API route |
| 6 | Trades GET/POST/DELETE API routes |
| 7 | Middleware route protection |
| 8 | Root layout + session provider |
| 9 | Root page redirect |
| 10 | Navbar component |
| 11 | StatsBar component |
| 12 | TradeForm component |
| 13 | TradeTable component |
| 14 | Dashboard page |
| 15 | Login page |
| 16 | Register page |
| 17 | TypeScript polish + build check |
| 18 | Deploy to Vercel |

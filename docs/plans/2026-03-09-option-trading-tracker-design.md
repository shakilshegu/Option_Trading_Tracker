# Option Trading Tracker — Design Doc

**Date:** 2026-03-09

## Overview

A multi-user option trade journal built with Next.js 14, Tailwind CSS, MongoDB Atlas, and NextAuth.js. Users register/login with email and password, then log and track their option trades with P&L.

## Stack

- **Framework:** Next.js 14 (App Router)
- **Styling:** Tailwind CSS
- **Database:** MongoDB Atlas via Mongoose
- **Auth:** NextAuth.js (Credentials provider, JWT sessions, bcrypt)

## Pages

| Route | Description |
|---|---|
| `/` | Landing page, redirects to dashboard if logged in |
| `/auth/signin` | Login form |
| `/auth/signup` | Registration form |
| `/dashboard` | Trade list + summary stats (total P&L, win rate) |
| `/trades/new` | Add new trade form |
| `/trades/[id]` | Edit / view trade detail |

## Data Models

### User
```
{
  name: String,
  email: String (unique),
  password: String (bcrypt hashed),
  createdAt: Date
}
```

### Trade
```
{
  userId: ObjectId (ref: User),
  symbol: String,
  type: Enum [Call, Put],
  action: Enum [Buy, Sell],
  strike: Number,
  expiry: Date,
  premium: Number,
  quantity: Number,
  status: Enum [Open, Closed],
  closePrice: Number (optional, for closed trades),
  pnl: Number (auto-calculated),
  createdAt: Date,
  updatedAt: Date
}
```

## Auth Flow

1. User registers at `/auth/signup` — password hashed with bcrypt, stored in MongoDB
2. User logs in at `/auth/signin` — NextAuth Credentials provider validates, issues JWT
3. Protected routes check session server-side via `getServerSession`
4. Unauthenticated users redirected to `/auth/signin`

## P&L Calculation

- **Buy:** `(closePrice - premium) * quantity * 100`
- **Sell:** `(premium - closePrice) * quantity * 100`
- Calculated when trade status changes to Closed

## Environment Variables

```
MONGODB_URI=<your Atlas connection string>
NEXTAUTH_SECRET=<random secret>
NEXTAUTH_URL=http://localhost:3000
```

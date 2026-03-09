# Indian Market Trade Schema — Design Doc

**Date:** 2026-03-09

## Overview

Replace the generic option trade schema with an Indian derivatives market–specific schema. Supports NSE/BSE index options (NIFTY, BANKNIFTY, FINNIFTY, MIDCPNIFTY, SENSEX, BANKEX) with CE/PE types, lot-based P&L calculation, trade journal fields (setup validity, rules followed, notes), and live P&L preview on the form.

## Stack

Same as existing: Next.js 14 App Router, TypeScript, Tailwind CSS, Mongoose, NextAuth v4

---

## Data Model (`models/Trade.ts`)

```
{
  userId:         ObjectId (ref: User)
  date:           Date       — trade date
  day:            String     — Mon/Tue/Wed/Thu/Fri/Sat/Sun (derived, stored)
  time:           String     — HH:MM (trade entry time)
  symbol:         String enum [NIFTY, BANKNIFTY, FINNIFTY, MIDCPNIFTY, SENSEX, BANKEX]
  type:           String enum [CE, PE]
  expiry:         Date       — option expiry date
  strike:         Number
  lots:           Number
  lotSize:        Number     — default 25, editable per trade
  entry:          Number     — entry price ₹
  exit:           Number     — exit price ₹
  charges:        Number     — brokerage/charges ₹
  grossPnL:       Number     — (exit - entry) × lots × lotSize
  netPnL:         Number     — grossPnL - charges
  setupValid:     Boolean    — was the setup valid?
  rulesFollowed:  Boolean    — were trading rules followed?
  notes:          String     — optional free text
  createdAt:      Date       (timestamps)
  updatedAt:      Date       (timestamps)
}
```

**Removed fields:** `type: Call/Put`, `action: Buy/Sell`, `premium`, `quantity`, `status`, `closePrice`, `pnl`

---

## P&L Formulas

- **Gross P&L** = `(exit - entry) × lots × lotSize`
- **Net P&L** = `grossPnL - charges`

Calculated on the backend (API) before saving. Also computed live on the frontend form as a read-only preview.

---

## Form (`components/TradeForm.tsx`)

Fields in order:
1. **Date** — date picker (required)
2. **Day** — read-only, auto-derived from Date via `new Date(date).toLocaleDateString('en-IN', { weekday: 'long' })`
3. **Time** — time picker HH:MM (required)
4. **Symbol** — select: NIFTY / BANKNIFTY / FINNIFTY / MIDCPNIFTY / SENSEX / BANKEX
5. **Type** — select: CE / PE
6. **Expiry** — date picker
7. **Strike** — number
8. **Lots** — number
9. **Lot Size** — number, default 25
10. **Entry ₹** — number
11. **Exit ₹** — number
12. **Charges ₹** — number
13. **Setup Valid** — Yes/No toggle buttons
14. **Rules Followed** — Yes/No toggle buttons
15. **Notes** — textarea (optional)
16. **Gross P&L** — read-only live calculation display
17. **Net P&L** — read-only live calculation display

---

## API Changes

### `POST /api/trades` and `PUT /api/trades/[id]`

Accept body:
```
{ date, time, symbol, type, expiry, strike, lots, lotSize, entry, exit, charges, setupValid, rulesFollowed, notes }
```

Compute and store:
```
day = new Date(date).toLocaleDateString('en-US', { weekday: 'long' })
grossPnL = (exit - entry) * lots * lotSize
netPnL = grossPnL - charges
```

---

## Dashboard

### Stats Cards
- **Total Trades** — count
- **Net P&L** — sum of netPnL (₹, green/red)
- **Win Rate** — % of trades where netPnL > 0
- **Avg Net P&L** — netPnL / total trades (₹)

### Table Columns
Date | Day | Time | Symbol | Type | Strike | Expiry | Lots | Entry | Exit | Gross P&L | Net P&L | Valid | Rules | Actions

---

## Files Changed

| File | Change |
|---|---|
| `models/Trade.ts` | Complete schema replacement |
| `app/api/trades/route.ts` | New fields, new P&L calculation |
| `app/api/trades/[id]/route.ts` | New fields, new P&L calculation |
| `components/TradeForm.tsx` | Complete rewrite |
| `app/dashboard/DashboardClient.tsx` | New stats + new table columns |
| `app/trades/[id]/page.tsx` | Pass new initial values to TradeForm |

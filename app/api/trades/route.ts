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
      grossPnL,
      charges,
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

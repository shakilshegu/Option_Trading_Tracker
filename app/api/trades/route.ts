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
    const trades = await Trade.find({ userId: session.user.id }).sort({ createdAt: -1 })
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
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

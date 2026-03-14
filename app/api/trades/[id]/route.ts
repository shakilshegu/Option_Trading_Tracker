import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import Trade from '@/models/Trade'
import User from '@/models/User'
import bcrypt from 'bcryptjs'

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
    const { symbol, type, action, strike, expiry, premium, quantity, status, closePrice } = body

    const effectiveStatus = status ?? trade.status
    let pnl: number | undefined
    if (effectiveStatus === 'Closed' && closePrice != null) {
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
      status: effectiveStatus,
      closePrice: effectiveStatus === 'Closed' ? closePrice : undefined,
      pnl,
    })
    await trade.save()
    return NextResponse.json(trade)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // We must read the body from the request to get the password
    let body;
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Missing request body' }, { status: 400 })
    }

    const { password } = body
    if (!password) {
      return NextResponse.json({ error: 'Password is required to delete a trade' }, { status: 400 })
    }

    // Verify Password Against User in DB
    await connectDB()
    const user = await User.findById(session.user.id)
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const isValid = await bcrypt.compare(password, user.password)
    if (!isValid) {
      return NextResponse.json({ error: 'Incorrect password' }, { status: 403 })
    }

    const trade = await getOwned(id, session.user.id)
    if (!trade) return NextResponse.json({ error: 'Trade not found' }, { status: 404 })

    await trade.deleteOne()
    return NextResponse.json({ message: 'Deleted' })
  } catch (error) {
    console.error('DELETE_TRADE_ERROR:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

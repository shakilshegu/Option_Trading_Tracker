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

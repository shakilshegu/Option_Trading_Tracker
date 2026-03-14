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

  return (
    <DashboardClient
      trades={serialized}
      userName={session.user.name ?? 'Trader'}
    />
  )
}

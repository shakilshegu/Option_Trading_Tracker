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

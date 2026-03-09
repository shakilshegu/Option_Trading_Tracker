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

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function Home() {
  const session = await getServerSession(authOptions)
  if (session) redirect('/dashboard')

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-4 text-center">
      <div className="mb-4 text-5xl">📈</div>
      <h1 className="text-4xl font-extrabold text-white mb-4">Option Trading Tracker</h1>
      <p className="text-gray-400 text-lg max-w-md mb-8">
        Log your option trades, track P&L, and review your performance — all in one place.
      </p>
      <div className="flex gap-4">
        <Link
          href="/auth/signup"
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
        >
          Get Started
        </Link>
        <Link
          href="/auth/signin"
          className="bg-gray-800 hover:bg-gray-700 text-white font-semibold px-6 py-3 rounded-xl transition-colors border border-gray-700"
        >
          Sign In
        </Link>
      </div>
    </div>
  )
}

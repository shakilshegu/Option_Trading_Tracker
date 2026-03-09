'use client'
import Link from 'next/link'
import { signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'

interface Trade {
  _id: string
  symbol: string
  type: string
  action: string
  strike: number
  expiry: string
  premium: number
  quantity: number
  status: string
  pnl?: number
}

interface Stats {
  totalPnL: number
  winRate: number
  total: number
  closed: number
}

export default function DashboardClient({
  trades, stats, userName,
}: { trades: Trade[]; stats: Stats; userName: string }) {
  const router = useRouter()

  async function deleteTrade(id: string) {
    if (!confirm('Delete this trade?')) return
    await fetch(`/api/trades/${id}`, { method: 'DELETE' })
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">📈 Option Tracker</h1>
          <div className="flex items-center gap-4">
            <span className="text-gray-400 text-sm">Hi, {userName}</span>
            <button
              onClick={() => signOut({ callbackUrl: '/' })}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Trades', value: String(stats.total) },
            { label: 'Closed', value: String(stats.closed) },
            {
              label: 'Total P&L',
              value: `$${stats.totalPnL >= 0 ? '+' : ''}${stats.totalPnL.toFixed(2)}`,
              color: stats.totalPnL >= 0 ? 'text-emerald-400' : 'text-red-400',
            },
            { label: 'Win Rate', value: `${stats.winRate}%` },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">{label}</p>
              <p className={`text-2xl font-bold ${color ?? 'text-white'}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">My Trades</h2>
          <Link
            href="/trades/new"
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            + New Trade
          </Link>
        </div>

        {/* Trades Table */}
        {trades.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p className="text-lg">No trades yet.</p>
            <Link href="/trades/new" className="text-emerald-400 hover:underline text-sm mt-2 inline-block">
              Log your first trade →
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-800">
                  {['Symbol', 'Type', 'Action', 'Strike', 'Expiry', 'Premium', 'Qty', 'Status', 'P&L', ''].map((h) => (
                    <th key={h} className="py-3 px-2 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {trades.map((trade) => (
                  <tr key={trade._id} className="border-b border-gray-800/50 hover:bg-gray-900/50">
                    <td className="py-3 px-2 font-semibold text-white">{trade.symbol}</td>
                    <td className="py-3 px-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${trade.type === 'Call' ? 'bg-blue-900/50 text-blue-300' : 'bg-purple-900/50 text-purple-300'}`}>
                        {trade.type}
                      </span>
                    </td>
                    <td className="py-3 px-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${trade.action === 'Buy' ? 'bg-emerald-900/50 text-emerald-300' : 'bg-orange-900/50 text-orange-300'}`}>
                        {trade.action}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-gray-300">${trade.strike}</td>
                    <td className="py-3 px-2 text-gray-300">{new Date(trade.expiry).toLocaleDateString()}</td>
                    <td className="py-3 px-2 text-gray-300">${trade.premium}</td>
                    <td className="py-3 px-2 text-gray-300">{trade.quantity}</td>
                    <td className="py-3 px-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${trade.status === 'Open' ? 'bg-yellow-900/50 text-yellow-300' : 'bg-gray-700 text-gray-300'}`}>
                        {trade.status}
                      </span>
                    </td>
                    <td className={`py-3 px-2 font-medium ${(trade.pnl ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {trade.pnl != null ? `$${trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}` : '—'}
                    </td>
                    <td className="py-3 px-2">
                      <div className="flex gap-2">
                        <Link href={`/trades/${trade._id}`} className="text-gray-400 hover:text-white text-xs">Edit</Link>
                        <button onClick={() => deleteTrade(trade._id)} className="text-red-500 hover:text-red-400 text-xs">Del</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}

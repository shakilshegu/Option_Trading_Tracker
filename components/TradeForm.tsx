'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface TradeFormProps {
  initialValues?: Partial<{
    symbol: string; type: string; action: string; strike: number | string
    expiry: string; premium: number | string; quantity: number | string
    status: string; closePrice: number | string
  }>
  tradeId?: string
}

const defaultValues = {
  symbol: '', type: 'Call', action: 'Buy',
  strike: '', expiry: '', premium: '', quantity: '',
  status: 'Open', closePrice: '',
}

export default function TradeForm({ initialValues, tradeId }: TradeFormProps) {
  const router = useRouter()
  const [form, setForm] = useState({ ...defaultValues, ...initialValues })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const isEdit = !!tradeId

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const payload = {
      ...form,
      strike: Number(form.strike),
      premium: Number(form.premium),
      quantity: Number(form.quantity),
      closePrice: form.closePrice !== '' ? Number(form.closePrice) : undefined,
    }

    try {
      const res = await fetch(isEdit ? `/api/trades/${tradeId}` : '/api/trades', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to save trade')
        setLoading(false)
        return
      }
      router.push('/dashboard')
      router.refresh()
    } catch {
      setError('Network error. Please try again.')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-900/40 border border-red-700 text-red-300 rounded-lg px-4 py-3 text-sm">{error}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Symbol */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Symbol (e.g. AAPL)</label>
          <input type="text" value={form.symbol} onChange={(e) => setForm({ ...form, symbol: e.target.value })} required
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>

        {/* Type */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Option Type</label>
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
            <option>Call</option>
            <option>Put</option>
          </select>
        </div>

        {/* Action */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Action</label>
          <select value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value })}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
            <option>Buy</option>
            <option>Sell</option>
          </select>
        </div>

        {/* Strike */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Strike Price</label>
          <input type="number" step="any" value={form.strike} onChange={(e) => setForm({ ...form, strike: e.target.value })} required
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>

        {/* Expiry */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Expiry Date</label>
          <input type="date" value={form.expiry} onChange={(e) => setForm({ ...form, expiry: e.target.value })} required
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>

        {/* Premium */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Premium per Contract ($)</label>
          <input type="number" step="any" value={form.premium} onChange={(e) => setForm({ ...form, premium: e.target.value })} required
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>

        {/* Quantity */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Quantity (contracts)</label>
          <input type="number" step="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>

        {/* Status */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Status</label>
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
            <option>Open</option>
            <option>Closed</option>
          </select>
        </div>

        {/* Close Price — only when Closed */}
        {form.status === 'Closed' && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Close Price ($)</label>
            <input type="number" step="any" value={form.closePrice} onChange={(e) => setForm({ ...form, closePrice: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
        )}
      </div>

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={loading}
          className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold px-6 py-2.5 rounded-lg transition-colors">
          {loading ? 'Saving…' : isEdit ? 'Update Trade' : 'Add Trade'}
        </button>
        <button type="button" onClick={() => router.back()}
          className="bg-gray-800 hover:bg-gray-700 text-white font-semibold px-6 py-2.5 rounded-lg transition-colors border border-gray-700">
          Cancel
        </button>
      </div>
    </form>
  )
}

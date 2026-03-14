'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function SignUpPage() {
  const router = useRouter()
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Registration failed')
      setLoading(false)
      return
    }
    router.push('/auth/signin?registered=true')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50/50 px-4">
      <div className="w-full max-w-md bg-white rounded-[24px] p-8 shadow-xl shadow-gray-200/50 border border-gray-100">
        <h1 className="text-2xl font-bold text-gray-900 mb-1.5">Create Account</h1>
        <p className="text-gray-500 text-sm mb-8">Start tracking your option trades today</p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl px-4 py-3 mb-6 text-sm font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {(['name', 'email', 'password'] as const).map((field) => (
            <div key={field}>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5 capitalize">{field}</label>
              <input
                type={field === 'password' ? 'password' : field === 'email' ? 'email' : 'text'}
                value={form[field]}
                onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                required
                className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm"
                placeholder={field === 'name' ? 'Your name' : field === 'email' ? 'you@example.com' : '••••••••'}
              />
            </div>
          ))}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white font-semibold rounded-xl py-3.5 shadow-md shadow-gray-900/10 transition-all active:scale-[0.98] mt-4"
          >
            {loading ? 'Creating account…' : 'Sign Up'}
          </button>
        </form>

        <p className="mt-8 text-sm text-gray-500 text-center font-medium">
          Already have an account?{' '}
          <Link href="/auth/signin" className="text-gray-900 font-bold hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  )
}

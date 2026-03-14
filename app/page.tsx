import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function Home() {
  const session = await getServerSession(authOptions)
  if (session) redirect('/dashboard')

  return (
    <div className="min-h-screen bg-[#030712] flex flex-col items-center justify-center px-4 relative overflow-hidden font-sans">

      {/* Background Ambient Glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/20 rounded-full blur-[120px] mix-blend-screen pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-600/20 rounded-full blur-[120px] mix-blend-screen pointer-events-none" />

      {/* Main Container */}
      <div className="relative z-10 max-w-4xl mx-auto flex flex-col items-center text-center">

        {/* Badge */}
        <div className="mb-8 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md shadow-lg shadow-black/20 text-sm font-medium text-gray-300 transform transition-all hover:bg-white/10 cursor-default">
          <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
          Build your edge in the markets
        </div>

        {/* Hero Headline */}
        <h1 className="text-5xl md:text-7xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-white via-gray-200 to-gray-500 mb-6 drop-shadow-sm tracking-tight leading-tight">
          Master Your <br className="hidden md:block" /> Option Trades
        </h1>

        <p className="text-lg md:text-xl text-gray-400 max-w-2xl mb-12 leading-relaxed">
          Log your setups, track your P&L, analyze your performance, and refine your edge—all in one beautiful, lightning-fast dashboard.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
          <Link
            href="/auth/signup"
            className="group relative flex items-center justify-center gap-2 w-full sm:w-auto px-8 py-4 bg-emerald-600 text-white font-bold rounded-xl shadow-[0_0_40px_-10px_rgba(16,185,129,0.5)] hover:shadow-[0_0_60px_-15px_rgba(16,185,129,0.7)] hover:-translate-y-0.5 transition-all duration-300"
          >
            <span>Get Started for Free</span>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 group-hover:translate-x-1 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
          </Link>

          <Link
            href="/auth/signin"
            className="group w-full sm:w-auto px-8 py-4 bg-white/5 hover:bg-white/10 text-white font-semibold rounded-xl border border-white/10 backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5"
          >
            Sign In
          </Link>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-20 pt-16 border-t border-white/5 w-full">
          {[
            { tag: "Analytics", title: "Smart P&L Tracking", desc: "Instantly see gross vs net profit, factoring in your exact brokerage fees." },
            { tag: "Accountability", title: "Rule Management", desc: "Flag trades that broke your rules to identify toxic behavioral patterns." },
            { tag: "Speed", title: "Lightning Fast API", desc: "Built on Next.js 14 and MongoDB—no lag when you're logging fast scalps." }
          ].map((feature, i) => (
            <div key={i} className="text-left p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] transition-colors">
              <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-2 block">{feature.tag}</span>
              <h3 className="text-lg font-bold text-gray-200 mb-2">{feature.title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}

import Link from "next/link";
import { TrendingUp, BarChart3, Bot, BookOpen, Play, Shield, Upload, Trophy, Zap, ArrowRight, Check } from "lucide-react";

const FEATURES = [
  { icon: BarChart3,  title: "Deep Analytics",      desc: "Equity curve, win rate, profit factor, R-ratio, drawdown — every metric a serious trader needs." },
  { icon: Bot,        title: "AI Coach",             desc: "Claude-powered insights analyse your patterns, flag psychology issues, and suggest concrete improvements." },
  { icon: BookOpen,   title: "Daily Journal",        desc: "Pre/post market reviews, mood tracking, rule adherence scoring, and streak monitoring." },
  { icon: Play,       title: "Trade Replay",         desc: "Replay any trading day with TradingView charts, entry/exit markers, and SL/TP lines." },
  { icon: Upload,     title: "CSV Import",           desc: "Auto-detects Robinhood, IBKR, Schwab, Tastytrade, Tradovate — or any generic CSV format." },
  { icon: Shield,     title: "Prop Firm Tracker",    desc: "Monitor daily loss limits, drawdown, and profit targets for FTMO, MyFundedFX, and others." },
  { icon: Trophy,     title: "Milestones",           desc: "Unlock achievements as you build consistency — gamified accountability that keeps you sharp." },
  { icon: Zap,        title: "Session Guard",        desc: "Real-time daily loss and max-trade limits with push notifications before you blow a limit." },
];

const PLANS = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    features: ["50 trades / month", "Core analytics", "Daily journal", "CSV import", "1 account"],
    cta: "Get started",
    accent: false,
  },
  {
    name: "Pro",
    price: "$19",
    period: "/ month",
    features: ["Unlimited trades", "AI Coach (20 queries/day)", "Multi-account", "Broker sync", "Trade replay + charts", "Prop firm tracker", "PDF export"],
    cta: "Start free trial",
    accent: true,
  },
  {
    name: "Elite",
    price: "$39",
    period: "/ month",
    features: ["Everything in Pro", "Unlimited AI queries", "Behavioral digest (weekly)", "Priority support", "Early feature access"],
    cta: "Start free trial",
    accent: false,
  },
];

const STATS = [
  { value: "2.4×", label: "avg profit factor improvement after 90 days" },
  { value: "68%", label: "of users hit their rule-adherence goal in month 1" },
  { value: "14 min", label: "saved per day vs spreadsheet journaling" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0f1117] text-[#e5e7eb]" style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
      {/* Nav */}
      <nav className="border-b border-[#1e2535] sticky top-0 z-50 bg-[#0f1117]/90 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp size={18} className="text-indigo-400" />
            <div className="flex flex-col gap-2">
              <span className="font-bold text-white text-sm tracking-wide leading-none">Edge Log</span>
              <span className="text-[9px] text-indigo-400/70 tracking-widest uppercase leading-none">The Eighth Wonder</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-[#9ca3af] hover:text-white transition-colors px-3 py-1.5">
              Sign in
            </Link>
            <Link href="/register" className="text-sm bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-lg font-medium transition-colors">
              Start free →
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-indigo-950/60 border border-indigo-800/40 rounded-full px-4 py-1.5 text-xs text-indigo-300 mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
          Multi-currency · AI Coach · Push Notifications · Native iOS/Android
        </div>
        <h1 className="text-5xl font-extrabold text-white leading-tight tracking-tight mb-3">
          The trading journal that
          <br />
          <span className="text-indigo-400">actually improves your edge</span>
        </h1>
        <p className="text-xs tracking-[0.3em] uppercase text-indigo-400/60 mb-5 font-medium">The Eighth Wonder</p>
        <p className="text-lg text-[#9ca3af] max-w-2xl mx-auto mb-8 leading-relaxed">
          Log trades, replay your day, track rule adherence, and get AI-powered coaching — all in one platform built for serious retail traders.
        </p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Link href="/register" className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-lg font-semibold text-sm transition-colors">
            Start for free <ArrowRight size={15} />
          </Link>
          <Link href="/login" className="inline-flex items-center gap-2 border border-[#1e2535] hover:border-indigo-700 text-[#9ca3af] hover:text-white px-6 py-3 rounded-lg font-medium text-sm transition-colors">
            Sign in
          </Link>
        </div>
        <p className="text-xs text-[#6b7280] mt-4">No credit card required · Free plan available · Cancel anytime</p>
      </section>

      {/* Stats bar */}
      <section className="border-y border-[#1e2535] bg-[#161b27]/60">
        <div className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-3 gap-8">
          {STATS.map((s) => (
            <div key={s.value} className="text-center">
              <div className="text-3xl font-extrabold text-indigo-400 mb-1">{s.value}</div>
              <div className="text-xs text-[#9ca3af] leading-snug">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features grid */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <h2 className="text-2xl font-bold text-white text-center mb-3">Everything you need to trade better</h2>
        <p className="text-sm text-[#9ca3af] text-center mb-12">Built by traders, for traders — not another bloated spreadsheet.</p>
        <div className="grid grid-cols-4 gap-5">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-[#161b27] border border-[#1e2535] rounded-xl p-5 hover:border-indigo-700/50 transition-colors">
              <div className="w-9 h-9 rounded-lg bg-indigo-950/70 border border-indigo-800/30 flex items-center justify-center mb-3">
                <Icon size={16} className="text-indigo-400" />
              </div>
              <div className="font-semibold text-white text-sm mb-1.5">{title}</div>
              <div className="text-xs text-[#6b7280] leading-relaxed">{desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Screenshot / preview panel */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <div className="bg-[#161b27] border border-[#1e2535] rounded-2xl overflow-hidden">
          <div className="border-b border-[#1e2535] px-5 py-3 flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#ef4444]/60" />
            <span className="w-3 h-3 rounded-full bg-[#f59e0b]/60" />
            <span className="w-3 h-3 rounded-full bg-[#22c55e]/60" />
            <span className="ml-4 text-xs text-[#6b7280]">Edge Log Dashboard</span>
          </div>
          <div className="p-6 grid grid-cols-4 gap-4">
            {[
              { label: "Net P&L", value: "+$4,230", sub: "47 trades", pos: true },
              { label: "Win Rate", value: "64.3%", sub: "30W / 17L", pos: true },
              { label: "Profit Factor", value: "2.18", sub: "", pos: true },
              { label: "Max Drawdown", value: "-$890", sub: "3.2%", pos: false },
            ].map((m) => (
              <div key={m.label} className="bg-[#0f1117] border border-[#1e2535] rounded-lg p-4">
                <div className="text-xs text-[#6b7280] uppercase tracking-wide mb-1.5">{m.label}</div>
                <div className={`text-xl font-bold ${m.pos ? "text-[#22c55e]" : "text-[#ef4444]"}`}>{m.value}</div>
                {m.sub && <div className="text-xs text-[#6b7280] mt-1">{m.sub}</div>}
              </div>
            ))}
          </div>
          <div className="px-6 pb-6">
            <div className="bg-[#0f1117] border border-[#1e2535] rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-[#6b7280]">Equity Curve</span>
                <span className="text-xs font-semibold text-[#22c55e]">+$4,230</span>
              </div>
              <svg viewBox="0 0 600 80" className="w-full h-16" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="eqFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d="M0,62 L25,55 L50,58 L75,48 L100,43 L125,50 L150,56 L175,48 L200,38 L225,32 L250,40 L275,46 L300,36 L325,28 L350,22 L375,30 L400,24 L425,18 L450,26 L475,20 L500,14 L525,18 L550,12 L575,9 L600,7"
                  fill="url(#eqFill)"
                  stroke="none"
                />
                <path
                  d="M0,62 L25,55 L50,58 L75,48 L100,43 L125,50 L150,56 L175,48 L200,38 L225,32 L250,40 L275,46 L300,36 L325,28 L350,22 L375,30 L400,24 L425,18 L450,26 L475,20 L500,14 L525,18 L550,12 L575,9 L600,7"
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth="1.5"
                />
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <h2 className="text-2xl font-bold text-white text-center mb-3">Simple, transparent pricing</h2>
        <p className="text-sm text-[#9ca3af] text-center mb-12">Start free. Upgrade when you&apos;re ready.</p>
        <div className="grid grid-cols-3 gap-6">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-xl border p-6 relative ${
                plan.accent
                  ? "bg-indigo-950/30 border-indigo-700/50"
                  : "bg-[#161b27] border-[#1e2535]"
              }`}
            >
              {plan.accent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                  Most popular
                </div>
              )}
              <div className="text-sm font-semibold text-white mb-1">{plan.name}</div>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-3xl font-extrabold text-white">{plan.price}</span>
                <span className="text-xs text-[#6b7280]">{plan.period}</span>
              </div>
              <ul className="space-y-2.5 mb-6">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-xs text-[#9ca3af]">
                    <Check size={13} className="text-indigo-400 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/register"
                className={`block text-center text-sm font-semibold py-2.5 rounded-lg transition-colors ${
                  plan.accent
                    ? "bg-indigo-600 hover:bg-indigo-500 text-white"
                    : "border border-[#1e2535] hover:border-indigo-700 text-[#9ca3af] hover:text-white"
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <div className="bg-gradient-to-br from-indigo-950/60 to-[#161b27] border border-indigo-800/30 rounded-2xl p-12 text-center">
          <h2 className="text-2xl font-bold text-white mb-3">Ready to trade with an edge?</h2>
          <p className="text-sm text-[#9ca3af] mb-6">Join traders who stopped guessing and started improving systematically.</p>
          <Link href="/register" className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-7 py-3 rounded-lg font-semibold text-sm transition-colors">
            Create free account <ArrowRight size={15} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#1e2535] py-8">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between text-xs text-[#4b5563]">
          <div className="flex items-center gap-3">
            <TrendingUp size={14} className="text-indigo-400" />
            <div>
              <span className="font-semibold text-[#6b7280]">Edge Log</span>
              <span className="mx-2 text-[#2d3748]">·</span>
              <span className="text-indigo-400/50 tracking-widest uppercase text-[10px]">The Eighth Wonder</span>
            </div>
            <span>© 2025</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link>
            <Link href="/login" className="hover:text-white transition-colors">Sign in</Link>
            <Link href="/register" className="hover:text-white transition-colors">Register</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

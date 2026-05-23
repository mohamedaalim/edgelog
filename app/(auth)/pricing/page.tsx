"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, TrendingUp, Zap, Crown } from "lucide-react";
import { PLANS } from "@/lib/plans";

const FREE_FEATURES = [
  "50 trades/month",
  "Basic analytics (Performance tab)",
  "Daily journal",
  "CSV import",
  "1 broker connection",
  "Community support",
];

export default function PricingPage() {
  const [loading, setLoading] = useState<string | null>(null);

  async function subscribe(plan: "PRO" | "ELITE") {
    setLoading(plan);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#0f0f11] px-4 py-16">
      {/* Nav */}
      <div className="flex items-center justify-between max-w-5xl mx-auto mb-16">
        <div className="flex items-center gap-2">
          <TrendingUp size={18} className="text-[#6c5ce7]" />
          <span className="font-bold text-white text-sm">EdgeLog</span>
        </div>
        <Link href="/login" className="text-sm text-[#888] hover:text-white transition-colors">Sign in</Link>
      </div>

      {/* Hero */}
      <div className="text-center mb-14">
        <h1 className="text-4xl md:text-5xl font-black text-white mb-4">
          Level up your trading
        </h1>
        <p className="text-[#888] text-lg max-w-xl mx-auto">
          World-class analytics, AI coaching, and broker sync. Pick the plan that matches your ambition.
        </p>
      </div>

      {/* Plans */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
        {/* Free */}
        <div className="bg-[#1a1a22] border border-white/10 rounded-2xl p-6 flex flex-col">
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Zap size={16} className="text-[#888]" />
              <span className="text-[#888] font-semibold text-sm uppercase tracking-wide">Free</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-black text-white">$0</span>
              <span className="text-[#888] text-sm">/month</span>
            </div>
            <p className="text-[#666] text-sm mt-2">Get started, no card required</p>
          </div>
          <ul className="space-y-2.5 flex-1 mb-6">
            {FREE_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-sm text-[#aaa]">
                <Check size={14} className="text-[#555] mt-0.5 shrink-0" />{f}
              </li>
            ))}
          </ul>
          <Link href="/register"
            className="w-full py-2.5 border border-white/10 text-white text-sm font-medium rounded-xl text-center hover:bg-white/5 transition-colors block">
            Get started free
          </Link>
        </div>

        {/* Pro */}
        <div className="bg-[#1a1a22] border border-[#6c5ce7] rounded-2xl p-6 flex flex-col relative">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#6c5ce7] text-white text-xs font-bold px-3 py-1 rounded-full">
            Most Popular
          </div>
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Zap size={16} className="text-[#6c5ce7]" />
              <span className="text-[#6c5ce7] font-semibold text-sm uppercase tracking-wide">Pro</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-black text-white">${PLANS.PRO.price}</span>
              <span className="text-[#888] text-sm">/month</span>
            </div>
            <p className="text-[#666] text-sm mt-2">For serious traders leveling up</p>
          </div>
          <ul className="space-y-2.5 flex-1 mb-6">
            {PLANS.PRO.features.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-sm text-[#ccc]">
                <Check size={14} className="text-[#6c5ce7] mt-0.5 shrink-0" />{f}
              </li>
            ))}
          </ul>
          <button onClick={() => subscribe("PRO")} disabled={loading === "PRO"}
            className="w-full py-2.5 bg-[#6c5ce7] hover:bg-[#5a4ed4] text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50">
            {loading === "PRO" ? "Loading…" : "Start Pro"}
          </button>
        </div>

        {/* Elite */}
        <div className="bg-gradient-to-b from-[#1e1a2e] to-[#1a1a22] border border-[#a78bfa]/40 rounded-2xl p-6 flex flex-col">
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Crown size={16} className="text-[#a78bfa]" />
              <span className="text-[#a78bfa] font-semibold text-sm uppercase tracking-wide">Elite</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-black text-white">${PLANS.ELITE.price}</span>
              <span className="text-[#888] text-sm">/month</span>
            </div>
            <p className="text-[#666] text-sm mt-2">For prop traders & full-time traders</p>
          </div>
          <ul className="space-y-2.5 flex-1 mb-6">
            {PLANS.ELITE.features.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-sm text-[#ccc]">
                <Check size={14} className="text-[#a78bfa] mt-0.5 shrink-0" />{f}
              </li>
            ))}
          </ul>
          <button onClick={() => subscribe("ELITE")} disabled={loading === "ELITE"}
            className="w-full py-2.5 bg-gradient-to-r from-[#6c5ce7] to-[#a78bfa] text-white text-sm font-semibold rounded-xl transition-opacity disabled:opacity-50 hover:opacity-90">
            {loading === "ELITE" ? "Loading…" : "Start Elite"}
          </button>
        </div>
      </div>

      <p className="text-center text-[#555] text-xs mt-10">
        Cancel anytime. All prices in USD. 7-day money-back guarantee.
      </p>
    </div>
  );
}

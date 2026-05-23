"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { type MilestoneDef, type MilestoneTier, type MilestoneCategory } from "@/lib/milestones";

// ── Types ─────────────────────────────────────────────────────────────────────

interface MilestoneData extends MilestoneDef {
  earned: boolean;
  unlockedAt: string | null;
  progress: number | null;
}

interface MilestonesResponse {
  milestones: MilestoneData[];
  totalPoints: number;
  maxPoints: number;
  stats: Record<string, number | boolean>;
}

// ── Tier config ───────────────────────────────────────────────────────────────

const TIER_STYLE: Record<MilestoneTier, { ring: string; bg: string; label: string; text: string; glow: string }> = {
  bronze:   { ring: "border-orange-500/50",  bg: "bg-orange-500/8",  label: "bg-orange-500/15 text-orange-400",  text: "text-orange-400",  glow: "shadow-orange-500/20" },
  silver:   { ring: "border-gray-400/50",    bg: "bg-gray-400/8",    label: "bg-gray-400/15 text-gray-300",      text: "text-gray-300",    glow: "shadow-gray-400/20" },
  gold:     { ring: "border-yellow-400/60",  bg: "bg-yellow-400/8",  label: "bg-yellow-400/15 text-yellow-400",  text: "text-yellow-400",  glow: "shadow-yellow-400/25" },
  platinum: { ring: "border-purple-400/60",  bg: "bg-purple-400/8",  label: "bg-purple-400/15 text-purple-400",  text: "text-purple-400",  glow: "shadow-purple-400/25" },
};

const LEVEL_THRESHOLDS = [
  { min: 0,    label: "Beginner",    color: "text-[var(--muted)]" },
  { min: 50,   label: "Developing",  color: "text-orange-400" },
  { min: 150,  label: "Proficient",  color: "text-gray-300" },
  { min: 350,  label: "Expert",      color: "text-yellow-400" },
  { min: 700,  label: "Elite",       color: "text-purple-400" },
];

function getLevel(pts: number) {
  return [...LEVEL_THRESHOLDS].reverse().find((l) => pts >= l.min) ?? LEVEL_THRESHOLDS[0];
}

const CATEGORIES: MilestoneCategory[] = ["Volume", "Profitability", "Streaks", "Discipline", "Journal", "Mastery"];

const CATEGORY_ICONS: Record<MilestoneCategory, string> = {
  Volume: "📈", Profitability: "💰", Streaks: "🔥", Discipline: "⚙️", Journal: "📝", Mastery: "🏆",
};

// ── Badge card ────────────────────────────────────────────────────────────────

function BadgeCard({ m }: { m: MilestoneData }) {
  const ts = TIER_STYLE[m.tier];
  const locked = !m.earned;

  return (
    <div className={`relative flex flex-col p-4 rounded-2xl border transition-all ${
      locked
        ? "border-[var(--card-border)] bg-[var(--card)] opacity-50"
        : `${ts.ring} ${ts.bg} shadow-lg ${ts.glow}`
    }`}>
      {/* Icon */}
      <div className={`text-3xl mb-3 transition-all ${locked ? "grayscale" : ""}`}>{m.icon}</div>

      {/* Tier + name */}
      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${locked ? "bg-[var(--card-border)] text-[var(--muted)]" : ts.label}`}>
          {m.tier.charAt(0).toUpperCase() + m.tier.slice(1)}
        </span>
        <span className={`text-xs font-semibold ${locked ? "text-[var(--muted)]" : ts.text}`}>+{m.points}pts</span>
      </div>
      <p className="text-sm font-bold text-white mb-1 leading-tight">{m.name}</p>
      <p className="text-xs text-[var(--muted)] leading-snug flex-1">{m.description}</p>

      {/* Progress bar for threshold milestones */}
      {m.progress != null && m.threshold != null && !m.earned && (
        <div className="mt-3">
          <div className="flex justify-between text-xs text-[var(--muted)] mb-1">
            <span>Progress</span>
            <span>{m.progress.toLocaleString()} / {m.threshold.toLocaleString()}</span>
          </div>
          <div className="h-1.5 bg-[var(--card-border)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--accent)] rounded-full transition-all"
              style={{ width: `${Math.min(100, (m.progress / m.threshold) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Unlocked date */}
      {m.earned && m.unlockedAt && (
        <p className={`mt-3 text-xs ${ts.text} font-medium`}>
          Unlocked {new Date(m.unlockedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        </p>
      )}

      {/* Lock overlay icon */}
      {locked && (
        <div className="absolute top-3 right-3 text-[var(--muted)] opacity-50 text-sm">🔒</div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MilestonesPage() {
  const qc = useQueryClient();
  const [activeCategory, setActiveCategory] = React.useState<MilestoneCategory | "All">("All");

  const { data, isLoading } = useQuery<MilestonesResponse>({
    queryKey: ["milestones"],
    queryFn: () => fetch("/api/milestones").then((r) => r.json()),
    staleTime: 30_000,
  });

  const checkMutation = useMutation({
    mutationFn: () => fetch("/api/milestones", { method: "POST" }).then((r) => r.json()),
    onSuccess: (result: { newlyUnlocked: string[] }) => {
      if (result.newlyUnlocked.length > 0) qc.invalidateQueries({ queryKey: ["milestones"] });
    },
  });

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
      </div>
    );
  }

  const { milestones, totalPoints, maxPoints } = data;
  const level = getLevel(totalPoints);
  const earned = milestones.filter((m) => m.earned).length;
  const total = milestones.length;
  const pct = Math.round((totalPoints / maxPoints) * 100);

  const filtered = milestones.filter((m) => activeCategory === "All" || m.category === activeCategory);

  // Group by category for "All" view
  const grouped = CATEGORIES.map((cat) => ({
    cat,
    items: filtered.filter((m) => m.category === cat),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">Milestones</h1>
          <p className="text-[var(--muted)] text-sm mt-0.5">Track your progress and unlock achievements as you grow as a trader</p>
        </div>
        <button
          onClick={() => checkMutation.mutate()}
          disabled={checkMutation.isPending}
          className="px-4 py-2 bg-[var(--accent)] text-white text-sm font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {checkMutation.isPending ? "Checking…" : "Check for New"}
        </button>
      </div>

      {/* Stats banner */}
      <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl p-5">
        <div className="flex flex-wrap gap-6 items-center">
          {/* Level badge */}
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-[var(--accent)]/10 border border-[var(--accent)]/20 flex items-center justify-center text-2xl">
              🏅
            </div>
            <div>
              <p className="text-xs text-[var(--muted)] mb-0.5">Current Level</p>
              <p className={`text-lg font-bold ${level.color}`}>{level.label}</p>
            </div>
          </div>

          <div className="w-px h-10 bg-[var(--card-border)] hidden sm:block" />

          {/* Points */}
          <div>
            <p className="text-xs text-[var(--muted)] mb-0.5">Total Points</p>
            <p className="text-lg font-bold text-white">{totalPoints.toLocaleString()} <span className="text-[var(--muted)] text-sm font-normal">/ {maxPoints.toLocaleString()}</span></p>
          </div>

          <div className="w-px h-10 bg-[var(--card-border)] hidden sm:block" />

          {/* Earned */}
          <div>
            <p className="text-xs text-[var(--muted)] mb-0.5">Badges Earned</p>
            <p className="text-lg font-bold text-white">{earned} <span className="text-[var(--muted)] text-sm font-normal">/ {total}</span></p>
          </div>

          {/* Progress bar */}
          <div className="flex-1 min-w-48">
            <div className="flex justify-between text-xs text-[var(--muted)] mb-1.5">
              <span>Overall progress</span>
              <span>{pct}%</span>
            </div>
            <div className="h-2 bg-[var(--background)] rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[var(--accent)] to-purple-400 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>

        {/* Tier breakdown */}
        <div className="mt-4 flex gap-4 flex-wrap">
          {(["bronze", "silver", "gold", "platinum"] as MilestoneTier[]).map((tier) => {
            const ts = TIER_STYLE[tier];
            const tierEarned = milestones.filter((m) => m.tier === tier && m.earned).length;
            const tierTotal = milestones.filter((m) => m.tier === tier).length;
            return (
              <div key={tier} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium ${ts.ring} ${ts.bg}`}>
                <span className={ts.text}>{tier.charAt(0).toUpperCase() + tier.slice(1)}</span>
                <span className="text-[var(--muted)]">{tierEarned}/{tierTotal}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Category filter */}
      <div className="flex gap-1.5 flex-wrap">
        {(["All", ...CATEGORIES] as const).map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeCategory === cat
                ? "bg-[var(--accent)] text-white"
                : "bg-[var(--card)] border border-[var(--card-border)] text-[var(--muted)] hover:text-white"
            }`}
          >
            {cat !== "All" && <span>{CATEGORY_ICONS[cat]}</span>}
            {cat}
            {cat !== "All" && (
              <span className={`text-xs px-1 rounded ${activeCategory === cat ? "bg-white/20" : "bg-[var(--card-border)]"}`}>
                {milestones.filter((m) => m.category === cat && m.earned).length}/{milestones.filter((m) => m.category === cat).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Achievement grid */}
      {grouped.map(({ cat, items }) => (
        <div key={cat}>
          {activeCategory === "All" && (
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">{CATEGORY_ICONS[cat]}</span>
              <h2 className="text-base font-semibold text-white">{cat}</h2>
              <span className="text-xs text-[var(--muted)]">
                {items.filter((m) => m.earned).length}/{items.length} earned
              </span>
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {items.map((m) => <BadgeCard key={m.id} m={m} />)}
          </div>
          {activeCategory === "All" && <div className="mt-4 mb-2 border-b border-[var(--card-border)]" />}
        </div>
      ))}
    </div>
  );
}

// React import needed for useState
import React from "react";

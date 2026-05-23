"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard, BookOpen, Plus, BarChart3, MoreHorizontal,
  NotebookPen, Calendar, Bot, Layers, Play, Upload, Trophy,
  Settings, LogOut, X, TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

const PRIMARY: { href: string; icon: React.ElementType; label: string }[] = [
  { href: "/dashboard",  icon: LayoutDashboard, label: "Home"      },
  { href: "/journal",    icon: BookOpen,        label: "Trades"    },
  // index 2 = FAB placeholder
  { href: "/analytics",  icon: BarChart3,       label: "Analytics" },
  { href: "/ai-coach",   icon: Bot,             label: "AI Coach"  },
];

const MORE: { href: string; icon: React.ElementType; label: string }[] = [
  { href: "/journal/daily", icon: NotebookPen, label: "Daily Journal" },
  { href: "/monthly",       icon: Calendar,    label: "Monthly"       },
  { href: "/playbook",      icon: Layers,      label: "Playbook"      },
  { href: "/replay",        icon: Play,        label: "Replay"        },
  { href: "/import",        icon: Upload,      label: "Import"        },
  { href: "/milestones",    icon: Trophy,      label: "Milestones"    },
  { href: "/settings",      icon: Settings,    label: "Settings"      },
];

interface BottomNavProps {
  onLogTrade: () => void;
}

export function BottomNav({ onLogTrade }: BottomNavProps) {
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = useState(false);

  const isActive = (href: string) =>
    pathname === href || (href !== "/dashboard" && pathname.startsWith(href));

  const moreActive = MORE.some((m) => isActive(m.href));

  return (
    <>
      {/* Bottom bar */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[var(--card)] border-t border-[var(--card-border)]"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex items-end justify-around px-2 pt-1 pb-2">
          {/* Slot 0 + 1 */}
          {PRIMARY.slice(0, 2).map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-0.5 px-3 py-1 min-w-[48px]"
            >
              <Icon
                size={22}
                className={cn(
                  "transition-colors",
                  isActive(href) ? "text-[var(--accent)]" : "text-[var(--muted)]"
                )}
              />
              <span
                className={cn(
                  "text-[10px] font-medium transition-colors",
                  isActive(href) ? "text-[var(--accent)]" : "text-[var(--muted)]"
                )}
              >
                {label}
              </span>
            </Link>
          ))}

          {/* FAB */}
          <button
            onClick={() => { setSheetOpen(false); onLogTrade(); }}
            className="flex flex-col items-center -mt-5 px-2"
          >
            <span className="w-14 h-14 rounded-full bg-[var(--accent)] flex items-center justify-center shadow-lg shadow-[var(--accent)]/30 active:scale-95 transition-transform">
              <Plus size={26} className="text-white" strokeWidth={2.5} />
            </span>
            <span className="text-[10px] font-medium text-[var(--muted)] mt-0.5">Log</span>
          </button>

          {/* Slot 2 + 3 */}
          {PRIMARY.slice(2).map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-0.5 px-3 py-1 min-w-[48px]"
            >
              <Icon
                size={22}
                className={cn(
                  "transition-colors",
                  isActive(href) ? "text-[var(--accent)]" : "text-[var(--muted)]"
                )}
              />
              <span
                className={cn(
                  "text-[10px] font-medium transition-colors",
                  isActive(href) ? "text-[var(--accent)]" : "text-[var(--muted)]"
                )}
              >
                {label}
              </span>
            </Link>
          ))}

          {/* More */}
          <button
            onClick={() => setSheetOpen(true)}
            className="flex flex-col items-center gap-0.5 px-3 py-1 min-w-[48px]"
          >
            <MoreHorizontal
              size={22}
              className={cn(
                "transition-colors",
                moreActive || sheetOpen ? "text-[var(--accent)]" : "text-[var(--muted)]"
              )}
            />
            <span
              className={cn(
                "text-[10px] font-medium transition-colors",
                moreActive || sheetOpen ? "text-[var(--accent)]" : "text-[var(--muted)]"
              )}
            >
              More
            </span>
          </button>
        </div>
      </nav>

      {/* More sheet backdrop */}
      {sheetOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setSheetOpen(false)}
        />
      )}

      {/* More sheet */}
      <div
        className={cn(
          "md:hidden fixed inset-x-0 bottom-0 z-50 bg-[var(--card)] rounded-t-2xl border-t border-[var(--card-border)] transition-transform duration-300 ease-out",
          sheetOpen ? "translate-y-0" : "translate-y-full"
        )}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {/* Sheet handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-[var(--card-border)]" />
        </div>

        {/* Sheet header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--card-border)]">
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-[var(--accent)]" />
            <span className="font-bold text-white text-sm">EdgeLog</span>
          </div>
          <button
            onClick={() => setSheetOpen(false)}
            className="p-1.5 rounded-lg text-[var(--muted)] hover:text-white hover:bg-[var(--card-border)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Sheet nav grid */}
        <div className="grid grid-cols-4 gap-1 p-4">
          {MORE.map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setSheetOpen(false)}
              className={cn(
                "flex flex-col items-center gap-1.5 p-3 rounded-xl transition-colors",
                isActive(href)
                  ? "bg-[var(--accent)] text-white"
                  : "text-[var(--muted)] hover:text-white hover:bg-[var(--card-border)]"
              )}
            >
              <Icon size={20} />
              <span className="text-[10px] font-medium text-center leading-tight">{label}</span>
            </Link>
          ))}
        </div>

        {/* Sign out */}
        <div className="px-4 pb-4">
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[var(--red)] hover:bg-[var(--red-dim)] transition-colors text-sm font-medium"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </div>
    </>
  );
}

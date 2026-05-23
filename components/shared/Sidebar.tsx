"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  BookOpen,
  BarChart3,
  Calendar,
  Layers,
  Play,
  Settings,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Bot,
  NotebookPen,
  Upload,
  Trophy,
  Building2,
} from "lucide-react";

const NAV = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/journal", icon: BookOpen, label: "Trade Log" },
  { href: "/journal/daily", icon: NotebookPen, label: "Daily Journal" },
  { href: "/monthly", icon: Calendar, label: "Monthly" },
  { href: "/analytics", icon: BarChart3, label: "Analytics" },
  { href: "/ai-coach", icon: Bot, label: "AI Coach" },
  { href: "/prop-firm", icon: Building2, label: "Prop Firm" },
  { href: "/playbook", icon: Layers, label: "Playbook" },
  { href: "/replay", icon: Play, label: "Replay" },
  { href: "/import", icon: Upload, label: "Import" },
  { href: "/milestones", icon: Trophy, label: "Milestones" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col h-full bg-[var(--card)] border-r border-[var(--card-border)] transition-all duration-200",
        collapsed ? "w-14" : "w-52"
      )}
    >
      {/* Logo */}
      <div className={cn("flex items-center h-14 px-3 border-b border-[var(--card-border)]", collapsed ? "justify-center" : "justify-between")}>
        {!collapsed && (
          <div className="flex items-center gap-2">
            <TrendingUp size={18} className="text-[var(--accent)]" />
            <span className="font-bold text-white text-sm tracking-wide">EdgeLog</span>
          </div>
        )}
        {collapsed && <TrendingUp size={18} className="text-[var(--accent)]" />}
        <button
          onClick={onToggle}
          className={cn(
            "p-1 rounded text-[var(--muted)] hover:text-white hover:bg-[var(--card-border)] transition-colors",
            collapsed && "hidden"
          )}
        >
          <ChevronLeft size={14} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 space-y-0.5 overflow-y-auto">
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={cn(
                "flex items-center gap-3 mx-2 px-2.5 py-2 rounded-lg text-sm transition-colors",
                active
                  ? "bg-[var(--accent)] text-white"
                  : "text-[var(--muted)] hover:text-white hover:bg-[var(--card-border)]"
              )}
            >
              <Icon size={16} className="shrink-0" />
              {!collapsed && <span>{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Collapse toggle when collapsed */}
      {collapsed && (
        <div className="pb-3 flex justify-center">
          <button
            onClick={onToggle}
            className="p-1.5 rounded text-[var(--muted)] hover:text-white hover:bg-[var(--card-border)] transition-colors"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </aside>
  );
}

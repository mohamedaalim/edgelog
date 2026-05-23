"use client";

import { cn } from "@/lib/utils";

interface Tab {
  id: string;
  label: string;
}

interface Props {
  tabs: Tab[];
  active: string;
  onChange: (id: string) => void;
}

export function Tabs({ tabs, active, onChange }: Props) {
  return (
    <div className="flex border-b border-[var(--card-border)] shrink-0">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
            active === tab.id
              ? "border-[var(--accent)] text-white"
              : "border-transparent text-[var(--muted)] hover:text-white"
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Sidebar } from "@/components/shared/Sidebar";
import { TopBar } from "@/components/shared/TopBar";
import { BottomNav } from "@/components/shared/BottomNav";
import { TradeModal } from "@/components/journal/TradeModal";
import { SessionWidget } from "@/components/shared/SessionWidget";
import { CapacitorInit } from "@/components/shared/CapacitorInit";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [dateRange, setDateRange] = useState("month");
  const [logTradeOpen, setLogTradeOpen] = useState(false);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <div className="w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    router.replace("/login");
    return null;
  }

  return (
    <div className="h-screen flex overflow-hidden bg-[var(--background)]">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          onLogTrade={() => setLogTradeOpen(true)}
        />
        {/* pb-16 on mobile leaves room above the fixed BottomNav */}
        <main className="flex-1 overflow-y-auto p-4 md:p-5 pb-20 md:pb-5">
          {children}
        </main>
      </div>
      <BottomNav onLogTrade={() => setLogTradeOpen(true)} />
      <TradeModal open={logTradeOpen} onClose={() => setLogTradeOpen(false)} trade={null} />
      <SessionWidget />
      <CapacitorInit />
    </div>
  );
}

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export function formatR(value: number): string {
  if (!isFinite(value) || isNaN(value)) return "N/A";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}R`;
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function calcHoldDuration(entry: Date, exit: Date): number {
  return Math.floor((exit.getTime() - entry.getTime()) / 1000);
}

export function calcPnl(
  side: "LONG" | "SHORT",
  quantity: number,
  entryPrice: number,
  exitPrice: number,
  commission = 0
): { grossPnl: number; netPnl: number } {
  const direction = side === "LONG" ? 1 : -1;
  const grossPnl = direction * quantity * (exitPrice - entryPrice);
  return { grossPnl, netPnl: grossPnl - commission };
}

export function calcRRatio(
  side: "LONG" | "SHORT",
  entryPrice: number,
  exitPrice: number,
  stopLoss: number
): number {
  const risk = Math.abs(entryPrice - stopLoss);
  if (risk === 0) return 0;
  const direction = side === "LONG" ? 1 : -1;
  const reward = direction * (exitPrice - entryPrice);
  return reward / risk;
}

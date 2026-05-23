import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, subMonths } from "date-fns";

export function getDateRange(range: string): { from: Date; to: Date } {
  const now = new Date();
  switch (range) {
    case "today":
      return { from: startOfDay(now), to: endOfDay(now) };
    case "week":
      return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) };
    case "month":
      return { from: startOfMonth(now), to: endOfMonth(now) };
    case "quarter":
      return { from: startOfQuarter(now), to: endOfQuarter(now) };
    case "ytd":
      return { from: startOfYear(now), to: endOfYear(now) };
    case "6m":
      return { from: subMonths(now, 6), to: now };
    default:
      return { from: new Date("2000-01-01"), to: now };
  }
}

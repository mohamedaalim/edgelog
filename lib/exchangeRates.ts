// Exchange rates via frankfurter.app — free, no API key, ECB data, 33 currencies.
// Historical endpoint: https://api.frankfurter.app/YYYY-MM-DD?from=GBP&to=USD
// Latest endpoint:     https://api.frankfurter.app/latest?from=GBP&to=USD

// In-process cache keyed by "YYYY-MM-DD:FROM:TO" — survives the life of one server worker.
const cache = new Map<string, number>();

export const SUPPORTED_CURRENCIES = [
  "USD", "EUR", "GBP", "JPY", "CAD", "AUD", "CHF", "NZD",
  "HKD", "SGD", "SEK", "NOK", "DKK", "MXN", "ZAR", "BRL",
  "INR", "CNY", "KRW", "PLN", "CZK", "HUF", "TRY", "ILS",
  "AED", "SAR", "THB", "MYR", "IDR", "PHP",
] as const;

export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number] | string;

// Returns how many units of `to` equal 1 unit of `from`.
// e.g. getRate("GBP", "USD", "2024-01-15") → 1.27
export async function getRate(
  from: CurrencyCode,
  to: CurrencyCode,
  date?: string | Date // defaults to "latest"
): Promise<number> {
  if (from === to) return 1;

  const dateStr = date
    ? typeof date === "string"
      ? date.slice(0, 10)
      : date.toISOString().slice(0, 10)
    : "latest";

  const key = `${dateStr}:${from}:${to}`;
  if (cache.has(key)) return cache.get(key)!;

  const url = `https://api.frankfurter.app/${dateStr}?from=${from}&to=${to}`;

  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      // 5-second timeout so a slow API doesn't hang an import
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      // Weekends / holidays fall back to "latest"
      if (dateStr !== "latest") return getRate(from, to, "latest");
      throw new Error(`Frankfurter API ${res.status}`);
    }

    const json = (await res.json()) as { rates: Record<string, number> };
    const rate = json.rates[to];
    if (!rate) throw new Error(`Rate ${from}→${to} not in response`);

    cache.set(key, rate);
    return rate;
  } catch {
    // If the API is unreachable (offline / server outage) return 1 with a warning.
    // Callers should surface this to the user rather than silently miscalculating.
    console.warn(`[exchangeRates] Could not fetch ${from}→${to} for ${dateStr}, using 1.0`);
    return 1;
  }
}

// Convert an amount from one currency to another on a given date.
export async function convert(
  amount: number,
  from: CurrencyCode,
  to: CurrencyCode,
  date?: string | Date
): Promise<{ converted: number; rate: number }> {
  if (from === to) return { converted: amount, rate: 1 };
  const rate = await getRate(from, to, date);
  return { converted: amount * rate, rate };
}

// Currency metadata for UI display
export const CURRENCY_META: Record<string, { symbol: string; name: string }> = {
  USD: { symbol: "$",  name: "US Dollar" },
  EUR: { symbol: "€",  name: "Euro" },
  GBP: { symbol: "£",  name: "British Pound" },
  JPY: { symbol: "¥",  name: "Japanese Yen" },
  CAD: { symbol: "C$", name: "Canadian Dollar" },
  AUD: { symbol: "A$", name: "Australian Dollar" },
  CHF: { symbol: "₣",  name: "Swiss Franc" },
  NZD: { symbol: "NZ$",name: "New Zealand Dollar" },
  HKD: { symbol: "HK$",name: "Hong Kong Dollar" },
  SGD: { symbol: "S$", name: "Singapore Dollar" },
  SEK: { symbol: "kr", name: "Swedish Krona" },
  NOK: { symbol: "kr", name: "Norwegian Krone" },
  DKK: { symbol: "kr", name: "Danish Krone" },
  MXN: { symbol: "MX$",name: "Mexican Peso" },
  ZAR: { symbol: "R",  name: "South African Rand" },
  BRL: { symbol: "R$", name: "Brazilian Real" },
  INR: { symbol: "₹",  name: "Indian Rupee" },
  CNY: { symbol: "¥",  name: "Chinese Yuan" },
  KRW: { symbol: "₩",  name: "South Korean Won" },
  PLN: { symbol: "zł", name: "Polish Zloty" },
  CZK: { symbol: "Kč", name: "Czech Koruna" },
  HUF: { symbol: "Ft", name: "Hungarian Forint" },
  TRY: { symbol: "₺",  name: "Turkish Lira" },
  ILS: { symbol: "₪",  name: "Israeli Shekel" },
  AED: { symbol: "د.إ",name: "UAE Dirham" },
  SAR: { symbol: "﷼",  name: "Saudi Riyal" },
  THB: { symbol: "฿",  name: "Thai Baht" },
  MYR: { symbol: "RM", name: "Malaysian Ringgit" },
  IDR: { symbol: "Rp", name: "Indonesian Rupiah" },
  PHP: { symbol: "₱",  name: "Philippine Peso" },
};

export function currencySymbol(code: string): string {
  return CURRENCY_META[code]?.symbol ?? code;
}

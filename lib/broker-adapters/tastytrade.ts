import type { BrokerAdapter, BrokerTrade, ConnectionTestResult, FillEvent, StoredConnection } from "./types";
import { fifoMatch } from "./fifo";
import type { AssetClass } from "@prisma/client";

// Tastytrade REST API adapter
// Credentials: apiKey = username, apiSecret = password

const BASE = "https://api.tastytrade.com";

interface TtSession {
  "session-token": string;
  user: { username: string; "external-id": string };
}

interface TtTransaction {
  id: number;
  "account-number": string;
  "transaction-type": string;
  "transaction-sub-type": string;
  "transaction-date": string;
  "settlement-date": string;
  action: string;
  "instrument-type": string;
  symbol: string;
  quantity: string;
  price: string;
  value: string;
  commission: string;
  fees: string;
  description: string;
}

function mapInstrument(instrumentType: string): AssetClass {
  switch (instrumentType) {
    case "Equity":
      return "STOCK";
    case "Equity Option":
      return "OPTION";
    case "Future":
      return "FUTURE";
    case "Future Option":
      return "FUTURE";
    case "Cryptocurrency":
      return "CRYPTO";
    default:
      return "STOCK";
  }
}

function isBuyAction(action: string): boolean {
  const normalized = action.toLowerCase();
  return normalized.includes("buy") || normalized === "receive";
}

export class TastytradeAdapter implements BrokerAdapter {
  private conn: StoredConnection;
  private sessionToken: string | null = null;

  constructor(conn: StoredConnection) {
    this.conn = conn;
    // Use cached token if still valid (Tastytrade sessions last 24h)
    if (conn.accessToken && conn.tokenExpiresAt && new Date(conn.tokenExpiresAt) > new Date()) {
      this.sessionToken = conn.accessToken;
    }
  }

  private async authenticate(): Promise<string> {
    if (this.sessionToken) return this.sessionToken;

    const res = await fetch(`${BASE}/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login: this.conn.apiKey, password: this.conn.apiSecret }),
    });

    if (!res.ok) throw new Error(`Tastytrade auth failed: ${res.status} — check username/password`);

    const body = await res.json();
    const data: TtSession = body.data;
    this.sessionToken = data["session-token"];
    return this.sessionToken;
  }

  private async get<T>(path: string): Promise<T> {
    const token = await this.authenticate();
    const res = await fetch(`${BASE}${path}`, {
      headers: { Authorization: token },
    });
    if (!res.ok) throw new Error(`Tastytrade GET ${path} → ${res.status}: ${await res.text()}`);
    const json = await res.json();
    return json.data;
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      await this.authenticate();
      const accounts = await this.get<{ items: { "account-number": string; nickname?: string }[] }>("/accounts");
      const first = accounts.items[0];
      return {
        ok: true,
        message: `Connected — ${accounts.items.length} account(s) found`,
        accountInfo: first ? { id: first["account-number"], name: first.nickname ?? first["account-number"] } : undefined,
      };
    } catch (e: unknown) {
      return { ok: false, message: (e as Error).message };
    }
  }

  async fetchTrades(since: Date): Promise<BrokerTrade[]> {
    // Discover accounts
    const accounts = await this.get<{ items: { "account-number": string }[] }>("/accounts");
    const accountNumbers = this.conn.accountId
      ? [this.conn.accountId]
      : accounts.items.map((a) => a["account-number"]);

    const allFills: FillEvent[] = [];

    for (const acctNum of accountNumbers) {
      const sinceStr = since.toISOString().split("T")[0];
      const txns = await this.get<{ items: TtTransaction[] }>(
        `/accounts/${acctNum}/transactions?start-date=${sinceStr}&per-page=2000`
      );

      // Keep only actual trade fills (not fees, dividends, etc.)
      const tradeTxns = txns.items.filter(
        (t) =>
          t["transaction-type"] === "Trade" &&
          ["Equity", "Equity Option", "Future", "Future Option", "Cryptocurrency"].includes(
            t["instrument-type"]
          )
      );

      for (const t of tradeTxns) {
        const qty = Math.abs(parseFloat(t.quantity));
        const price = Math.abs(parseFloat(t.price));
        if (qty <= 0 || price <= 0) continue;

        allFills.push({
          id: String(t.id),
          symbol: t.symbol.split(" ")[0], // strip option expiry detail for display
          side: isBuyAction(t.action) ? "BUY" : "SELL",
          qty,
          price,
          time: new Date(t["transaction-date"]),
          commission: Math.abs(parseFloat(t.commission ?? "0")),
          fees: Math.abs(parseFloat(t.fees ?? "0")),
          assetClass: mapInstrument(t["instrument-type"]),
        });
      }
    }

    return fifoMatch(allFills);
  }

  getToken(): string | null { return this.sessionToken; }
}

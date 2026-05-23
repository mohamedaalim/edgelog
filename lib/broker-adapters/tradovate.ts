import type { BrokerAdapter, BrokerTrade, ConnectionTestResult, FillEvent, StoredConnection } from "./types";
import { fifoMatch } from "./fifo";

// Tradovate REST API adapter
// Credentials: apiKey = username, apiSecret = password
// credentials JSON: { cid: string, sec: string }
// environment: "live" | "demo"

const BASE = {
  live: "https://live.tradovateapi.com/v1",
  demo: "https://demo.tradovateapi.com/v1",
} as const;

interface TradovateAuth {
  accessToken: string;
  expirationTime: string;
  userId: number;
  name: string;
  hasLive: boolean;
}

interface TvFill {
  id: number;
  orderId: number;
  contractId: number;
  timestamp: string;
  tradeType: string;
  qty: number;
  price: number;
  active: boolean;
  commission?: number;
}

interface TvOrder {
  id: number;
  accountId: number;
  contractId: number;
  timestamp: string;
  action: string; // "Buy" | "Sell" | "BuyMinus" | "SellPlus" | "SellShort" | "BuyToCover"
  ordStatus: string; // "Filled" | "PendingNew" | "Cancelled" ...
}

interface TvContract {
  id: number;
  name: string;
  fullName?: string;
  contractMaturityId?: number;
  status?: string;
}

function isBuyAction(action: string): boolean {
  return ["Buy", "BuyMinus", "BuyToCover"].includes(action);
}

function detectAssetClass(name: string): "FUTURE" | "STOCK" | "FOREX" | "CRYPTO" {
  // Common futures contract root symbols
  const futureRoots = /^(ES|NQ|RTY|YM|CL|GC|SI|ZB|ZN|ZF|ZT|6E|6J|6B|6C|6A|NG|HO|RB|BTC|ETH|MES|MNQ|M2K|MYM|MCL|MGC)/;
  if (futureRoots.test(name.toUpperCase())) return "FUTURE";
  if (/^[A-Z]{6}$/.test(name)) return "FOREX"; // 6-letter forex pair
  return "STOCK";
}

export class TradovateAdapter implements BrokerAdapter {
  private base: string;
  private conn: StoredConnection;
  private token: string | null = null;

  constructor(conn: StoredConnection) {
    this.conn = conn;
    this.base = BASE[(conn.environment ?? "live") as keyof typeof BASE] ?? BASE.live;
    // Use cached token if not expired
    if (conn.accessToken && conn.tokenExpiresAt && new Date(conn.tokenExpiresAt) > new Date()) {
      this.token = conn.accessToken;
    }
  }

  private async authenticate(): Promise<string> {
    if (this.token) return this.token;

    const creds = this.conn.credentials as { cid?: string; sec?: string } | null;
    const body = {
      name: this.conn.apiKey,
      password: this.conn.apiSecret,
      appId: "EdgeLog",
      appVersion: "1.0.0",
      cid: creds?.cid ? Number(creds.cid) : 1,
      sec: creds?.sec ?? "",
      deviceId: "edgelog-server",
    };

    const res = await fetch(`${this.base}/auth/accesstokenrequest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) throw new Error(`Tradovate auth failed: ${res.status} ${await res.text()}`);

    const data: TradovateAuth = await res.json();
    if (!data.accessToken) throw new Error("Tradovate: no accessToken in response");

    this.token = data.accessToken;
    return this.token;
  }

  private async get<T>(path: string): Promise<T> {
    const token = await this.authenticate();
    const res = await fetch(`${this.base}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Tradovate GET ${path} → ${res.status}: ${await res.text()}`);
    return res.json();
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      await this.authenticate();
      const accounts = await this.get<{ id: number; name: string; balance?: number }[]>("/account/list");
      const first = accounts[0];
      return {
        ok: true,
        message: `Connected — ${accounts.length} account(s) found`,
        accountInfo: first ? { id: String(first.id), name: first.name, balance: first.balance } : undefined,
      };
    } catch (e: unknown) {
      return { ok: false, message: (e as Error).message };
    }
  }

  async fetchTrades(since: Date): Promise<BrokerTrade[]> {
    const token = await this.authenticate();
    if (!token) throw new Error("Authentication required");

    // Fetch fills and orders in parallel
    const [fillsRaw, ordersRaw] = await Promise.all([
      this.get<TvFill[]>("/fill/list"),
      this.get<TvOrder[]>("/order/list"),
    ]);

    // Filter active fills only, and those after `since`
    const fills = fillsRaw.filter(
      (f) => f.active && f.tradeType === "Trade" && new Date(f.timestamp) >= since
    );
    if (fills.length === 0) return [];

    // Build order lookup for action (BUY/SELL) determination
    const orderMap = new Map<number, TvOrder>(ordersRaw.map((o) => [o.id, o]));

    // Fetch all unique contracts referenced by these fills
    const contractIds = [...new Set(fills.map((f) => f.contractId))];
    const contracts = await Promise.all(
      contractIds.map((cid) =>
        this.get<TvContract>(`/contract/item?id=${cid}`).catch(() => null)
      )
    );
    const contractMap = new Map<number, TvContract>(
      contracts.filter(Boolean).map((c) => [c!.id, c!])
    );

    // Build FillEvents
    const fillEvents: FillEvent[] = fills.map((f) => {
      const order = orderMap.get(f.orderId);
      const contract = contractMap.get(f.contractId);
      const symbol = contract?.name ?? `CONTRACT_${f.contractId}`;
      const side: "BUY" | "SELL" = order ? (isBuyAction(order.action) ? "BUY" : "SELL") : "BUY";

      return {
        id: String(f.id),
        symbol: symbol.replace(/\d{2}$/, "").toUpperCase(), // strip expiry suffix (e.g. ESH4 → ES)
        side,
        qty: f.qty,
        price: f.price,
        time: new Date(f.timestamp),
        commission: f.commission ?? 0,
        fees: 0,
        assetClass: detectAssetClass(symbol),
      };
    });

    return fifoMatch(fillEvents);
  }

  // Expose the authenticated token so the sync route can persist it
  getToken(): string | null { return this.token; }
}

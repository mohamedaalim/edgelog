import type { BrokerAdapter, BrokerTrade, ConnectionTestResult, FillEvent, StoredConnection } from "./types";
import { fifoMatch } from "./fifo";
import type { AssetClass } from "@prisma/client";

// IBKR Client Portal Gateway adapter
// Setup: Run the IBKR Client Portal Gateway on your machine or server.
//   1. Download from https://www.interactivebrokers.com/en/trading/ib-api.php
//   2. Start with: java -jar root/dist/ibgroup.web.api.ibcp.jar root/conf.yaml
//   3. Authenticate via browser at https://localhost:5000
//   4. In EdgeLog, set gatewayUrl = "https://localhost:5000" in credentials JSON
//
// Credentials: accountId = your IBKR account ID (e.g. "U1234567")
// credentials JSON: { gatewayUrl: string }

interface IbkrTrade {
  execution_id: string;
  symbol: string;
  supports_tax_opt: string;
  side: string; // "B" (buy) | "S" (sell)
  order_description: string;
  trade_time: string;
  trade_time_r: number;
  size: number;
  price: number;
  submitter: string;
  exchange: string;
  commission: number;
  net_amount: number;
  account: string;
  accountCode: string;
  company_name: string;
  contract_description_1: string;
  open_close: string; // "O" (open) | "C" (close)
  listing_exchange: string;
  country_code: string;
  position: number;
  clearing_id: string;
  clearing_name: string;
  liquidation_trade: number;
  is_event_trading: string;
  asset_class: string; // "STK" | "OPT" | "FUT" | "CASH" | "CRYPTO"
}

function mapAssetClass(ibkrClass: string): AssetClass {
  switch (ibkrClass.toUpperCase()) {
    case "STK": return "STOCK";
    case "OPT": return "OPTION";
    case "FUT": return "FUTURE";
    case "CASH": return "FOREX";
    case "CRYPTO": return "CRYPTO";
    default: return "STOCK";
  }
}

export class IBKRAdapter implements BrokerAdapter {
  private conn: StoredConnection;
  private gatewayUrl: string;

  constructor(conn: StoredConnection) {
    this.conn = conn;
    const creds = conn.credentials as { gatewayUrl?: string } | null;
    this.gatewayUrl = creds?.gatewayUrl ?? "https://localhost:5000";
  }

  private async get<T>(path: string): Promise<T> {
    const res = await fetch(`${this.gatewayUrl}/v1/api${path}`, {
      // Client Portal Gateway uses a self-signed certificate
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) throw new Error(`IBKR Gateway GET ${path} → ${res.status}: ${await res.text()}`);
    return res.json();
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const status = await this.get<{ authenticated: boolean; connected: boolean; competing: boolean }>("/iserver/auth/status");
      if (!status.authenticated) {
        return { ok: false, message: "Not authenticated — please log in via the IBKR Client Portal Gateway browser window" };
      }
      const accounts = await this.get<{ accounts: string[] }>("/iserver/accounts");
      return {
        ok: true,
        message: `Connected — ${accounts.accounts.length} account(s): ${accounts.accounts.join(", ")}`,
        accountInfo: { id: accounts.accounts[0], name: accounts.accounts[0] },
      };
    } catch (e: unknown) {
      return {
        ok: false,
        message: `Gateway unreachable — is the IBKR Client Portal Gateway running at ${this.gatewayUrl}? Error: ${(e as Error).message}`,
      };
    }
  }

  async fetchTrades(since: Date): Promise<BrokerTrade[]> {
    const accountId = this.conn.accountId;
    if (!accountId) throw new Error("IBKR: accountId is required — set it in the broker connection settings");

    const trades = await this.get<IbkrTrade[]>(
      `/iserver/account/${accountId}/trades`
    );

    if (!Array.isArray(trades) || trades.length === 0) return [];

    // Filter to since date
    const filtered = trades.filter((t) => new Date(t.trade_time) >= since);

    const fills: FillEvent[] = filtered.map((t) => ({
      id: t.execution_id,
      symbol: t.symbol,
      side: t.side === "B" ? "BUY" : "SELL",
      qty: Math.abs(t.size),
      price: t.price,
      time: new Date(t.trade_time),
      commission: t.commission ?? 0,
      fees: 0,
      assetClass: mapAssetClass(t.asset_class),
    }));

    return fifoMatch(fills);
  }
}

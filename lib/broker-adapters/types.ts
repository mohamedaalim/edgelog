import type { AssetClass } from "@prisma/client";

export interface BrokerTrade {
  externalId: string;
  symbol: string;
  side: "LONG" | "SHORT";
  assetClass: AssetClass;
  quantity: number;
  entryPrice: number;
  exitPrice: number;
  entryTime: Date;
  exitTime: Date;
  grossPnl: number;
  netPnl: number;
  commission: number;
  fees: number;
  multiplier?: number; // futures contract multiplier
}

export interface FillEvent {
  id: string;
  symbol: string;
  side: "BUY" | "SELL";
  qty: number;
  price: number;
  time: Date;
  commission: number;
  fees: number;
  assetClass: AssetClass;
}

export interface ConnectionTestResult {
  ok: boolean;
  message: string;
  accountInfo?: { id: string; name: string; balance?: number };
}

export interface SyncResult {
  imported: number;
  skipped: number;
  errors: string[];
}

export interface BrokerAdapter {
  testConnection(): Promise<ConnectionTestResult>;
  fetchTrades(since: Date): Promise<BrokerTrade[]>;
}

export interface StoredConnection {
  id: string;
  broker: string;
  apiKey: string | null;
  apiSecret: string | null;
  accountId: string | null;
  environment: string;
  credentials: Record<string, unknown> | null;
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiresAt: Date | null;
}

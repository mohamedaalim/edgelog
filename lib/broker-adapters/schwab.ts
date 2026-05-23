import type { BrokerAdapter, BrokerTrade, ConnectionTestResult, FillEvent, StoredConnection } from "./types";
import { fifoMatch } from "./fifo";
import type { AssetClass } from "@prisma/client";

// Schwab (TD Ameritrade) OAuth2 adapter
// Setup:
//   1. Register at https://developer.schwab.com
//   2. Create an app — note the Client ID and Client Secret
//   3. Set redirect URI to: {APP_URL}/api/brokers/oauth/schwab/callback
//   4. In EdgeLog: apiKey = Client ID, apiSecret = Client Secret
//   5. Click "Connect Schwab" to initiate the OAuth flow
//
// The OAuth flow stores accessToken + refreshToken on the BrokerConnection.
// Tokens expire after 30 minutes; refresh tokens expire after 7 days.

const AUTH_BASE = "https://api.schwabapi.com/v1/oauth";
const API_BASE = "https://api.schwabapi.com/trader/v1";

interface SchwabToken {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

interface SchwabOrder {
  orderId: number;
  status: string;
  enteredTime: string;
  closeTime?: string;
  orderType: string;
  session: string;
  orderLegCollection: {
    orderLegType: string;
    instrument: { symbol: string; assetType: string };
    instruction: string; // "BUY" | "SELL" | "BUY_TO_OPEN" | "SELL_TO_CLOSE" | "BUY_TO_COVER" | "SELL_SHORT"
    quantity: number;
  }[];
  orderActivityCollection?: {
    executionType: string;
    quantity: number;
    orderRemainingQuantity: number;
    executionLegs: {
      legId: number;
      price: number;
      quantity: number;
      mismarkedQuantity: number;
      instrumentId: number;
      time: string;
    }[];
  }[];
  price?: number;
  filledQuantity?: number;
}

function mapSchwabAsset(assetType: string): AssetClass {
  switch (assetType.toUpperCase()) {
    case "EQUITY": return "STOCK";
    case "OPTION": return "OPTION";
    case "FUTURE": return "FUTURE";
    case "FOREX": return "FOREX";
    case "CRYPTO": return "CRYPTO";
    default: return "STOCK";
  }
}

function isBuyInstruction(instruction: string): boolean {
  return ["BUY", "BUY_TO_OPEN", "BUY_TO_COVER", "BUY_TO_CLOSE"].includes(instruction.toUpperCase());
}

// Build the OAuth authorization URL for initiating the Schwab OAuth flow
export function buildSchwabAuthUrl(clientId: string, redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "readonly",
    state,
  });
  return `${AUTH_BASE}/authorize?${params}`;
}

// Exchange authorization code for tokens
export async function exchangeSchwabCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<SchwabToken> {
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch(`${AUTH_BASE}/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });
  if (!res.ok) throw new Error(`Schwab token exchange failed: ${res.status} ${await res.text()}`);
  return res.json();
}

// Refresh an expired access token
export async function refreshSchwabToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<SchwabToken> {
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch(`${AUTH_BASE}/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) throw new Error(`Schwab token refresh failed: ${res.status} — re-connect your Schwab account`);
  return res.json();
}

export class SchwabAdapter implements BrokerAdapter {
  private conn: StoredConnection;
  private token: string | null;

  constructor(conn: StoredConnection) {
    this.conn = conn;
    this.token = conn.accessToken ?? null;
  }

  private async ensureToken(): Promise<string> {
    // If token exists and not expired, use it
    if (this.token && this.conn.tokenExpiresAt && new Date(this.conn.tokenExpiresAt) > new Date(Date.now() + 60_000)) {
      return this.token;
    }
    // Attempt refresh if refresh token exists
    if (this.conn.refreshToken && this.conn.apiKey && this.conn.apiSecret) {
      const tokens = await refreshSchwabToken(this.conn.refreshToken, this.conn.apiKey, this.conn.apiSecret);
      this.token = tokens.access_token;
      return this.token;
    }
    throw new Error("Schwab: not connected — please authorize via Settings → Brokers → Connect Schwab");
  }

  private async get<T>(path: string): Promise<T> {
    const token = await this.ensureToken();
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Schwab GET ${path} → ${res.status}: ${await res.text()}`);
    return res.json();
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      await this.ensureToken();
      const accounts = await this.get<{ securitiesAccount: { accountNumber: string; type: string }; aggregatedBalance?: { currentLiquidationValue: number } }[]>("/accounts?fields=balances");
      const first = accounts[0];
      return {
        ok: true,
        message: `Connected — ${accounts.length} account(s) found`,
        accountInfo: first ? {
          id: first.securitiesAccount.accountNumber,
          name: `${first.securitiesAccount.type} ${first.securitiesAccount.accountNumber}`,
          balance: first.aggregatedBalance?.currentLiquidationValue,
        } : undefined,
      };
    } catch (e: unknown) {
      return { ok: false, message: (e as Error).message };
    }
  }

  async fetchTrades(since: Date): Promise<BrokerTrade[]> {
    const accountNumbers = this.conn.accountId
      ? [this.conn.accountId]
      : await this.get<{ securitiesAccount: { accountNumber: string } }[]>("/accounts").then(
          (accts) => accts.map((a) => a.securitiesAccount.accountNumber)
        );

    const fills: FillEvent[] = [];
    const sinceStr = since.toISOString();

    for (const acct of accountNumbers) {
      const orders = await this.get<SchwabOrder[]>(
        `/accounts/${acct}/orders?fromEnteredTime=${sinceStr}&status=FILLED&maxResults=500`
      );

      for (const order of orders) {
        const leg = order.orderLegCollection?.[0];
        const execs = order.orderActivityCollection ?? [];
        if (!leg || execs.length === 0) continue;

        const symbol = leg.instrument.symbol;
        const assetClass = mapSchwabAsset(leg.instrument.assetType);
        const side: "BUY" | "SELL" = isBuyInstruction(leg.instruction) ? "BUY" : "SELL";

        for (const exec of execs) {
          if (exec.executionType !== "FILL") continue;
          for (const execLeg of exec.executionLegs) {
            fills.push({
              id: `${order.orderId}-${execLeg.legId}-${execLeg.time}`,
              symbol,
              side,
              qty: execLeg.quantity,
              price: execLeg.price,
              time: new Date(execLeg.time),
              commission: 0, // Schwab doesn't return commission at execution leg level
              fees: 0,
              assetClass,
            });
          }
        }
      }
    }

    return fifoMatch(fills);
  }

  getToken(): string | null { return this.token; }
}

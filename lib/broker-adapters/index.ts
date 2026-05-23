import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import type { BrokerAdapter, BrokerTrade, StoredConnection, SyncResult } from "./types";
import { TradovateAdapter } from "./tradovate";
import { TastytradeAdapter } from "./tastytrade";
import { IBKRAdapter } from "./ibkr";
import { SchwabAdapter } from "./schwab";
import { checkMilestones } from "@/lib/milestones";

export function getAdapter(conn: StoredConnection): BrokerAdapter {
  switch (conn.broker) {
    case "tradovate":   return new TradovateAdapter(conn);
    case "tastytrade":  return new TastytradeAdapter(conn);
    case "ibkr":        return new IBKRAdapter(conn);
    case "td_ameritrade":
    case "schwab":      return new SchwabAdapter(conn);
    default:
      throw new Error(`No sync adapter available for broker: ${conn.broker}. Use CSV import instead.`);
  }
}

function makeHash(userId: string, broker: string, externalId: string): string {
  return createHash("sha256").update(`${userId}:${broker}:${externalId}`).digest("hex");
}

// Find the EdgeLog account to attach synced trades to
async function resolveAccountId(userId: string, brokerName: string, brokerAccountId: string | null): Promise<string> {
  // 1. Try to find an account matching the broker name
  if (brokerAccountId) {
    const match = await prisma.account.findFirst({
      where: { userId, isActive: true, accountNumber: brokerAccountId },
      select: { id: true },
    });
    if (match) return match.id;
  }

  // 2. Try matching by broker label
  const brokerMatch = await prisma.account.findFirst({
    where: { userId, isActive: true, broker: { contains: brokerName, mode: "insensitive" } },
    select: { id: true },
  });
  if (brokerMatch) return brokerMatch.id;

  // 3. Fall back to default account
  const defaultAcct = await prisma.account.findFirst({
    where: { userId, isActive: true, isDefault: true },
    select: { id: true },
  });
  if (defaultAcct) return defaultAcct.id;

  // 4. First active account
  const firstAcct = await prisma.account.findFirst({
    where: { userId, isActive: true },
    select: { id: true },
  });
  if (firstAcct) return firstAcct.id;

  throw new Error("No active trading account found — add an account in Settings → Accounts");
}

export async function runSync(
  connectionId: string,
  userId: string
): Promise<SyncResult> {
  const conn = await prisma.brokerConnection.findFirst({
    where: { id: connectionId, userId },
  });
  if (!conn) throw new Error("Broker connection not found");

  const since = conn.lastSyncAt
    ? new Date(conn.lastSyncAt.getTime() - 24 * 60 * 60 * 1000) // 1-day overlap
    : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);          // 90-day first-sync window

  const storedConn: StoredConnection = {
    id: conn.id,
    broker: conn.broker,
    apiKey: conn.apiKey,
    apiSecret: conn.apiSecret,
    accountId: conn.accountId,
    environment: conn.environment,
    credentials: conn.credentials as Record<string, unknown> | null,
    accessToken: conn.accessToken,
    refreshToken: conn.refreshToken,
    tokenExpiresAt: conn.tokenExpiresAt,
  };

  const adapter = getAdapter(storedConn);
  const trades: BrokerTrade[] = await adapter.fetchTrades(since);

  if (trades.length === 0) {
    await prisma.brokerConnection.update({
      where: { id: connectionId },
      data: { lastSyncAt: new Date(), lastSyncStatus: "ok", lastSyncCount: 0 },
    });
    return { imported: 0, skipped: 0, errors: [] };
  }

  // Compute all hashes for this batch
  const hashes = trades.map((t) => makeHash(userId, conn.broker, t.externalId));
  const existingHashes = await prisma.trade.findMany({
    where: { userId, importHash: { in: hashes } },
    select: { importHash: true },
  });
  const existingSet = new Set(existingHashes.map((t) => t.importHash));

  const accountId = await resolveAccountId(userId, conn.broker, conn.accountId);

  let imported = 0;
  const errors: string[] = [];

  for (let i = 0; i < trades.length; i++) {
    const t = trades[i];
    const hash = hashes[i];
    if (existingSet.has(hash)) continue;

    try {
      const holdDuration = Math.floor((t.exitTime.getTime() - t.entryTime.getTime()) / 1000);
      await prisma.trade.create({
        data: {
          userId,
          accountId,
          symbol: t.symbol,
          assetClass: t.assetClass,
          side: t.side,
          status: "CLOSED",
          quantity: t.quantity,
          entryPrice: t.entryPrice,
          exitPrice: t.exitPrice,
          entryTime: t.entryTime,
          exitTime: t.exitTime,
          holdDuration,
          grossPnl: t.grossPnl,
          netPnl: t.netPnl,
          commission: t.commission,
          fees: t.fees,
          isManual: false,
          importSource: conn.broker,
          importHash: hash,
          mistakeTags: [],
          setupTags: [],
          customTags: [],
          rulesBroken: [],
        },
      });
      imported++;
    } catch (e: unknown) {
      errors.push(`${t.symbol}: ${(e as Error).message}`);
    }
  }

  // Cache refreshed token if adapter supports it
  const tokenSource = adapter as { getToken?: () => string | null };
  const freshToken = tokenSource.getToken?.();

  await prisma.brokerConnection.update({
    where: { id: connectionId },
    data: {
      lastSyncAt: new Date(),
      lastSyncStatus: errors.length > 0 ? `ok_with_errors` : "ok",
      lastSyncCount: imported,
      ...(freshToken && freshToken !== conn.accessToken ? {
        accessToken: freshToken,
        tokenExpiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000), // assume 8h
      } : {}),
    },
  });

  if (imported > 0) checkMilestones(userId).catch(() => null);

  return { imported, skipped: trades.length - imported - errors.length, errors };
}

export { type BrokerAdapter, type BrokerTrade, type SyncResult };

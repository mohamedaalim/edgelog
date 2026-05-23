import type { FillEvent, BrokerTrade } from "./types";

interface QueuedFill extends FillEvent {
  remaining: number;
}

// FIFO matching: turns raw fills (buys/sells) into closed round-trip trades.
// Fills must be pre-sorted ascending by time.
export function fifoMatch(fills: FillEvent[]): BrokerTrade[] {
  // Group fills by symbol so we track positions per instrument
  const bySymbol = new Map<string, FillEvent[]>();
  for (const f of fills) {
    const arr = bySymbol.get(f.symbol) ?? [];
    arr.push(f);
    bySymbol.set(f.symbol, arr);
  }

  const trades: BrokerTrade[] = [];

  for (const [symbol, symFills] of bySymbol) {
    const sorted = [...symFills].sort((a, b) => a.time.getTime() - b.time.getTime());
    const longQ: QueuedFill[] = [];  // open long entries waiting to be closed
    const shortQ: QueuedFill[] = []; // open short entries waiting to be closed

    for (const fill of sorted) {
      let remaining = fill.qty;

      if (fill.side === "BUY") {
        // First close any existing SHORT positions (FIFO)
        while (remaining > 0 && shortQ.length > 0) {
          const entry = shortQ[0];
          const matchQty = Math.min(remaining, entry.remaining);
          remaining -= matchQty;
          entry.remaining -= matchQty;

          const multiplier = 1; // adapters should pre-multiply price for futures
          const grossPnl = (entry.price - fill.price) * matchQty * multiplier;
          const entryCommission = entry.commission * (matchQty / entry.qty);
          const exitCommission = fill.commission * (matchQty / fill.qty);
          const totalComm = entryCommission + exitCommission;
          const totalFees = (entry.fees * (matchQty / entry.qty)) + (fill.fees * (matchQty / fill.qty));

          trades.push({
            externalId: `${entry.id}:${fill.id}`,
            symbol,
            side: "SHORT",
            assetClass: fill.assetClass,
            quantity: matchQty,
            entryPrice: entry.price,
            exitPrice: fill.price,
            entryTime: entry.time,
            exitTime: fill.time,
            grossPnl,
            netPnl: grossPnl - totalComm - totalFees,
            commission: totalComm,
            fees: totalFees,
          });

          if (entry.remaining <= 0) shortQ.shift();
        }
        // Remaining qty opens a new LONG position
        if (remaining > 0) {
          longQ.push({ ...fill, remaining, commission: fill.commission * (remaining / fill.qty), fees: fill.fees * (remaining / fill.qty) });
        }
      } else {
        // SELL: first close any existing LONG positions (FIFO)
        while (remaining > 0 && longQ.length > 0) {
          const entry = longQ[0];
          const matchQty = Math.min(remaining, entry.remaining);
          remaining -= matchQty;
          entry.remaining -= matchQty;

          const grossPnl = (fill.price - entry.price) * matchQty;
          const entryCommission = entry.commission * (matchQty / entry.qty);
          const exitCommission = fill.commission * (matchQty / fill.qty);
          const totalComm = entryCommission + exitCommission;
          const totalFees = (entry.fees * (matchQty / entry.qty)) + (fill.fees * (matchQty / fill.qty));

          trades.push({
            externalId: `${entry.id}:${fill.id}`,
            symbol,
            side: "LONG",
            assetClass: fill.assetClass,
            quantity: matchQty,
            entryPrice: entry.price,
            exitPrice: fill.price,
            entryTime: entry.time,
            exitTime: fill.time,
            grossPnl,
            netPnl: grossPnl - totalComm - totalFees,
            commission: totalComm,
            fees: totalFees,
          });

          if (entry.remaining <= 0) longQ.shift();
        }
        // Remaining qty opens a new SHORT position
        if (remaining > 0) {
          shortQ.push({ ...fill, remaining, commission: fill.commission * (remaining / fill.qty), fees: fill.fees * (remaining / fill.qty) });
        }
      }
    }
  }

  return trades;
}

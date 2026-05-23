import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";
import { createHash } from "crypto";
import { detectBrokerFormat, applyBrokerMapping, parseRobinhoodSide, parseIBKRSide } from "@/lib/broker-parsers";
import { convert } from "@/lib/exchangeRates";

// ── CSV parser (no external deps) ────────────────────────────────────────────
function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const nonEmpty = lines.filter((l) => l.trim());
  if (nonEmpty.length < 2) return { headers: [], rows: [] };

  const parseRow = (line: string): string[] => {
    const fields: string[] = [];
    let field = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQuotes && line[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (c === "," && !inQuotes) {
        fields.push(field.trim()); field = "";
      } else {
        field += c;
      }
    }
    fields.push(field.trim());
    return fields;
  };

  const headers = parseRow(nonEmpty[0]).map((h) => h.replace(/^"|"$/g, "").trim());
  const rows = nonEmpty.slice(1).map((line) => {
    const values = parseRow(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = (values[i] ?? "").replace(/^"|"$/g, "").trim(); });
    return row;
  }).filter((r) => Object.values(r).some((v) => v));

  return { headers, rows };
}

// ── Column auto-detection ─────────────────────────────────────────────────────
const FIELD_PATTERNS: Record<string, RegExp[]> = {
  symbol:      [/^(symbol|ticker|stock|instrument|contract|security)$/i],
  side:        [/^(side|direction|type|action|buy.?sell|long.?short)$/i],
  entryPrice:  [/^(entry.?price|open.?price|avg.?buy|buy.?price|open|entry)$/i],
  exitPrice:   [/^(exit.?price|close.?price|avg.?sell|sell.?price|close|exit)$/i],
  entryTime:   [/^(entry.?time|entry.?date|open.?time|open.?date|date.?time|timestamp|date|time|trade.?date|exec.?date)$/i],
  exitTime:    [/^(exit.?time|exit.?date|close.?time|close.?date)$/i],
  quantity:    [/^(qty|quantity|shares|contracts|size|volume|amount|units)$/i],
  commission:  [/^(commission|fee|fees|cost|charges|brokerage)$/i],
  netPnl:      [/^(pnl|net.?pnl|profit|net.?profit|gain.?loss|realized.?pnl|p.?l|p&l|profit.?loss)$/i],
  setupType:   [/^(setup|strategy|setup.?type|strategy.?type|pattern)$/i],
  notes:       [/^(notes?|comments?|remarks?|description|memo)$/i],
  stopLoss:    [/^(stop.?loss|stop|sl)$/i],
};

export function detectColumnMapping(headers: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const header of headers) {
    for (const [field, patterns] of Object.entries(FIELD_PATTERNS)) {
      if (!map[field] && patterns.some((p) => p.test(header))) {
        map[field] = header;
        break;
      }
    }
  }
  return map;
}

// ── Trade builder ─────────────────────────────────────────────────────────────
function parseSide(val: string): "LONG" | "SHORT" | null {
  const v = val.toUpperCase().trim();
  if (["LONG", "BUY", "B", "BOT", "BOUGHT"].includes(v)) return "LONG";
  if (["SHORT", "SELL", "S", "SLD", "SOLD", "SHRT"].includes(v)) return "SHORT";
  return null;
}

function parseDate(val: string): Date | null {
  if (!val) return null;
  // Try common formats
  const cleaned = val.replace(/\//g, "-");
  const d = new Date(cleaned);
  return isNaN(d.getTime()) ? null : d;
}

// ── GET — return headers + mapping preview ────────────────────────────────────
export async function POST(req: NextRequest) {
  const { userId, error } = await requireSession();
  if (error) return error;

  const contentType = req.headers.get("content-type") ?? "";

  // Phase 1: parse & preview (multipart with no mapping yet)
  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const mappingJson = form.get("mapping") as string | null;
    const accountId = form.get("accountId") as string | null;
    const tradeCurrency = (form.get("tradeCurrency") as string | null)?.toUpperCase() || null;
    const preview = form.get("preview") === "true";

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
    if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "File too large (max 5 MB)" }, { status: 400 });

    const text = await file.text();
    const { headers, rows } = parseCSV(text);
    if (!headers.length) return NextResponse.json({ error: "Could not parse CSV — check file format" }, { status: 400 });

    const brokerFormat = detectBrokerFormat(headers);
    const brokerMapping = brokerFormat !== "generic" ? applyBrokerMapping(brokerFormat, headers) : {};
    const autoMapping = detectColumnMapping(headers);
    const mapping = mappingJson
      ? JSON.parse(mappingJson)
      : { ...autoMapping, ...brokerMapping };

    if (preview) {
      return NextResponse.json({
        headers,
        mapping,
        brokerFormat,
        preview: rows.slice(0, 5),
        totalRows: rows.length,
      });
    }

    // Phase 2: actually import
    if (!accountId) return NextResponse.json({ error: "accountId required for import" }, { status: 400 });

    // Verify account belongs to user
    const account = await prisma.account.findFirst({ where: { id: accountId, userId: userId! } });
    if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });

    // Currency: if tradeCurrency differs from account base, we'll convert P&L row-by-row
    const accountCurrency = account.currency ?? "USD";
    const needsConversion = tradeCurrency && tradeCurrency !== accountCurrency;

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // 1-indexed with header

      try {
        const symbol = mapping.symbol ? row[mapping.symbol]?.toUpperCase() : null;
        if (!symbol) { errors.push(`Row ${rowNum}: missing symbol`); skipped++; continue; }

        const rawSide = mapping.side ? row[mapping.side] : "";
        const side = brokerFormat === "robinhood"
          ? parseRobinhoodSide(rawSide)
          : brokerFormat === "ibkr" && !mapping.side
            ? parseIBKRSide(row[mapping.quantity] ?? "")
            : parseSide(rawSide);
        if (!side) { errors.push(`Row ${rowNum}: invalid side "${rawSide}"`); skipped++; continue; }

        const entryTime = mapping.entryTime ? parseDate(row[mapping.entryTime]) : null;
        if (!entryTime) { errors.push(`Row ${rowNum}: invalid entry time "${row[mapping.entryTime]}"`); skipped++; continue; }

        const entryPrice = mapping.entryPrice ? parseFloat(row[mapping.entryPrice]) : NaN;
        if (isNaN(entryPrice) || entryPrice <= 0) { errors.push(`Row ${rowNum}: invalid entry price`); skipped++; continue; }

        const quantity = mapping.quantity ? parseFloat(row[mapping.quantity]) : NaN;
        if (isNaN(quantity) || quantity <= 0) { errors.push(`Row ${rowNum}: invalid quantity`); skipped++; continue; }

        const exitPrice = mapping.exitPrice ? parseFloat(row[mapping.exitPrice]) || null : null;
        const exitTime = mapping.exitTime ? parseDate(row[mapping.exitTime]) : null;
        const commission = mapping.commission ? parseFloat(row[mapping.commission]) || 0 : 0;
        const stopLoss = mapping.stopLoss ? parseFloat(row[mapping.stopLoss]) || null : null;
        const setupType = mapping.setupType ? row[mapping.setupType] || null : null;
        const notes = mapping.notes ? row[mapping.notes] || null : null;

        // Compute derived fields (in the CSV's native currency first)
        const direction = side === "LONG" ? 1 : -1;
        const rawGrossPnl = exitPrice ? direction * quantity * (exitPrice - entryPrice) : 0;
        const rawNetPnl = rawGrossPnl - commission;
        const holdDuration = exitTime ? Math.floor((exitTime.getTime() - entryTime.getTime()) / 1000) : null;
        const rRatio = stopLoss && exitPrice
          ? parseFloat(((direction * (exitPrice - entryPrice)) / Math.abs(entryPrice - stopLoss)).toFixed(2))
          : null;

        // Currency conversion — convert P&L to account base currency using the trade date
        let grossPnl = rawGrossPnl;
        let netPnl = rawNetPnl;
        let exchangeRate: number | null = null;
        let originalCurrency: string | null = null;
        let originalGrossPnl: number | null = null;
        let originalNetPnl: number | null = null;

        if (needsConversion && tradeCurrency) {
          const tradeDate = exitTime ?? entryTime;
          const { converted: cGross, rate } = await convert(rawGrossPnl, tradeCurrency, accountCurrency, tradeDate);
          const { converted: cNet }         = await convert(rawNetPnl,   tradeCurrency, accountCurrency, tradeDate);
          grossPnl         = cGross;
          netPnl           = cNet;
          exchangeRate     = rate;
          originalCurrency = tradeCurrency;
          originalGrossPnl = rawGrossPnl;
          originalNetPnl   = rawNetPnl;
        }

        // Deduplication hash
        const hashInput = `${userId}:${symbol}:${side}:${entryPrice}:${entryTime.toISOString()}:${quantity}`;
        const importHash = createHash("sha256").update(hashInput).digest("hex");

        const exists = await prisma.trade.findFirst({ where: { importHash }, select: { id: true } });
        if (exists) { skipped++; continue; }

        await prisma.trade.create({
          data: {
            userId: userId!, accountId,
            symbol, side, status: exitPrice ? "CLOSED" : "OPEN",
            quantity, entryPrice, exitPrice: exitPrice ?? undefined,
            entryTime, exitTime: exitTime ?? undefined,
            stopLoss: stopLoss ?? undefined,
            commission, grossPnl, netPnl,
            holdDuration: holdDuration ?? undefined,
            rRatio: rRatio ?? undefined,
            setupType: setupType ?? undefined,
            notes: notes ?? undefined,
            currency: accountCurrency,
            originalCurrency: originalCurrency ?? undefined,
            originalGrossPnl: originalGrossPnl ?? undefined,
            originalNetPnl: originalNetPnl ?? undefined,
            exchangeRate: exchangeRate ?? undefined,
            isManual: false, importSource: "csv", importHash,
          },
        });
        imported++;
      } catch (e: unknown) {
        errors.push(`Row ${rowNum}: ${(e as Error).message}`);
        skipped++;
      }
    }

    return NextResponse.json({ imported, skipped, errors: errors.slice(0, 20) });
  }

  return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
}

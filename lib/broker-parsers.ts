export type BrokerFormat = "tos" | "webull" | "robinhood" | "ibkr" | "tradovate" | "generic";

export interface BrokerPreset {
  id: BrokerFormat;
  label: string;
  description: string;
  instructions: string;
  sampleHeaders: string[];
  mapping: Record<string, string>;
}

// Detect broker from CSV headers
export function detectBrokerFormat(headers: string[]): BrokerFormat {
  const h = headers.map((x) => x.toLowerCase().replace(/[^a-z0-9]/g, ""));

  if (h.some((x) => x.includes("transcod") || x.includes("procesdate") || x.includes("settledate"))) return "robinhood";
  if (h.some((x) => x.includes("filledqty") || x.includes("avgprice") || x.includes("tradedate"))) return "webull";
  if (h.some((x) => x.includes("exectime") || x.includes("spread") || x.includes("poseffect"))) return "tos";
  if (h.some((x) => x.includes("datadiscriminator") || x.includes("assetcategory"))) return "ibkr";
  if (h.some((x) => x.includes("accountid") && h.some((y) => y.includes("contractid")))) return "tradovate";
  return "generic";
}

// Apply broker-specific column mapping
export function applyBrokerMapping(format: BrokerFormat, headers: string[]): Record<string, string> {
  const h = headers;
  const find = (...patterns: string[]) =>
    h.find((header) => patterns.some((p) => header.toLowerCase().replace(/[^a-z0-9]/g, "").includes(p))) ?? "";

  switch (format) {
    case "tos":
      return {
        entryTime:  find("exectime", "datetime", "date"),
        symbol:     find("symbol"),
        side:       find("side", "buysell", "action"),
        quantity:   find("qty", "quantity", "contracts"),
        entryPrice: find("price", "tradeprice"),
        commission: find("comm", "commission", "fees"),
        setupType:  find("spread", "description"),
      };

    case "webull":
      return {
        entryTime:  find("tradedate", "date"),
        symbol:     find("symbol", "ticker"),
        side:       find("side", "direction"),
        quantity:   find("filledqty", "qty", "quantity"),
        entryPrice: find("avgprice", "price"),
        commission: find("commission", "fee"),
      };

    case "robinhood":
      return {
        entryTime:  find("activitydate", "processdate", "date"),
        symbol:     find("instrument", "symbol"),
        side:       find("transcode", "description"),
        quantity:   find("quantity", "qty"),
        entryPrice: find("price"),
        commission: "",
      };

    case "ibkr":
      return {
        entryTime:  find("datetime", "date"),
        symbol:     find("symbol"),
        side:       find("quantity", "qty"),    // IBKR uses negative qty for sells
        quantity:   find("quantity", "qty"),
        entryPrice: find("tprice", "tradeprice", "price"),
        commission: find("commfee", "commission"),
        netPnl:     find("realizedpl", "realizedpnl"),
      };

    case "tradovate":
      return {
        entryTime:  find("timestamp", "datetime", "date"),
        symbol:     find("contractid", "symbol"),
        side:       find("action", "side"),
        quantity:   find("qty", "quantity"),
        entryPrice: find("price", "avgprice"),
        commission: find("commission", "fees"),
      };

    default:
      return {};
  }
}

export const BROKER_PRESETS: BrokerPreset[] = [
  {
    id: "tos",
    label: "ThinkorSwim (TOS)",
    description: "TD Ameritrade / Schwab ThinkorSwim",
    instructions: "Go to Monitor → Activity and Positions → Transactions tab → gear icon → Export to File",
    sampleHeaders: ["Exec Time", "Spread", "Side", "Qty", "Pos Effect", "Symbol", "Price", "Comm"],
    mapping: { entryTime: "Exec Time", symbol: "Symbol", side: "Side", quantity: "Qty", entryPrice: "Price", commission: "Comm" },
  },
  {
    id: "webull",
    label: "WeBull",
    description: "WeBull trading history export",
    instructions: "Open WeBull → Orders → History → Filter your date range → Export (top right)",
    sampleHeaders: ["Symbol", "Trade Date", "Side", "Filled Qty", "Avg Price", "Commission", "Amount"],
    mapping: { symbol: "Symbol", entryTime: "Trade Date", side: "Side", quantity: "Filled Qty", entryPrice: "Avg Price", commission: "Commission" },
  },
  {
    id: "robinhood",
    label: "Robinhood",
    description: "Robinhood account history",
    instructions: "Robinhood app → Account → History → scroll down → Export to CSV (takes a moment to email)",
    sampleHeaders: ["Activity Date", "Process Date", "Settle Date", "Instrument", "Description", "Trans Code", "Quantity", "Price", "Amount"],
    mapping: { entryTime: "Activity Date", symbol: "Instrument", side: "Trans Code", quantity: "Quantity", entryPrice: "Price" },
  },
  {
    id: "ibkr",
    label: "Interactive Brokers",
    description: "IBKR Activity Statement",
    instructions: "Account Management → Reports → Flex Queries → Create a Trades query, export as CSV",
    sampleHeaders: ["Trades", "Header", "DataDiscriminator", "Asset Category", "Currency", "Symbol", "Date/Time", "Quantity", "T. Price", "Comm/Fee"],
    mapping: { entryTime: "Date/Time", symbol: "Symbol", quantity: "Quantity", entryPrice: "T. Price", commission: "Comm/Fee", netPnl: "Realized P/L" },
  },
  {
    id: "tradovate",
    label: "Tradovate",
    description: "Tradovate order history",
    instructions: "Tradovate platform → Account → Trade History → Export CSV",
    sampleHeaders: ["accountId", "contractId", "timestamp", "action", "qty", "price", "commission"],
    mapping: { entryTime: "timestamp", symbol: "contractId", side: "action", quantity: "qty", entryPrice: "price", commission: "commission" },
  },
];

// Robinhood Trans Code → side mapping
export function parseRobinhoodSide(transCode: string): "LONG" | "SHORT" | null {
  const code = transCode.toUpperCase().trim();
  if (["BTO", "BTC", "BUY", "BOT"].includes(code)) return "LONG";
  if (["STO", "STC", "SELL", "SLD"].includes(code)) return "SHORT";
  return null;
}

// IBKR: negative quantity = sell (SHORT)
export function parseIBKRSide(quantity: string): "LONG" | "SHORT" | null {
  const qty = parseFloat(quantity);
  if (isNaN(qty)) return null;
  return qty > 0 ? "LONG" : "SHORT";
}

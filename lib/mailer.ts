import nodemailer from "nodemailer";

function getTransport() {
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  return nodemailer.createTransport({
    host,
    port: parseInt(process.env.SMTP_PORT ?? "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
}

export function isMailConfigured() {
  return !!process.env.SMTP_HOST;
}

interface MailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendMail({ to, subject, html }: MailOptions) {
  const transport = getTransport();
  if (!transport) throw new Error("SMTP not configured — add SMTP_HOST to .env");

  await transport.sendMail({
    from: process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "noreply@edgelog.app",
    to,
    subject,
    html,
  });
}

// ── Email templates ───────────────────────────────────────────────────────────
export function buildDailyDigestEmail(data: {
  name: string;
  date: string;
  totalPnl: number;
  trades: number;
  winRate: number;
  bestTrade: number;
  worstTrade: number;
  cumulativePnl: number;
  // enriched fields
  avgR?: number | null;
  commission?: number;
  wtdPnl?: number;
  streak?: { type: "win" | "loss"; count: number } | null;
  topSymbol?: { symbol: string; pnl: number } | null;
  setupBreakdown?: { setup: string; pnl: number; count: number }[];
  grade?: string | null;
  replayUrl?: string;
  appUrl?: string;
}) {
  const pnlColor = data.totalPnl >= 0 ? "#00c878" : "#ff4646";
  const wtdColor = (data.wtdPnl ?? 0) >= 0 ? "#00c878" : "#ff4646";
  const fmt = (n: number) => `${n >= 0 ? "+" : "-"}$${Math.abs(n).toFixed(2)}`;
  const appUrl = data.appUrl ?? "http://localhost:3000";
  const replayUrl = data.replayUrl ?? `${appUrl}/replay`;
  const settingsUrl = `${appUrl}/settings#notifications`;

  const streakBadge = data.streak
    ? `<span style="display:inline-block;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:600;background:${data.streak.type === "win" ? "rgba(0,200,120,0.15)" : "rgba(255,70,70,0.15)"};color:${data.streak.type === "win" ? "#00c878" : "#ff4646"}">${data.streak.count} ${data.streak.type === "win" ? "win" : "loss"} streak</span>`
    : "";

  const gradeBlock = data.grade
    ? `<div style="display:inline-block;padding:4px 14px;background:rgba(108,92,231,0.2);border:1px solid rgba(108,92,231,0.4);border-radius:8px;color:#a78bfa;font-size:15px;font-weight:700;margin-left:8px">Grade: ${data.grade}</div>`
    : "";

  const setupRows = (data.setupBreakdown ?? [])
    .slice(0, 4)
    .map((s) => `<tr>
      <td style="padding:5px 0;color:#94a3b8;font-size:12px;border-bottom:1px solid #1e2333">${s.setup}</td>
      <td style="padding:5px 0;text-align:center;color:#94a3b8;font-size:12px;border-bottom:1px solid #1e2333">${s.count}</td>
      <td style="padding:5px 0;text-align:right;font-size:12px;font-weight:600;color:${s.pnl >= 0 ? "#00c878" : "#ff4646"};border-bottom:1px solid #1e2333">${fmt(s.pnl)}</td>
    </tr>`).join("");

  const setupSection = setupRows ? `
    <div style="margin-top:16px">
      <p style="margin:0 0 8px;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#475569">Setup Breakdown</p>
      <table style="width:100%;border-collapse:collapse">
        <tr>
          <th style="text-align:left;font-size:11px;color:#475569;padding-bottom:4px;border-bottom:1px solid #1e2333;font-weight:500">Setup</th>
          <th style="text-align:center;font-size:11px;color:#475569;padding-bottom:4px;border-bottom:1px solid #1e2333;font-weight:500">Trades</th>
          <th style="text-align:right;font-size:11px;color:#475569;padding-bottom:4px;border-bottom:1px solid #1e2333;font-weight:500">P&amp;L</th>
        </tr>
        ${setupRows}
      </table>
    </div>` : "";

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0d14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0d14;padding:24px 12px">
  <tr><td align="center">
  <table width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%">

    <!-- Header -->
    <tr><td style="background:linear-gradient(135deg,#6c5ce7,#a78bfa);padding:24px 28px;border-radius:12px 12px 0 0">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            <p style="margin:0;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:rgba(255,255,255,0.6)">EdgeLog</p>
            <h1 style="margin:4px 0 0;font-size:20px;color:#fff;font-weight:700">Daily Trading Summary</h1>
            <p style="margin:4px 0 0;color:rgba(255,255,255,0.65);font-size:13px">${data.date}</p>
          </td>
          <td align="right" style="vertical-align:top">
            ${gradeBlock}
          </td>
        </tr>
      </table>
    </td></tr>

    <!-- Body -->
    <tr><td style="background:#111827;border:1px solid #1e2333;border-top:none;border-radius:0 0 12px 12px;padding:24px 28px">

      <!-- P&L hero -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px">
        <tr>
          <td style="background:#0a0d14;border-radius:10px;padding:18px;text-align:center;width:48%">
            <p style="margin:0;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#475569">Today's P&L</p>
            <p style="margin:6px 0 0;font-size:30px;font-weight:800;color:${pnlColor};letter-spacing:-0.03em">${fmt(data.totalPnl)}</p>
            <div style="margin-top:6px">${streakBadge}</div>
          </td>
          <td style="width:4%"></td>
          <td style="background:#0a0d14;border-radius:10px;padding:18px;text-align:center;width:48%">
            <p style="margin:0;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#475569">Week-to-Date</p>
            <p style="margin:6px 0 0;font-size:30px;font-weight:800;color:${wtdColor};letter-spacing:-0.03em">${fmt(data.wtdPnl ?? 0)}</p>
            <p style="margin:4px 0 0;font-size:11px;color:#475569">all-time: ${fmt(data.cumulativePnl)}</p>
          </td>
        </tr>
      </table>

      <!-- Stats table -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:4px">
        <tr>
          <td style="padding:7px 0;color:#64748b;font-size:13px;border-bottom:1px solid #1e2333">Trades taken</td>
          <td style="padding:7px 0;text-align:right;color:#e2e8f0;font-size:13px;font-weight:600;border-bottom:1px solid #1e2333">${data.trades}</td>
        </tr>
        <tr>
          <td style="padding:7px 0;color:#64748b;font-size:13px;border-bottom:1px solid #1e2333">Win rate</td>
          <td style="padding:7px 0;text-align:right;color:#e2e8f0;font-size:13px;font-weight:600;border-bottom:1px solid #1e2333">${data.winRate.toFixed(1)}%</td>
        </tr>
        ${data.avgR != null ? `<tr>
          <td style="padding:7px 0;color:#64748b;font-size:13px;border-bottom:1px solid #1e2333">Avg R</td>
          <td style="padding:7px 0;text-align:right;font-size:13px;font-weight:600;color:${data.avgR >= 0 ? "#00c878" : "#ff4646"};border-bottom:1px solid #1e2333">${data.avgR >= 0 ? "+" : ""}${data.avgR.toFixed(2)}R</td>
        </tr>` : ""}
        <tr>
          <td style="padding:7px 0;color:#64748b;font-size:13px;border-bottom:1px solid #1e2333">Best trade</td>
          <td style="padding:7px 0;text-align:right;color:#00c878;font-size:13px;font-weight:600;border-bottom:1px solid #1e2333">+$${data.bestTrade.toFixed(2)}</td>
        </tr>
        <tr>
          <td style="padding:7px 0;color:#64748b;font-size:13px;border-bottom:1px solid #1e2333">Worst trade</td>
          <td style="padding:7px 0;text-align:right;color:#ff4646;font-size:13px;font-weight:600;border-bottom:1px solid #1e2333">-$${Math.abs(data.worstTrade).toFixed(2)}</td>
        </tr>
        ${data.topSymbol ? `<tr>
          <td style="padding:7px 0;color:#64748b;font-size:13px;border-bottom:1px solid #1e2333">Top symbol</td>
          <td style="padding:7px 0;text-align:right;font-size:13px;border-bottom:1px solid #1e2333"><span style="font-weight:700;color:#e2e8f0">${data.topSymbol.symbol}</span> <span style="color:${data.topSymbol.pnl >= 0 ? "#00c878" : "#ff4646"}">${fmt(data.topSymbol.pnl)}</span></td>
        </tr>` : ""}
        ${data.commission ? `<tr>
          <td style="padding:7px 0;color:#64748b;font-size:13px">Commissions</td>
          <td style="padding:7px 0;text-align:right;color:#64748b;font-size:13px">-$${data.commission.toFixed(2)}</td>
        </tr>` : ""}
      </table>

      ${setupSection}

      <!-- CTA -->
      <div style="margin-top:24px;text-align:center">
        <a href="${replayUrl}" style="display:inline-block;background:#6c5ce7;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600">View Session Replay →</a>
      </div>

      <!-- Footer -->
      <p style="margin:20px 0 0;font-size:11px;color:#334155;text-align:center">
        EdgeLog Trading Journal &nbsp;·&nbsp;
        <a href="${settingsUrl}" style="color:#475569;text-decoration:none">Manage alerts</a>
      </p>

    </td></tr>
  </table>
  </td></tr>
</table>
</body>
</html>`;
}

export function buildPasswordResetEmail(data: { name: string; resetUrl: string; expiresIn: string }) {
  return `
<!DOCTYPE html>
<html>
<body style="font-family:system-ui,sans-serif;background:#0f1117;color:#e2e8f0;padding:24px;max-width:480px;margin:0 auto">
  <div style="background:#1a1f2e;border:1px solid #2a2f3e;border-radius:12px;overflow:hidden">
    <div style="background:#6c5ce7;padding:20px 24px">
      <h1 style="margin:0;color:#fff;font-size:18px">🔐 Reset Your Password</h1>
    </div>
    <div style="padding:24px">
      <p style="color:#94a3b8;font-size:14px;margin:0 0 20px">Hi ${data.name}, someone requested a password reset for your EdgeLog account.</p>
      <a href="${data.resetUrl}" style="display:block;text-align:center;background:#6c5ce7;color:#fff;text-decoration:none;padding:14px 24px;border-radius:8px;font-size:15px;font-weight:600">Reset Password</a>
      <p style="margin:16px 0 0;font-size:12px;color:#475569;text-align:center">This link expires in ${data.expiresIn}. If you didn't request this, you can safely ignore this email.</p>
      <p style="margin:12px 0 0;font-size:11px;color:#334155;text-align:center;word-break:break-all">${data.resetUrl}</p>
    </div>
  </div>
</body>
</html>`;
}

export function buildDrawdownAlertEmail(data: {
  name: string;
  drawdownPct: number;
  drawdownAmt: number;
  threshold: number;
}) {
  return `
<!DOCTYPE html>
<html>
<body style="font-family:system-ui,sans-serif;background:#0f1117;color:#e2e8f0;padding:24px;max-width:480px;margin:0 auto">
  <div style="background:#1a1f2e;border:1px solid #2a2f3e;border-radius:12px;overflow:hidden">
    <div style="background:#ff4646;padding:20px 24px">
      <h1 style="margin:0;color:#fff;font-size:18px">⚠️ Drawdown Alert</h1>
    </div>
    <div style="padding:24px">
      <p style="color:#94a3b8;font-size:14px;margin:0 0 16px">Hi ${data.name}, your drawdown has exceeded your alert threshold.</p>
      <div style="background:#0f1117;border-radius:8px;padding:16px;margin-bottom:16px;text-align:center">
        <p style="margin:0;color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:0.05em">Current Drawdown</p>
        <p style="margin:4px 0 0;font-size:28px;font-weight:700;color:#ff4646">-${data.drawdownPct.toFixed(1)}%</p>
        <p style="margin:4px 0 0;color:#94a3b8;font-size:13px">-$${Math.abs(data.drawdownAmt).toFixed(2)}</p>
      </div>
      <p style="font-size:13px;color:#94a3b8">Your alert was set at <strong style="color:#e2e8f0">${data.threshold}%</strong>. Consider reviewing your risk management.</p>
      <p style="margin:20px 0 0;font-size:12px;color:#475569;text-align:center">EdgeLog · <a href="#" style="color:#6c5ce7">Manage alerts</a></p>
    </div>
  </div>
</body>
</html>`;
}

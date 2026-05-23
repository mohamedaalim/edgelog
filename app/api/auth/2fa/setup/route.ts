import { NextResponse } from "next/server";
import { requireSession } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";
import { generateSecret, generateURI } from "otplib";
import QRCode from "qrcode";

export async function POST() {
  const { userId, error } = await requireSession();
  if (error) return error;

  const user = await prisma.user.findUnique({ where: { id: userId! }, select: { email: true, twoFactorEnabled: true } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (user.twoFactorEnabled) return NextResponse.json({ error: "2FA is already enabled" }, { status: 400 });

  const secret = generateSecret();
  const otpauthUrl = generateURI({ label: user.email, issuer: "EdgeLog", secret, strategy: "totp" });
  const qrDataUrl = await QRCode.toDataURL(otpauthUrl);

  // Save secret (not yet enabled — user must verify first)
  await prisma.user.update({ where: { id: userId! }, data: { twoFactorSecret: secret } });

  return NextResponse.json({ secret, qrDataUrl });
}

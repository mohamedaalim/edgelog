import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";

// POST — toggle public sharing on/off
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId, error } = await requireSession();
  if (error) return error;
  const { id } = await params;

  const trade = await prisma.trade.findFirst({ where: { id, userId: userId! } });
  if (!trade) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (trade.isPublic) {
    // Turn off sharing — revoke the token
    const updated = await prisma.trade.update({
      where: { id },
      data: { isPublic: false, shareToken: null },
      select: { id: true, isPublic: true, shareToken: true },
    });
    return NextResponse.json(updated);
  } else {
    // Generate fresh share token
    const shareToken = randomBytes(16).toString("hex");
    const updated = await prisma.trade.update({
      where: { id },
      data: { isPublic: true, shareToken },
      select: { id: true, isPublic: true, shareToken: true },
    });
    return NextResponse.json(updated);
  }
}

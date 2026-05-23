import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";
import { unlink } from "fs/promises";
import { join } from "path";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; sid: string }> }
) {
  const { userId, error } = await requireSession();
  if (error) return error;
  const { id: tradeId, sid } = await params;

  const screenshot = await prisma.tradeScreenshot.findFirst({
    where: { id: sid, tradeId },
    include: { trade: { select: { userId: true } } },
  });
  if (!screenshot || screenshot.trade.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Delete file from disk (best effort — don't fail if file missing)
  if (screenshot.url.startsWith("/uploads/")) {
    const filePath = join(process.cwd(), "public", screenshot.url);
    await unlink(filePath).catch(() => null);
  }

  await prisma.tradeScreenshot.delete({ where: { id: sid } });
  return NextResponse.json({ ok: true });
}

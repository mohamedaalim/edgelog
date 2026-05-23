import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId, error } = await requireSession();
  if (error) return error;
  const { id } = await params;

  const existing = await prisma.rule.findUnique({ where: { id }, select: { userId: true } });
  if (!existing || existing.userId !== userId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { text, category, isActive, order } = await req.json();

  const rule = await prisma.rule.update({
    where: { id },
    data: {
      text: text?.trim() ?? undefined,
      category: category ?? undefined,
      isActive: isActive ?? undefined,
      order: order ?? undefined,
    },
  });

  return NextResponse.json(rule);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId, error } = await requireSession();
  if (error) return error;
  const { id } = await params;

  const existing = await prisma.rule.findUnique({ where: { id }, select: { userId: true } });
  if (!existing || existing.userId !== userId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.rule.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

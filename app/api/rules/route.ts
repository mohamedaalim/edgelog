import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";

export async function GET(_req: NextRequest) {
  const { userId, error } = await requireSession();
  if (error) return error;

  const rules = await prisma.rule.findMany({
    where: { userId: userId! },
    orderBy: [{ category: "asc" }, { order: "asc" }, { createdAt: "asc" }],
    take: 500,
  });

  return NextResponse.json(rules);
}

export async function POST(req: NextRequest) {
  const { userId, error } = await requireSession();
  if (error) return error;

  const { text, category } = await req.json();
  if (!text?.trim()) return NextResponse.json({ error: "text is required" }, { status: 400 });

  // Find current max order for this category
  const maxOrder = await prisma.rule.aggregate({
    where: { userId: userId!, category: category ?? "MISC" },
    _max: { order: true },
  });

  const rule = await prisma.rule.create({
    data: {
      userId: userId!, text: text.trim(),
      category: category ?? "MISC",
      order: (maxOrder._max.order ?? 0) + 1,
    },
  });

  return NextResponse.json(rule, { status: 201 });
}

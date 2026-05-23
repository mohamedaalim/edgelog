import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";
import { z } from "zod";

const schema = z.object({
  ids: z.array(z.string()),
  action: z.enum(["delete", "addTags"]),
  tags: z.array(z.string()).optional(),
});

export async function POST(req: NextRequest) {
  const { userId, error } = await requireSession();
  if (error) return error;

  const body = schema.parse(await req.json());
  const { ids, action, tags } = body;

  // Verify all trades belong to user
  const count = await prisma.trade.count({ where: { id: { in: ids }, userId: userId! } });
  if (count !== ids.length) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  if (action === "delete") {
    await prisma.trade.deleteMany({ where: { id: { in: ids } } });
    return NextResponse.json({ success: true, deleted: ids.length });
  }

  if (action === "addTags" && tags?.length) {
    await prisma.$transaction(async (tx) => {
      const trades = await tx.trade.findMany({ where: { id: { in: ids } }, select: { id: true, customTags: true } });
      await Promise.all(
        trades.map((t) =>
          tx.trade.update({
            where: { id: t.id },
            data: { customTags: Array.from(new Set([...t.customTags, ...tags])) },
          })
        )
      );
    });
    return NextResponse.json({ success: true, updated: ids.length });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

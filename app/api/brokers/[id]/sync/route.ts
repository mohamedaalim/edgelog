import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/apiAuth";
import { runSync } from "@/lib/broker-adapters/index";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, error } = await requireSession();
  if (error) return error;
  const { id } = await params;

  try {
    const result = await runSync(id, userId!);
    return NextResponse.json(result);
  } catch (e: unknown) {
    const message = (e as Error).message;
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

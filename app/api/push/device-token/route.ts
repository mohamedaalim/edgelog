import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";

// GET — count registered device tokens for the current user
export async function GET() {
  const { userId, error } = await requireSession();
  if (error) return error;
  const count = await prisma.deviceToken.count({ where: { userId: userId! } });
  return NextResponse.json({ count });
}

// POST — register a native FCM/APNs device token
export async function POST(req: NextRequest) {
  const { userId, error } = await requireSession();
  if (error) return error;

  const { token, platform } = await req.json();
  if (!token || !["ios", "android"].includes(platform)) {
    return NextResponse.json({ error: "token and platform (ios|android) required" }, { status: 400 });
  }

  await prisma.deviceToken.upsert({
    where: { token },
    create: { userId: userId!, token, platform },
    update: { userId: userId! },
  });

  return NextResponse.json({ ok: true });
}

// DELETE — unregister a device token
export async function DELETE(req: NextRequest) {
  const { userId, error } = await requireSession();
  if (error) return error;

  const { token } = await req.json();
  if (!token) return NextResponse.json({ error: "token required" }, { status: 400 });

  await prisma.deviceToken.deleteMany({ where: { token, userId: userId! } });
  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";
import { compare, hash } from "bcryptjs";

export async function PUT(req: NextRequest) {
  const { userId, error } = await requireSession();
  if (error) return error;

  const { currentPassword, newPassword } = await req.json();
  if (!currentPassword || !newPassword) return NextResponse.json({ error: "Both passwords required" }, { status: 400 });
  if (newPassword.length < 8) return NextResponse.json({ error: "New password must be at least 8 characters" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: userId! }, select: { password: true } });
  if (!user?.password) return NextResponse.json({ error: "No password set on this account" }, { status: 400 });

  const valid = await compare(currentPassword, user.password);
  if (!valid) return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });

  const hashed = await hash(newPassword, 12);
  await prisma.user.update({ where: { id: userId! }, data: { password: hashed } });

  return NextResponse.json({ ok: true });
}

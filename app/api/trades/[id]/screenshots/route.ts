import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, error } = await requireSession();
  if (error) return error;
  const { id: tradeId } = await params;

  const trade = await prisma.trade.findFirst({ where: { id: tradeId, userId: userId! }, select: { id: true } });
  if (!trade) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const screenshots = await prisma.tradeScreenshot.findMany({
    where: { tradeId },
    orderBy: { order: "asc" },
  });
  return NextResponse.json(screenshots);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, error } = await requireSession();
  if (error) return error;
  const { id: tradeId } = await params;

  const trade = await prisma.trade.findFirst({ where: { id: tradeId, userId: userId! }, select: { id: true } });
  if (!trade) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const form = await req.formData();
  const file = form.get("file") as File | null;
  const label = (form.get("label") as string | null) ?? null;

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (file.size > MAX_SIZE) return NextResponse.json({ error: "File too large (max 5 MB)" }, { status: 400 });
  if (!ALLOWED.has(file.type)) return NextResponse.json({ error: "Only JPEG, PNG, GIF, WEBP allowed" }, { status: 400 });

  const ext = file.type.split("/")[1].replace("jpeg", "jpg");
  const filename = `${tradeId}-${randomUUID()}.${ext}`;
  const dir = join(process.cwd(), "public", "uploads", userId!);
  await mkdir(dir, { recursive: true });
  const path = join(dir, filename);
  await writeFile(path, Buffer.from(await file.arrayBuffer()));

  const url = `/uploads/${userId}/${filename}`;

  const count = await prisma.tradeScreenshot.count({ where: { tradeId } });
  const screenshot = await prisma.tradeScreenshot.create({
    data: { tradeId, url, label, order: count },
  });

  return NextResponse.json(screenshot, { status: 201 });
}

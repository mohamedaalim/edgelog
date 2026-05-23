import { NextResponse } from "next/server";
import { requireSession } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

export async function POST() {
  const { userId, error } = await requireSession();
  if (error) return error;

  const sub = await prisma.subscription.findUnique({ where: { userId: userId! }, select: { stripeCustomerId: true } });
  if (!sub?.stripeCustomerId) return NextResponse.json({ error: "No billing account found" }, { status: 404 });

  const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: `${appUrl}/settings?tab=Billing`,
  });

  return NextResponse.json({ url: session.url });
}

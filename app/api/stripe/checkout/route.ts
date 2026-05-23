import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";
import { stripe, PLANS, getOrCreateStripeCustomer, type PlanKey } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const { userId, error } = await requireSession();
  if (error) return error;

  const { plan } = await req.json() as { plan: PlanKey };
  if (!PLANS[plan]) return NextResponse.json({ error: "Invalid plan" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: userId! }, select: { email: true, name: true } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const customerId = await getOrCreateStripeCustomer(userId!, user.email, user.name);
  const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ["card"],
    line_items: [{ price: PLANS[plan].priceId, quantity: 1 }],
    mode: "subscription",
    success_url: `${appUrl}/settings?tab=Billing&success=1`,
    cancel_url: `${appUrl}/pricing`,
    metadata: { userId: userId!, plan },
    subscription_data: { metadata: { userId: userId!, plan } },
  });

  return NextResponse.json({ url: session.url });
}

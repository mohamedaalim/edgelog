import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import Stripe from "stripe";

function planFromPriceId(priceId: string): "PRO" | "ELITE" | "FREE" {
  if (priceId === process.env.STRIPE_PRO_PRICE_ID) return "PRO";
  if (priceId === process.env.STRIPE_ELITE_PRICE_ID) return "ELITE";
  return "FREE";
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature") ?? "";

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET ?? "");
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const sub = event.data.object as Stripe.Subscription & { current_period_end?: number };

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const userId = sub.metadata.userId;
      if (!userId) break;
      const priceId = (sub.items.data[0]?.price?.id) ?? "";
      const plan = planFromPriceId(priceId);
      await prisma.subscription.upsert({
        where: { userId },
        create: {
          userId,
          stripeCustomerId: sub.customer as string,
          stripeSubscriptionId: sub.id,
          stripePriceId: priceId,
          plan,
          status: sub.status,
          currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000) : null,
          cancelAtPeriodEnd: sub.cancel_at_period_end,
        },
        update: {
          stripeSubscriptionId: sub.id,
          stripePriceId: priceId,
          plan,
          status: sub.status,
          currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000) : null,
          cancelAtPeriodEnd: sub.cancel_at_period_end,
        },
      });
      break;
    }
    case "customer.subscription.deleted": {
      const userId = sub.metadata.userId;
      if (!userId) break;
      await prisma.subscription.update({
        where: { userId },
        data: { plan: "FREE", status: "canceled", stripeSubscriptionId: null },
      });
      break;
    }
  }

  return NextResponse.json({ received: true });
}

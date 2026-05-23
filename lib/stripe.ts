import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
export { PLANS } from "@/lib/plans";
export type { PlanKey } from "@/lib/plans";

let _stripe: Stripe | null = null;
export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-04-22.dahlia" });
  }
  return _stripe;
}
export const stripe = new Proxy({} as Stripe, {
  get: (_, prop) => getStripe()[prop as keyof Stripe],
});

export async function getOrCreateStripeCustomer(userId: string, email: string, name?: string | null) {
  const sub = await prisma.subscription.findUnique({ where: { userId } });
  if (sub?.stripeCustomerId) return sub.stripeCustomerId;

  const customer = await stripe.customers.create({ email, name: name ?? undefined, metadata: { userId } });

  await prisma.subscription.upsert({
    where: { userId },
    create: { userId, stripeCustomerId: customer.id },
    update: { stripeCustomerId: customer.id },
  });

  return customer.id;
}

export async function getUserPlan(userId: string): Promise<"FREE" | "PRO" | "ELITE"> {
  const sub = await prisma.subscription.findUnique({ where: { userId }, select: { plan: true, status: true } });
  if (!sub || (sub.status !== "active" && sub.status !== "trialing")) return "FREE";
  return sub.plan as "FREE" | "PRO" | "ELITE";
}

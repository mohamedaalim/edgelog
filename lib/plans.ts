export const PLANS = {
  PRO: {
    name: "Pro",
    priceId: process.env.STRIPE_PRO_PRICE_ID ?? "",
    price: 19,
    features: [
      "Unlimited trades",
      "All analytics modules",
      "AI Coach (Claude Sonnet)",
      "Broker API sync — 4 brokers",
      "Options analytics",
      "Milestone system",
      "CSV & PDF export",
      "Priority support",
    ],
  },
  ELITE: {
    name: "Elite",
    priceId: process.env.STRIPE_ELITE_PRICE_ID ?? "",
    price: 39,
    features: [
      "Everything in Pro",
      "AI Coach — Claude Opus (most powerful)",
      "Prop firm challenge tracker",
      "Multi-leg options",
      "Public trade sharing",
      "Monte Carlo simulation",
      "Unlimited broker connections",
      "Dedicated onboarding call",
    ],
  },
} as const;

export type PlanKey = keyof typeof PLANS;

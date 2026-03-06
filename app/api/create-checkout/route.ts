import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

// Set these in .env.local + Vercel after creating products in Stripe Dashboard
const PRICE_IDS: Record<string, string> = {
  starter:    process.env.STRIPE_PRICE_STARTER    ?? "",
  growth:     process.env.STRIPE_PRICE_GROWTH     ?? "",
  enterprise: process.env.STRIPE_PRICE_ENTERPRISE ?? "",
};

export async function POST(req: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Payments not configured" }, { status: 503 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const { plan = "growth", userId, email } = await req.json();

  const priceId = PRICE_IDS[plan];
  if (!priceId) {
    return NextResponse.json({ error: `Stripe price ID not configured for plan: ${plan}` }, { status: 500 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_URL || "http://localhost:3000";

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      currency: "aud",
      ...(email ? { customer_email: email } : {}),
      allow_promotion_codes: true,
      subscription_data: {
        metadata: { userId: userId ?? "", plan },
      },
      metadata: { userId: userId ?? "", plan },
      success_url: `${baseUrl}/dashboard?subscribed=true&plan=${plan}`,
      cancel_url: `${baseUrl}/signup?plan=${plan}`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Stripe error:", err);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}

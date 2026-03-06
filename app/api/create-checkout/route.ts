import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const PRICES = {
  apply: 19900,      // $199 AUD in cents
  apply_pro: 49900,  // $499 AUD in cents
};

export async function POST(req: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Payments not configured" }, { status: 503 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const { grantId, userId, tier = "apply", grantTitle } = await req.json();

  if (!grantId) {
    return NextResponse.json({ error: "Missing grantId" }, { status: 400 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_URL || "http://localhost:3000";

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      currency: "aud",
      line_items: [
        {
          price_data: {
            currency: "aud",
            unit_amount: PRICES[tier as keyof typeof PRICES] ?? PRICES.apply,
            product_data: {
              name: tier === "apply_pro"
                ? "GrantMate Apply Pro — Expert Review + AI Draft"
                : "GrantMate Application Draft",
              description: grantTitle
                ? `AI-generated grant application for: ${grantTitle}`
                : "Complete AI-generated grant application draft",
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/dashboard/apply/${grantId}?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/dashboard/apply/${grantId}`,
      metadata: {
        grantId,
        userId: userId || "",
        tier,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Stripe error:", err);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}

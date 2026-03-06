import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const PRICE_IDS: Record<string, string> = {
  starter:    process.env.STRIPE_PRICE_STARTER    ?? "",
  growth:     process.env.STRIPE_PRICE_GROWTH     ?? "",
  enterprise: process.env.STRIPE_PRICE_ENTERPRISE ?? "",
};

export async function POST(req: NextRequest) {
  const { email, password, plan = "growth" } = await req.json();

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Payments not configured" }, { status: 503 });
  }

  const priceId = PRICE_IDS[plan];
  if (!priceId) {
    return NextResponse.json({ error: `Plan not configured: ${plan}` }, { status: 500 });
  }

  // Create Supabase user server-side using service role
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data, error: signUpError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // skip email confirmation so they can log in immediately
  });

  if (signUpError) {
    return NextResponse.json({ error: signUpError.message }, { status: 400 });
  }

  const userId = data.user?.id ?? "";

  // Create Stripe checkout session
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const baseUrl = process.env.NEXT_PUBLIC_URL || "https://fundii.vercel.app";

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      currency: "aud",
      customer_email: email,
      allow_promotion_codes: true,
      subscription_data: {
        metadata: { userId, plan },
      },
      metadata: { userId, plan },
      success_url: `${baseUrl}/dashboard?subscribed=true&plan=${plan}`,
      cancel_url: `${baseUrl}/signup?plan=${plan}`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Stripe error:", msg);
    // Roll back: delete the user we just created
    await supabase.auth.admin.deleteUser(userId);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

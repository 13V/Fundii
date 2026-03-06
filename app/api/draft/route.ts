import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(req: NextRequest) {
  // Check auth + plan gating
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (token) {
    const authClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    const { data: { user } } = await authClient.auth.getUser(token);
    if (user) {
      const { data: profileRow } = await authClient
        .from("profiles").select("plan").eq("id", user.id).single();
      const plan = profileRow?.plan;
      if (!plan || (plan !== "growth" && plan !== "enterprise")) {
        return NextResponse.json(
          { error: "AI drafting requires a Growth or Enterprise plan. Upgrade to continue." },
          { status: 403 },
        );
      }
    }
  }

  const { grantId, profile } = await req.json();

  if (!grantId) {
    return NextResponse.json({ error: "Missing grantId" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  const { data: grant, error } = await supabase
    .from("grants")
    .select("id, title, description, amount_text, eligibility, source")
    .eq("id", grantId)
    .single();

  if (error || !grant) {
    return NextResponse.json({ error: "Grant not found" }, { status: 404 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI service not configured" }, { status: 503 });
  }

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1200,
      messages: [
        {
          role: "user",
          content: `You are a professional Australian grant application writer. Write a compelling first draft of a grant application for the following grant. Keep it professional, specific, and aligned with Australian government grant assessment criteria.

GRANT: ${grant.title}
DESCRIPTION: ${grant.description}
AMOUNT: ${grant.amount_text}
ELIGIBILITY: ${grant.eligibility}
SOURCE: ${grant.source}

APPLICANT PROFILE:
- State: ${profile?.state ?? "Not specified"}
- Industry: ${(profile?.industries ?? []).join(", ") || "General"}
- Business size: ${(profile?.sizes ?? []).join(", ") || "Small business"}
- Annual revenue: ${profile?.revenue ?? "Not specified"}
- Funding purposes: ${(profile?.purposes ?? []).join(", ") || "Business growth"}

Write a draft that includes:
1. Project Overview (2-3 paragraphs explaining the business and project)
2. Alignment with Grant Objectives (how the project meets the grant criteria)
3. Expected Outcomes & Benefits (specific, measurable outcomes)
4. Budget Summary Outline (high-level breakdown of how funds will be used)

Keep it under 600 words. Use a professional but approachable tone. Include [PLACEHOLDER] brackets where the applicant needs to fill in specific details like business name, ABN, specific dollar amounts, or project timelines. Do not include the section headers as a numbered list — write them as subheadings.`,
        },
      ],
    });

    const text = message.content
      .filter((c) => c.type === "text")
      .map((c) => (c as { type: "text"; text: string }).text)
      .join("\n");

    return NextResponse.json({ draft: text, grant });
  } catch (err) {
    console.error("Claude API error:", err);
    return NextResponse.json(
      { error: "Failed to generate draft. Please try again." },
      { status: 500 }
    );
  }
}

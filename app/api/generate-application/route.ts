import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function buildPrompt(grant: Record<string, unknown>, intake: Record<string, string>) {
  const criteria = (grant.assessment_criteria as string[] | undefined)?.map((c, i) => `${i+1}. ${c}`).join("\n") || "Not specified";
  return `You are an expert Australian grant writer with 15 years of experience. Write a complete, professional grant application for the following program.

GRANT PROGRAM:
- Name: ${grant.title || grant.name}
- Funding: Up to ${grant.amount_text || grant.amount}
- Co-contribution: ${grant.co_contribution || "Not specified"}
- Source: ${grant.source || "Australian Government"}
- Assessment criteria:
${criteria}

APPLICANT DETAILS:
- Business name: ${intake.businessName}
- Business description: ${intake.businessDesc}
- Project description: ${intake.project}
- Spending breakdown: ${intake.spending}
- Total project cost: ${intake.budget}
- Grant amount requested: ${intake.grantAmount}
- Expected outcomes: ${intake.outcomes}
- Employees: ${intake.employees}
- Timeline: ${intake.timeline}
- Prior funding: ${intake.priorFunding}

Write the complete application with these sections. Use clear, professional Australian English. Be specific and quantitative wherever possible. Do NOT use markdown formatting — use plain text with section headers in CAPS.

Sections:
1. EXECUTIVE SUMMARY (3-4 sentences)
2. BUSINESS OVERVIEW (who they are, capacity to deliver)
3. PROJECT DESCRIPTION (detailed description)
4. ALIGNMENT WITH GRANT OBJECTIVES (directly address EACH assessment criterion with a dedicated paragraph)
5. BUDGET BREAKDOWN (itemised costs, co-contribution column)
6. EXPECTED OUTCOMES AND BENEFITS (quantified where possible)
7. IMPLEMENTATION TIMELINE (month-by-month)
8. RISK MANAGEMENT (3 key risks with mitigation)
9. DECLARATION (standard closing statement)

Write 1200-1500 words. Sound professional but not bureaucratic. Address every assessment criterion explicitly.`;
}

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI service not configured" }, { status: 503 });
  }

  const { grantId, intake, purchaseId } = await req.json();

  if (!grantId || !intake) {
    return NextResponse.json({ error: "Missing grantId or intake data" }, { status: 400 });
  }

  // Fetch grant from Supabase
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: grant } = await supabase
    .from("grants")
    .select("*")
    .eq("id", grantId)
    .single();

  if (!grant) {
    return NextResponse.json({ error: "Grant not found" }, { status: 404 });
  }

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      messages: [{ role: "user", content: buildPrompt(grant, intake) }],
    });

    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map(b => b.text)
      .join("\n");

    // Save to applications table if we have a purchaseId
    if (purchaseId) {
      await supabase.from("applications").upsert({
        purchase_id: purchaseId,
        grant_id: grantId,
        business_name: intake.businessName,
        intake_data: intake,
        generated_text: text,
        status: "draft",
      });
    }

    return NextResponse.json({ application: text, grant });
  } catch (err) {
    console.error("Anthropic error:", err);
    return NextResponse.json({ error: "Failed to generate. Please try again." }, { status: 500 });
  }
}

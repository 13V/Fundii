import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const APP_URL = Deno.env.get("APP_URL") ?? "https://fundii.com.au";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "onboarding@resend.dev";

// ── Matching algorithm (mirrors lib/matching.ts) ──────────────────────────────
function computeScore(grant: Record<string, unknown>, profile: Record<string, unknown>): number {
  let score = 0;
  let maxScore = 0;

  const states = (grant.states ?? []) as string[];
  const industries = (grant.industries ?? []) as string[];
  const sizes = (grant.business_sizes ?? []) as string[];
  const profileIndustries = (profile.industries ?? []) as string[];
  const profileSize = profile.business_size as string ?? "";
  const profilePurposes = (profile.funding_purposes ?? []) as string[];
  const revenue = profile.revenue_range as string ?? "";

  // State (30)
  maxScore += 30;
  if (states.includes("National")) score += 30;
  else if (states.includes(profile.state as string)) score += 30;

  // Industry (25)
  maxScore += 25;
  if (industries.includes("General")) score += 20;
  if (industries.some((i) => profileIndustries.includes(i))) score += 25;

  // Size (20)
  maxScore += 20;
  if (sizes.includes("General") || sizes.includes("All") || sizes.includes(profileSize)) score += 20;

  // Revenue (15)
  maxScore += 15;
  const amountMax = (grant.amount_max as number) ?? 0;
  if (amountMax === 0 || !revenue) score += 10;
  else if (amountMax >= 10000 && revenue === "under_500k") score += 15;
  else if (amountMax >= 50000 && revenue === "500k_2m") score += 15;
  else if (amountMax >= 100000 && revenue === "2m_10m") score += 15;
  else score += 8;

  // Purpose (10)
  maxScore += 10;
  const purposeMap: Record<string, string[]> = {
    grow: ["General", "Manufacturing"],
    export: ["Export"],
    innovate: ["Technology", "Research"],
    hire: ["General"],
    equipment: ["General", "Manufacturing"],
    digital: ["Technology"],
    energy: ["Energy"],
    training: ["General"],
  };
  const relevant = profilePurposes.flatMap((p) => purposeMap[p] ?? []);
  if (relevant.some((i) => industries.includes(i))) score += 10;
  else score += 5;

  return Math.min(Math.round((score / maxScore) * 100), 98);
}

// ── Email builder ─────────────────────────────────────────────────────────────
function buildEmail(
  matches: Array<Record<string, unknown> & { score: number }>,
  state: string,
  email: string,
): string {
  const grantCards = matches
    .slice(0, 5)
    .map(
      (g) => `
    <div style="background:#ffffff;border:1px solid #e9ecef;border-radius:12px;padding:20px;margin-bottom:16px;">
      <div style="margin-bottom:10px;">
        <span style="background:#e0f2f1;color:#00897b;font-size:12px;font-weight:700;padding:3px 10px;border-radius:99px;margin-right:6px;">${g.score}% match</span>
        <span style="background:#e6f9f0;color:#38a169;font-size:12px;font-weight:600;padding:3px 10px;border-radius:99px;">Open</span>
      </div>
      <h3 style="color:#1b2a4a;font-size:16px;font-weight:700;margin:0 0 8px;line-height:1.3;">${g.title}</h3>
      <p style="color:#6c757d;font-size:14px;margin:0 0 10px;line-height:1.5;">${((g.description as string) ?? "").slice(0, 160)}…</p>
      <div style="font-size:13px;color:#6c757d;margin-bottom:16px;">
        <strong style="color:#38a169;">$</strong> ${g.amount_text ?? "See details"} &nbsp;·&nbsp;
        📍 ${((g.states as string[]) ?? []).join(", ")} &nbsp;·&nbsp;
        📅 ${g.close_date ?? "Ongoing"}
      </div>
      <a href="${APP_URL}/draft/${g.id}"
         style="background:#00897b;color:#ffffff;font-weight:700;font-size:13px;padding:10px 20px;border-radius:10px;text-decoration:none;display:inline-block;">
        ✨ View &amp; Draft Application
      </a>
    </div>`,
    )
    .join("");

  const extra = matches.length > 5
    ? `<p style="text-align:center;color:#6c757d;font-size:14px;margin:0 0 24px;">…and ${matches.length - 5} more matching grants in your dashboard.</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:Inter,system-ui,sans-serif;background:#f8fafb;margin:0;padding:40px 16px;">
  <div style="max-width:600px;margin:0 auto;">

    <!-- Header -->
    <div style="text-align:center;margin-bottom:32px;">
      <div style="display:inline-block;background:linear-gradient(135deg,#00897b,#1b2a4a);border-radius:16px;width:52px;height:52px;line-height:52px;text-align:center;color:#fff;font-weight:800;font-size:24px;margin-bottom:16px;">G</div>
      <h1 style="color:#1b2a4a;font-size:26px;font-weight:800;margin:0 0 10px;">
        🎉 ${matches.length} new grant${matches.length > 1 ? "s" : ""} for you
      </h1>
      <p style="color:#6c757d;font-size:16px;margin:0;">
        New grants matching your ${state} profile were added today.
      </p>
    </div>

    <!-- Grant cards -->
    ${grantCards}
    ${extra}

    <!-- CTA -->
    <div style="text-align:center;margin:32px 0 40px;">
      <a href="${APP_URL}/dashboard"
         style="background:#f5a623;color:#1b2a4a;font-weight:800;font-size:17px;padding:16px 40px;border-radius:14px;text-decoration:none;display:inline-block;">
        View All in Dashboard →
      </a>
    </div>

    <!-- Footer -->
    <div style="text-align:center;color:#adb5bd;font-size:12px;border-top:1px solid #e9ecef;padding-top:24px;">
      <p style="margin:0 0 6px;">Fundii · Made in Australia 🇦🇺</p>
      <p style="margin:0;">You're receiving this because you subscribed to weekly grant alerts.<br>
        <a href="${APP_URL}/dashboard" style="color:#adb5bd;">Manage alerts</a>
      </p>
    </div>

  </div>
</body>
</html>`;
}

// ── Main handler ──────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // 1. Find grants added in the last 25 hours
  const since = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
  const { data: newGrants, error: grantsErr } = await supabase
    .from("grants")
    .select("*")
    .gte("created_at", since)
    .in("status", ["open", "ongoing"]);

  if (grantsErr) {
    console.error("Failed to fetch new grants:", grantsErr);
    return new Response(JSON.stringify({ error: grantsErr.message }), { status: 500 });
  }

  if (!newGrants || newGrants.length === 0) {
    console.log("No new grants found in last 25h");
    return new Response(JSON.stringify({ message: "No new grants", sent: 0 }), { status: 200 });
  }

  console.log(`Found ${newGrants.length} new grants`);

  // 2. Get active subscribers with their profiles
  const { data: subs, error: subsErr } = await supabase
    .from("alert_subscriptions")
    .select("*, profiles(*)")
    .eq("active", true);

  if (subsErr) {
    console.error("Failed to fetch subscriptions:", subsErr);
    return new Response(JSON.stringify({ error: subsErr.message }), { status: 500 });
  }

  if (!subs || subs.length === 0) {
    console.log("No active subscribers");
    return new Response(JSON.stringify({ message: "No subscribers", sent: 0 }), { status: 200 });
  }

  console.log(`Processing ${subs.length} subscribers`);
  let emailsSent = 0;
  let emailErrors = 0;

  // 3. For each subscriber, match and email
  for (const sub of subs) {
    const profile = sub.profiles as Record<string, unknown> | null;
    if (!profile) continue;

    // Run matching
    const matches = newGrants
      .map((g) => ({ ...g, score: computeScore(g, profile) }))
      .filter((g) => g.score > 30)
      .sort((a, b) => b.score - a.score);

    if (matches.length === 0) {
      console.log(`No matches for ${sub.email}`);
      continue;
    }

    console.log(`Sending ${matches.length} matches to ${sub.email}`);

    // Send via Resend
    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `Fundii <${FROM_EMAIL}>`,
        to: [sub.email],
        subject: `🎉 ${matches.length} new grant${matches.length > 1 ? "s" : ""} matching your profile`,
        html: buildEmail(matches, profile.state as string ?? "Australia", sub.email),
      }),
    });

    if (emailRes.ok) {
      emailsSent++;
      await supabase
        .from("alert_subscriptions")
        .update({ last_sent_at: new Date().toISOString() })
        .eq("id", sub.id);
    } else {
      const errText = await emailRes.text();
      console.error(`Failed to send to ${sub.email}:`, errText);
      emailErrors++;
    }
  }

  const result = {
    newGrants: newGrants.length,
    subscribers: subs.length,
    emailsSent,
    emailErrors,
  };
  console.log("Alert run complete:", result);

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

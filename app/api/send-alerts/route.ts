import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Called by GitHub Actions after scraper runs
// Protected by CRON_SECRET env var
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: "Email not configured" }, { status: 503 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Get all active alert subscriptions
  const { data: subscriptions } = await supabase
    .from("alert_subscriptions")
    .select("user_id, email")
    .eq("active", true);

  if (!subscriptions?.length) {
    return NextResponse.json({ sent: 0, message: "No active subscriptions" });
  }

  // Get grants from last 7 days
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: newGrants } = await supabase
    .from("grants")
    .select("id, title, source, amount_text, states, close_date, description, url, source_url")
    .in("status", ["open", "ongoing"])
    .gte("created_at", weekAgo)
    .order("created_at", { ascending: false })
    .limit(20);

  if (!newGrants?.length) {
    return NextResponse.json({ sent: 0, message: "No new grants this week" });
  }

  const baseUrl = process.env.NEXT_PUBLIC_URL || "https://fundii.vercel.app";
  let sent = 0;

  for (const sub of subscriptions) {
    // Get user profile to personalise matching
    const { data: profile } = await supabase
      .from("profiles")
      .select("state, industries")
      .eq("id", sub.user_id)
      .single();

    // Filter grants relevant to user's state
    const relevant = newGrants.filter((g) => {
      const states: string[] = g.states ?? [];
      return states.includes("National") || states.includes("All") ||
        (profile?.state && states.includes(profile.state));
    }).slice(0, 8);

    if (!relevant.length) continue;

    const grantRows = relevant.map((g) => `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #f0f0f0;">
          <a href="${g.url || g.source_url || baseUrl}" style="font-weight:600;color:#0F7B6C;text-decoration:none;">${g.title}</a>
          <div style="color:#666;font-size:13px;margin-top:3px;">${g.source} · ${g.amount_text || "Amount varies"}</div>
          ${g.close_date ? `<div style="color:#999;font-size:12px;margin-top:2px;">Closes ${g.close_date}</div>` : ""}
        </td>
      </tr>`).join("");

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#FAF8F4;margin:0;padding:0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAF8F4;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
        <tr><td style="background:#0F7B6C;padding:32px 40px;">
          <h1 style="color:#fff;margin:0;font-size:24px;">GrantBase Weekly Digest</h1>
          <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;">${relevant.length} new grants this week${profile?.state ? ` for ${profile.state}` : ""}</p>
        </td></tr>
        <tr><td style="padding:32px 40px;">
          <table width="100%" cellpadding="0" cellspacing="0">${grantRows}</table>
          <div style="text-align:center;margin-top:32px;">
            <a href="${baseUrl}/quiz" style="background:#0F7B6C;color:#fff;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:700;display:inline-block;">
              View All Matching Grants →
            </a>
          </div>
        </td></tr>
        <tr><td style="padding:20px 40px;border-top:1px solid #f0f0f0;text-align:center;">
          <p style="color:#999;font-size:12px;margin:0;">
            You're receiving this because you enabled grant alerts.
            <a href="${baseUrl}/dashboard" style="color:#0F7B6C;">Manage alerts</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    // Send via Resend
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "GrantBase <alerts@grantbase.com.au>",
        to: sub.email,
        subject: `🔔 ${relevant.length} new grants for you this week`,
        html,
      }),
    });

    // Update last_sent_at
    await supabase.from("alert_subscriptions")
      .update({ last_sent_at: new Date().toISOString() })
      .eq("user_id", sub.user_id);

    sent++;
  }

  return NextResponse.json({ sent, total: subscriptions.length });
}

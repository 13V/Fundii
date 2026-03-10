import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { matchGrants } from "@/lib/matching";
import type { Grant, UserProfile } from "@/lib/types";

// Strip excess whitespace and cap description length
function truncateDescription(desc: string): string {
  const cleaned = desc.replace(/\s+/g, " ").trim();
  return cleaned.length > 400 ? cleaned.slice(0, 397) + "…" : cleaned;
}

export async function POST(req: NextRequest) {
  const { profile }: { profile: UserProfile } = await req.json();

  if (
    !profile?.state ||
    !Array.isArray(profile.industries) ||
    !Array.isArray(profile.sizes) ||
    !profile.revenue
  ) {
    return NextResponse.json({ error: "Incomplete profile" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const { data, error } = await supabase
    .from("grants")
    .select(
      "id, title, source, source_url, amount_min, amount_max, amount_text, states, industries, business_sizes, status, close_date, description, eligibility, grant_type, category, url"
    )
    .in("status", ["open", "ongoing"])
    .overlaps("states", [profile.state, "National", "All"])
    // Filter out nav garbage, phishing banners, and other scraper artefacts
    .not("description", "ilike", "%Skip navigation%")
    .not("description", "ilike", "%Toggle High Contrast%")
    .not("description", "ilike", "%Accessibility Options%")
    .not("description", "ilike", "%phishing%")
    .not("description", "ilike", "%impersonating GrantConnect%")
    .not("title", "ilike", "%Current Grant Opportunity View%");

  if (error) {
    console.error("Supabase error:", error);
    return NextResponse.json({ error: "Failed to fetch grants" }, { status: 500 });
  }

  // Map business_sizes → sizes to match the Grant interface
  const grants: Grant[] = (data ?? []).map((row: Record<string, unknown>) => ({
    ...(row as Omit<Grant, "sizes">),
    sizes: (row.business_sizes as string[]) ?? [],
    // Fallback url → source_url so "View Details" links are never broken
    url: (row.url as string) || (row.source_url as string) || "",
    // Truncate descriptions that are too long (signs of full-page scrapes)
    description: truncateDescription((row.description as string) ?? ""),
  }));

  const matches = matchGrants(grants, profile);

  return NextResponse.json({ matches: matches.slice(0, 50) });
}

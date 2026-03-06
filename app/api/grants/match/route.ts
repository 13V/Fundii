import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { matchGrants } from "@/lib/matching";
import type { Grant, UserProfile } from "@/lib/types";

export async function POST(req: NextRequest) {
  const { profile }: { profile: UserProfile } = await req.json();

  if (!profile?.state) {
    return NextResponse.json({ error: "Missing profile" }, { status: 400 });
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
    .overlaps("states", [profile.state, "National"]);

  if (error) {
    console.error("Supabase error:", error);
    return NextResponse.json({ error: "Failed to fetch grants" }, { status: 500 });
  }

  // Map business_sizes → sizes to match the Grant interface
  const grants: Grant[] = (data ?? []).map((row: Record<string, unknown>) => ({
    ...(row as Omit<Grant, "sizes">),
    sizes: (row.business_sizes as string[]) ?? [],
  }));

  const matches = matchGrants(grants, profile);

  return NextResponse.json({ matches: matches.slice(0, 100) });
}

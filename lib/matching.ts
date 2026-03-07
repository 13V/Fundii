import type { Grant, MatchedGrant, UserProfile } from "./types";

// Normalize DB industry labels → quiz-compatible values.
// Scrapers use various labels; this maps them to what users actually select in the quiz.
const INDUSTRY_NORMALIZE: Record<string, string> = {
  "Environment":         "Energy",      // quiz option covers "Energy & Environment"
  "Food & Beverage":     "Agriculture", // closest quiz match
  "Education":           "General",     // no quiz option
  "Transport":           "General",     // no quiz option
  "Sport":               "General",     // no quiz option
  "Space":               "Research",    // closest quiz match
  "Creative Industries": "Arts",        // agencyscrapers.py label
  "Arts & Culture":      "Arts",        // agencyscrapers.py label
  "Education & Training":"General",     // agencyscrapers.py label
};

// Keywords that signal a grant is clearly for a specific industry the user may not be in
const INDUSTRY_KEYWORD_GUARDS: Array<{ keywords: string[]; industries: string[]; requireActivity?: string }> = [
  {
    keywords: ["algal bloom", "fishery", "fisheries", "aquaculture", "seafood", "fishing industry", "marine harvest"],
    industries: ["Agriculture"],
  },
  {
    keywords: ["screen australia", "film production", "music grant", "arts board", "arts council", "creative arts fund"],
    industries: ["Arts"],
  },
  {
    keywords: ["pastoral", "livestock", "horticulture", "broadacre", "crop production", "viticulture"],
    industries: ["Agriculture"],
  },
  {
    keywords: ["tourism operator", "visitor economy", "accommodation provider", "travel agent"],
    industries: ["Tourism"],
  },
  {
    // Export/customs grants only relevant if user has Export industry or export activity
    keywords: [
      "export market", "export program", "export diversification", "export finance",
      "overseas market development", "export grant", "simplify customs",
      "import and export businesses", "customs processes", "trusted trader",
    ],
    industries: ["Export"],
    requireActivity: "export",
  },
];

export function matchGrants(grants: Grant[], profile: UserProfile): MatchedGrant[] {
  return grants
    .filter((g) => g.status === "open" || g.status === "ongoing")
    .map((grant) => {
      let score = 0;
      const maxScore = 100;

      // --- State match (30 pts) ---
      if (grant.states.includes("National") || grant.states.includes("All")) {
        score += 30;
      } else if (grant.states.includes(profile.state)) {
        score += 30;
      }

      // --- Industry match (25 pts) ---
      // Normalize DB labels → quiz-compatible values first
      const rawInds = grant.industries ?? [];
      const grantInds = [...new Set(rawInds.map((i) => INDUSTRY_NORMALIZE[i] ?? i))];
      const hasGeneral = grantInds.some((i) => i === "General" || i === "All");
      const specificInds = grantInds.filter((i) => i !== "General" && i !== "All");
      // If 6+ industries are tagged it's almost certainly a scraper false-positive
      // (grabbed too much page text). Treat as General-only — no direct match bonus.
      const overTagged = specificInds.length >= 6;
      const hasDirectMatch = !overTagged && specificInds.some((i) => profile.industries.includes(i));

      if (hasDirectMatch) {
        score += 25; // Direct industry match — full credit
      } else if (hasGeneral && specificInds.length === 0) {
        score += 12; // General-only grant — could apply to anyone
      } else if (hasGeneral && specificInds.length > 0) {
        score += 5;  // Has General + specific industries but none match — marginal
      }
      // else: specific industries only, none match → 0 pts

      // --- Size match (20 pts) ---
      const grantSizes = grant.sizes ?? [];
      if (
        grantSizes.length === 0 ||
        grantSizes.includes("General") ||
        grantSizes.includes("All") ||
        grantSizes.some((s) => profile.sizes.includes(s))
      ) {
        score += 20;
      }

      // --- Revenue / amount relevance (15 pts) ---
      // Vague landing pages (no amount + generic "Find out how to" description) get penalised
      const desc = (grant.description ?? "").toLowerCase();
      const isVagueLandingPage =
        (!grant.amount_max || grant.amount_max === 0) &&
        (!grant.amount_min || grant.amount_min === 0) &&
        (desc.startsWith("find out how to") || desc.startsWith("find out about") || desc.length < 60);

      if (isVagueLandingPage) {
        score += 3; // Almost no info — penalise heavily
      } else if (!grant.amount_max || grant.amount_max === 0 || !profile.revenue) {
        score += 8; // No amount info but has real description
      } else if (grant.amount_max >= 10000 && profile.revenue === "under_500k") {
        score += 15;
      } else if (grant.amount_max >= 50000 && profile.revenue === "500k_2m") {
        score += 15;
      } else if (grant.amount_max >= 100000 && profile.revenue === "2m_10m") {
        score += 15;
      } else {
        score += 5; // Amount exists but doesn't fit revenue range
      }

      // --- Purpose + activities match (10 pts) ---
      // Fixed: no longer guaranteed 5 pts — must actually match something
      const purposeMap: Record<string, string[]> = {
        grow:      ["General", "Manufacturing"],
        export:    ["Export"],
        innovate:  ["Technology", "Research"],
        hire:      ["General"],
        equipment: ["General", "Manufacturing"],
        digital:   ["Technology"],
        energy:    ["Energy"],
        training:  ["General"],
      };
      const activityMap: Record<string, string[]> = {
        apprentices:      ["General", "Construction", "Manufacturing"],
        export:           ["Export"],
        research:         ["Technology", "Research"],
        energy_intensive: ["Energy", "Manufacturing"],
        regional:         ["General"],
        social_enterprise:["General", "Arts"],
      };

      const purposeInds = (profile.purposes ?? []).flatMap((p) => purposeMap[p] ?? []);
      const activityInds = (profile.activities ?? []).flatMap((a) => activityMap[a] ?? []);
      const allRelevant = [...new Set([...purposeInds, ...activityInds])];

      if (allRelevant.some((i) => grantInds.includes(i))) {
        score += 10;
      } else if (hasGeneral && allRelevant.length > 0) {
        score += 4; // General grant, user has some relevant purpose/activity
      }
      // else: 0 pts — no purpose/activity alignment

      // --- Keyword mismatch penalty ---
      // Penalise grants with strong industry-specific keywords when user isn't in that industry
      const titleDesc = `${grant.title} ${grant.description ?? ""}`.toLowerCase();
      for (const { keywords, industries, requireActivity } of INDUSTRY_KEYWORD_GUARDS) {
        const hasKeyword = keywords.some((kw) => titleDesc.includes(kw));
        if (!hasKeyword) continue;
        const userInThisIndustry = industries.some((i) => profile.industries.includes(i));
        // requireActivity: also passes if user has the matching activity (e.g. "export")
        const userHasActivity = requireActivity
          ? (profile.activities ?? []).includes(requireActivity) ||
            (profile.purposes ?? []).includes(requireActivity)
          : false;
        if (!userInThisIndustry && !userHasActivity) {
          score -= 25;
          break;
        }
      }

      const pct = Math.min(Math.max(Math.round((score / maxScore) * 100), 0), 98);
      return { ...grant, matchScore: pct };
    })
    .filter((g) => g.matchScore >= 65) // Only show strong matches
    .sort((a, b) => b.matchScore - a.matchScore);
}

import type { Grant, MatchedGrant, UserProfile } from "./types";

// Keywords that signal a grant is for a specific industry the user may not be in
const INDUSTRY_KEYWORD_GUARDS: Array<{ keywords: string[]; industries: string[] }> = [
  {
    keywords: ["algal bloom", "fishery", "fisheries", "aquaculture", "seafood", "fishing industry", "marine harvest"],
    industries: ["Agriculture", "Fisheries"],
  },
  {
    keywords: ["screen australia", "film production", "music grant", "arts board", "arts council", "creative arts fund"],
    industries: ["Arts", "Creative"],
  },
  {
    keywords: ["pastoral", "livestock", "horticulture", "broadacre", "crop production", "viticulture"],
    industries: ["Agriculture"],
  },
  {
    keywords: ["tourism operator", "visitor economy", "accommodation provider", "travel agent"],
    industries: ["Tourism"],
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
      // Fixed: mutually exclusive, General is partial credit only
      const grantInds = grant.industries ?? [];
      const hasGeneral = grantInds.some((i) => i === "General" || i === "All");
      const specificInds = grantInds.filter((i) => i !== "General" && i !== "All");
      const hasDirectMatch = specificInds.some((i) => profile.industries.includes(i));

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
        grantSizes.some((s) => profile.sizes.includes(s))
      ) {
        score += 20;
      }

      // --- Revenue / amount relevance (15 pts) ---
      if (!grant.amount_max || grant.amount_max === 0 || !profile.revenue) {
        score += 10;
      } else if (grant.amount_max >= 10000 && profile.revenue === "under_500k") {
        score += 15;
      } else if (grant.amount_max >= 50000 && profile.revenue === "500k_2m") {
        score += 15;
      } else if (grant.amount_max >= 100000 && profile.revenue === "2m_10m") {
        score += 15;
      } else {
        score += 8;
      }

      // --- Purpose + activities match (10 pts) ---
      // Fixed: no longer guaranteed 5 pts — must actually match something
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
      const activityMap: Record<string, string[]> = {
        apprentices: ["General"],
        export: ["Export"],
        research: ["Technology", "Research"],
        energy_intensive: ["Energy"],
        regional: ["General"],
        social_enterprise: ["General"],
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
      for (const { keywords, industries } of INDUSTRY_KEYWORD_GUARDS) {
        const hasKeyword = keywords.some((kw) => titleDesc.includes(kw));
        const userInThisIndustry = industries.some((i) => profile.industries.includes(i));
        if (hasKeyword && !userInThisIndustry) {
          score -= 25;
          break;
        }
      }

      const pct = Math.min(Math.max(Math.round((score / maxScore) * 100), 0), 98);
      return { ...grant, matchScore: pct };
    })
    .filter((g) => g.matchScore >= 60) // Raised from 30 to 60 — only show strong matches
    .sort((a, b) => b.matchScore - a.matchScore);
}

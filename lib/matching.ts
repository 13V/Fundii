import type { Grant, MatchBreakdown, MatchedGrant, UserProfile } from "./types";

// Normalize DB industry labels → quiz-compatible values.
// Scrapers use various labels; this maps them to what users actually select in the quiz.
const INDUSTRY_NORMALIZE: Record<string, string> = {
  // Environment-themed → Energy (quiz option is "Energy & Environment")
  "Environment":              "Energy",
  "Sustainability":           "Energy",
  "Clean Technology":         "Energy",
  // Food/agriculture variants
  "Food & Beverage":          "Agriculture",
  "Food Production":          "Agriculture",
  "Agrifood":                 "Agriculture",
  "Fisheries":                "Agriculture",
  "Aquaculture":              "Agriculture",
  "Forestry":                 "Agriculture",
  // Arts variants
  "Creative Industries":      "Arts",
  "Arts & Culture":           "Arts",
  "Screen":                   "Arts",
  "Film":                     "Arts",
  "Music":                    "Arts",
  // Research variants
  "Space":                    "Research",
  "Aerospace":                "Research",
  "Innovation":               "Research",
  "Commercialisation":        "Research",
  // Healthcare variants
  "Medical":                  "Healthcare",
  "Aged Care":                "Healthcare",
  "Disability":               "Healthcare",
  "Biotech":                  "Healthcare",
  "Biotechnology":            "Healthcare",
  // No quiz equivalent → General
  "Education":                "General",
  "Education & Training":     "General",
  "Transport":                "General",
  "Infrastructure":           "General",
  "Sport":                    "General",
  "Community":                "General",
  "Social Services":          "General",
  "Legal":                    "General",
  "Finance":                  "General",
  "Property":                 "General",
  "Veterinary":               "General",
  // Indigenous as industry label → General
  // (keyword guard restricts it to indigenous-activity users)
  "Indigenous":               "General",
  "Aboriginal":               "General",
  "First Nations":            "General",
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
  {
    // Healthcare-specific grants shouldn't match non-healthcare businesses
    keywords: [
      "aged care provider", "aged care facility", "residential aged care",
      "clinical trial", "pharmaceutical manufacturer", "registered health practitioner",
      "health service provider", "medical practice", "allied health practitioner",
      "disability service provider", "ndis provider",
    ],
    industries: ["Healthcare"],
  },
  {
    // Mining-specific grants shouldn't match general businesses
    keywords: [
      "mining operation", "mineral exploration", "extractive industry",
      "quarrying operation", "mine site", "mine rehabilitation",
    ],
    industries: ["Mining"],
  },
  {
    // Defence industry grants are highly specific
    keywords: [
      "defence supply chain", "defence industry participant", "defence contractor",
      "defence primes", "sovereignty industrial", "australian defence industry",
    ],
    industries: ["Defence"],
  },
  {
    // Indigenous-specific grants — only relevant for indigenous-owned businesses
    keywords: [
      "indigenous business", "aboriginal business", "torres strait islander business",
      "first nations business", "indigenous entrepreneur", "indigenous owned",
      "indigenous procurement", "aboriginal and torres strait",
    ],
    industries: ["__indigenous__"], // sentinel — handled specially below
  },
  {
    // Women-specific grants
    keywords: [
      "women-owned business", "women in business", "women led", "women founder",
      "female entrepreneur", "women's entrepreneurship",
    ],
    industries: ["__women_led__"], // sentinel — handled specially below
  },
];

export function matchGrants(grants: Grant[], profile: UserProfile): MatchedGrant[] {
  return grants
    .filter((g) => g.status === "open" || g.status === "ongoing")
    .map((grant) => {
      let score = 0;
      const maxScore = 100;
      const breakdown: MatchBreakdown = { state: 0, industry: 0, size: 0, revenue: 0, purpose: 0 };

      // --- State match (30 pts) ---
      if (grant.states.includes("National") || grant.states.includes("All")) {
        breakdown.state = 30;
      } else if (grant.states.includes(profile.state)) {
        breakdown.state = 30;
      }
      score += breakdown.state;

      // --- Industry match (25 pts) ---
      // Normalize DB labels → quiz-compatible values first
      const rawInds = grant.industries ?? [];
      const grantInds = [...new Set(rawInds.map((i) => INDUSTRY_NORMALIZE[i] ?? i))];
      const hasGeneral = grantInds.some((i) => i === "General" || i === "All");
      const specificInds = grantInds.filter((i) => i !== "General" && i !== "All");
      // If 7+ specific industries tagged → almost certainly a full-page scrape false positive.
      // Legitimate programs cover at most 6 industries (e.g. R&D Tax Incentive).
      const overTagged = specificInds.length >= 7;
      const hasDirectMatch = specificInds.some((i) => profile.industries.includes(i));

      if (hasDirectMatch && !overTagged) {
        breakdown.industry = 25; // Direct industry match — full credit
      } else if (hasDirectMatch && overTagged) {
        breakdown.industry = 15; // Match found but grant is over-tagged — partial credit
      } else if (hasGeneral && specificInds.length === 0) {
        breakdown.industry = 12; // General-only grant — could apply to anyone
      } else if (hasGeneral && specificInds.length > 0) {
        breakdown.industry = 5;  // Has General + specific industries but none match — marginal
      }
      // else: specific industries only, none match → 0 pts
      score += breakdown.industry;

      // --- Size + business age match (20 pts) ---
      const grantSizes = grant.sizes ?? [];

      // Expand what the grant's size tags mean for matching:
      // - "Large" in DB (legacy, now removed from scraper) → treat as "All"
      // - "Indigenous" in DB (legacy, now removed from scraper) → treat as "All"
      //   (the keyword guard handles who can actually see indigenous grants)
      const effectiveGrantSizes = grantSizes.map((s) => {
        if (s === "Large" || s === "Indigenous") return "All";
        return s;
      });

      // Expand what the user's selected size means for grant eligibility:
      // - "Sole Trader" is legally a small business → also eligible for "Small" grants
      // - "Startup" businesses are often small → also eligible for "Small" grants
      // - "Non-profit" entities are often small/medium → eligible for both
      const effectiveProfileSizes = [...(profile.sizes ?? [])];
      if (effectiveProfileSizes.includes("Sole Trader")) effectiveProfileSizes.push("Small");
      if (effectiveProfileSizes.includes("Startup"))    effectiveProfileSizes.push("Small");
      if (effectiveProfileSizes.includes("Non-profit")) { effectiveProfileSizes.push("Small"); effectiveProfileSizes.push("Medium"); }

      const sizeMatch =
        effectiveGrantSizes.length === 0 ||
        effectiveGrantSizes.includes("General") ||
        effectiveGrantSizes.includes("All") ||
        effectiveGrantSizes.some((s) => effectiveProfileSizes.includes(s));

      if (sizeMatch) {
        breakdown.size = 20;
      }

      // Business age penalty (no bonus — startup users already get "Startup" size match)
      if (profile.business_age && breakdown.size > 0) {
        const eligibilityText = `${grant.title} ${grant.description ?? ""} ${grant.eligibility ?? ""}`.toLowerCase();
        const requiresTenure =
          /operating for (at least )?\d+ year/.test(eligibilityText) ||
          /\d+ year.{0,10}(trading|in operation|of operation)/.test(eligibilityText) ||
          eligibilityText.includes("established business") ||
          eligibilityText.includes("must have been trading");

        if (profile.business_age === "under_2" && requiresTenure) {
          breakdown.size = Math.max(breakdown.size - 15, 0); // likely ineligible
        }
        if (profile.business_age === "over_5") {
          // Established business applying for a startup-only grant
          const startupOnly = (effectiveGrantSizes.includes("Startup") && effectiveGrantSizes.length === 1);
          if (startupOnly) breakdown.size = Math.max(breakdown.size - 10, 0);
        }
      }
      score += breakdown.size;

      // --- Revenue / amount relevance (15 pts) ---
      // Vague landing pages (no amount + generic "Find out how to" description) get penalised
      const desc = (grant.description ?? "").toLowerCase();
      const isVagueLandingPage =
        (!grant.amount_max || grant.amount_max === 0) &&
        (!grant.amount_min || grant.amount_min === 0) &&
        (
          desc.startsWith("find out how to") ||
          desc.startsWith("find out about") ||
          desc.startsWith("information about") ||
          desc.startsWith("learn about") ||
          desc.length < 80 ||
          // No description at all — only title was stored
          desc === (grant.title ?? "").toLowerCase()
        );

      if (isVagueLandingPage) {
        breakdown.revenue = 3; // Almost no info — penalise heavily
      } else if (!grant.amount_max || grant.amount_max === 0 || !profile.revenue) {
        breakdown.revenue = 8; // No amount info but has real description
      } else if (profile.revenue === "pre_revenue") {
        breakdown.revenue = grant.amount_max >= 5000 ? 15 : 8;
      } else if (profile.revenue === "under_500k") {
        breakdown.revenue = grant.amount_max >= 10000 ? 15 : 5;
      } else if (profile.revenue === "500k_2m") {
        breakdown.revenue = grant.amount_max >= 50000 ? 15 : 5;
      } else if (profile.revenue === "2m_10m") {
        breakdown.revenue = grant.amount_max >= 100000 ? 15 : 5;
      } else if (profile.revenue === "over_10m") {
        breakdown.revenue = grant.amount_max >= 200000 ? 15 : grant.amount_max >= 50000 ? 8 : 5;
      } else {
        breakdown.revenue = 5;
      }
      score += breakdown.revenue;

      // --- Purpose + activities match (10 pts) ---
      const purposeMap: Record<string, string[]> = {
        grow:      ["General"],
        export:    ["Export"],
        innovate:  ["Technology", "Research", "General"],
        hire:      ["General"],
        equipment: ["General", "Manufacturing", "Construction", "Agriculture", "Mining", "Defence"],
        digital:   ["Technology", "General"],
        energy:    ["Energy"],
        training:  ["General", "Construction", "Manufacturing", "Healthcare", "Agriculture"],
      };
      const activityMap: Record<string, string[]> = {
        apprentices:      ["General", "Construction", "Manufacturing", "Agriculture", "Healthcare", "Tourism"],
        export:           ["Export"],
        research:         ["Technology", "Research", "Manufacturing", "Agriculture", "Healthcare", "Defence"],
        energy_intensive: ["Energy", "Manufacturing", "Mining", "Agriculture"],
        regional:         ["General", "Agriculture", "Tourism", "Construction", "Manufacturing"],
        social_enterprise:["General", "Arts", "Healthcare"],
        indigenous:       ["General", "Agriculture", "Tourism", "Arts", "Construction", "Mining", "Manufacturing"],
        women_led:        ["General", "Technology", "Research", "Construction", "Manufacturing", "Agriculture", "Healthcare"],
        ai_adoption:      ["Technology", "General", "Manufacturing", "Retail", "Agriculture", "Healthcare", "Construction"],
      };

      const purposeInds = (profile.purposes ?? []).flatMap((p) => purposeMap[p] ?? []);
      const activityInds = (profile.activities ?? []).flatMap((a) => activityMap[a] ?? []);
      const allRelevant = [...new Set([...purposeInds, ...activityInds])];

      if (allRelevant.some((i) => grantInds.includes(i))) {
        breakdown.purpose = 10;
      } else if (hasGeneral && allRelevant.length > 0) {
        breakdown.purpose = 4;
      }
      score += breakdown.purpose;

      // --- Keyword mismatch penalty ---
      // Each mismatched guard subtracts 25 pts. Multiple guards can fire (no break).
      // Total penalty capped at -50 to avoid driving score deeply negative.
      const titleDesc = `${grant.title} ${grant.description ?? ""}`.toLowerCase();
      const userActivities = profile.activities ?? [];
      let penalty = 0;
      for (const { keywords, industries, requireActivity } of INDUSTRY_KEYWORD_GUARDS) {
        if (penalty >= 50) break; // cap reached
        const hasKeyword = keywords.some((kw) => titleDesc.includes(kw));
        if (!hasKeyword) continue;

        // Handle sentinel flags for activities-based grants
        if (industries.includes("__indigenous__")) {
          if (!userActivities.includes("indigenous")) penalty += 25;
          continue;
        }
        if (industries.includes("__women_led__")) {
          if (!userActivities.includes("women_led")) penalty += 25;
          continue;
        }

        const userInThisIndustry = industries.some((i) => profile.industries.includes(i));
        const userHasActivity = requireActivity
          ? userActivities.includes(requireActivity) ||
            (profile.purposes ?? []).includes(requireActivity)
          : false;
        if (!userInThisIndustry && !userHasActivity) {
          penalty += 25;
        }
      }
      score -= Math.min(penalty, 50);

      const pct = Math.min(Math.max(Math.round((score / maxScore) * 100), 0), 98);
      return { ...grant, matchScore: pct, matchBreakdown: breakdown };
    })
    .filter((g) => g.matchScore >= 65) // Only show strong matches
    // Primary sort: score descending. Secondary: title alphabetical for determinism.
    .sort((a, b) => b.matchScore - a.matchScore || a.title.localeCompare(b.title));
}

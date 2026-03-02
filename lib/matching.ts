import { GRANTS_DB } from "./grants-data";
import type { MatchedGrant, UserProfile } from "./types";

export function matchGrants(profile: UserProfile): MatchedGrant[] {
  return GRANTS_DB.filter((g) => g.status === "open" || g.status === "ongoing")
    .map((grant) => {
      let score = 0;
      let maxScore = 0;

      // State match (weight: 30)
      maxScore += 30;
      if (grant.states.includes("National")) score += 30;
      else if (grant.states.includes(profile.state)) score += 30;

      // Industry match (weight: 25)
      maxScore += 25;
      if (grant.industries.includes("General")) score += 20;
      if (grant.industries.some((i) => profile.industries.includes(i))) score += 25;

      // Size match (weight: 20)
      maxScore += 20;
      if (
        grant.sizes.includes("General") ||
        grant.sizes.some((s) => profile.sizes.includes(s))
      )
        score += 20;

      // Revenue/amount relevance (weight: 15)
      maxScore += 15;
      if (grant.amount_max === 0 || !profile.revenue) {
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

      // Purpose match (weight: 10)
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
      const relevantIndustries = (profile.purposes ?? []).flatMap(
        (p) => purposeMap[p] ?? []
      );
      if (relevantIndustries.some((i) => grant.industries.includes(i))) {
        score += 10;
      } else {
        score += 5;
      }

      const pct = Math.min(Math.round((score / maxScore) * 100), 98);
      return { ...grant, matchScore: pct };
    })
    .filter((g) => g.matchScore > 30)
    .sort((a, b) => b.matchScore - a.matchScore);
}

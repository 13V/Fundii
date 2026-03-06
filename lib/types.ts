export interface Grant {
  id: string;
  title: string;
  source: string;
  source_url: string;
  amount_min: number;
  amount_max: number;
  amount_text: string;
  states: string[];
  industries: string[];
  sizes: string[];
  status: "open" | "closed" | "ongoing" | "upcoming" | "unknown";
  close_date: string;
  description: string;
  eligibility: string;
  grant_type: "grant" | "loan" | "rebate" | "tax_incentive" | "voucher" | "subsidy" | "scholarship";
  category: "federal" | "state" | "community" | "industry" | "energy" | "research" | "export" | "innovation";
  url: string;
}

export interface MatchedGrant extends Grant {
  matchScore: number;
}

export interface UserProfile {
  state: string;
  industries: string[];
  sizes: string[];
  revenue: string;
  purposes: string[];
  activities?: string[];
}

export interface SavedGrant extends MatchedGrant {
  applicationStatus?: "saved" | "applying" | "applied" | "awarded";
  notes?: string;
  savedAt?: string;
}

export interface QuizStep {
  id: keyof UserProfile | "state" | "revenue";
  title: string;
  subtitle?: string;
  type: "single" | "multi";
  options: { value: string; label: string }[];
}

import { useState, useEffect, useCallback } from "react";

// ========== GRANT DATABASE (from scraper - would be Supabase in production) ==========
const GRANTS_DB = [
  { id: "g1", title: "Small Business Growth Grants Program WA", source: "business.gov.au", amount_min: 2000, amount_max: 10000, amount_text: "$2,000–$10,000", states: ["WA"], industries: ["General"], sizes: ["Small", "Startup"], status: "open", close_date: "Ongoing", description: "Matched funding to help eligible small business owners invest in expert advice and services to grow their business, build capability and strengthen long-term success.", eligibility: "Must be a WA-based small business with fewer than 20 FTE employees and turnover under $5M.", grant_type: "Voucher", category: "state", url: "https://business.gov.au/grants-and-programs/small-business-growth-grants-program-wa" },
  { id: "g2", title: "Export Market Development Grant (EMDG)", source: "business.gov.au", amount_min: 5000, amount_max: 150000, amount_text: "$5,000–$150,000", states: ["National"], industries: ["Export", "Manufacturing", "Technology", "Agriculture", "Food & Beverage"], sizes: ["Small", "Medium"], status: "open", close_date: "Round-based", description: "Reimburses up to 50% of eligible export marketing and promotion expenses to help Australian businesses expand into international markets.", eligibility: "Australian business with income under $20M. Must have spent at least $15,000 on eligible export promotion activities.", grant_type: "grant", category: "federal", url: "https://business.gov.au/grants-and-programs/export-market-development-grants" },
  { id: "g3", title: "R&D Tax Incentive", source: "business.gov.au", amount_min: 0, amount_max: 0, amount_text: "Tax offset up to 43.5%", states: ["National"], industries: ["Technology", "Manufacturing", "Healthcare", "Agriculture", "Energy", "Research"], sizes: ["Small", "Medium", "Startup"], status: "open", close_date: "Ongoing (annual)", description: "Provides a tax offset to encourage Australian companies to invest in research and development activities that might not otherwise be undertaken.", eligibility: "Incorporated company conducting eligible R&D activities in Australia. Must register with AusIndustry within 10 months of income year end.", grant_type: "tax_incentive", category: "federal", url: "https://business.gov.au/grants-and-programs/research-and-development-tax-incentive" },
  { id: "g4", title: "Industry Growth Program", source: "business.gov.au", amount_min: 50000, amount_max: 5000000, amount_text: "$50,000–$5,000,000", states: ["National"], industries: ["Manufacturing", "Technology", "Healthcare", "Energy", "Defence", "Agriculture"], sizes: ["Small", "Medium", "Startup"], status: "open", close_date: "Apply anytime (advisory stage)", description: "Supports innovative SMEs to commercialise novel products, processes and services. Includes advisory services followed by co-funded grant for commercialisation projects.", eligibility: "Australian SME with innovative product/process in National Reconstruction Fund priority areas. Must complete advisory stage before grant application.", grant_type: "grant", category: "federal", url: "https://business.gov.au/grants-and-programs/industry-growth-program" },
  { id: "g5", title: "CSIRO Kick-Start", source: "business.gov.au", amount_min: 10000, amount_max: 50000, amount_text: "$10,000–$50,000 (matched)", states: ["National"], industries: ["Technology", "Manufacturing", "Healthcare", "Agriculture", "Energy", "Research"], sizes: ["Small", "Startup"], status: "open", close_date: "Ongoing", description: "Matched funding for Australian startups and small SMEs to access CSIRO research expertise and capabilities to undertake R&D activities that will grow your business.", eligibility: "Australian startup or SME with fewer than 20 employees and annual turnover under $5M. Must have an eligible R&D project.", grant_type: "grant", category: "federal", url: "https://business.gov.au/grants-and-programs/csiro-kickstart" },
  { id: "g6", title: "Innovation Connect (ICON) Grants ACT", source: "act.gov.au", amount_min: 10000, amount_max: 30000, amount_text: "$10,000–$30,000 (matched)", states: ["ACT"], industries: ["Technology", "General"], sizes: ["Startup", "Small"], status: "open", close_date: "Ongoing", description: "Matched funding grants for early-stage entrepreneurs and start-ups in the ACT to kick-start their innovation journey.", eligibility: "ACT-based early-stage business or startup. Must demonstrate an innovative idea with commercial potential.", grant_type: "grant", category: "state", url: "https://www.act.gov.au/business/apply-for-grants-and-funding" },
  { id: "g7", title: "Business Growth Loan Scheme TAS", source: "business.tas.gov.au", amount_min: 50000, amount_max: 5000000, amount_text: "$50,000–$5,000,000", states: ["TAS"], industries: ["General"], sizes: ["Small", "Medium"], status: "open", close_date: "Ongoing", description: "Low-interest loans to assist Tasmanian businesses to develop, expand or undertake new projects that promote growth in the Tasmanian economy.", eligibility: "Tasmanian business that can demonstrate the project will create jobs and economic growth in Tasmania.", grant_type: "loan", category: "state", url: "https://www.business.tas.gov.au/funding" },
  { id: "g8", title: "Innovation Booster Grant WA", source: "business.gov.au", amount_min: 5000, amount_max: 50000, amount_text: "Up to $50,000 (matched)", states: ["WA"], industries: ["Technology", "Manufacturing", "Research"], sizes: ["Startup", "Small"], status: "open", close_date: "Ongoing", description: "Funding for WA start-ups and small businesses to commercialise innovative ideas or projects, and to expand to create jobs.", eligibility: "WA-based startup or small business with an innovative product or service to commercialise. Reduced matched funding for underrepresented groups.", grant_type: "grant", category: "state", url: "https://business.gov.au/grants-and-programs/innovation-booster-grant-wa" },
  { id: "g9", title: "Future Made in Australia Innovation Fund", source: "arena.gov.au", amount_min: 500000, amount_max: 50000000, amount_text: "Up to $1.5 billion total pool", states: ["National"], industries: ["Energy", "Manufacturing"], sizes: ["Medium", "Small"], status: "open", close_date: "Ongoing until exhausted", description: "ARENA-administered fund providing grants for pre-commercial innovation, demonstration and deployment of renewable energy and low emission technologies.", eligibility: "Australian entity with project in green metals, renewable energy technology manufacturing, or low carbon liquid fuels. TRL 4+ typically required.", grant_type: "grant", category: "federal", url: "https://arena.gov.au/funding/future-made-in-australia-innovation-fund/" },
  { id: "g10", title: "Regional Economic Development Grants WA", source: "business.gov.au", amount_min: 25000, amount_max: 250000, amount_text: "$25,000–$250,000", states: ["WA"], industries: ["General", "Agriculture", "Tourism", "Manufacturing"], sizes: ["Small", "Medium"], status: "open", close_date: "Round-based", description: "Funding for businesses undertaking projects in regional Western Australia that contribute to economic growth in local communities.", eligibility: "Must be a legal entity operating in regional WA. Minimum 50% cash co-contribution required.", grant_type: "grant", category: "state", url: "https://business.gov.au/grants-and-programs/regional-economic-development-grants-wa" },
  { id: "g11", title: "Instant Asset Write-Off", source: "ato.gov.au", amount_min: 0, amount_max: 20000, amount_text: "Up to $20,000 per asset", states: ["National"], industries: ["General"], sizes: ["Small", "Startup", "Sole Trader"], status: "open", close_date: "30 June 2025 (may extend)", description: "Allows small businesses to immediately deduct the cost of eligible assets costing less than $20,000 each, rather than depreciating over time.", eligibility: "Small business with aggregated annual turnover under $10M. Asset must be first used or installed ready for use in the relevant income year.", grant_type: "tax_incentive", category: "federal", url: "https://www.ato.gov.au/businesses-and-organisations/income-deductions-and-concessions/depreciation-and-capital-expenses-and-allowances/simpler-depreciation-for-small-business" },
  { id: "g12", title: "Advance Queensland Industry Research Fellowships", source: "business.qld.gov.au", amount_min: 50000, amount_max: 200000, amount_text: "Up to $200,000", states: ["QLD"], industries: ["Technology", "Research", "Healthcare", "Manufacturing", "Energy"], sizes: ["Small", "Medium", "Startup"], status: "open", close_date: "Round-based", description: "Supports collaborative research between Queensland businesses and universities to drive innovation and solve industry challenges.", eligibility: "Queensland-based business partnering with a QLD university. Project must address an industry challenge with commercial potential.", grant_type: "grant", category: "state", url: "https://www.business.qld.gov.au/running-business/growing-business/becoming-innovative/grants" },
  { id: "g13", title: "SA Small Business Strategy Grant", source: "sa.gov.au", amount_min: 1000, amount_max: 5000, amount_text: "$1,000–$5,000", states: ["SA"], industries: ["General"], sizes: ["Small", "Startup", "Sole Trader"], status: "open", close_date: "Ongoing", description: "Helps South Australian small businesses access professional business advice and strategic planning support to strengthen their operations.", eligibility: "SA-based small business. Must use funding for professional advisory services from an approved provider.", grant_type: "grant", category: "state", url: "https://www.sa.gov.au/topics/business-and-trade/business-grants" },
  { id: "g14", title: "Defence Industry Development Grant", source: "business.gov.au", amount_min: 10000, amount_max: 50000, amount_text: "$10,000–$50,000", states: ["National"], industries: ["Defence", "Manufacturing", "Technology"], sizes: ["Small", "Medium"], status: "open", close_date: "Ongoing", description: "Supports small and medium Australian businesses operating in the defence sector to enhance their capabilities, capacity and security posture.", eligibility: "Australian SME operating in or seeking to enter the defence supply chain. Must demonstrate how grant will enhance defence capability.", grant_type: "grant", category: "federal", url: "https://business.gov.au/grants-and-programs" },
  { id: "g15", title: "NSW Small Business Fees and Charges Rebate", source: "nsw.gov.au", amount_min: 500, amount_max: 2000, amount_text: "Up to $2,000", states: ["NSW"], industries: ["General"], sizes: ["Small", "Startup", "Sole Trader"], status: "open", close_date: "Until funds exhausted", description: "Rebate for eligible NSW small businesses to offset the cost of NSW and local government fees and charges.", eligibility: "NSW small business with total Australian wages below the payroll tax threshold. Must have an ABN and NSW business address.", grant_type: "rebate", category: "state", url: "https://www.nsw.gov.au/grants-and-funding" },
  { id: "g16", title: "Business Victoria Energy Efficiency Grants", source: "business.vic.gov.au", amount_min: 5000, amount_max: 20000, amount_text: "$5,000–$20,000", states: ["VIC"], industries: ["General", "Manufacturing", "Retail", "Tourism"], sizes: ["Small", "Medium"], status: "open", close_date: "Round-based", description: "Helps Victorian businesses invest in energy-efficient equipment and processes to reduce energy costs and improve sustainability.", eligibility: "Victorian business with an ABN. Must demonstrate how funding will reduce energy consumption. Co-contribution may be required.", grant_type: "grant", category: "state", url: "https://business.vic.gov.au/grants-and-programs" },
];

// ========== MATCHING ALGORITHM ==========
function matchGrants(profile) {
  return GRANTS_DB
    .filter(g => g.status === "open")
    .map(grant => {
      let score = 0;
      let maxScore = 0;

      // State match (weight: 30)
      maxScore += 30;
      if (grant.states.includes("National")) score += 30;
      else if (grant.states.includes(profile.state)) score += 30;
      else score += 0;

      // Industry match (weight: 25)
      maxScore += 25;
      if (grant.industries.includes("General")) score += 20;
      if (grant.industries.some(i => profile.industries.includes(i))) score += 25;

      // Size match (weight: 20)
      maxScore += 20;
      if (grant.sizes.includes("General") || grant.sizes.some(s => profile.sizes.includes(s))) score += 20;

      // Revenue/amount relevance (weight: 15)
      maxScore += 15;
      if (grant.amount_max === 0 || !profile.revenue) score += 10;
      else if (grant.amount_max >= 10000 && profile.revenue === "under_500k") score += 15;
      else if (grant.amount_max >= 50000 && profile.revenue === "500k_2m") score += 15;
      else if (grant.amount_max >= 100000 && profile.revenue === "2m_10m") score += 15;
      else score += 8;

      // Purpose match (weight: 10)
      maxScore += 10;
      const purposeMap = { grow: ["General", "Manufacturing"], export: ["Export"], innovate: ["Technology", "Research"], hire: ["General"], equipment: ["General", "Manufacturing"], digital: ["Technology"], energy: ["Energy"], training: ["General"] };
      const relevantIndustries = profile.purposes?.flatMap(p => purposeMap[p] || []) || [];
      if (relevantIndustries.some(i => grant.industries.includes(i))) score += 10;
      else score += 5;

      const pct = Math.min(Math.round((score / maxScore) * 100), 98);
      return { ...grant, matchScore: pct };
    })
    .filter(g => g.matchScore > 30)
    .sort((a, b) => b.matchScore - a.matchScore);
}

// ========== QUIZ STEPS ==========
const QUIZ_STEPS = [
  { id: "state", title: "Where is your business based?", type: "single", options: [
    { value: "NSW", label: "New South Wales" }, { value: "VIC", label: "Victoria" },
    { value: "QLD", label: "Queensland" }, { value: "SA", label: "South Australia" },
    { value: "WA", label: "Western Australia" }, { value: "TAS", label: "Tasmania" },
    { value: "NT", label: "Northern Territory" }, { value: "ACT", label: "ACT" },
  ]},
  { id: "industries", title: "What industry are you in?", type: "multi", options: [
    { value: "Construction", label: "Construction & Trades" }, { value: "Technology", label: "Technology & Digital" },
    { value: "Manufacturing", label: "Manufacturing" }, { value: "Retail", label: "Retail & E-commerce" },
    { value: "Agriculture", label: "Agriculture & Food" }, { value: "Healthcare", label: "Healthcare" },
    { value: "Tourism", label: "Tourism & Hospitality" }, { value: "Energy", label: "Energy & Environment" },
    { value: "Defence", label: "Defence & Aerospace" }, { value: "Export", label: "Import/Export" },
    { value: "Research", label: "Research & Innovation" }, { value: "General", label: "Other / General" },
  ]},
  { id: "sizes", title: "How big is your business?", type: "single", options: [
    { value: "Sole Trader", label: "Just me (Sole Trader)" }, { value: "Startup", label: "Startup (pre-revenue or early stage)" },
    { value: "Small", label: "Small (1–19 employees)" }, { value: "Medium", label: "Medium (20–199 employees)" },
  ]},
  { id: "revenue", title: "What\u2019s your annual revenue?", type: "single", options: [
    { value: "pre_revenue", label: "Pre-revenue / Just starting" }, { value: "under_500k", label: "Under $500K" },
    { value: "500k_2m", label: "$500K – $2M" }, { value: "2m_10m", label: "$2M – $10M" }, { value: "over_10m", label: "$10M+" },
  ]},
  { id: "purposes", title: "What do you need funding for?", subtitle: "Select all that apply", type: "multi", options: [
    { value: "grow", label: "Grow my business" }, { value: "export", label: "Export to new markets" },
    { value: "innovate", label: "R&D / Innovation" }, { value: "hire", label: "Hire staff" },
    { value: "equipment", label: "Equipment / Assets" }, { value: "digital", label: "Go digital" },
    { value: "energy", label: "Energy efficiency" }, { value: "training", label: "Training & upskilling" },
  ]},
];

// ========== STYLES ==========
const colors = { navy: "#1B2A4A", teal: "#00897B", tealLight: "#E0F2F1", gold: "#F5A623", goldLight: "#FFF8E1", bg: "#F8FAFB", white: "#FFFFFF", gray100: "#F1F3F5", gray200: "#E9ECEF", gray400: "#ADB5BD", gray600: "#6C757D", gray800: "#343A40", red: "#E53E3E", green: "#38A169" };

// ========== MAIN APP ==========
export default function GrantMateApp() {
  const [view, setView] = useState("landing"); // landing, quiz, results, dashboard, drafter
  const [quizStep, setQuizStep] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [matchedGrants, setMatchedGrants] = useState([]);
  const [savedGrants, setSavedGrants] = useState([]);
  const [selectedGrant, setSelectedGrant] = useState(null);
  const [drafterGrant, setDrafterGrant] = useState(null);
  const [draft, setDraft] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [email, setEmail] = useState("");
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  // Load saved data
  useEffect(() => {
    (async () => {
      try {
        const saved = await window.storage.get("saved_grants");
        if (saved) setSavedGrants(JSON.parse(saved.value));
      } catch {}
      try {
        const profile = await window.storage.get("user_profile");
        if (profile) setUserProfile(JSON.parse(profile.value));
      } catch {}
      try {
        const alerts = await window.storage.get("alerts_email");
        if (alerts) { setEmail(alerts.value); setAlertsEnabled(true); }
      } catch {}
    })();
  }, []);

  // Save grants to storage
  const saveSavedGrants = useCallback(async (grants) => {
    setSavedGrants(grants);
    try { await window.storage.set("saved_grants", JSON.stringify(grants)); } catch {}
  }, []);

  const toggleSaveGrant = (grant) => {
    const exists = savedGrants.find(g => g.id === grant.id);
    if (exists) saveSavedGrants(savedGrants.filter(g => g.id !== grant.id));
    else saveSavedGrants([...savedGrants, grant]);
  };

  const isSaved = (grantId) => savedGrants.some(g => g.id === grantId);

  // Quiz logic
  const handleQuizAnswer = (stepId, value) => {
    const step = QUIZ_STEPS[quizStep];
    if (step.type === "multi") {
      const current = quizAnswers[stepId] || [];
      const updated = current.includes(value) ? current.filter(v => v !== value) : [...current, value];
      setQuizAnswers({ ...quizAnswers, [stepId]: updated });
    } else {
      setQuizAnswers({ ...quizAnswers, [stepId]: step.type === "single" ? value : [value] });
    }
  };

  const nextStep = () => {
    if (quizStep < QUIZ_STEPS.length - 1) setQuizStep(quizStep + 1);
    else finishQuiz();
  };

  const prevStep = () => { if (quizStep > 0) setQuizStep(quizStep - 1); };

  const finishQuiz = async () => {
    const profile = {
      state: quizAnswers.state,
      industries: quizAnswers.industries || [],
      sizes: Array.isArray(quizAnswers.sizes) ? quizAnswers.sizes : [quizAnswers.sizes],
      revenue: quizAnswers.revenue,
      purposes: quizAnswers.purposes || [],
    };
    setUserProfile(profile);
    try { await window.storage.set("user_profile", JSON.stringify(profile)); } catch {}
    const results = matchGrants(profile);
    setMatchedGrants(results);
    setView("results");
  };

  const canProceed = () => {
    const step = QUIZ_STEPS[quizStep];
    const answer = quizAnswers[step.id];
    if (!answer) return false;
    if (Array.isArray(answer)) return answer.length > 0;
    return true;
  };

  // AI Drafter
  const generateDraft = async (grant) => {
    setDrafterGrant(grant);
    setDraft("");
    setDrafting(true);
    setView("drafter");

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{
            role: "user",
            content: `You are a professional Australian grant application writer. Write a compelling first draft of a grant application for the following grant. Keep it professional, specific, and aligned with Australian government grant assessment criteria.

GRANT: ${grant.title}
DESCRIPTION: ${grant.description}
AMOUNT: ${grant.amount_text}
ELIGIBILITY: ${grant.eligibility}

APPLICANT PROFILE:
- State: ${userProfile?.state || "Not specified"}
- Industry: ${userProfile?.industries?.join(", ") || "General"}
- Business size: ${userProfile?.sizes?.join(", ") || "Small"}
- Funding purposes: ${userProfile?.purposes?.join(", ") || "Business growth"}

Write a draft that includes:
1. Project Overview (2-3 paragraphs)
2. Alignment with Grant Objectives
3. Expected Outcomes & Benefits
4. Budget Summary outline

Keep it under 500 words. Use a professional but approachable tone. Include placeholder brackets [like this] where the applicant needs to fill in specific details.`
          }]
        })
      });
      const data = await response.json();
      const text = data.content?.map(c => c.text || "").join("\n") || "Error generating draft. Please try again.";
      setDraft(text);
    } catch (err) {
      setDraft("Unable to generate draft right now. The AI service may be temporarily unavailable. Please try again in a moment.");
    }
    setDrafting(false);
  };

  // Enable alerts
  const enableAlerts = async () => {
    if (email && email.includes("@")) {
      setAlertsEnabled(true);
      try { await window.storage.set("alerts_email", email); } catch {}
    }
  };

  // ========== COMPONENTS ==========

  const Nav = () => (
    <nav style={{ background: colors.white, borderBottom: `1px solid ${colors.gray200}`, padding: "0 24px", position: "sticky", top: 0, zIndex: 100, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", height: 64 }}>
        <div onClick={() => setView("landing")} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg, ${colors.teal}, ${colors.navy})`, display: "flex", alignItems: "center", justifyContent: "center", color: colors.white, fontWeight: 800, fontSize: 18 }}>G</div>
          <span style={{ fontSize: 22, fontWeight: 800, color: colors.navy, letterSpacing: "-0.5px" }}>Grant<span style={{ color: colors.teal }}>Mate</span></span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {userProfile && (
            <>
              <button onClick={() => { setMatchedGrants(matchGrants(userProfile)); setView("results"); }} style={{ ...btnStyle, ...btnGhost }}>My Matches</button>
              <button onClick={() => setView("dashboard")} style={{ ...btnStyle, ...btnGhost, position: "relative" }}>
                Dashboard
                {savedGrants.length > 0 && <span style={{ position: "absolute", top: -4, right: -4, background: colors.gold, color: colors.navy, borderRadius: 99, width: 20, height: 20, fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{savedGrants.length}</span>}
              </button>
            </>
          )}
          <button onClick={() => { setQuizStep(0); setQuizAnswers({}); setView("quiz"); }} style={{ ...btnStyle, ...btnPrimary }}>Find Grants</button>
        </div>
      </div>
    </nav>
  );

  const GrantCard = ({ grant, showDrafter = true }) => (
    <div style={{ background: colors.white, borderRadius: 16, border: `1px solid ${colors.gray200}`, padding: 24, transition: "all 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            {grant.matchScore && <span style={{ background: grant.matchScore >= 70 ? "#E6F9F0" : grant.matchScore >= 50 ? colors.goldLight : colors.gray100, color: grant.matchScore >= 70 ? colors.green : grant.matchScore >= 50 ? "#B7791F" : colors.gray600, padding: "3px 10px", borderRadius: 99, fontSize: 12, fontWeight: 700 }}>{grant.matchScore}% match</span>}
            <span style={{ background: grant.status === "open" ? "#E6F9F0" : colors.gray100, color: grant.status === "open" ? colors.green : colors.gray600, padding: "3px 10px", borderRadius: 99, fontSize: 12, fontWeight: 600 }}>{grant.status === "open" ? "Open" : grant.status}</span>
            <span style={{ background: colors.tealLight, color: colors.teal, padding: "3px 10px", borderRadius: 99, fontSize: 12, fontWeight: 600 }}>{grant.grant_type === "tax_incentive" ? "Tax Incentive" : grant.grant_type === "loan" ? "Loan" : grant.grant_type === "rebate" ? "Rebate" : "Grant"}</span>
          </div>
          <h3 style={{ fontSize: 17, fontWeight: 700, color: colors.navy, margin: 0, lineHeight: 1.3 }}>{grant.title}</h3>
        </div>
        <button onClick={() => toggleSaveGrant(grant)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, padding: 4, color: isSaved(grant.id) ? colors.gold : colors.gray400, transition: "color 0.2s" }} title={isSaved(grant.id) ? "Remove from saved" : "Save grant"}>
          {isSaved(grant.id) ? "★" : "☆"}
        </button>
      </div>

      <p style={{ fontSize: 14, color: colors.gray600, margin: "0 0 12px", lineHeight: 1.5 }}>{grant.description}</p>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 13, color: colors.gray600, marginBottom: 16 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ color: colors.green, fontWeight: 700, fontSize: 15 }}>$</span> {grant.amount_text}</span>
        <span>📍 {grant.states.join(", ")}</span>
        <span>📅 {grant.close_date}</span>
        <span>🏢 {grant.source}</span>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <a href={grant.url} target="_blank" rel="noopener noreferrer" style={{ ...btnStyle, ...btnOutline, fontSize: 13, padding: "8px 16px", textDecoration: "none" }}>View Details ↗</a>
        {showDrafter && <button onClick={() => generateDraft(grant)} style={{ ...btnStyle, ...btnTeal, fontSize: 13, padding: "8px 16px" }}>✨ AI Draft Application</button>}
      </div>
    </div>
  );

  // ========== VIEWS ==========

  // LANDING
  if (view === "landing") return (
    <div style={{ minHeight: "100vh", background: colors.bg }}>
      <Nav />
      {/* Hero */}
      <div style={{ background: `linear-gradient(160deg, ${colors.navy} 0%, #2D4A7A 50%, ${colors.teal} 100%)`, padding: "80px 24px", textAlign: "center" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div style={{ display: "inline-block", background: "rgba(255,255,255,0.12)", borderRadius: 99, padding: "6px 18px", marginBottom: 24 }}>
            <span style={{ color: colors.gold, fontSize: 14, fontWeight: 600 }}>🇦🇺 Built for Australian businesses</span>
          </div>
          <h1 style={{ fontSize: "clamp(32px, 5vw, 52px)", fontWeight: 800, color: colors.white, margin: "0 0 20px", lineHeight: 1.15, letterSpacing: "-1px" }}>
            Stop missing out on<br /><span style={{ color: colors.gold }}>free money</span> for your business
          </h1>
          <p style={{ fontSize: 19, color: "rgba(255,255,255,0.85)", maxWidth: 560, margin: "0 auto 36px", lineHeight: 1.6 }}>
            GrantMate finds grants you're eligible for, tells you how much you could get, and helps you apply — in minutes, not months.
          </p>
          <button onClick={() => { setQuizStep(0); setQuizAnswers({}); setView("quiz"); }} style={{ ...btnStyle, background: colors.gold, color: colors.navy, fontSize: 18, fontWeight: 700, padding: "16px 40px", borderRadius: 14, boxShadow: "0 4px 14px rgba(245,166,35,0.4)", border: "none", cursor: "pointer", transition: "transform 0.2s" }}>
            Find My Grants →
          </button>
          <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 14, marginTop: 16 }}>Takes 60 seconds. No signup required.</p>
        </div>
      </div>

      {/* How it works */}
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "64px 24px" }}>
        <h2 style={{ textAlign: "center", fontSize: 28, fontWeight: 800, color: colors.navy, marginBottom: 48 }}>How GrantMate Works</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 32 }}>
          {[
            { icon: "📋", title: "Answer 5 quick questions", desc: "Tell us your state, industry, size, and what you need funding for." },
            { icon: "🎯", title: "Get matched instantly", desc: "Our AI scans 40+ government databases and scores each grant by eligibility." },
            { icon: "✨", title: "Draft your application", desc: "AI generates a first draft tailored to each grant's specific criteria." },
            { icon: "🔔", title: "Never miss a grant", desc: "Weekly alerts when new grants match your profile. Set and forget." },
          ].map((item, i) => (
            <div key={i} style={{ background: colors.white, borderRadius: 16, padding: 28, textAlign: "center", border: `1px solid ${colors.gray200}` }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>{item.icon}</div>
              <h3 style={{ fontSize: 17, fontWeight: 700, color: colors.navy, margin: "0 0 8px" }}>{item.title}</h3>
              <p style={{ fontSize: 14, color: colors.gray600, margin: 0, lineHeight: 1.5 }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div style={{ background: colors.navy, padding: "48px 24px" }}>
        <div style={{ maxWidth: 960, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 32, textAlign: "center" }}>
          {[
            { num: "$90B+", label: "Available in AU grants annually" },
            { num: "7,000+", label: "Active grant programs" },
            { num: "40+", label: "Government sources scraped" },
            { num: "60 sec", label: "To find your matches" },
          ].map((s, i) => (
            <div key={i}>
              <div style={{ fontSize: 32, fontWeight: 800, color: colors.gold }}>{s.num}</div>
              <div style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div style={{ textAlign: "center", padding: "64px 24px" }}>
        <h2 style={{ fontSize: 28, fontWeight: 800, color: colors.navy, marginBottom: 16 }}>Ready to find your grants?</h2>
        <p style={{ color: colors.gray600, marginBottom: 28, fontSize: 16 }}>Most Australian businesses are eligible for at least 3-5 grants. Find yours now.</p>
        <button onClick={() => { setQuizStep(0); setQuizAnswers({}); setView("quiz"); }} style={{ ...btnStyle, ...btnPrimary, fontSize: 17, padding: "14px 36px" }}>
          Start Free Match →
        </button>
      </div>

      <footer style={{ borderTop: `1px solid ${colors.gray200}`, padding: "24px", textAlign: "center", fontSize: 13, color: colors.gray400 }}>
        © 2026 GrantMate · Made in Australia 🇦🇺
      </footer>
    </div>
  );

  // QUIZ
  if (view === "quiz") {
    const step = QUIZ_STEPS[quizStep];
    const answer = quizAnswers[step.id];
    const progress = ((quizStep + 1) / QUIZ_STEPS.length) * 100;

    return (
      <div style={{ minHeight: "100vh", background: colors.bg }}>
        <Nav />
        <div style={{ maxWidth: 640, margin: "0 auto", padding: "40px 24px" }}>
          {/* Progress */}
          <div style={{ marginBottom: 40 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13, color: colors.gray600 }}>
              <span>Step {quizStep + 1} of {QUIZ_STEPS.length}</span>
              <span>{Math.round(progress)}% complete</span>
            </div>
            <div style={{ height: 6, background: colors.gray200, borderRadius: 99 }}>
              <div style={{ height: "100%", background: `linear-gradient(90deg, ${colors.teal}, ${colors.navy})`, borderRadius: 99, width: `${progress}%`, transition: "width 0.4s ease" }} />
            </div>
          </div>

          <h2 style={{ fontSize: 26, fontWeight: 800, color: colors.navy, marginBottom: 8 }}>{step.title}</h2>
          {step.subtitle && <p style={{ color: colors.gray600, marginBottom: 24, fontSize: 15 }}>{step.subtitle}</p>}
          {step.type === "multi" && !step.subtitle && <p style={{ color: colors.gray600, marginBottom: 24, fontSize: 15 }}>Select all that apply</p>}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12, marginBottom: 40 }}>
            {step.options.map(opt => {
              const isSelected = step.type === "multi"
                ? (answer || []).includes(opt.value)
                : answer === opt.value;
              return (
                <button key={opt.value} onClick={() => handleQuizAnswer(step.id, opt.value)} style={{
                  padding: "16px 20px", borderRadius: 12, border: `2px solid ${isSelected ? colors.teal : colors.gray200}`,
                  background: isSelected ? colors.tealLight : colors.white, cursor: "pointer", textAlign: "left",
                  fontSize: 15, fontWeight: isSelected ? 600 : 400, color: isSelected ? colors.teal : colors.gray800,
                  transition: "all 0.15s"
                }}>
                  {isSelected && <span style={{ marginRight: 6 }}>✓</span>}{opt.label}
                </button>
              );
            })}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <button onClick={quizStep === 0 ? () => setView("landing") : prevStep} style={{ ...btnStyle, ...btnGhost }}>
              ← Back
            </button>
            <button onClick={nextStep} disabled={!canProceed()} style={{ ...btnStyle, ...btnPrimary, opacity: canProceed() ? 1 : 0.4, cursor: canProceed() ? "pointer" : "not-allowed" }}>
              {quizStep === QUIZ_STEPS.length - 1 ? "Find My Grants ✨" : "Next →"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // RESULTS
  if (view === "results") return (
    <div style={{ minHeight: "100vh", background: colors.bg }}>
      <Nav />
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "40px 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <h1 style={{ fontSize: 30, fontWeight: 800, color: colors.navy, marginBottom: 8 }}>
            🎉 We found <span style={{ color: colors.teal }}>{matchedGrants.length} grants</span> for you
          </h1>
          <p style={{ color: colors.gray600, fontSize: 16 }}>
            Sorted by eligibility match. Save the ones you like and generate AI application drafts.
          </p>
        </div>

        {/* Alert signup */}
        {!alertsEnabled && (
          <div style={{ background: `linear-gradient(135deg, ${colors.navy}, ${colors.teal})`, borderRadius: 16, padding: 24, marginBottom: 32, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <h3 style={{ color: colors.white, fontSize: 16, fontWeight: 700, margin: "0 0 4px" }}>🔔 Get weekly grant alerts</h3>
              <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, margin: 0 }}>New matching grants delivered to your inbox every Monday.</p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input type="email" placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)} style={{ padding: "10px 14px", borderRadius: 10, border: "none", fontSize: 14, width: 200 }} />
              <button onClick={enableAlerts} style={{ ...btnStyle, background: colors.gold, color: colors.navy, fontWeight: 700, padding: "10px 20px" }}>Subscribe</button>
            </div>
          </div>
        )}
        {alertsEnabled && (
          <div style={{ background: "#E6F9F0", borderRadius: 12, padding: "12px 20px", marginBottom: 24, fontSize: 14, color: colors.green, fontWeight: 600 }}>
            ✅ Weekly alerts enabled for {email}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {matchedGrants.map(grant => <GrantCard key={grant.id} grant={grant} />)}
        </div>

        {matchedGrants.length === 0 && (
          <div style={{ textAlign: "center", padding: 60, color: colors.gray600 }}>
            <p style={{ fontSize: 40, marginBottom: 16 }}>🤔</p>
            <p style={{ fontSize: 16 }}>No strong matches found with your current profile. Try broadening your industry or purpose selections.</p>
            <button onClick={() => { setQuizStep(0); setView("quiz"); }} style={{ ...btnStyle, ...btnPrimary, marginTop: 16 }}>Retake Quiz</button>
          </div>
        )}
      </div>
    </div>
  );

  // DASHBOARD
  if (view === "dashboard") return (
    <div style={{ minHeight: "100vh", background: colors.bg }}>
      <Nav />
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "40px 24px" }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: colors.navy, marginBottom: 8 }}>Your Dashboard</h1>
        <p style={{ color: colors.gray600, marginBottom: 32, fontSize: 15 }}>Track your saved grants and manage applications.</p>

        {/* Stats cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16, marginBottom: 32 }}>
          {[
            { label: "Saved Grants", value: savedGrants.length, icon: "⭐" },
            { label: "Total Potential", value: savedGrants.length > 0 ? "$" + savedGrants.reduce((sum, g) => sum + (g.amount_max || 0), 0).toLocaleString() : "$0", icon: "💰" },
            { label: "Alerts", value: alertsEnabled ? "Active" : "Off", icon: "🔔" },
          ].map((card, i) => (
            <div key={i} style={{ background: colors.white, borderRadius: 14, padding: 20, border: `1px solid ${colors.gray200}` }}>
              <div style={{ fontSize: 24, marginBottom: 4 }}>{card.icon}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: colors.navy }}>{card.value}</div>
              <div style={{ fontSize: 13, color: colors.gray600 }}>{card.label}</div>
            </div>
          ))}
        </div>

        {/* Alert settings */}
        {!alertsEnabled && (
          <div style={{ background: colors.goldLight, border: `1px solid ${colors.gold}`, borderRadius: 12, padding: 20, marginBottom: 24 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: colors.navy, margin: "0 0 8px" }}>🔔 Enable Weekly Alerts</h3>
            <p style={{ fontSize: 13, color: colors.gray600, margin: "0 0 12px" }}>Get notified when new grants match your profile.</p>
            <div style={{ display: "flex", gap: 8 }}>
              <input type="email" placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)} style={{ padding: "8px 12px", borderRadius: 8, border: `1px solid ${colors.gray200}`, fontSize: 14, flex: 1 }} />
              <button onClick={enableAlerts} style={{ ...btnStyle, ...btnTeal, padding: "8px 16px" }}>Enable</button>
            </div>
          </div>
        )}

        <h2 style={{ fontSize: 20, fontWeight: 700, color: colors.navy, marginBottom: 16 }}>Saved Grants ({savedGrants.length})</h2>

        {savedGrants.length === 0 ? (
          <div style={{ textAlign: "center", padding: 48, background: colors.white, borderRadius: 16, border: `1px solid ${colors.gray200}` }}>
            <p style={{ fontSize: 36, marginBottom: 12 }}>☆</p>
            <p style={{ color: colors.gray600, fontSize: 15, marginBottom: 16 }}>No saved grants yet. Find grants and tap the star to save them here.</p>
            <button onClick={() => { if (userProfile) { setMatchedGrants(matchGrants(userProfile)); setView("results"); } else { setQuizStep(0); setView("quiz"); } }} style={{ ...btnStyle, ...btnPrimary }}>Find Grants</button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {savedGrants.map(grant => <GrantCard key={grant.id} grant={grant} />)}
          </div>
        )}
      </div>
    </div>
  );

  // AI DRAFTER
  if (view === "drafter") return (
    <div style={{ minHeight: "100vh", background: colors.bg }}>
      <Nav />
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "40px 24px" }}>
        <button onClick={() => setView("results")} style={{ ...btnStyle, ...btnGhost, marginBottom: 20 }}>← Back to results</button>

        <div style={{ background: `linear-gradient(135deg, ${colors.navy}, ${colors.teal})`, borderRadius: 16, padding: 28, marginBottom: 24 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <span style={{ background: "rgba(255,255,255,0.15)", color: colors.white, padding: "3px 10px", borderRadius: 99, fontSize: 12, fontWeight: 600 }}>{drafterGrant?.amount_text}</span>
            <span style={{ background: "rgba(255,255,255,0.15)", color: colors.white, padding: "3px 10px", borderRadius: 99, fontSize: 12, fontWeight: 600 }}>{drafterGrant?.states?.join(", ")}</span>
          </div>
          <h2 style={{ color: colors.white, fontSize: 22, fontWeight: 700, margin: "0 0 6px" }}>✨ AI Application Draft</h2>
          <p style={{ color: "rgba(255,255,255,0.8)", fontSize: 14, margin: 0 }}>{drafterGrant?.title}</p>
        </div>

        <div style={{ background: colors.white, borderRadius: 16, border: `1px solid ${colors.gray200}`, overflow: "hidden" }}>
          <div style={{ borderBottom: `1px solid ${colors.gray200}`, padding: "14px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: colors.navy }}>Application Draft</span>
            {draft && !drafting && (
              <button onClick={() => navigator.clipboard?.writeText(draft)} style={{ ...btnStyle, ...btnOutline, fontSize: 12, padding: "6px 14px" }}>📋 Copy</button>
            )}
          </div>
          <div style={{ padding: 24, minHeight: 300 }}>
            {drafting ? (
              <div style={{ textAlign: "center", padding: 48 }}>
                <div style={{ fontSize: 36, marginBottom: 16, animation: "spin 2s linear infinite" }}>✨</div>
                <p style={{ color: colors.gray600, fontSize: 15, fontWeight: 500 }}>Generating your application draft...</p>
                <p style={{ color: colors.gray400, fontSize: 13 }}>Our AI is crafting a tailored draft based on your profile and the grant criteria.</p>
                <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
              </div>
            ) : draft ? (
              <div style={{ whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.7, color: colors.gray800 }}>{draft}</div>
            ) : null}
          </div>
        </div>

        {draft && !drafting && (
          <div style={{ background: colors.goldLight, borderRadius: 12, padding: 20, marginTop: 20 }}>
            <h4 style={{ fontSize: 14, fontWeight: 700, color: colors.navy, margin: "0 0 6px" }}>💡 Next Steps</h4>
            <p style={{ fontSize: 13, color: colors.gray600, margin: 0, lineHeight: 1.6 }}>
              This is a first draft to get you started. Replace the [bracketed placeholders] with your specific details, review the eligibility criteria on the grant website, and consider having an accountant or advisor review before submitting.
            </p>
          </div>
        )}
      </div>
    </div>
  );

  return null;
}

// ========== SHARED STYLES ==========
const btnStyle = { borderRadius: 10, fontWeight: 600, fontSize: 14, border: "none", cursor: "pointer", transition: "all 0.15s", display: "inline-flex", alignItems: "center", justifyContent: "center" };
const btnPrimary = { background: "#00897B", color: "#fff", padding: "12px 24px", boxShadow: "0 2px 8px rgba(0,137,123,0.25)" };
const btnGhost = { background: "transparent", color: "#1B2A4A", padding: "10px 18px", border: "1px solid #E9ECEF" };
const btnOutline = { background: "transparent", color: "#00897B", padding: "10px 18px", border: "1px solid #00897B" };
const btnTeal = { background: "#00897B", color: "#fff", padding: "10px 18px" };

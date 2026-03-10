"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Nav from "@/components/Nav";
import { QUIZ_STEPS } from "@/lib/grants-data";
import { createClient } from "@/lib/supabase";
import type { UserProfile } from "@/lib/types";

type QuizAnswers = {
  state?: string;
  industries?: string[];
  sizes?: string;
  business_age?: string;
  revenue?: string;
  purposes?: string[];
  activities?: string[];
};

const INDUSTRY_MAP: Record<string, string> = {
  "Agriculture & Farming": "Agriculture",
  "Arts & Culture": "Arts",
  "Construction & Trades": "Construction",
  "Education & Training": "General",
  "Finance & Accounting": "General",
  "Food & Beverage": "Agriculture",
  "Healthcare & Allied Health": "Healthcare",
  "Hospitality & Tourism": "Tourism",
  "IT & Technology": "Technology",
  "Manufacturing": "Manufacturing",
  "Mining & Resources": "Mining",
  "Professional Services": "General",
  "Property & Real Estate": "General",
  "Retail & E-commerce": "Retail",
  "Social Enterprise & Nonprofit": "General",
  "Transport & Logistics": "General",
  "Other": "General",
};

const SIZE_MAP: Record<string, string> = {
  "Just me": "Sole Trader",
  "2–5": "Small",
  "6–19": "Small",
  "20–49": "Medium",
  "50–199": "Medium",
  "200+": "Medium",
};

const REVENUE_MAP: Record<string, string> = {
  "Pre-revenue": "pre_revenue",
  "Under $100K": "under_500k",
  "$100K – $500K": "under_500k",
  "$500K – $2M": "500k_2m",
  "$2M – $10M": "2m_10m",
  "$10M – $20M": "over_10m",
  "$20M+": "over_10m",
};

const FUNDING_MAP: Record<string, string> = {
  "Research & Development": "innovate",
  "Hiring & Training": "hire",
  "Equipment & Machinery": "equipment",
  "Export & Trade": "export",
  "Sustainability & Environment": "energy",
  "Digital Transformation": "digital",
  "Facilities & Fit–out": "grow",
  "Marketing & Branding": "grow",
  "Community Impact": "grow",
  "Innovation & Commercialisation": "innovate",
};

const DEMO_MAP: Record<string, string> = {
  "Indigenous-owned (Aboriginal or Torres Strait Islander)": "indigenous",
  "Women-owned or led": "women_led",
  "Regional / Rural business": "regional",
};

export default function QuizPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswers>({});
  const [prefilled, setPrefilled] = useState(false);

  useEffect(() => {
    // If quiz already completed (localStorage has answers), skip straight to results
    const existing = localStorage.getItem("fundii_profile");
    if (existing) {
      router.replace("/results");
      return;
    }

    // Otherwise try to pre-fill from saved Supabase profile
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("state, industries, business_size, revenue_range, funding_purposes")
        .eq("id", user.id)
        .single();
      if (!profile) return;

      const mapped: QuizAnswers = {};

      if (profile.state) mapped.state = profile.state as string;
      if (Array.isArray(profile.industries) && profile.industries.length) {
        mapped.industries = profile.industries as string[];
      }
      if (profile.business_size) mapped.sizes = profile.business_size as string;
      if (profile.revenue_range) mapped.revenue = profile.revenue_range as string;
      if (Array.isArray(profile.funding_purposes) && profile.funding_purposes.length) {
        mapped.purposes = profile.funding_purposes as string[];
      }

      if (Object.keys(mapped).length > 0) {
        setAnswers(mapped);
        setPrefilled(true);
      }
    });
  }, [router]);

  const currentStep = QUIZ_STEPS[step];
  const progress = ((step + 1) / QUIZ_STEPS.length) * 100;

  const getAnswer = () => answers[currentStep.id as keyof QuizAnswers];

  const handleSelect = (value: string) => {
    if (currentStep.type === "multi") {
      const current = (answers[currentStep.id as keyof QuizAnswers] as string[] | undefined) ?? [];
      const updated = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      setAnswers({ ...answers, [currentStep.id]: updated });
    } else {
      setAnswers({ ...answers, [currentStep.id]: value });
    }
  };

  const canProceed = () => {
    if (currentStep.id === "activities") return true; // optional step
    if (currentStep.id === "business_age") return !!answers.business_age;
    const answer = getAnswer();
    if (!answer) return false;
    if (Array.isArray(answer)) return answer.length > 0;
    return true;
  };

  const handleNext = () => {
    if (step < QUIZ_STEPS.length - 1) {
      setStep(step + 1);
    } else {
      finishQuiz();
    }
  };

  const finishQuiz = async () => {
    const profile: UserProfile = {
      state: answers.state ?? "",
      industries: answers.industries ?? [],
      sizes: answers.sizes ? [answers.sizes] : [],
      business_age: answers.business_age,
      revenue: answers.revenue ?? "",
      purposes: answers.purposes ?? [],
      activities: (answers.activities ?? []).filter((a) => a !== "none"),
    };
    localStorage.setItem("fundii_profile", JSON.stringify(profile));

    // Persist to Supabase so answers survive across devices/sessions
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("profiles").upsert({
        id: user.id,
        state: profile.state || null,
        industries: profile.industries,
        business_size: profile.sizes[0] ?? null,
        revenue_range: profile.revenue || null,
        funding_purposes: profile.purposes,
      }, { onConflict: "id" });
    }

    router.push("/results");
  };

  const isSelected = (value: string) => {
    const answer = getAnswer();
    if (!answer) return false;
    if (Array.isArray(answer)) return answer.includes(value);
    return answer === value;
  };

  return (
    <div className="min-h-screen bg-[#FAF8F4]">
      <Nav />
      <div className="max-w-2xl mx-auto px-6 py-12">
        {/* Pre-fill notice */}
        {prefilled && (
          <div className="mb-6 flex items-center gap-3 px-4 py-3 bg-teal-50 border border-teal-200 rounded-xl text-sm text-teal-700">
            <span>✓</span>
            <span>Pre-filled from your profile — review each step and update if needed.</span>
          </div>
        )}

        {/* Progress */}
        <div className="mb-12">
          <div className="flex justify-between text-sm text-gray-500 mb-2.5">
            <span>
              Step {step + 1} of {QUIZ_STEPS.length}
            </span>
            <span>{Math.round(progress)}% complete</span>
          </div>
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${progress}%`, background: "#0F7B6C" }}
            />
          </div>
        </div>

        {/* Question */}
        <h2 className="text-3xl font-extrabold mb-3 text-[#1A1A2E]">
          {currentStep.title}
        </h2>
        {currentStep.subtitle ? (
          <p className="text-gray-500 mb-8">{currentStep.subtitle}</p>
        ) : currentStep.type === "multi" ? (
          <p className="text-gray-500 mb-8">Select all that apply</p>
        ) : null}

        {/* Options */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-12">
          {currentStep.options.map((opt) => {
            const selected = isSelected(opt.value);
            return (
              <button
                key={opt.value}
                onClick={() => handleSelect(opt.value)}
                className="text-left px-5 py-4 rounded-xl border-2 transition-all font-medium text-base"
                style={{
                  borderColor: selected ? "#0F7B6C" : "#E9ECEF",
                  background: selected ? "#E6F5F2" : "#fff",
                  color: selected ? "#0F7B6C" : "#343A40",
                  fontWeight: selected ? 600 : 400,
                }}
              >
                {selected && <span className="mr-2">✓</span>}
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Navigation */}
        <div className="flex justify-between">
          <button
            onClick={() => (step === 0 ? router.push("/") : setStep(step - 1))}
            className="px-6 py-3 rounded-xl border border-gray-200 font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            ← Back
          </button>
          <button
            onClick={handleNext}
            disabled={!canProceed()}
            className="px-8 py-3 rounded-xl font-bold text-white transition-all"
            style={{
              background: "#0F7B6C",
              opacity: canProceed() ? 1 : 0.4,
              cursor: canProceed() ? "pointer" : "not-allowed",
            }}
          >
            {step === QUIZ_STEPS.length - 1 ? "Find My Grants ✨" : "Next →"}
          </button>
        </div>
      </div>
    </div>
  );
}

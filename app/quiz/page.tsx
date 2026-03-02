"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Nav from "@/components/Nav";
import { QUIZ_STEPS } from "@/lib/grants-data";
import type { UserProfile } from "@/lib/types";

type QuizAnswers = {
  state?: string;
  industries?: string[];
  sizes?: string;
  revenue?: string;
  purposes?: string[];
};

export default function QuizPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswers>({});

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

  const finishQuiz = () => {
    const profile: UserProfile = {
      state: answers.state ?? "",
      industries: answers.industries ?? [],
      sizes: answers.sizes ? [answers.sizes] : [],
      revenue: answers.revenue ?? "",
      purposes: answers.purposes ?? [],
    };
    localStorage.setItem("fundii_profile", JSON.stringify(profile));
    router.push("/results");
  };

  const isSelected = (value: string) => {
    const answer = getAnswer();
    if (!answer) return false;
    if (Array.isArray(answer)) return answer.includes(value);
    return answer === value;
  };

  return (
    <div className="min-h-screen bg-[#F8FAFB]">
      <Nav />
      <div className="max-w-2xl mx-auto px-6 py-12">
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
              style={{
                width: `${progress}%`,
                background: "linear-gradient(90deg, #00897B, #1B2A4A)",
              }}
            />
          </div>
        </div>

        {/* Question */}
        <h2 className="text-3xl font-extrabold mb-3" style={{ color: "#1B2A4A" }}>
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
                  borderColor: selected ? "#00897B" : "#E9ECEF",
                  background: selected ? "#E0F2F1" : "#fff",
                  color: selected ? "#00897B" : "#343A40",
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
              background: "#00897B",
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

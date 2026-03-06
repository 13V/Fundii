"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

const PLANS = {
  starter: {
    name: "Starter",
    price: "$99",
    period: "/mo",
    features: ["Full grant matching (3,900+ programs)", "Weekly email alerts", "Save & track up to 20 grants", "Eligibility summaries", "Deadline reminders"],
  },
  growth: {
    name: "Growth",
    price: "$229",
    period: "/mo",
    features: ["Everything in Starter", "AI-drafted applications (10/mo)", "Daily grant alerts", "Unlimited saved grants", "Application progress tracker"],
  },
  enterprise: {
    name: "Enterprise",
    price: "$499",
    period: "/mo",
    features: ["Everything in Growth", "Unlimited AI drafts", "Multi-user access (5 seats)", "Dedicated account manager", "White-label reports"],
  },
};

function SignupForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const planKey = (searchParams.get("plan") ?? "growth") as keyof typeof PLANS;
  const plan = PLANS[planKey] ?? PLANS.growth;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    // Create account
    const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    const userId = data.user?.id;

    // Go to Stripe checkout
    const res = await fetch("/api/create-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: planKey, userId, email }),
    });

    const { url, error: checkoutError } = await res.json();
    if (checkoutError || !url) {
      setError(checkoutError ?? "Failed to start checkout. Please try again.");
      setLoading(false);
      return;
    }

    window.location.href = url;
  };

  return (
    <div className="min-h-screen bg-[#FAF8F4] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-4xl grid sm:grid-cols-2 gap-8">

        {/* Plan summary */}
        <div className="bg-white border border-gray-200 rounded-2xl p-8 flex flex-col">
          <p className="text-xs font-bold tracking-widest text-[#0F7B6C] uppercase mb-2">Your plan</p>
          <h2 className="text-3xl font-bold text-[#1A1A2E] mb-1">{plan.name}</h2>
          <div className="flex items-end gap-1 mb-6">
            <span className="text-4xl font-extrabold text-[#1A1A2E]">{plan.price}</span>
            <span className="text-gray-400 mb-1">{plan.period}</span>
          </div>
          <ul className="flex flex-col gap-3 flex-1">
            {plan.features.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                <svg className="flex-shrink-0 mt-0.5" width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="7" fill="#E6F5F2" />
                  <path d="M5 8L7 10L11 6" stroke="#0F7B6C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {f}
              </li>
            ))}
          </ul>
          <div className="mt-6 pt-6 border-t border-gray-100 flex gap-3 text-sm">
            {Object.entries(PLANS).map(([key, p]) => (
              <Link
                key={key}
                href={`/signup?plan=${key}`}
                className={`px-3 py-1.5 rounded-lg font-semibold no-underline transition-colors ${
                  key === planKey
                    ? "bg-[#0F7B6C] text-white"
                    : "text-gray-500 hover:text-gray-800"
                }`}
              >
                {p.name}
              </Link>
            ))}
          </div>
        </div>

        {/* Signup form */}
        <div className="bg-white border border-gray-200 rounded-2xl p-8">
          <h1 className="text-2xl font-bold text-[#1A1A2E] mb-1">Create your account</h1>
          <p className="text-gray-500 text-sm mb-6">
            Then you&apos;ll be taken to secure checkout to complete your subscription.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@business.com.au"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#0F7B6C] focus:ring-2 focus:ring-[#E6F5F2]"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password</label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#0F7B6C] focus:ring-2 focus:ring-[#E6F5F2]"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl font-bold text-white text-sm transition-colors disabled:opacity-60"
              style={{ background: loading ? "#6b7280" : "#0F7B6C" }}
            >
              {loading ? "Creating account…" : `Continue to payment →`}
            </button>
          </form>

          <p className="text-xs text-gray-400 text-center mt-4">
            By signing up you agree to our terms. Cancel anytime — no lock-in.
          </p>
          <p className="text-sm text-center text-gray-500 mt-3">
            Already have an account?{" "}
            <Link href="/login" className="text-[#0F7B6C] font-semibold no-underline hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}

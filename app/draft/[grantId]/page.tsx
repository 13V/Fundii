"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Nav from "@/components/Nav";
import { createClient } from "@/lib/supabase";
import type { Grant, UserProfile } from "@/lib/types";

const TYPE_LABELS: Record<string, string> = {
  grant: "Grant",
  loan: "Loan",
  rebate: "Rebate",
  tax_incentive: "Tax Incentive",
  voucher: "Voucher",
  subsidy: "Subsidy",
};

export default function DraftPage() {
  const { grantId } = useParams<{ grantId: string }>();
  const router = useRouter();

  const [grant, setGrant] = useState<Grant | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const init = async () => {
      // Load grant from Supabase
      const supabase = createClient();
      const { data } = await supabase
        .from("grants")
        .select("id, title, source, source_url, amount_min, amount_max, amount_text, states, industries, business_sizes, status, close_date, description, eligibility, grant_type, category, url")
        .eq("id", grantId)
        .single();

      if (!data) { router.push("/results"); return; }
      setGrant({ ...(data as Omit<Grant, "sizes">), sizes: (data.business_sizes as string[]) ?? [] });

      const raw = localStorage.getItem("fundii_profile");
      if (raw) setProfile(JSON.parse(raw));
    };
    init();
  }, [grantId]);

  const generateDraft = async () => {
    if (!grant) return;
    setLoading(true);
    setDraft("");
    setError("");

    try {
      // Pass auth token so server can verify plan
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (session?.access_token) headers["Authorization"] = `Bearer ${session.access_token}`;

      const res = await fetch("/api/draft", {
        method: "POST",
        headers,
        body: JSON.stringify({ grantId: grant.id, profile }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
      } else {
        setDraft(data.draft);
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
    }
    setLoading(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(draft).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (!grant) {
    return (
      <div className="min-h-screen bg-[#F8FAFB]">
        <Nav />
        <div className="flex items-center justify-center py-32">
          <div className="text-gray-400 text-lg">Loading…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFB]">
      <Nav />

      <div className="max-w-3xl mx-auto px-6 py-12">
        {/* Back */}
        <Link
          href="/results"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-600 hover:text-gray-900 mb-8 no-underline"
        >
          ← Back to results
        </Link>

        {/* Grant header */}
        <div
          className="rounded-2xl p-7 mb-6"
          style={{ background: "linear-gradient(135deg, #1B2A4A, #00897B)" }}
        >
          <div className="flex gap-2 mb-3">
            <span className="text-xs font-semibold bg-white/15 text-white rounded-full px-3 py-0.5">
              {grant.amount_text}
            </span>
            <span className="text-xs font-semibold bg-white/15 text-white rounded-full px-3 py-0.5">
              {grant.states.join(", ")}
            </span>
            <span className="text-xs font-semibold bg-white/15 text-white rounded-full px-3 py-0.5">
              {TYPE_LABELS[grant.grant_type] ?? grant.grant_type}
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-white mb-1">✨ AI Application Draft</h1>
          <p className="text-white/80 text-sm">{grant.title}</p>
          <p className="text-white/60 text-xs mt-1">Source: {grant.source}</p>
        </div>

        {/* Profile summary */}
        {profile && (
          <div className="bg-white rounded-xl border border-gray-200 px-5 py-4 mb-6 text-sm text-gray-600 flex flex-wrap gap-4">
            <span>📍 {profile.state}</span>
            <span>🏢 {profile.industries.join(", ") || "General"}</span>
            <span>👥 {profile.sizes.join(", ")}</span>
            <span>💰 {profile.revenue}</span>
            <Link href="/quiz" className="text-teal-600 font-semibold hover:underline no-underline ml-auto">
              Edit profile →
            </Link>
          </div>
        )}

        {/* Draft card */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-6">
          {/* Toolbar */}
          <div
            className="flex justify-between items-center px-6 py-4 border-b border-gray-100"
          >
            <span className="text-sm font-bold text-navy">Application Draft</span>
            {draft && !loading && (
              <button
                onClick={handleCopy}
                className="text-sm font-semibold px-4 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
              >
                {copied ? "✓ Copied!" : "📋 Copy"}
              </button>
            )}
          </div>

          {/* Content */}
          <div className="px-6 py-6 min-h-[300px]">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="text-5xl mb-5 animate-spin">✨</div>
                <p className="text-gray-700 font-semibold text-lg mb-2">
                  Generating your application draft…
                </p>
                <p className="text-gray-400 text-sm max-w-sm">
                  Our AI is crafting a tailored draft based on your profile and the grant&apos;s
                  specific criteria.
                </p>
              </div>
            ) : draft ? (
              <div className="prose prose-sm max-w-none text-gray-800 leading-relaxed whitespace-pre-wrap">
                {draft}
              </div>
            ) : error ? (
              <div className="py-12 text-center">
                <p className="text-red-600 font-semibold mb-4">{error}</p>
                {error.includes("Growth") || error.includes("upgrade") || error.includes("Upgrade") ? (
                  <Link href="/signup?plan=growth"
                    className="inline-block px-6 py-3 rounded-xl text-white font-bold text-sm no-underline"
                    style={{ background: "#0F7B6C" }}>
                    Upgrade to Growth →
                  </Link>
                ) : (
                  <button onClick={generateDraft}
                    className="px-6 py-3 rounded-xl bg-teal-500 text-white font-bold text-sm hover:bg-teal-600">
                    Try Again
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <p className="text-4xl mb-4">📄</p>
                <p className="text-gray-600 mb-6 text-base">
                  Ready to generate your application draft for{" "}
                  <strong>{grant.title}</strong>.
                </p>
                <button
                  onClick={generateDraft}
                  className="px-8 py-4 rounded-xl text-white font-bold text-base transition-colors"
                  style={{ background: "#00897B" }}
                >
                  ✨ Generate Application Draft
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Next steps tip */}
        {draft && !loading && (
          <div
            className="rounded-xl p-5"
            style={{ background: "#FFF8E1", border: "1px solid #F5A623" }}
          >
            <h4 className="font-bold text-sm mb-2" style={{ color: "#1B2A4A" }}>
              💡 Next Steps
            </h4>
            <p className="text-sm text-gray-600 leading-relaxed">
              This is a first draft to get you started. Replace the{" "}
              <span className="font-mono bg-yellow-100 px-1 rounded">[PLACEHOLDER]</span> fields
              with your specific details, review the eligibility criteria on the grant website, and
              consider having an accountant or advisor review before submitting.
            </p>
            <a
              href={grant.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-3 text-sm font-semibold text-teal-600 hover:underline no-underline"
            >
              View official grant page ↗
            </a>
          </div>
        )}

        {/* Regenerate */}
        {draft && !loading && (
          <div className="text-center mt-6">
            <button
              onClick={generateDraft}
              className="text-sm font-semibold text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-4 py-2 hover:bg-gray-50"
            >
              ↺ Regenerate draft
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

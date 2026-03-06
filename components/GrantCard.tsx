"use client";

import Link from "next/link";
import { useState } from "react";
import type { MatchedGrant, SavedGrant } from "@/lib/types";

interface GrantCardProps {
  grant: MatchedGrant | SavedGrant;
  showDrafter?: boolean;
  canDraft?: boolean;
  onToggleSave?: (grant: MatchedGrant) => void;
  isSaved?: boolean;
}

const TYPE_LABELS: Record<string, string> = {
  grant: "Grant",
  loan: "Loan",
  rebate: "Rebate",
  tax_incentive: "Tax Incentive",
  voucher: "Voucher",
  subsidy: "Subsidy",
  scholarship: "Scholarship",
};

export default function GrantCard({
  grant,
  showDrafter = true,
  canDraft = true,
  onToggleSave,
  isSaved = false,
}: GrantCardProps) {
  const score = (grant as MatchedGrant).matchScore;
  const [animating, setAnimating] = useState(false);

  const handleSave = () => {
    if (!onToggleSave) return;
    setAnimating(true);
    setTimeout(() => setAnimating(false), 400);
    onToggleSave(grant as MatchedGrant);
  };

  const scoreColor =
    score >= 70
      ? "bg-green-100 text-green-700"
      : score >= 50
      ? "bg-yellow-100 text-yellow-700"
      : "bg-gray-100 text-gray-600";

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
      {/* Header row */}
      <div className="flex justify-between items-start gap-4 mb-3">
        <div className="flex-1">
          {/* Badges */}
          <div className="flex flex-wrap gap-2 mb-2">
            {score !== undefined && (
              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${scoreColor}`}>
                {score}% match
              </span>
            )}
            <span
              className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                grant.status === "open" || grant.status === "ongoing"
                  ? "bg-green-100 text-green-700"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              {grant.status === "open" || grant.status === "ongoing" ? "Open" : grant.status}
            </span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-600">
              {TYPE_LABELS[grant.grant_type] ?? grant.grant_type}
            </span>
          </div>

          <h3 className="text-base font-bold text-navy leading-snug">{grant.title}</h3>
        </div>

        {/* Save button */}
        {onToggleSave && (
          <button
            onClick={handleSave}
            className="text-2xl flex-shrink-0 transition-colors"
            style={{
              color: isSaved ? "#F5A623" : "#ADB5BD",
              transform: animating ? "scale(1.5)" : "scale(1)",
              transition: "transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), color 0.2s ease",
            }}
            title={isSaved ? "Remove from saved" : "Save grant"}
          >
            {isSaved ? "★" : "☆"}
          </button>
        )}
      </div>

      <p className="text-sm text-gray-600 mb-3 leading-relaxed">{grant.description}</p>

      {/* Meta row */}
      <div className="flex flex-wrap gap-4 text-sm text-gray-500 mb-4">
        <span className="flex items-center gap-1">
          <span className="text-green-600 font-bold">$</span>
          {grant.amount_text}
        </span>
        <span>📍 {grant.states.join(", ")}</span>
        <span>📅 {grant.close_date}</span>
        <span>🏢 {grant.source}</span>
      </div>

      {/* Eligibility */}
      {grant.eligibility && (
        <div className="bg-gray-50 rounded-lg px-3 py-2 mb-4 text-xs text-gray-600 leading-relaxed">
          <span className="font-semibold text-gray-700">Eligibility: </span>
          {grant.eligibility}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <a
          href={grant.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-semibold px-4 py-2 rounded-lg border border-teal-500 text-teal-600 hover:bg-teal-50 transition-colors no-underline"
        >
          View Details ↗
        </a>
        {showDrafter && (
          canDraft ? (
            <Link
              href={`/draft/${grant.id}`}
              className="text-sm font-semibold px-4 py-2 rounded-lg bg-teal-500 text-white hover:bg-teal-600 transition-colors no-underline"
            >
              ✨ AI Draft Application
            </Link>
          ) : (
            <Link
              href="/signup?plan=growth"
              className="text-sm font-semibold px-4 py-2 rounded-lg border border-[#0F7B6C] text-[#0F7B6C] hover:bg-[#E6F5F2] transition-colors no-underline"
            >
              Upgrade to Draft ↗
            </Link>
          )
        )}
      </div>
    </div>
  );
}

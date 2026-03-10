"use client";

import Link from "next/link";
import { useState } from "react";
import type { MatchBreakdown, MatchedGrant, SavedGrant } from "@/lib/types";

interface GrantCardProps {
  grant: MatchedGrant | SavedGrant;
  showDrafter?: boolean;
  canDraft?: boolean;
  onToggleSave?: (grant: MatchedGrant) => void;
  isSaved?: boolean;
  onTrack?: (grant: MatchedGrant) => void;
  isTracked?: boolean;
}

function daysUntilClose(closeDate: string): number | null {
  if (!closeDate || closeDate === "See website" || closeDate === "Ongoing" || closeDate === "Round-based") return null;
  // Try ISO format first (2025-06-30), then common AU formats
  const parsed = new Date(closeDate);
  if (isNaN(parsed.getTime())) return null;
  const diff = Math.ceil((parsed.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return diff >= 0 && diff <= 365 ? diff : null; // only show if ≤1 year away
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

function BreakdownBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.round((value / max) * 100);
  const isGood = value >= max * 0.8;
  const isMid = value >= max * 0.4;
  const color = isGood ? "#0F7B6C" : isMid ? "#F5A623" : "#E5E7EB";
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-16 text-gray-500 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div style={{ width: `${pct}%`, background: color, height: "100%", borderRadius: 9999, transition: "width 0.4s ease" }} />
      </div>
      <span className="w-8 text-right font-semibold" style={{ color: isGood ? "#0F7B6C" : isMid ? "#B87B0A" : "#9CA3AF" }}>
        {value}/{max}
      </span>
    </div>
  );
}

export default function GrantCard({
  grant,
  showDrafter = true,
  canDraft = true,
  onToggleSave,
  isSaved = false,
  onTrack,
  isTracked = false,
}: GrantCardProps) {
  const score = (grant as MatchedGrant).matchScore;
  const breakdown = (grant as MatchedGrant).matchBreakdown as MatchBreakdown | undefined;
  const [animating, setAnimating] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const daysLeft = daysUntilClose(grant.close_date ?? "");

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
              <button
                onClick={() => setShowBreakdown(!showBreakdown)}
                className={`text-xs font-bold px-2.5 py-0.5 rounded-full cursor-pointer hover:opacity-80 transition-opacity ${scoreColor}`}
                title="See match breakdown"
              >
                {score}% match {breakdown ? (showBreakdown ? "▲" : "▼") : ""}
              </button>
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
            {daysLeft !== null && daysLeft <= 30 && (
              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                daysLeft <= 7 ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"
              }`}>
                ⏰ {daysLeft === 0 ? "Closes today" : daysLeft === 1 ? "1 day left" : `${daysLeft} days left`}
              </span>
            )}
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

      {showBreakdown && breakdown && (
        <div className="bg-gray-50 rounded-xl px-4 py-3 mb-3 flex flex-col gap-1.5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Why this matched</p>
          <BreakdownBar label="Location" value={breakdown.state}    max={30} />
          <BreakdownBar label="Industry" value={breakdown.industry}  max={25} />
          <BreakdownBar label="Size"     value={breakdown.size}      max={20} />
          <BreakdownBar label="Amount"   value={breakdown.revenue}   max={15} />
          <BreakdownBar label="Purpose"  value={breakdown.purpose}   max={10} />
        </div>
      )}

      <p className="text-sm text-gray-600 mb-3 leading-relaxed">{grant.description}</p>

      {/* Meta row */}
      <div className="flex flex-wrap gap-4 text-sm text-gray-500 mb-4">
        <span className="flex items-center gap-1">
          <span className="text-green-600 font-bold">$</span>
          {grant.amount_text}
        </span>
        <span>📍 {grant.states.join(", ")}</span>
        {grant.close_date && grant.close_date !== "See website" && (
          <span>📅 Closes {grant.close_date}</span>
        )}
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
        <Link
          href={`/dashboard/grant/${grant.id}`}
          className="text-sm font-semibold px-4 py-2 rounded-lg border border-teal-500 text-teal-600 hover:bg-teal-50 transition-colors no-underline"
        >
          View Details →
        </Link>
        {grant.url && (
          <a
            href={grant.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium px-3 py-2 rounded-lg text-gray-400 hover:text-gray-600 transition-colors no-underline"
          >
            Official site ↗
          </a>
        )}
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
        {onTrack && (
          <button
            onClick={() => onTrack(grant as MatchedGrant)}
            className="text-sm font-semibold px-4 py-2 rounded-lg border transition-colors"
            style={{
              borderColor: isTracked ? "#0F7B6C" : "#E5E7EB",
              background: isTracked ? "#E6F5F2" : "#fff",
              color: isTracked ? "#0F7B6C" : "#6B7280",
            }}
            title={isTracked ? "Remove from tracker" : "Add to application tracker"}
          >
            {isTracked ? "✓ Tracked" : "📋 Track"}
          </button>
        )}
      </div>
    </div>
  );
}

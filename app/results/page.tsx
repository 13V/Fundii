"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Nav from "@/components/Nav";
import GrantCard from "@/components/GrantCard";
import AuthModal from "@/components/AuthModal";
import { createClient } from "@/lib/supabase";
import type { MatchedGrant, UserProfile } from "@/lib/types";
import type { User } from "@supabase/supabase-js";

export default function ResultsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [matches, setMatches] = useState<MatchedGrant[]>([]);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [trackedIds, setTrackedIds] = useState<Set<string>>(new Set());
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [pendingSaveId, setPendingSaveId] = useState<string | null>(null);
  const [alertEmail, setAlertEmail] = useState("");
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [alertLoading, setAlertLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<string | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem("fundii_profile");
    if (!raw) { setLoading(false); return; }

    const p: UserProfile = JSON.parse(raw);
    setProfile(p);

    fetch("/api/grants/match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile: p }),
    })
      .then((res) => res.json())
      .then(({ matches }) => { if (matches) setMatches(matches); })
      .finally(() => setLoading(false));

    const savedRaw = localStorage.getItem("fundii_saved");
    if (savedRaw) {
      const savedGrants = JSON.parse(savedRaw) as MatchedGrant[];
      setSaved(new Set<string>(savedGrants.map((g) => g.id)));
    }

    supabase.auth.getUser().then(async ({ data }) => {
      setUser(data.user);
      if (data.user) {
        const { data: prof } = await supabase
          .from("profiles").select("plan").eq("id", data.user.id).single();
        setPlan(prof?.plan ?? null);

        const { data: dbSaved } = await supabase
          .from("saved_grants").select("grant_id").eq("user_id", data.user.id);
        if (dbSaved?.length) {
          const ids = new Set(dbSaved.map((r: { grant_id: string }) => r.grant_id));
          setSaved(prev => new Set([...prev, ...ids]));
        }

        const { data: tracked } = await supabase
          .from("application_tracker").select("grant_id").eq("user_id", data.user.id);
        if (tracked?.length) {
          setTrackedIds(new Set(tracked.map((r: { grant_id: string }) => r.grant_id)));
        }
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user && pendingSaveId) {
      const grant = matches.find((g) => g.id === pendingSaveId);
      if (grant) doSave(grant);
      setPendingSaveId(null);
    }
  }, [user, pendingSaveId]);

  const doSave = (grant: MatchedGrant) => {
    const savedRaw = localStorage.getItem("fundii_saved");
    const existing: MatchedGrant[] = savedRaw ? JSON.parse(savedRaw) : [];
    if (saved.has(grant.id)) {
      localStorage.setItem("fundii_saved", JSON.stringify(existing.filter((g) => g.id !== grant.id)));
      setSaved((prev) => { const next = new Set(prev); next.delete(grant.id); return next; });
    } else {
      localStorage.setItem("fundii_saved", JSON.stringify([...existing, grant]));
      setSaved((prev) => new Set([...prev, grant.id]));
    }
    if (user) {
      supabase.from("saved_grants").upsert({ user_id: user.id, grant_id: grant.id, status: "saved" }).then(() => {});
    }
  };

  const handleToggleSave = (grant: MatchedGrant) => {
    if (!user && !saved.has(grant.id)) {
      doSave(grant);
      setPendingSaveId(grant.id);
      return;
    }
    doSave(grant);
  };

  const handleTrack = async (grant: MatchedGrant) => {
    if (!user) { setShowAuth(true); return; }
    if (plan !== "enterprise") { router.push("/dashboard/billing"); return; }
    if (trackedIds.has(grant.id)) {
      await supabase.from("application_tracker").delete().eq("user_id", user.id).eq("grant_id", grant.id);
      setTrackedIds(prev => { const next = new Set(prev); next.delete(grant.id); return next; });
    } else {
      await supabase.from("application_tracker").insert({
        user_id: user.id,
        grant_id: grant.id,
        grant_title: grant.title,
        grant_source: grant.source,
        grant_category: grant.category ?? null,
        grant_close_date: grant.close_date ?? null,
        grant_url: grant.url || null,
        status: "saved",
      });
      setTrackedIds(prev => new Set([...prev, grant.id]));
    }
  };

  const handleEnableAlerts = async () => {
    if (!alertEmail || !alertEmail.includes("@")) return;
    setAlertLoading(true);
    if (user) {
      await supabase.from("alert_subscriptions").upsert({
        user_id: user.id, email: alertEmail, frequency: "weekly", active: true,
      });
    }
    localStorage.setItem("fundii_alert_email", alertEmail);
    setAlertsEnabled(true);
    setAlertLoading(false);
  };

  const [sortBy, setSortBy] = useState<"match" | "amount">("match");
  const [typeFilter, setTypeFilter] = useState("all");
  const [amountFilter, setAmountFilter] = useState("any");
  const [closingSoon, setClosingSoon] = useState(false);
  const [search, setSearch] = useState("");

  const isFree = !plan;
  const canDraft = plan === "growth" || plan === "enterprise";

  const applyFilters = (list: MatchedGrant[]) => {
    const q = search.toLowerCase().trim();
    return list
      .filter((g) => !q || g.title.toLowerCase().includes(q) || (g.description ?? "").toLowerCase().includes(q) || g.source.toLowerCase().includes(q))
      .filter((g) => typeFilter === "all" || g.grant_type === typeFilter)
      .filter((g) => {
        if (amountFilter === "5k")   return g.amount_max >= 5000;
        if (amountFilter === "50k")  return g.amount_max >= 50000;
        if (amountFilter === "100k") return g.amount_max >= 100000;
        return true;
      })
      .filter((g) => {
        if (!closingSoon) return true;
        const cd = g.close_date;
        if (!cd || cd === "See website" || cd === "Ongoing" || cd === "Round-based") return false;
        const parsed = new Date(cd);
        if (isNaN(parsed.getTime())) return false;
        const diff = Math.ceil((parsed.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        return diff >= 0 && diff <= 30;
      })
      .sort((a, b) =>
        sortBy === "amount" ? b.amount_max - a.amount_max : b.matchScore - a.matchScore
      );
  };

  const filteredMatches = applyFilters(matches);
  const visibleGrants = isFree ? filteredMatches.slice(0, 2) : filteredMatches;
  const lockedCount = isFree ? Math.max(0, filteredMatches.length - 2) : 0;

  if (!profile) {
    return (
      <div className="min-h-screen bg-[#FAF8F4]">
        <Nav />
        <div className="max-w-xl mx-auto px-6 py-24 text-center">
          <p className="text-gray-400 text-sm font-semibold uppercase tracking-widest mb-4">No results yet</p>
          <h2 className="text-2xl font-bold text-[#1A1A2E] mb-3">Take the quiz first</h2>
          <p className="text-gray-500 mb-8">Answer 5 quick questions and we'll match you with grants you're eligible for.</p>
          <Link href="/quiz" className="inline-block px-8 py-3.5 rounded-xl bg-[#0F7B6C] text-white font-bold no-underline hover:bg-[#0a6159]">
            Find My Grants →
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF8F4]">
        <Nav />
        <div className="max-w-xl mx-auto px-6 py-24 text-center">
          <div className="w-10 h-10 border-4 border-[#0F7B6C] border-t-transparent rounded-full animate-spin mx-auto mb-6" />
          <p className="text-gray-600 font-medium">Searching 3,900+ grants for your best matches…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF8F4]">
      <Nav />
      {showAuth && (
        <AuthModal onClose={() => setShowAuth(false)} onSuccess={() => setShowAuth(false)} />
      )}

      <div className="max-w-3xl mx-auto px-6 py-12">

        {/* Header */}
        <div className="mb-8">
          <p className="text-xs font-bold tracking-widest text-[#0F7B6C] uppercase mb-2">Your results</p>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold text-[#1A1A2E] leading-tight">
                {filteredMatches.length} grants matched
                {filteredMatches.length !== matches.length && (
                  <span className="text-base font-normal text-gray-400 ml-2">of {matches.length}</span>
                )}
              </h1>
              <p className="text-gray-500 mt-1">Click any match score to see why it matched.</p>
            </div>
            <Link
              href="/quiz"
              className="text-sm font-semibold text-[#0F7B6C] border border-[#0F7B6C] px-4 py-2 rounded-lg no-underline hover:bg-[#E6F5F2] transition-colors"
            >
              Edit profile
            </Link>
          </div>

          {/* Profile tags */}
          <div className="flex flex-wrap gap-2 mt-4">
            <span className="bg-white border border-gray-200 rounded-full px-3 py-1 text-sm text-gray-600">
              {profile.state}
            </span>
            {profile.industries.slice(0, 3).map((ind) => (
              <span key={ind} className="bg-[#E6F5F2] text-[#0F7B6C] rounded-full px-3 py-1 text-sm font-medium">
                {ind}
              </span>
            ))}
          </div>
        </div>

        {/* Search + filter bar */}
        <div className="mb-3">
          <input
            type="text"
            placeholder="Search grants by name, source, or keyword…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#0F7B6C] focus:ring-2 focus:ring-[#E6F5F2] bg-white"
          />
        </div>
        {/* Filter + sort bar */}
        <div className="bg-white border border-gray-200 rounded-2xl px-5 py-4 mb-6 flex flex-wrap gap-4 items-center">
          {/* Sort */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Sort</span>
            {(["match", "amount"] as const).map((opt) => (
              <button
                key={opt}
                onClick={() => setSortBy(opt)}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors"
                style={{
                  borderColor: sortBy === opt ? "#0F7B6C" : "#E5E7EB",
                  background:  sortBy === opt ? "#E6F5F2" : "#fff",
                  color:       sortBy === opt ? "#0F7B6C" : "#6B7280",
                }}
              >
                {opt === "match" ? "Best match" : "Highest amount"}
              </button>
            ))}
          </div>

          <div className="w-px h-5 bg-gray-200 hidden sm:block" />

          {/* Type filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</span>
            {[
              { value: "all",          label: "All" },
              { value: "grant",        label: "Grant" },
              { value: "loan",         label: "Loan" },
              { value: "tax_incentive",label: "Tax incentive" },
              { value: "rebate",       label: "Rebate" },
              { value: "voucher",      label: "Voucher" },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setTypeFilter(opt.value)}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors"
                style={{
                  borderColor: typeFilter === opt.value ? "#0F7B6C" : "#E5E7EB",
                  background:  typeFilter === opt.value ? "#E6F5F2" : "#fff",
                  color:       typeFilter === opt.value ? "#0F7B6C" : "#6B7280",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="w-px h-5 bg-gray-200 hidden sm:block" />

          {/* Amount filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Min</span>
            {[
              { value: "any",  label: "Any" },
              { value: "5k",   label: "$5K+" },
              { value: "50k",  label: "$50K+" },
              { value: "100k", label: "$100K+" },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setAmountFilter(opt.value)}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors"
                style={{
                  borderColor: amountFilter === opt.value ? "#0F7B6C" : "#E5E7EB",
                  background:  amountFilter === opt.value ? "#E6F5F2" : "#fff",
                  color:       amountFilter === opt.value ? "#0F7B6C" : "#6B7280",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="w-px h-5 bg-gray-200 hidden sm:block" />

          {/* Closing soon */}
          <button
            onClick={() => setClosingSoon(!closingSoon)}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors"
            style={{
              borderColor: closingSoon ? "#EA580C" : "#E5E7EB",
              background:  closingSoon ? "#FFF7ED" : "#fff",
              color:       closingSoon ? "#EA580C" : "#6B7280",
            }}
          >
            ⏰ Closing in 30 days
          </button>
        </div>

        {/* Alert banner */}
        {!alertsEnabled ? (
          <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-8 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="flex-1">
              <p className="font-bold text-[#1A1A2E] text-sm mb-0.5">Get weekly grant alerts</p>
              <p className="text-gray-500 text-sm">New matching grants delivered every Monday.</p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <input
                type="email"
                placeholder="your@email.com"
                value={alertEmail}
                onChange={(e) => setAlertEmail(e.target.value)}
                className="flex-1 sm:w-48 px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#0F7B6C] focus:ring-2 focus:ring-[#E6F5F2]"
              />
              <button
                onClick={handleEnableAlerts}
                disabled={alertLoading}
                className="px-5 py-2.5 rounded-xl font-bold text-sm text-white disabled:opacity-60"
                style={{ background: "#0F7B6C" }}
              >
                {alertLoading ? "…" : "Subscribe"}
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-[#E6F5F2] border border-[#0F7B6C]/20 rounded-xl px-5 py-3 mb-6 text-sm text-[#0F7B6C] font-semibold">
            Weekly alerts enabled for {alertEmail}
          </div>
        )}

        {/* Grant list */}
        {filteredMatches.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
            {matches.length > 0 ? (
              <>
                <p className="text-gray-400 text-sm font-semibold uppercase tracking-widest mb-3">No results for these filters</p>
                <p className="text-gray-600 text-base mb-6 max-w-xs mx-auto">
                  Try removing a filter — you have {matches.length} matched grants total.
                </p>
                <button
                  onClick={() => { setTypeFilter("all"); setAmountFilter("any"); setSearch(""); setClosingSoon(false); }}
                  className="inline-block px-8 py-3 rounded-xl bg-[#0F7B6C] text-white font-bold"
                >
                  Clear Filters
                </button>
              </>
            ) : (
              <>
                <p className="text-gray-400 text-sm font-semibold uppercase tracking-widest mb-3">No matches found</p>
                <p className="text-gray-600 text-base mb-6 max-w-xs mx-auto">
                  Try broadening your industry or purpose selections to see more results.
                </p>
                <Link href="/quiz" className="inline-block px-8 py-3 rounded-xl bg-[#0F7B6C] text-white font-bold no-underline hover:bg-[#0a6159]">
                  Retake Quiz
                </Link>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-4">
              {visibleGrants.map((grant) => (
                <GrantCard
                  key={grant.id}
                  grant={grant}
                  isSaved={saved.has(grant.id)}
                  onToggleSave={handleToggleSave}
                  showDrafter
                  canDraft={canDraft}
                  onTrack={handleTrack}
                  isTracked={trackedIds.has(grant.id)}
                />
              ))}
            </div>

            {/* Free tier paywall */}
            {isFree && lockedCount > 0 && (
              <div className="relative mt-4">
                {/* Blurred preview cards */}
                <div className="pointer-events-none select-none" style={{ filter: "blur(6px)", opacity: 0.5 }}>
                  {matches.slice(2, 5).map((grant) => (
                    <div key={grant.id} className="bg-white rounded-2xl border border-gray-200 p-6 mb-4">
                      <div className="flex gap-2 mb-2">
                        <span className="bg-gray-100 rounded-full px-3 py-1 text-xs text-gray-400 w-16 h-5" />
                        <span className="bg-gray-100 rounded-full px-3 py-1 text-xs text-gray-400 w-12 h-5" />
                      </div>
                      <div className="h-5 bg-gray-100 rounded w-3/4 mb-2" />
                      <div className="h-4 bg-gray-50 rounded w-full mb-1" />
                      <div className="h-4 bg-gray-50 rounded w-2/3" />
                    </div>
                  ))}
                </div>

                {/* Upgrade CTA overlay */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="bg-white border border-gray-200 rounded-2xl shadow-lg p-8 text-center max-w-sm mx-4">
                    <div className="w-12 h-12 bg-[#E6F5F2] rounded-xl flex items-center justify-center mx-auto mb-4">
                      <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
                        <rect x="5" y="11" width="14" height="10" rx="2" stroke="#0F7B6C" strokeWidth="2" />
                        <path d="M8 11V7a4 4 0 018 0v4" stroke="#0F7B6C" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-bold text-[#1A1A2E] mb-2">
                      {lockedCount} more grants available
                    </h3>
                    <p className="text-gray-500 text-sm mb-6">
                      Upgrade to see all {matches.length} matching grants, save your favourites, and get weekly alerts.
                    </p>
                    <Link
                      href="/signup?plan=starter"
                      className="block w-full py-3 rounded-xl bg-[#0F7B6C] text-white font-bold text-sm no-underline hover:bg-[#0a6159] transition-colors mb-3"
                    >
                      Unlock All Grants →
                    </Link>
                    {!user && (
                      <Link
                        href="/login"
                        className="block text-sm text-[#0F7B6C] font-semibold no-underline hover:underline"
                      >
                        Already have an account? Sign in
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

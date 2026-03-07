"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import type { MatchedGrant } from "@/lib/types";
import type { User } from "@supabase/supabase-js";

const PLAN_LABELS: Record<string, { label: string; color: string; bg: string; border: string }> = {
  starter:    { label: "Starter",    color: "#0F7B6C", bg: "#E6F5F2", border: "#A7D7D0" },
  growth:     { label: "Growth",     color: "#7C3AED", bg: "#EDE9FE", border: "#C4B5FD" },
  enterprise: { label: "Enterprise", color: "#B45309", bg: "#FEF3C7", border: "#FCD34D" },
};

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const justSubscribed = searchParams.get("subscribed") === "true";
  const newPlan = searchParams.get("plan") ?? "";

  const [user, setUser] = useState<User | null>(null);
  const [plan, setPlan] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState<MatchedGrant[]>([]);
  const [alertEmail, setAlertEmail] = useState("");
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [alertLoading, setAlertLoading] = useState(false);

  useEffect(() => {
    const init = async () => {
      const supabase = createClient();
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) { router.push("/login?redirect=/dashboard"); return; }
      setUser(authUser);

      const { data: profile } = await supabase
        .from("profiles").select("plan, subscription_status").eq("id", authUser.id).single();
      setPlan(profile?.plan ?? null);

      const { data: dbSaved } = await supabase
        .from("saved_grants")
        .select("grant_id, grants(id, title, source, amount_text, description, states, status, grant_type, close_date, url, source_url)")
        .eq("user_id", authUser.id);

      if (dbSaved?.length) {
        const grants = dbSaved
          .map((r: Record<string, unknown>) => r.grants).filter(Boolean)
          .map((g: unknown) => ({ ...(g as Record<string, unknown>), matchScore: 0, sizes: [] })) as unknown as MatchedGrant[];
        setSaved(grants);
      } else {
        const raw = localStorage.getItem("fundii_saved");
        if (raw) setSaved(JSON.parse(raw));
      }

      const storedEmail = localStorage.getItem("fundii_alert_email");
      if (storedEmail) { setAlertEmail(storedEmail); setAlertsEnabled(true); }
      setLoading(false);
    };
    init();
  }, []);

  const handleEnableAlerts = async () => {
    if (!alertEmail || !alertEmail.includes("@")) return;
    setAlertLoading(true);
    const supabase = createClient();
    if (user) await supabase.from("alert_subscriptions").upsert({ user_id: user.id, email: alertEmail, frequency: "weekly", active: true });
    localStorage.setItem("fundii_alert_email", alertEmail);
    setAlertsEnabled(true);
    setAlertLoading(false);
  };

  const handleRemove = async (grant: MatchedGrant) => {
    const supabase = createClient();
    if (user) await supabase.from("saved_grants").delete().eq("user_id", user.id).eq("grant_id", grant.id);
    setSaved(prev => prev.filter((g) => g.id !== grant.id));
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  };

  const totalPotential = saved.reduce((sum, g) => sum + (g.amount_max || 0), 0);
  const activePlan = (justSubscribed && newPlan) ? newPlan : plan;
  const planInfo = activePlan ? PLAN_LABELS[activePlan] : null;
  const canDraft = activePlan === "growth" || activePlan === "enterprise";
  const initials = user?.email?.slice(0, 2).toUpperCase() ?? "GM";

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF8F4] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#0F7B6C] border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 text-sm">Loading your dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF8F4]">
      {/* Nav */}
      <nav className="bg-white border-b border-gray-100 px-6 py-0 flex items-center justify-between h-16 sticky top-0 z-10">
        <Link href="/" className="text-xl font-extrabold text-[#1A1A2E] no-underline">
          Grant<span style={{ color: "#0F7B6C" }}>Mate</span>
        </Link>
        <div className="flex items-center gap-3">
          {planInfo && (
            <span className="hidden sm:inline text-xs font-bold px-3 py-1 rounded-full border"
              style={{ color: planInfo.color, background: planInfo.bg, borderColor: planInfo.border }}>
              {planInfo.label}
            </span>
          )}
          <Link href="/quiz" className="text-sm font-semibold text-[#0F7B6C] no-underline hover:underline hidden sm:inline">
            Find Grants
          </Link>
          {activePlan && (
            <button onClick={async () => {
              const res = await fetch("/api/billing-portal", { method: "POST" });
              const { url } = await res.json();
              if (url) window.location.href = url;
            }} className="text-sm text-gray-400 hover:text-gray-700">Billing</button>
          )}
          <button onClick={handleSignOut} className="text-sm text-gray-400 hover:text-gray-700">Sign out</button>
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
            style={{ background: "#0F7B6C" }}>{initials}</div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* Welcome banner */}
        {justSubscribed && (
          <div className="bg-gradient-to-r from-[#0F7B6C] to-[#0a5c51] rounded-2xl p-6 mb-8 flex items-center gap-4 text-white">
            <span className="text-4xl">🎉</span>
            <div>
              <p className="font-bold text-xl">Welcome to GrantBase!</p>
              <p className="text-white/80 text-sm mt-0.5">
                Your {activePlan ? activePlan.charAt(0).toUpperCase() + activePlan.slice(1) : "subscription"} plan is active.
                {canDraft ? " AI drafting is ready to use." : " Start finding grants below."}
              </p>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-extrabold text-[#1A1A2E]">Dashboard</h1>
            <p className="text-gray-400 text-sm mt-0.5">{user?.email}</p>
          </div>
          {!activePlan && (
            <Link href="/signup" className="px-4 py-2 rounded-xl bg-[#0F7B6C] text-white font-bold text-sm no-underline">
              Upgrade Plan →
            </Link>
          )}
        </div>

        {/* Stats + Plan row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-2xl p-5 border border-gray-100 col-span-1">
            <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center text-lg mb-3">⭐</div>
            <div className="text-2xl font-extrabold text-[#1A1A2E]">{saved.length}</div>
            <div className="text-xs text-gray-400 mt-0.5 font-medium">Saved Grants</div>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-gray-100 col-span-1">
            <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center text-lg mb-3">💰</div>
            <div className="text-2xl font-extrabold text-[#1A1A2E]">
              {totalPotential > 0 ? `$${(totalPotential / 1000).toFixed(0)}k` : "$0"}
            </div>
            <div className="text-xs text-gray-400 mt-0.5 font-medium">Total Potential</div>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-gray-100 col-span-1">
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-lg mb-3">🔔</div>
            <div className="text-2xl font-extrabold text-[#1A1A2E]">{alertsEnabled ? "On" : "Off"}</div>
            <div className="text-xs text-gray-400 mt-0.5 font-medium">Weekly Alerts</div>
          </div>
          <div className="rounded-2xl p-5 border col-span-1"
            style={planInfo ? { background: planInfo.bg, borderColor: planInfo.border } : { background: "#F3F4F6", borderColor: "#E5E7EB" }}>
            <div className="w-9 h-9 rounded-xl bg-white/60 flex items-center justify-center text-lg mb-3">
              {activePlan === "enterprise" ? "👑" : activePlan === "growth" ? "🚀" : activePlan ? "✨" : "🔒"}
            </div>
            <div className="text-2xl font-extrabold" style={{ color: planInfo?.color ?? "#9CA3AF" }}>
              {planInfo?.label ?? "Free"}
            </div>
            <div className="text-xs mt-0.5 font-medium" style={{ color: planInfo?.color ?? "#9CA3AF" }}>
              {canDraft ? "AI drafting on" : activePlan ? "Upgrade for AI" : "No active plan"}
            </div>
          </div>
        </div>

        {/* Two column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Main: Saved grants */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-[#1A1A2E]">Saved Grants
                <span className="ml-2 text-sm font-normal text-gray-400">({saved.length})</span>
              </h2>
              <Link href="/quiz" className="text-sm font-semibold text-[#0F7B6C] no-underline hover:underline">
                + Find more
              </Link>
            </div>

            {saved.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                <div className="w-16 h-16 bg-[#E6F5F2] rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">🔍</div>
                <p className="font-semibold text-[#1A1A2E] mb-2">No saved grants yet</p>
                <p className="text-sm text-gray-400 mb-6">Take the quiz to find grants matching your business.</p>
                <Link href="/quiz" className="inline-block px-6 py-3 rounded-xl text-white font-bold text-sm no-underline"
                  style={{ background: "#0F7B6C" }}>
                  Find My Grants →
                </Link>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {saved.map((grant) => (
                  <div key={grant.id} className="bg-white rounded-2xl border border-gray-100 p-5 hover:border-[#A7D7D0] transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="inline-block w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
                          <span className="text-xs text-gray-400 font-medium">{grant.source}</span>
                        </div>
                        <p className="font-bold text-[#1A1A2E] text-sm leading-snug mb-1">{grant.title}</p>
                        <p className="text-xs text-gray-500">{grant.amount_text || "Amount varies"}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        {canDraft ? (
                          <Link href={`/draft/${grant.id}`}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold text-white no-underline"
                            style={{ background: "#0F7B6C" }}>
                            Draft →
                          </Link>
                        ) : (
                          <Link href="/dashboard/billing"
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold border no-underline"
                            style={{ color: "#0F7B6C", borderColor: "#A7D7D0" }}>
                            Upgrade
                          </Link>
                        )}
                        <button onClick={() => handleRemove(grant)} className="text-xs text-gray-300 hover:text-red-400 transition-colors">
                          remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="flex flex-col gap-4">

            {/* Plan card */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <p className="text-xs font-bold tracking-widest uppercase text-gray-400 mb-3">Your Plan</p>
              {activePlan && planInfo ? (
                <>
                  <p className="text-xl font-extrabold mb-1" style={{ color: planInfo.color }}>{planInfo.label}</p>
                  {canDraft ? (
                    <p className="text-xs text-gray-500 mb-4">✓ AI application drafting enabled</p>
                  ) : (
                    <p className="text-xs text-gray-500 mb-4">Upgrade to Enterprise to unlock AI drafting</p>
                  )}
                  {!canDraft && (
                    <Link href="/dashboard/billing" className="block text-center py-2.5 rounded-xl text-sm font-bold text-white no-underline"
                      style={{ background: "#0F7B6C" }}>
                      Upgrade to Enterprise →
                    </Link>
                  )}
                </>
              ) : (
                <>
                  <p className="text-xl font-extrabold text-gray-300 mb-1">No plan</p>
                  <p className="text-xs text-gray-400 mb-4">Subscribe to access full grant matching and AI drafting</p>
                  <Link href="/signup" className="block text-center py-2.5 rounded-xl text-sm font-bold text-white no-underline"
                    style={{ background: "#0F7B6C" }}>
                    Get Started →
                  </Link>
                </>
              )}
            </div>

            {/* Alert card */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <p className="text-xs font-bold tracking-widest uppercase text-gray-400 mb-3">Weekly Alerts</p>
              {alertsEnabled ? (
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-2 h-2 bg-green-400 rounded-full" />
                    <span className="text-sm font-semibold text-[#1A1A2E]">Active</span>
                  </div>
                  <p className="text-xs text-gray-400">{alertEmail}</p>
                </div>
              ) : (
                <>
                  <p className="text-sm text-gray-500 mb-3">Get new matching grants every Monday.</p>
                  <input type="email" placeholder="your@email.com" value={alertEmail}
                    onChange={(e) => setAlertEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm mb-2 focus:outline-none focus:border-[#0F7B6C]" />
                  <button onClick={handleEnableAlerts} disabled={alertLoading}
                    className="w-full py-2.5 rounded-lg text-sm font-bold text-white disabled:opacity-60"
                    style={{ background: "#0F7B6C" }}>
                    {alertLoading ? "…" : "Enable Alerts"}
                  </button>
                </>
              )}
            </div>

            {/* Quick links */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <p className="text-xs font-bold tracking-widest uppercase text-gray-400 mb-3">Quick Actions</p>
              <div className="flex flex-col gap-2">
                <Link href="/quiz" className="flex items-center justify-between py-2 text-sm font-semibold text-[#1A1A2E] no-underline hover:text-[#0F7B6C] transition-colors">
                  <span>🔍 Find new grants</span><span className="text-gray-300">→</span>
                </Link>
                <Link href="/results" className="flex items-center justify-between py-2 text-sm font-semibold text-[#1A1A2E] no-underline hover:text-[#0F7B6C] transition-colors">
                  <span>📋 View last results</span><span className="text-gray-300">→</span>
                </Link>
                {activePlan && (
                  <button onClick={async () => {
                    const res = await fetch("/api/billing-portal", { method: "POST" });
                    const { url } = await res.json();
                    if (url) window.location.href = url;
                  }} className="flex items-center justify-between py-2 text-sm font-semibold text-[#1A1A2E] hover:text-[#0F7B6C] transition-colors text-left">
                    <span>💳 Manage billing</span><span className="text-gray-300">→</span>
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return <Suspense><DashboardContent /></Suspense>;
}

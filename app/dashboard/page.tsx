"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import type { MatchedGrant } from "@/lib/types";
import type { User } from "@supabase/supabase-js";

const PLAN_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  starter:    { label: "Starter",    color: "#0F7B6C", bg: "#E6F5F2" },
  growth:     { label: "Growth",     color: "#7C3AED", bg: "#EDE9FE" },
  enterprise: { label: "Enterprise", color: "#B45309", bg: "#FEF3C7" },
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

      if (!authUser) {
        router.push("/login?redirect=/dashboard");
        return;
      }
      setUser(authUser);

      const { data: profile } = await supabase
        .from("profiles")
        .select("plan, subscription_status")
        .eq("id", authUser.id)
        .single();

      setPlan(profile?.plan ?? null);

      // Load saved grants from Supabase (source of truth for logged-in users)
      const { data: dbSaved } = await supabase
        .from("saved_grants")
        .select("grant_id, grants(id, title, source, amount_text, description, states, status, grant_type, close_date, url, source_url)")
        .eq("user_id", authUser.id);

      if (dbSaved?.length) {
        const grants = dbSaved
          .map((r: Record<string, unknown>) => r.grants)
          .filter(Boolean)
          .map((g: unknown) => ({ ...(g as Record<string, unknown>), matchScore: 0, sizes: [] })) as unknown as MatchedGrant[];
        setSaved(grants);
      } else {
        // Fall back to localStorage
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
    if (user) {
      await supabase.from("alert_subscriptions").upsert({
        user_id: user.id, email: alertEmail, frequency: "weekly", active: true,
      });
    }
    localStorage.setItem("fundii_alert_email", alertEmail);
    setAlertsEnabled(true);
    setAlertLoading(false);
  };

  const handleRemove = (grant: MatchedGrant) => {
    const updated = saved.filter((g) => g.id !== grant.id);
    setSaved(updated);
    localStorage.setItem("fundii_saved", JSON.stringify(updated));
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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF8F4] flex items-center justify-center">
        <div className="text-gray-400 text-lg">Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF8F4]">
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="text-xl font-extrabold text-[#1A1A2E] no-underline">GrantMate</Link>
        <div className="flex items-center gap-4">
          {planInfo && (
            <span className="text-xs font-bold px-3 py-1 rounded-full"
              style={{ color: planInfo.color, background: planInfo.bg }}>
              {planInfo.label} Plan
            </span>
          )}
          <Link href="/find" className="text-sm font-semibold text-[#0F7B6C] no-underline hover:underline">Find Grants</Link>
          <button onClick={handleSignOut} className="text-sm text-gray-500 hover:text-gray-800">Sign out</button>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-12">

        {justSubscribed && (
          <div className="bg-[#E6F5F2] border border-[#0F7B6C] rounded-2xl p-6 mb-8 flex items-center gap-4">
            <span className="text-3xl">🎉</span>
            <div>
              <p className="font-bold text-[#0F7B6C] text-lg">Welcome to GrantMate!</p>
              <p className="text-sm text-gray-600">
                Your {activePlan ? activePlan.charAt(0).toUpperCase() + activePlan.slice(1) : "subscription"} plan is active.
                {canDraft ? " You can now use AI to draft grant applications." : " Explore matching grants below."}
              </p>
            </div>
          </div>
        )}

        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-extrabold text-[#1A1A2E] mb-1">Your Dashboard</h1>
            <p className="text-gray-500">{user?.email}</p>
          </div>
          {!activePlan && (
            <Link href="/signup" className="px-5 py-2.5 rounded-xl bg-[#0F7B6C] text-white font-bold text-sm no-underline hover:opacity-90">
              Upgrade Plan →
            </Link>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          {[
            { label: "Saved Grants", value: saved.length, icon: "⭐" },
            { label: "Total Potential", value: totalPotential > 0 ? `$${totalPotential.toLocaleString()}` : "$0", icon: "💰" },
            { label: "Alerts", value: alertsEnabled ? "Active" : "Off", icon: "🔔" },
          ].map((card, i) => (
            <div key={i} className="bg-white rounded-2xl p-5 border border-gray-200">
              <div className="text-2xl mb-2">{card.icon}</div>
              <div className="text-2xl font-extrabold text-[#1A1A2E] mb-0.5">{card.value}</div>
              <div className="text-sm text-gray-500">{card.label}</div>
            </div>
          ))}
        </div>

        {activePlan && planInfo && (
          <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-8">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: planInfo.color }}>Current Plan</p>
                <p className="text-xl font-bold text-[#1A1A2E]">{planInfo.label}</p>
                {!canDraft && (
                  <p className="text-sm text-gray-500 mt-1">Upgrade to Growth to unlock AI application drafting.</p>
                )}
              </div>
              {canDraft ? (
                <span className="text-sm text-[#0F7B6C] font-semibold">✓ AI drafting enabled</span>
              ) : (
                <Link href="/signup?plan=growth" className="px-4 py-2 rounded-xl text-sm font-bold text-white no-underline"
                  style={{ background: "#0F7B6C" }}>
                  Upgrade →
                </Link>
              )}
            </div>
          </div>
        )}

        {!alertsEnabled && (
          <div className="rounded-2xl p-5 mb-8 border" style={{ background: "#FFFBEB", borderColor: "#F59E0B" }}>
            <h3 className="font-bold text-base text-[#1A1A2E] mb-1">🔔 Enable Weekly Alerts</h3>
            <p className="text-sm text-gray-600 mb-3">Get notified when new grants match your profile every Monday.</p>
            <div className="flex gap-2">
              <input type="email" placeholder="your@email.com" value={alertEmail}
                onChange={(e) => setAlertEmail(e.target.value)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#0F7B6C]" />
              <button onClick={handleEnableAlerts} disabled={alertLoading}
                className="px-5 py-2.5 rounded-xl font-bold text-sm text-white disabled:opacity-60"
                style={{ background: "#0F7B6C" }}>
                {alertLoading ? "…" : "Enable"}
              </button>
            </div>
          </div>
        )}
        {alertsEnabled && (
          <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-3 mb-6 text-sm text-green-700 font-semibold">
            ✅ Weekly alerts active for {alertEmail}
          </div>
        )}

        <h2 className="text-xl font-bold text-[#1A1A2E] mb-5">Saved Grants ({saved.length})</h2>

        {saved.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
            <p className="text-4xl mb-4">⭐</p>
            <p className="text-gray-500 mb-6">No saved grants yet. Take the quiz to find matching grants.</p>
            <Link href="/find" className="inline-block px-8 py-3 rounded-xl text-white font-bold no-underline"
              style={{ background: "#0F7B6C" }}>
              Find Grants →
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {saved.map((grant) => (
              <div key={grant.id} className="bg-white border border-gray-200 rounded-2xl p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[#1A1A2E] text-base mb-1">{grant.title}</p>
                    <p className="text-sm text-gray-500 mb-2">{grant.source} · {grant.amount_text || "Amount varies"}</p>
                    <p className="text-sm text-gray-600 line-clamp-2">{grant.description}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <span className="text-sm font-bold text-[#0F7B6C]">{grant.matchScore}% match</span>
                    {canDraft ? (
                      <Link href={`/draft/${grant.id}`}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-white no-underline"
                        style={{ background: "#0F7B6C" }}>
                        Draft App →
                      </Link>
                    ) : (
                      <Link href="/signup?plan=growth"
                        className="px-3 py-1.5 rounded-lg text-xs font-bold border no-underline"
                        style={{ color: "#0F7B6C", borderColor: "#0F7B6C" }}>
                        Upgrade to Draft
                      </Link>
                    )}
                    <button onClick={() => handleRemove(grant)} className="text-xs text-red-400 hover:text-red-600">Remove</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return <Suspense><DashboardContent /></Suspense>;
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Nav from "@/components/Nav";
import GrantCard from "@/components/GrantCard";
import AuthModal from "@/components/AuthModal";
import { createClient } from "@/lib/supabase";
import type { MatchedGrant } from "@/lib/types";
import type { User } from "@supabase/supabase-js";

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState<MatchedGrant[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [alertEmail, setAlertEmail] = useState("");
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [alertLoading, setAlertLoading] = useState(false);
  const [showAuth, setShowAuth] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data.user);

      // Load saved grants from localStorage
      const raw = localStorage.getItem("fundii_saved");
      if (raw) {
        const grants: MatchedGrant[] = JSON.parse(raw);
        setSaved(grants);
        setSavedIds(new Set(grants.map((g) => g.id)));
      }

      // Load alert
      const email = localStorage.getItem("fundii_alert_email");
      if (email) {
        setAlertEmail(email);
        setAlertsEnabled(true);
      }

      setLoading(false);
    };

    init();

    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const handleRemove = (grant: MatchedGrant) => {
    const updated = saved.filter((g) => g.id !== grant.id);
    setSaved(updated);
    setSavedIds(new Set(updated.map((g) => g.id)));
    localStorage.setItem("fundii_saved", JSON.stringify(updated));
  };

  const handleEnableAlerts = async () => {
    if (!alertEmail || !alertEmail.includes("@")) return;
    setAlertLoading(true);

    if (user) {
      await supabase.from("alert_subscriptions").upsert({
        user_id: user.id,
        email: alertEmail,
        frequency: "weekly",
        active: true,
      });
    }
    localStorage.setItem("fundii_alert_email", alertEmail);
    setAlertsEnabled(true);
    setAlertLoading(false);
  };

  const totalPotential = saved.reduce((sum, g) => sum + (g.amount_max || 0), 0);

  if (loading) {
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
      {showAuth && (
        <AuthModal
          onClose={() => setShowAuth(false)}
          onSuccess={() => setShowAuth(false)}
        />
      )}

      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold mb-2" style={{ color: "#1B2A4A" }}>
            {user ? `Welcome back` : "Your Dashboard"}
          </h1>
          <p className="text-gray-500">Track your saved grants and manage applications.</p>
          {!user && (
            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
              <span className="font-semibold">Sign in</span> to sync your grants across devices and
              access full features.{" "}
              <button
                onClick={() => setShowAuth(true)}
                className="underline font-semibold hover:text-amber-900"
              >
                Sign in now →
              </button>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          {[
            { label: "Saved Grants", value: saved.length, icon: "⭐" },
            {
              label: "Total Potential",
              value: totalPotential > 0 ? `$${totalPotential.toLocaleString()}` : "$0",
              icon: "💰",
            },
            { label: "Alerts", value: alertsEnabled ? "Active" : "Off", icon: "🔔" },
          ].map((card, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm"
            >
              <div className="text-2xl mb-2">{card.icon}</div>
              <div className="text-2xl font-extrabold mb-0.5" style={{ color: "#1B2A4A" }}>
                {card.value}
              </div>
              <div className="text-sm text-gray-500">{card.label}</div>
            </div>
          ))}
        </div>

        {/* Alert setup */}
        {!alertsEnabled && (
          <div
            className="rounded-2xl p-5 mb-8 border"
            style={{ background: "#FFF8E1", borderColor: "#F5A623" }}
          >
            <h3 className="font-bold text-base mb-1" style={{ color: "#1B2A4A" }}>
              🔔 Enable Weekly Alerts
            </h3>
            <p className="text-sm text-gray-600 mb-3">
              Get notified when new grants match your profile every Monday.
            </p>
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="your@email.com"
                value={alertEmail}
                onChange={(e) => setAlertEmail(e.target.value)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <button
                onClick={handleEnableAlerts}
                disabled={alertLoading}
                className="px-5 py-2.5 rounded-xl font-bold text-sm text-white"
                style={{ background: "#00897B" }}
              >
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

        {/* Saved grants */}
        <h2 className="text-xl font-bold mb-5" style={{ color: "#1B2A4A" }}>
          Saved Grants ({saved.length})
        </h2>

        {saved.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
            <p className="text-4xl mb-4">☆</p>
            <p className="text-gray-500 mb-6 text-base">
              No saved grants yet. Take the quiz to find grants and tap the star to save them.
            </p>
            <Link
              href="/quiz"
              className="inline-block px-8 py-3 rounded-xl bg-teal-500 text-white font-bold no-underline hover:bg-teal-600"
            >
              Find Grants
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {saved.map((grant) => (
              <GrantCard
                key={grant.id}
                grant={grant}
                isSaved={savedIds.has(grant.id)}
                onToggleSave={handleRemove}
                showDrafter
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

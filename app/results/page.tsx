"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Nav from "@/components/Nav";
import GrantCard from "@/components/GrantCard";
import AuthModal from "@/components/AuthModal";
import { matchGrants } from "@/lib/matching";
import { createClient } from "@/lib/supabase";
import type { MatchedGrant, UserProfile } from "@/lib/types";
import type { User } from "@supabase/supabase-js";

export default function ResultsPage() {
  const supabase = createClient();
  const [matches, setMatches] = useState<MatchedGrant[]>([]);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [pendingSaveId, setPendingSaveId] = useState<string | null>(null);
  const [alertEmail, setAlertEmail] = useState("");
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [alertLoading, setAlertLoading] = useState(false);

  useEffect(() => {
    // Load profile from localStorage
    const raw = localStorage.getItem("fundii_profile");
    if (!raw) return;

    const p: UserProfile = JSON.parse(raw);
    setProfile(p);
    setMatches(matchGrants(p));

    // Load saved grants
    const savedRaw = localStorage.getItem("fundii_saved");
    if (savedRaw) {
      const savedGrants = JSON.parse(savedRaw) as MatchedGrant[];
      setSaved(new Set<string>(savedGrants.map((g) => g.id)));
    }

    // Check auth
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  // After auth, execute pending save
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
      const updated = existing.filter((g) => g.id !== grant.id);
      localStorage.setItem("fundii_saved", JSON.stringify(updated));
      setSaved((prev) => {
        const next = new Set(prev);
        next.delete(grant.id);
        return next;
      });
    } else {
      const updated = [...existing, grant];
      localStorage.setItem("fundii_saved", JSON.stringify(updated));
      setSaved((prev) => new Set([...prev, grant.id]));
    }

    // Sync to Supabase if logged in
    if (user) {
      supabase.from("saved_grants").upsert({
        user_id: user.id,
        grant_id: grant.id,
        status: "saved",
      }).then(() => {});
    }
  };

  const handleToggleSave = (grant: MatchedGrant) => {
    if (!user && !saved.has(grant.id)) {
      // Prompt sign-in to save, but allow saving locally first
      doSave(grant); // save locally anyway
      setPendingSaveId(grant.id);
      return;
    }
    doSave(grant);
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

  if (!profile) {
    return (
      <div className="min-h-screen bg-[#F8FAFB]">
        <Nav />
        <div className="max-w-2xl mx-auto px-6 py-24 text-center">
          <p className="text-2xl mb-4">🤔</p>
          <p className="text-gray-600 mb-6">No quiz results yet. Take the quiz to find your grants.</p>
          <Link
            href="/quiz"
            className="inline-block px-8 py-4 rounded-xl bg-teal-500 text-white font-bold no-underline hover:bg-teal-600"
          >
            Take the Quiz →
          </Link>
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
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-extrabold mb-3" style={{ color: "#1B2A4A" }}>
            🎉 We found{" "}
            <span style={{ color: "#00897B" }}>{matches.length} grants</span> for you
          </h1>
          <p className="text-gray-500 text-lg">
            Sorted by eligibility match. Save the ones you like and generate AI application drafts.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2 text-sm">
            <span className="bg-white border border-gray-200 rounded-full px-3 py-1 text-gray-600">
              📍 {profile.state}
            </span>
            {profile.industries.slice(0, 3).map((ind) => (
              <span
                key={ind}
                className="bg-teal-50 text-teal-700 border border-teal-100 rounded-full px-3 py-1"
              >
                {ind}
              </span>
            ))}
            <Link
              href="/quiz"
              className="border border-gray-200 rounded-full px-3 py-1 text-gray-500 hover:bg-gray-50 no-underline"
            >
              ✏️ Edit profile
            </Link>
          </div>
        </div>

        {/* Alert signup banner */}
        {!alertsEnabled ? (
          <div
            className="rounded-2xl p-6 mb-8 flex flex-col sm:flex-row gap-4 items-start sm:items-center"
            style={{ background: "linear-gradient(135deg, #1B2A4A, #00897B)" }}
          >
            <div className="flex-1">
              <h3 className="text-white font-bold text-base mb-1">
                🔔 Get weekly grant alerts
              </h3>
              <p className="text-white/70 text-sm">
                New matching grants delivered to your inbox every Monday.
              </p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <input
                type="email"
                placeholder="your@email.com"
                value={alertEmail}
                onChange={(e) => setAlertEmail(e.target.value)}
                className="flex-1 sm:w-48 px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-white/50"
              />
              <button
                onClick={handleEnableAlerts}
                disabled={alertLoading}
                className="px-5 py-2.5 rounded-xl font-bold text-sm"
                style={{ background: "#F5A623", color: "#1B2A4A" }}
              >
                {alertLoading ? "…" : "Subscribe"}
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-3 mb-6 text-sm text-green-700 font-semibold">
            ✅ Weekly alerts enabled for {alertEmail}
          </div>
        )}

        {/* Grant list */}
        {matches.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
            <p className="text-4xl mb-4">🤔</p>
            <p className="text-gray-600 text-base mb-6">
              No strong matches with your current profile. Try broadening your industry or purpose
              selections.
            </p>
            <Link
              href="/quiz"
              className="inline-block px-8 py-3 rounded-xl bg-teal-500 text-white font-bold no-underline"
            >
              Retake Quiz
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {matches.map((grant) => (
              <GrantCard
                key={grant.id}
                grant={grant}
                isSaved={saved.has(grant.id)}
                onToggleSave={handleToggleSave}
                showDrafter
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

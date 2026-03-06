"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

export default function Nav() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [plan, setPlan] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      setUser(data.user);
      if (data.user) {
        const { data: profile } = await supabase
          .from("profiles").select("plan").eq("id", data.user.id).single();
        setPlan(profile?.plan ?? null);
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) setPlan(null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  const handleBillingPortal = async () => {
    const res = await fetch("/api/billing-portal", { method: "POST" });
    const { url, error } = await res.json();
    if (url) window.location.href = url;
    else console.error("Portal error:", error);
  };

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-6 flex justify-between items-center h-16">
        <Link href="/" className="text-xl font-extrabold text-[#1A1A2E] no-underline">
          Grant<span style={{ color: "#0F7B6C" }}>Mate</span>
        </Link>
        <div className="flex gap-2 items-center">
          <Link href="/find" className="px-4 py-2 rounded-lg text-sm font-semibold text-[#1A1A2E] border border-gray-200 hover:bg-gray-50 transition-colors no-underline">
            Find Grants
          </Link>
          {user ? (
            <>
              <Link href="/dashboard" className="px-4 py-2 rounded-lg text-sm font-semibold text-[#1A1A2E] border border-gray-200 hover:bg-gray-50 transition-colors no-underline">
                Dashboard
              </Link>
              {plan && (
                <button onClick={handleBillingPortal} className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-500 hover:text-gray-800 transition-colors">
                  Billing
                </button>
              )}
              <button onClick={handleSignOut} className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-gray-700 transition-colors">
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="px-4 py-2 rounded-lg text-sm font-semibold text-[#1A1A2E] border border-gray-200 hover:bg-gray-50 no-underline">
                Sign in
              </Link>
              <Link href="/signup" className="px-4 py-2 rounded-lg text-sm font-bold text-white no-underline" style={{ background: "#0F7B6C" }}>
                Get started
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

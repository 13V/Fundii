"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

export default function Nav() {
  const router = useRouter();
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [savedCount, setSavedCount] = useState(0);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    // Read saved count from localStorage for immediate feedback
    try {
      const saved = localStorage.getItem("fundii_saved");
      if (saved) setSavedCount(JSON.parse(saved).length);
    } catch {}

    return () => listener.subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-6xl mx-auto px-6 flex justify-between items-center h-16">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 no-underline">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 to-navy flex items-center justify-center text-white font-extrabold text-lg">
            F
          </div>
          <span className="text-xl font-extrabold text-navy tracking-tight">
            Fun<span className="text-teal-500">dii</span>
          </span>
        </Link>

        {/* Nav links */}
        <div className="flex gap-2 items-center">
          <Link
            href="/quiz"
            className="px-4 py-2 rounded-lg text-sm font-semibold text-navy border border-gray-200 hover:bg-gray-50 transition-colors no-underline"
          >
            Find Grants
          </Link>

          {user ? (
            <>
              <Link
                href="/dashboard"
                className="relative px-4 py-2 rounded-lg text-sm font-semibold text-navy border border-gray-200 hover:bg-gray-50 transition-colors no-underline"
              >
                Dashboard
                {savedCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-gold text-navy text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {savedCount}
                  </span>
                )}
              </Link>
              <button
                onClick={handleSignOut}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors"
              >
                Sign out
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-teal-500 text-white hover:bg-teal-600 transition-colors no-underline"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}

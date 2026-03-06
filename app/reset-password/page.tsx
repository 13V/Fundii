"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

function ResetForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [ready, setReady] = useState(false);
  const [linkError, setLinkError] = useState("");

  useEffect(() => {
    // Check for error params in URL (e.g. otp_expired)
    const urlError = searchParams.get("error");
    const errorCode = searchParams.get("error_code");
    if (urlError) {
      if (errorCode === "otp_expired") {
        setLinkError("This reset link has expired. Please request a new one.");
      } else {
        setLinkError("Invalid reset link. Please request a new one.");
      }
      return;
    }

    // Supabase exchanges the hash token automatically on page load
    const supabase = createClient();
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });

    // Also check existing session (in case already exchanged)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords don't match."); return; }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) { setError(updateError.message); setLoading(false); return; }
    setDone(true);
    setTimeout(() => router.push("/dashboard"), 2000);
  };

  return (
    <div className="min-h-screen bg-[#FAF8F4] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl p-8">
        <Link href="/" className="no-underline">
          <span className="text-xl font-extrabold text-[#1A1A2E]">GrantMate</span>
        </Link>
        <h1 className="text-2xl font-bold text-[#1A1A2E] mt-4 mb-4">Set new password</h1>

        {done ? (
          <div className="text-center py-6">
            <p className="text-3xl mb-3">✅</p>
            <p className="font-semibold text-[#1A1A2E]">Password updated!</p>
            <p className="text-sm text-gray-500 mt-1">Redirecting to your dashboard…</p>
          </div>
        ) : linkError ? (
          <div className="text-center py-4">
            <p className="text-3xl mb-3">⚠️</p>
            <p className="text-red-600 font-semibold mb-4">{linkError}</p>
            <Link href="/login"
              className="inline-block px-6 py-3 rounded-xl font-bold text-white text-sm no-underline"
              style={{ background: "#0F7B6C" }}>
              Request New Link →
            </Link>
          </div>
        ) : !ready ? (
          <p className="text-sm text-gray-500">Verifying reset link…</p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">New password</label>
              <input type="password" required minLength={8} value={password}
                onChange={(e) => setPassword(e.target.value)} placeholder="Min. 8 characters"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#0F7B6C] focus:ring-2 focus:ring-[#E6F5F2]" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Confirm password</label>
              <input type="password" required value={confirm}
                onChange={(e) => setConfirm(e.target.value)} placeholder="Repeat password"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#0F7B6C] focus:ring-2 focus:ring-[#E6F5F2]" />
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full py-3.5 rounded-xl font-bold text-white text-sm disabled:opacity-60"
              style={{ background: loading ? "#6b7280" : "#0F7B6C" }}>
              {loading ? "Updating…" : "Update Password →"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return <Suspense><ResetForm /></Suspense>;
}

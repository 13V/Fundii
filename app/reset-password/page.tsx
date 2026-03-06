"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

function ResetForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase puts the token in the URL hash — just need to be on the page
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      setReady(!!data.session);
    });
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
        <h1 className="text-2xl font-bold text-[#1A1A2E] mt-4 mb-1">Set new password</h1>

        {done ? (
          <div className="text-center py-6">
            <p className="text-3xl mb-3">✅</p>
            <p className="font-semibold text-[#1A1A2E]">Password updated!</p>
            <p className="text-sm text-gray-500 mt-1">Redirecting to your dashboard…</p>
          </div>
        ) : !ready ? (
          <p className="text-sm text-gray-500 mt-4">Verifying reset link…</p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-6">
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

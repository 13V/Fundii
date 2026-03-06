"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

function LoginForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const subscribed = searchParams.get("subscribed") === "true";
  const plan = searchParams.get("plan") ?? "";
  const redirectTo = searchParams.get("redirect") ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) { setError(signInError.message); setLoading(false); return; }
      router.push(redirectTo);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Sign in failed. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF8F4] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        {subscribed && (
          <div className="bg-[#E6F5F2] border border-[#0F7B6C] rounded-2xl p-5 mb-6 text-center">
            <p className="text-2xl mb-2">🎉</p>
            <p className="font-bold text-[#0F7B6C] text-lg">Payment successful!</p>
            <p className="text-sm text-gray-600 mt-1">
              Your {plan ? plan.charAt(0).toUpperCase() + plan.slice(1) : "subscription"} plan is active. Sign in below to access your dashboard.
            </p>
          </div>
        )}
        <div className="bg-white border border-gray-200 rounded-2xl p-8">
          <div className="mb-6">
            <Link href="/" className="no-underline">
              <span className="text-xl font-extrabold text-[#1A1A2E]">GrantMate</span>
            </Link>
            <h1 className="text-2xl font-bold text-[#1A1A2E] mt-4 mb-1">Welcome back</h1>
            <p className="text-gray-500 text-sm">Sign in to access your grants and dashboard.</p>
          </div>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="you@business.com.au"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#0F7B6C] focus:ring-2 focus:ring-[#E6F5F2]" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password</label>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#0F7B6C] focus:ring-2 focus:ring-[#E6F5F2]" />
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full py-3.5 rounded-xl font-bold text-white text-sm transition-colors disabled:opacity-60"
              style={{ background: loading ? "#6b7280" : "#0F7B6C" }}>
              {loading ? "Signing in…" : "Sign In →"}
            </button>
          </form>
          <p className="text-sm text-center text-gray-500 mt-5">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-[#0F7B6C] font-semibold no-underline hover:underline">Get started</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>;
}

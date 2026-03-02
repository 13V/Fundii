"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Nav from "@/components/Nav";
import { createClient } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setError(error.message);
      else setSent(true);
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      else router.push("/dashboard");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFB]">
      <Nav />
      <div className="flex items-center justify-center px-6 py-20">
        <div className="bg-white rounded-2xl shadow-lg w-full max-w-md p-10">
          <div className="text-center mb-8">
            <Link href="/" className="no-underline">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-500 to-navy flex items-center justify-center text-white font-extrabold text-2xl mx-auto mb-4"
                style={{ background: "linear-gradient(135deg, #00897B, #1B2A4A)" }}>
                G
              </div>
            </Link>
            <h1 className="text-2xl font-extrabold" style={{ color: "#1B2A4A" }}>
              {mode === "signin" ? "Welcome back" : "Create your account"}
            </h1>
            <p className="text-gray-500 text-sm mt-2">
              {mode === "signin"
                ? "Sign in to access your saved grants and dashboard"
                : "Free account — save grants, track applications, get weekly alerts"}
            </p>
          </div>

          {sent ? (
            <div className="text-center py-8">
              <p className="text-5xl mb-4">📬</p>
              <h2 className="font-bold text-lg mb-2" style={{ color: "#1B2A4A" }}>
                Check your email
              </h2>
              <p className="text-gray-500 text-sm">
                We sent a confirmation link to <strong>{email}</strong>. Click it to activate your
                account, then come back and sign in.
              </p>
              <button
                onClick={() => { setSent(false); setMode("signin"); }}
                className="mt-6 text-sm text-teal-600 font-semibold hover:underline"
              >
                Back to sign in
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl font-bold text-sm text-white transition-colors disabled:opacity-50"
                style={{ background: "#00897B" }}
              >
                {loading
                  ? "Please wait…"
                  : mode === "signin"
                  ? "Sign In"
                  : "Create Free Account"}
              </button>
            </form>
          )}

          {!sent && (
            <p className="text-center text-sm text-gray-500 mt-6">
              {mode === "signin" ? "Don't have an account? " : "Already have an account? "}
              <button
                onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(""); }}
                className="text-teal-600 font-semibold hover:underline"
              >
                {mode === "signin" ? "Sign up free" : "Sign in"}
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

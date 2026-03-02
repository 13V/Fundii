"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase";

interface AuthModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function AuthModal({ onClose, onSuccess }: AuthModalProps) {
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
      if (error) {
        setError(error.message);
      } else {
        setSent(true);
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
      } else {
        onSuccess();
        onClose();
      }
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl"
        >
          ✕
        </button>

        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-500 to-navy flex items-center justify-center text-white font-extrabold text-xl mx-auto mb-3">
            G
          </div>
          <h2 className="text-2xl font-extrabold text-navy">
            {mode === "signin" ? "Welcome back" : "Create account"}
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            {mode === "signin"
              ? "Sign in to save grants and access your dashboard"
              : "Free account — save grants and get weekly alerts"}
          </p>
        </div>

        {sent ? (
          <div className="text-center py-6">
            <p className="text-4xl mb-3">📬</p>
            <p className="font-semibold text-navy mb-2">Check your email</p>
            <p className="text-gray-500 text-sm">
              We sent a confirmation link to <strong>{email}</strong>. Click it to activate your
              account.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
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
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password</label>
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
              <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-teal-500 text-white font-bold text-sm hover:bg-teal-600 transition-colors disabled:opacity-50"
            >
              {loading ? "Please wait…" : mode === "signin" ? "Sign In" : "Create Account"}
            </button>
          </form>
        )}

        {!sent && (
          <p className="text-center text-sm text-gray-500 mt-4">
            {mode === "signin" ? "Don't have an account? " : "Already have an account? "}
            <button
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="text-teal-600 font-semibold hover:underline"
            >
              {mode === "signin" ? "Sign up free" : "Sign in"}
            </button>
          </p>
        )}
      </div>
    </div>
  );
}

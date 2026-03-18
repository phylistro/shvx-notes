"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { loginUser } from "@/lib/api";
import ThemeToggle from "@/components/ThemeToggle";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await loginUser(email, password);
      router.push("/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--paper)" }}>
      <div className="fixed top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md animate-fadeUp">
        {/* Header */}
        <div className="text-center mb-10">
          <div
            className="inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-4"
            style={{ background: "var(--accent)", color: "white", fontSize: "20px" }}
          >
            📝
          </div>
          <h1 className="font-serif text-4xl mb-2" style={{ color: "var(--ink)" }}>
            Welcome back
          </h1>
          <p style={{ color: "var(--ink-mute)", fontSize: "15px" }}>
            Sign in to access your notes
          </p>
        </div>

        {/* Form Card */}
        <div className="rounded-2xl p-8 border" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
          {error && (
            <div
              className="mb-5 px-4 py-3 rounded-xl text-sm font-medium"
              style={{ background: "#fdf0ef", color: "var(--danger)", border: "1px solid #f5c6c3" }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--ink-soft)" }}>
                Email address
              </label>
              <input
                type="email"
                className="field w-full px-4 py-2.5 rounded-xl border text-sm"
                style={{ background: "var(--paper)", borderColor: "var(--border)", color: "var(--ink)" }}
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--ink-soft)" }}>
                Password
              </label>
              <input
                type="password"
                className="field w-full px-4 py-2.5 rounded-xl border text-sm"
                style={{ background: "var(--paper)", borderColor: "var(--border)", color: "var(--ink)" }}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-press w-full py-3 rounded-xl font-medium text-sm transition-opacity"
              style={{
                background: loading ? "var(--accent-light)" : "var(--accent)",
                color: "white",
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>

        <p className="text-center text-sm mt-5" style={{ color: "var(--ink-mute)" }}>
          Don&apos;t have an account?{" "}
          <Link href="/register" className="font-medium hover:underline" style={{ color: "var(--accent)" }}>
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LockKeyhole, ShieldCheck } from "lucide-react";

export function AdminLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        setError("Invalid admin credentials.");
        return;
      }

      router.replace("/admin");
      router.refresh();
    } catch {
      setError("Invalid admin credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12">
      <section className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl sm:p-8">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-szocial-orange text-white">
          <ShieldCheck className="h-6 w-6" />
        </span>
        <h1 className="mt-5 text-3xl font-bold text-white">Szocial Admin</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Secure operational access for moderation and platform management.
        </p>

        <form className="mt-7 space-y-4" onSubmit={submit}>
          <label className="block">
            <span className="text-sm font-semibold text-slate-200">Email</span>
            <input
              autoComplete="username"
              className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-szocial-orange"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-slate-200">Password</span>
            <input
              autoComplete="current-password"
              className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-szocial-orange"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>
          {error ? (
            <p className="rounded-2xl border border-red-900 bg-red-950/60 px-4 py-3 text-sm text-red-200">
              {error}
            </p>
          ) : null}
          <button
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-szocial-orange px-4 font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={loading}
            type="submit"
          >
            <LockKeyhole className="h-4 w-4" />
            {loading ? "Signing in..." : "Login"}
          </button>
        </form>

        <p className="mt-5 text-xs leading-5 text-slate-500">
          Admin access uses a separate server-validated session and does not use
          resident or business authentication.
        </p>
      </section>
    </main>
  );
}

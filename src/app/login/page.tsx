"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { browserSupabase } from "@/lib/supabase/client";
import { PRODUCT } from "@/lib/brand";

/**
 * Passwordless auth: email → 6-digit code → in.
 *  1. signInWithOtp({ email, shouldCreateUser: true }) emails the code
 *     (register + login are the same flow — no separate signup).
 *  2. verifyOtp({ email, token, type: 'email' }) establishes the session.
 * On success we hard-navigate to /app so the server sees the fresh cookie.
 */
export default function Login() {
  const supabase = browserSupabase();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function sendCode(e: FormEvent) {
    e.preventDefault();
    setErr(null); setMsg(null); setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true },
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setStage("code");
    setMsg(`We sent a 6-digit code to ${email.trim()}. Enter it below.`);
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    setErr(null); setBusy(true);
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: "email",
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    window.location.href = "/app"; // full navigation so SSR picks up the session
  }

  return (
    <main className="auth">
      <Link className="wordmark back" href="/">
        <span className="dot" />
        <b>{PRODUCT.name}</b>
      </Link>

      <div className="card">
        <h1>{stage === "email" ? "Sign in or create your account" : "Enter your code"}</h1>
        <p className="sub">{PRODUCT.full}</p>

        {stage === "email" ? (
          <form onSubmit={sendCode}>
            <label>Email</label>
            <input
              type="email" required autoFocus placeholder="you@company.com"
              value={email} onChange={(e) => setEmail(e.target.value)}
            />
            <button className="btn primary wide" disabled={busy || !email}>
              {busy ? "Sending…" : "Email me a code"}
            </button>
            <p className="fine">No password. We'll email you a one-time code each time.</p>
          </form>
        ) : (
          <form onSubmit={verify}>
            <label>6-digit code</label>
            <input
              inputMode="numeric" pattern="[0-9]*" maxLength={6} required autoFocus
              placeholder="123456" value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            />
            <button className="btn primary wide" disabled={busy || code.length < 6}>
              {busy ? "Verifying…" : "Verify & continue"}
            </button>
            <button type="button" className="linklike" onClick={() => { setStage("email"); setCode(""); setMsg(null); setErr(null); }}>
              ← Use a different email
            </button>
          </form>
        )}

        {msg ? <p className="ok">{msg}</p> : null}
        {err ? <p className="bad">{err}</p> : null}
      </div>
    </main>
  );
}

"use client";

import { browserSupabase } from "@/lib/supabase/client";

export function SignOutButton() {
  async function signOut() {
    await browserSupabase().auth.signOut();
    window.location.href = "/";
  }
  return (
    <button className="btn ghost sm" onClick={signOut}>Sign out</button>
  );
}

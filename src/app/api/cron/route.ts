import { NextResponse } from "next/server";
import { runCycle } from "@/lib/orchestrator";
import { activeTenant } from "@/lib/tenant";
import { env } from "@/lib/env";

export const runtime = "nodejs";

/**
 * Unattended cycle — the server-side "always-on" heartbeat. Protected by a shared
 * secret so only your scheduler can call it. Wire it to a cron trigger (e.g.
 * Vercel Cron or Supabase pg_cron) at the tenant's cadence.
 *
 * Phase 1: iterate every enabled tenant whose cadence is due, rather than the
 * single demo tenant. Autonomy still governs what runs vs. queues — the cron
 * cannot bypass the outreach lock or the mode ceiling.
 */
async function handle(req: Request) {
  const secret = env.cronSecret();
  if (secret) {
    const auth = req.headers.get("authorization") ?? "";
    const url = new URL(req.url);
    const provided = auth.replace(/^Bearer\s+/i, "") || url.searchParams.get("secret") || "";
    if (provided !== secret) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }
  try {
    const result = await runCycle(activeTenant(), "cron");
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function GET(req: Request) { return handle(req); }
export async function POST(req: Request) { return handle(req); }

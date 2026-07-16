import { NextResponse } from "next/server";
import { runCycle } from "@/lib/orchestrator";
import { svc } from "@/lib/db";
import { env } from "@/lib/env";

export const runtime = "nodejs";

/**
 * Unattended heartbeat — the server-side "always-on" cycle. Protected by a shared
 * secret so only your scheduler can call it (wired via vercel.json → Vercel Cron).
 *
 * Runs one cycle for every tenant whose engine is enabled and not killed.
 * Autonomy still governs what runs vs. queues — cron cannot bypass the mode
 * ceiling or the outreach lock. Killed engines are skipped.
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
    const { data: rows } = await svc()
      .from("governance")
      .select("tenant_id, enabled, killswitch")
      .eq("enabled", true)
      .eq("killswitch", false);

    const results: Array<{ tenant: string; ran: boolean; reason?: string }> = [];
    for (const g of rows ?? []) {
      try {
        const r = await runCycle(g.tenant_id, "cron");
        results.push({ tenant: g.tenant_id, ran: r.ran, reason: r.reason });
      } catch (e) {
        results.push({ tenant: g.tenant_id, ran: false, reason: String(e) });
      }
    }
    return NextResponse.json({ tenants: results.length, results });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function GET(req: Request) { return handle(req); }
export async function POST(req: Request) { return handle(req); }

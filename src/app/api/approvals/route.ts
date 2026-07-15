import { NextResponse } from "next/server";
import { approveQueued, dismissQueued } from "@/lib/orchestrator";
import { activeTenant } from "@/lib/tenant";

export const runtime = "nodejs";

/**
 * The one-tap decision on a queued action. Approving executes it now (still
 * gated by the outreach lock for audience-facing types); dismissing drops it.
 * Phase 1: authenticate the caller and stamp their user id as the actor.
 */
export async function POST(req: Request) {
  try {
    const { actionId, decision } = await req.json();
    if (!actionId || !["approve", "dismiss"].includes(decision)) {
      return NextResponse.json({ error: "actionId and decision (approve|dismiss) required" }, { status: 400 });
    }
    const tenantId = activeTenant();
    const actor = "console-operator"; // Phase 1: real user id from session

    if (decision === "dismiss") {
      await dismissQueued(tenantId, actionId, actor);
      return NextResponse.json({ ok: true, status: "dismissed" });
    }
    const result = await approveQueued(tenantId, actionId, actor);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

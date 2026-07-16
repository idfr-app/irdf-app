import { NextResponse } from "next/server";
import { approveQueued, dismissQueued } from "@/lib/orchestrator";
import { currentUser, getUserTenant } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * One-tap decision on a queued action. Tenant + actor come from the session, so
 * a user can only decide on their own tenant's actions, and the ledger records
 * exactly who approved. Approving still honours the outreach lock server-side.
 */
export async function POST(req: Request) {
  const user = await currentUser();
  const tenantId = await getUserTenant();
  if (!user || !tenantId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const { actionId, decision } = await req.json();
    if (!actionId || !["approve", "dismiss"].includes(decision)) {
      return NextResponse.json({ error: "actionId and decision (approve|dismiss) required" }, { status: 400 });
    }
    const actor = user.email ?? user.id;

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

import { NextResponse } from "next/server";
import { killSwitch } from "@/lib/orchestrator";
import { currentUser, getUserTenant } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * The kill switch — always works. Disarms the engine, purges the pending queue,
 * seals a governance event, and re-verifies the chain. Never deletes ledger
 * history. Tenant + actor come from the session.
 */
export async function POST() {
  const user = await currentUser();
  const tenantId = await getUserTenant();
  if (!user || !tenantId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const result = await killSwitch(tenantId, user.email ?? user.id);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

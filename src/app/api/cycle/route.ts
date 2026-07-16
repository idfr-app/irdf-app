import { NextResponse } from "next/server";
import { runCycle } from "@/lib/orchestrator";
import { getUserTenant } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * Attended cycle — triggered from the console's "Run one cycle" button.
 * The tenant is resolved from the caller's session, so a user can only ever run
 * a cycle for their OWN brand.
 */
export async function POST() {
  const tenantId = await getUserTenant();
  if (!tenantId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const result = await runCycle(tenantId, "console");
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

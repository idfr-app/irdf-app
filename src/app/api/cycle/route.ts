import { NextResponse } from "next/server";
import { runCycle } from "@/lib/orchestrator";
import { activeTenant } from "@/lib/tenant";

export const runtime = "nodejs";

/**
 * Attended cycle — triggered from the console's "Run one cycle" button.
 * Phase 1: resolve the tenant from the session and check the caller's role
 * before running. Phase 0 uses the demo tenant.
 */
export async function POST() {
  try {
    const result = await runCycle(activeTenant(), "console");
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

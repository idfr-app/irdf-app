import { NextResponse } from "next/server";
import { killSwitch } from "@/lib/orchestrator";
import { activeTenant } from "@/lib/tenant";

export const runtime = "nodejs";

/**
 * The kill switch — always works. Disarms the engine, purges the pending queue,
 * seals a governance event, and re-verifies the chain to prove the ledger is
 * intact. It never deletes ledger history (the chain is append-only).
 * Phase 1: restrict to owner/admin roles.
 */
export async function POST() {
  try {
    const result = await killSwitch(activeTenant(), "console-operator");
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

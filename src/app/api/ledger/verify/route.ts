import { NextResponse } from "next/server";
import { verify } from "@/lib/ledger";
import { activeTenant } from "@/lib/tenant";

export const runtime = "nodejs";

/**
 * Independent integrity proof for the audit ledger. Re-derives the hash chain in
 * the database (verify_ledger) and returns whether it is intact. Useful for
 * compliance exports and external monitors.
 */
export async function GET() {
  try {
    const result = await verify(activeTenant());
    return NextResponse.json({ ...result, ok: result.ok });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

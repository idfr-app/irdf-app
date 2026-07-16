import { NextResponse } from "next/server";
import { verify } from "@/lib/ledger";
import { getUserTenant } from "@/lib/auth";

export const runtime = "nodejs";

/** Independent integrity proof for the caller's own ledger. */
export async function GET() {
  const tenantId = await getUserTenant();
  if (!tenantId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const result = await verify(tenantId);
    return NextResponse.json({ ...result, ok: result.ok });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

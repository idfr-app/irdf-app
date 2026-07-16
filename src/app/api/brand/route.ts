import { NextResponse } from "next/server";
import { svc } from "@/lib/db";
import { getUserTenant } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * Save the caller's brand identity. Tenant is resolved from the session, so a
 * user can only ever edit their OWN brand. Accent is validated as a hex colour;
 * ground-truth "key: value" lines become a JSON object the radar scores against.
 */
export async function POST(req: Request) {
  const tenantId = await getUserTenant();
  if (!tenantId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const name = String(body.name ?? "").trim().slice(0, 120) || "My Brand";
    const accent = /^#[0-9a-fA-F]{6}$/.test(String(body.accent ?? "")) ? body.accent : "#6366F1";
    const tone = String(body.tone ?? "").trim().slice(0, 300) || "confident, warm, precise, plain-spoken";
    const languages = String(body.languages ?? "en")
      .split(",").map((s: string) => s.trim()).filter(Boolean).slice(0, 12);
    const groundTruth = parseKeyVals(String(body.ground_truth ?? ""));

    await svc().from("tenants").update({ name }).eq("id", tenantId);
    await svc().from("brand_core").update({
      accent,
      tone,
      languages: languages.length ? languages : ["en"],
      ground_truth: groundTruth,
      updated_at: new Date().toISOString(),
    }).eq("tenant_id", tenantId);

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

/** Parse "key: value" lines into an object; ignores blanks/malformed lines. */
function parseKeyVals(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const i = line.indexOf(":");
    if (i <= 0) continue;
    const k = line.slice(0, i).trim();
    const v = line.slice(i + 1).trim();
    if (k && v) out[k] = v;
  }
  return out;
}

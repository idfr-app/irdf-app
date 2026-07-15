import { svc } from "./db";
import { ledgerHash, GENESIS_PREV } from "./hash";
import type { LedgerKind } from "./types";

/**
 * Append-only, hash-chained ledger — the generalised, multi-tenant version of
 * IRDF's _seal()/verifyLedger(). Every Observation, Plan and Action is sealed
 * here. The DB rejects UPDATE/DELETE, and verify() re-derives the chain from
 * scratch, so tampering is detectable without trusting this code.
 */

interface Head { seq: number; hash: string; }

async function head(tenantId: string): Promise<Head> {
  const { data, error } = await svc()
    .from("ledger")
    .select("seq, hash")
    .eq("tenant_id", tenantId)
    .order("seq", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { seq: -1, hash: GENESIS_PREV }; // no genesis yet
  return { seq: data.seq, hash: data.hash };
}

/**
 * Seal one entry onto the tenant's chain. Returns the new row's seq + hash.
 * The (tenant_id, seq) and (tenant_id, hash) unique constraints make a racing
 * double-append fail cleanly rather than fork the chain — callers can retry.
 */
export async function seal(
  tenantId: string,
  kind: LedgerKind,
  payload: Record<string, unknown>,
): Promise<{ seq: number; hash: string }> {
  const h = await head(tenantId);
  const seq = h.seq + 1;
  const tsMs = Date.now();
  const hash = ledgerHash({ prevHash: h.hash, tenantId, seq, kind, payload, tsMs });

  const { error } = await svc().from("ledger").insert({
    tenant_id: tenantId,
    seq,
    kind,
    payload,
    prev_hash: h.hash,
    hash,
    ts_ms: tsMs,
  });
  if (error) throw error;
  return { seq, hash };
}

/** DB-side integrity proof. { ok, brokenSeq } — brokenSeq === -1 when clean. */
export async function verify(tenantId: string): Promise<{ ok: boolean; brokenSeq: number }> {
  const { data, error } = await svc().rpc("verify_ledger", { p_tenant: tenantId });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return { ok: !!row?.ok, brokenSeq: Number(row?.broken_seq ?? -1) };
}

export async function tail(tenantId: string, limit = 40) {
  const { data, error } = await svc()
    .from("ledger")
    .select("seq, kind, payload, hash, prev_hash, created_at")
    .eq("tenant_id", tenantId)
    .order("seq", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

import { createHash } from "crypto";

/**
 * Canonical JSON — recursively sorts object keys so the hash preimage is stable
 * and byte-for-byte identical to the Postgres `irdf_canonical()` function.
 * Arrays keep their order; objects are key-sorted; scalars use JSON.stringify.
 * This is what lets the DB independently re-verify a chain the app sealed.
 */
export function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonical(obj[k])).join(",") + "}";
}

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

/**
 * The single source of truth for a ledger row's hash.
 * Preimage: prev | tenant | seq | kind | canonical(payload) | ts_ms
 * Mirrors irdf_ledger_hash() in 0001_init.sql exactly.
 */
export function ledgerHash(args: {
  prevHash: string;
  tenantId: string;
  seq: number;
  kind: string;
  payload: unknown;
  tsMs: number;
}): string {
  const preimage = [
    args.prevHash,
    args.tenantId,
    String(args.seq),
    args.kind,
    canonical(args.payload),
    String(args.tsMs),
  ].join("|");
  return sha256Hex(preimage);
}

export const GENESIS_PREV = "IRDF-GENESIS";

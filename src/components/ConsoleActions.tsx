"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * The operator's controls — the "freedom to intervene" surface. Every button is
 * a single tap that posts to a gated API route and refreshes the console.
 * Two shapes:
 *   <ConsoleActions tenantHint={...} />   → Run cycle + Kill switch
 *   <ConsoleActions approveId={id} />     → Approve + Dismiss for one queued action
 */
export function ConsoleActions({ tenantHint, approveId }: { tenantHint?: string; approveId?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function post(url: string, body: Record<string, unknown>, tag: string) {
    setBusy(tag);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) console.error(await res.text());
    } finally {
      setBusy(null);
      router.refresh();
    }
  }

  if (approveId) {
    return (
      <>
        <button className="primary" disabled={!!busy} onClick={() => post("/api/approvals", { actionId: approveId, decision: "approve" }, "a")}>
          {busy === "a" ? "Approving…" : "Approve"}
        </button>
        <button disabled={!!busy} onClick={() => post("/api/approvals", { actionId: approveId, decision: "dismiss" }, "d")}>
          Dismiss
        </button>
      </>
    );
  }

  return (
    <div className="controls">
      <button className="primary" disabled={!!busy} onClick={() => post("/api/cycle", {}, "c")}>
        {busy === "c" ? "Running…" : "Run one cycle"}
      </button>
      <button className="danger" disabled={!!busy} onClick={() => {
        if (confirm("Kill switch disarms the engine and purges the pending queue. The ledger is preserved. Continue?")) {
          post("/api/killswitch", {}, "k");
        }
      }}>
        {busy === "k" ? "Disarming…" : "Kill switch"}
      </button>
    </div>
  );
}

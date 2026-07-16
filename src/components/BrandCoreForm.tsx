"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type BC = {
  name: string;
  accent: string;
  tone: string;
  languages: string;      // comma-separated in the form
  ground_truth: string;   // freeform "key: value" lines
};

/**
 * The tenant's brand identity — one accent + one voice that flows through their
 * console and every generated asset. This is where a new brand owner makes
 * BI-NET theirs. Saves via /api/brand (session-scoped, server-side).
 */
export function BrandCoreForm({ initial }: { initial: BC }) {
  const router = useRouter();
  const [bc, setBc] = useState<BC>(initial);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  function set<K extends keyof BC>(k: K, v: BC[K]) {
    setBc((p) => ({ ...p, [k]: v }));
    setSaved(false);
  }

  async function save() {
    setBusy(true); setSaved(false);
    try {
      const res = await fetch("/api/brand", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(bc),
      });
      if (!res.ok) throw new Error(await res.text());
      setSaved(true);
      router.refresh();
    } catch (e) {
      alert("Could not save brand: " + String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="brandkit">
      <div className="bk-head">
        <div className="bk-swatch" style={{ background: bc.accent }} />
        <div className="bk-name">
          <b>{bc.name || "Your brand"}</b>
          <span>{bc.tone}</span>
        </div>
        <button className="btn ghost sm" onClick={() => setOpen((o) => !o)}>
          {open ? "Close" : "Edit brand"}
        </button>
      </div>

      {open ? (
        <div className="bk-body">
          <div className="fld">
            <label>Brand name</label>
            <input value={bc.name} onChange={(e) => set("name", e.target.value)} placeholder="Acme Labs" />
          </div>
          <div className="fld row">
            <div>
              <label>Accent colour</label>
              <input type="color" value={bc.accent} onChange={(e) => set("accent", e.target.value)} />
            </div>
            <div className="grow">
              <label>Hex</label>
              <input value={bc.accent} onChange={(e) => set("accent", e.target.value)} placeholder="#6366F1" />
            </div>
          </div>
          <div className="fld">
            <label>Tone of voice</label>
            <input value={bc.tone} onChange={(e) => set("tone", e.target.value)} placeholder="confident, warm, precise, plain-spoken" />
          </div>
          <div className="fld">
            <label>Languages (comma-separated)</label>
            <input value={bc.languages} onChange={(e) => set("languages", e.target.value)} placeholder="en, hi" />
          </div>
          <div className="fld">
            <label>Ground-truth facts <span className="hint">— what the radar checks AI answers against. One per line, e.g. <code>offers: GEO audits</code></span></label>
            <textarea rows={4} value={bc.ground_truth} onChange={(e) => set("ground_truth", e.target.value)} placeholder={"category: brand intelligence\noffers: AI-perception tracking, content generation\nfounded: 2026"} />
          </div>
          <div className="bk-actions">
            <button className="btn primary" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save brand"}</button>
            {saved ? <span className="ok inline">Saved ✓</span> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

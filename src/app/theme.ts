import type { CSSProperties } from "react";
import type { BrandCore } from "@/lib/types";

/**
 * The console's accent is not a design choice made here — it is the tenant's
 * Brand Core accent, the same value that flows into every generated asset. One
 * brand, everywhere. This maps the Brand Core onto CSS custom properties that
 * the whole console reads.
 */
export function brandStyle(bc: Pick<BrandCore, "accent" | "accentInk">): CSSProperties {
  return {
    // consumed in globals.css via var(--accent)
    ["--accent" as string]: bc.accent,
    ["--accent-ink" as string]: bc.accentInk,
  };
}

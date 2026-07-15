import "./globals.css";
import type { ReactNode } from "react";
import { loadBrandCore } from "@/lib/brandCore";
import { brandStyle } from "./theme";
import { DEMO_TENANT } from "@/lib/tenant";

export const metadata = {
  title: "IRDF-APP · Brand Brain",
  description: "See how AI and the internet perceive your brand — then shape it, generate it, and ship it, with you in control.",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Phase 0: theme from the demo tenant's Brand Core. Phase 1 resolves the tenant
  // from the signed-in session and applies that tenant's accent instead.
  let style = {};
  try {
    const bc = await loadBrandCore(DEMO_TENANT);
    style = brandStyle(bc);
  } catch {
    // env not configured yet — fall back to the CSS default accent.
  }
  return (
    <html lang="en">
      <body style={style}>{children}</body>
    </html>
  );
}

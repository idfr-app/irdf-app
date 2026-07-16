import "./globals.css";
import type { ReactNode, CSSProperties } from "react";
import { PRODUCT } from "@/lib/brand";

export const metadata = {
  title: `${PRODUCT.name} — ${PRODUCT.full}`,
  description: PRODUCT.tagline,
};

/**
 * The product shell wears BI-NET's own accent (see src/lib/brand.ts). Inside a
 * tenant's console (/app), that tenant's Brand Core accent overrides it locally,
 * so every brand still shows up in its own colour where it matters.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  const shell = {
    ["--accent" as string]: PRODUCT.accent,
    ["--accent-ink" as string]: PRODUCT.accentInk,
  } as CSSProperties;
  return (
    <html lang="en">
      <body style={shell}>{children}</body>
    </html>
  );
}

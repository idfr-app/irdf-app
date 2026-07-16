/**
 * BI-NET product identity — the single source of truth.
 *
 * Requirement: the name "BI-NET" always travels with its full form,
 * "Brand Intelligence & Narrative Engine Technology", everywhere in the product.
 * Import from here; never hard-code the name or full form inline.
 *
 * NOTE: This is the BI-NET *product* brand (the console chrome, marketing, admin).
 * Each tenant's own accent/tone lives in their Brand Core and themes THEIR console
 * — that is a separate thing from this product identity.
 */
export const PRODUCT = {
  name: "BI-NET",
  full: "Brand Intelligence & Narrative Engine Technology",
  /** Use in titles/headers where the name should carry its meaning. */
  label: "BI-NET — Brand Intelligence & Narrative Engine Technology",
  tagline:
    "See how AI and the internet perceive your brand — then shape it, generate it, and ship it, with you in control.",

  // BI-NET's own product accent (the chrome). Change these two values to
  // re-skin the whole product shell; tenant consoles are themed separately.
  accent: "#6366F1",
  accentInk: "#FFFFFF",
} as const;

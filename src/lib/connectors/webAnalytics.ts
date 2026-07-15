import type { Connector, ConnectorContext } from "./types";
import type { Signal } from "../types";

/**
 * Web analytics — the one connector Phase 0 ships with.
 *
 * Phase 0 returns a DETERMINISTIC STUB shaped exactly like a real provider
 * response, so the whole Observe → Orient → Generate → Act loop runs end-to-end
 * with no external account. To go live, replace fetchStub() with a call to your
 * analytics provider (GA4 / Plausible / Umami); the Signal[] contract does not
 * change, and nothing downstream needs touching. This is the "add-on layer"
 * that keeps the sensor layer platform-agnostic.
 */
export const webAnalytics: Connector = {
  kind: "web_analytics",
  label: "Website analytics",
  async fetchSignals(ctx: ConnectorContext): Promise<Signal[]> {
    const provider = String(ctx.config?.provider ?? "stub");
    if (provider !== "stub") {
      // TODO(Phase 1): dispatch to the real provider adapter based on config.
      // return await realAnalyticsAdapter(provider, ctx);
    }
    return fetchStub(ctx);
  },
};

function fetchStub(ctx: ConnectorContext): Signal[] {
  const now = Date.now();
  // Deterministic-ish numbers derived from the day, so cycles differ but repeat
  // stably within a day (handy for demos and tests).
  const daySeed = new Date().getUTCDate();
  const sessions = 40 + (daySeed * 7) % 60;
  const signups = Math.max(0, Math.round(sessions * (0.06 + (daySeed % 5) / 100)));
  const topPage = ["/rent-agreement", "/legal-notice", "/nda", "/affidavit"][daySeed % 4];
  const bounce = 42 + (daySeed % 30);

  const s = (key: string, value: number | string, label: string): Signal => ({
    source: "web_analytics", key, value, label, at: now,
    meta: { property: ctx.config?.property ?? null },
  });

  return [
    s("sessions_24h", sessions, `${sessions} sessions in the last 24h`),
    s("signups_24h", signups, `${signups} sign-ups in the last 24h`),
    s("top_page", topPage, `Top landing page: ${topPage}`),
    s("bounce_rate", bounce, `Bounce rate ${bounce}%`),
    s("conversion_pct", Math.round((signups / Math.max(1, sessions)) * 100),
      `Conversion ~${Math.round((signups / Math.max(1, sessions)) * 100)}%`),
  ];
}

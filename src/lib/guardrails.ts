import type { AutonomyMode, Governance, PlannedAction, Risk } from "./types";

/**
 * The ALLOWLIST. The orchestrator can only ever emit these action types — the
 * generalised, brand-agnostic version of IRDF_ACTIONS. Everything audience-facing
 * carries outreach:true and is gated by the outreach lock; nothing here can touch
 * secrets, keys or infrastructure (there is simply no such action to emit).
 *
 *   risk:       low | med | high   — auto-exec ceiling per autonomy mode
 *   reversible: true if it leaves no outward footprint (draft/flag/note)
 *   outreach:   true if the intent would reach a REAL audience (lock-gated)
 */
export interface ActionMeta {
  risk: Risk;
  reversible: boolean;
  outreach: boolean;
  domain: string;
  label: string;
}

export const ACTION_CATALOGUE: Record<string, ActionMeta> = {
  "perception.probe":  { risk: "low",  reversible: true,  outreach: false, domain: "radar",   label: "Probe AI answer-engines for how they describe the brand" },
  "content.blog":      { risk: "low",  reversible: true,  outreach: false, domain: "content", label: "Draft an owned blog asset (source of truth)" },
  "content.social":    { risk: "low",  reversible: true,  outreach: false, domain: "content", label: "Draft platform-native social posts that funnel to the blog" },
  "content.seo":       { risk: "low",  reversible: true,  outreach: false, domain: "content", label: "Draft an SEO pack (keywords, title, meta)" },
  "content.geo":       { risk: "low",  reversible: true,  outreach: false, domain: "content", label: "Draft a GEO asset so AI engines learn the brand correctly" },
  "content.email":     { risk: "med",  reversible: true,  outreach: true,  domain: "outreach",label: "Draft an email campaign" },
  "content.whatsapp":  { risk: "med",  reversible: true,  outreach: true,  domain: "outreach",label: "Draft a WhatsApp/SMS broadcast" },
  "ux.flag":           { risk: "low",  reversible: true,  outreach: false, domain: "product", label: "Flag a high-friction step for the product team" },
  "ops.alert":         { risk: "low",  reversible: true,  outreach: false, domain: "ops",     label: "Raise an internal alert" },
  "ops.brief":         { risk: "low",  reversible: true,  outreach: false, domain: "ops",     label: "Generate an operator brief" },
  "pricing.suggest":   { risk: "high", reversible: true,  outreach: false, domain: "pricing", label: "Propose a reversible pricing experiment (suggestion only)" },
};

export const RISK_RANK: Record<Risk, number> = { low: 0, med: 1, high: 2 };

export function isAllowed(type: string): boolean {
  return Object.prototype.hasOwnProperty.call(ACTION_CATALOGUE, type);
}

/**
 * Auto-exec ceiling by mode: which risk tiers may run WITHOUT a human tap.
 *   manual → nothing runs automatically
 *   semi   → low-risk only
 *   full   → low + med (never high, never outreach — see canAuto)
 */
export function autoCeiling(mode: AutonomyMode): number {
  if (mode === "full") return RISK_RANK.med;   // low + med
  if (mode === "semi") return RISK_RANK.low;   // low only
  return -1;                                    // manual: none
}

export interface DayUsage { autoActions: number; }

/**
 * Can this action execute automatically right now? Every hard rule from the
 * autonomy model lives here in one place:
 *  - kill switch off, engine on
 *  - never auto-touch a real audience (outreach)            [absolute]
 *  - never auto-run irreversible actions                    [absolute]
 *  - respect the mode's risk ceiling
 *  - respect the daily auto-exec budget
 */
export function canAuto(
  action: PlannedAction,
  gov: Governance,
  usage: DayUsage,
): boolean {
  if (!isAllowed(action.type)) return false;
  if (gov.killswitch || !gov.enabled) return false;
  if (action.outreach) return false;              // audience-facing never auto-runs
  if (!action.reversible) return false;
  const ceil = autoCeiling(gov.mode);
  if (ceil < 0) return false;
  if (RISK_RANK[action.risk] > ceil) return false;
  if (usage.autoActions >= gov.maxAutoPerDay) return false;
  return true;
}

/** Why an audience-facing action is being held (for the queue/console). */
export function outreachGate(action: PlannedAction, gov: Governance): string | null {
  if (!action.outreach) return null;
  if (!gov.outreachUnlocked) {
    return "Outreach lock is closed — draft held. Open the lock to allow audience-facing actions.";
  }
  return null;
}

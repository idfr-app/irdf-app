// ── Shared domain types ──────────────────────────────────────────────────────

export type AutonomyMode = "manual" | "semi" | "full";
export type Risk = "low" | "med" | "high";
export type LedgerKind = "observe" | "plan" | "act" | "govern";

export type ActionStatus =
  | "proposed" | "queued" | "approved" | "executed" | "dismissed" | "blocked";

export interface BrandCore {
  tenantId: string;
  accent: string;
  accentInk: string;
  tone: string;
  languages: string[];
  lexiconDo: string[];
  lexiconDont: string[];
  forbiddenClaims: string[];
  groundTruth: Record<string, unknown>;
}

export interface Governance {
  tenantId: string;
  enabled: boolean;
  mode: AutonomyMode;
  outreachUnlocked: boolean;
  killswitch: boolean;
  cadenceMinutes: number;
  maxAutoPerDay: number;
  maxActionsPerDay: number;
}

/** A normalised signal emitted by a connector's fetchSignals(). */
export interface Signal {
  source: string;            // connector kind, e.g. 'web_analytics'
  key: string;               // metric/observation name
  value: number | string | null;
  label: string;             // human phrase for the planner/console
  at: number;                // epoch ms
  meta?: Record<string, unknown>;
}

/** The unified reality snapshot for one Observe cycle. */
export interface Snapshot {
  tenantId: string;
  takenAt: number;
  signals: Signal[];
  perception: PerceptionSummary;
}

export interface PerceptionSummary {
  probed: boolean;
  models: string[];
  presenceRate: number | null;    // 0..1
  avgAccuracy: number | null;     // 0..1 vs ground truth
  avgSentiment: number | null;    // -1..1
  shareOfVoice: number | null;    // 0..1 vs competitors
  gaps: string[];                 // human-readable detected errors/gaps
}

/** A candidate action the planner proposes (must be in the allowlist). */
export interface PlannedAction {
  type: string;
  priority: number;              // 1..5
  risk: Risk;
  reversible: boolean;
  outreach: boolean;
  title: string;
  rationale: string;
  context?: Record<string, unknown>;   // e.g. { story, format, language }
}

export interface CycleResult {
  ran: boolean;
  reason?: string;               // when ran === false
  via?: "rules" | "ai";
  snapshotId?: string;
  executed: Array<{ type: string; status: ActionStatus; assetId?: string }>;
  queued: Array<{ id: string; type: string }>;
}

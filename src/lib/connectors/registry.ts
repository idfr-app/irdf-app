import type { Connector } from "./types";
import { webAnalytics } from "./webAnalytics";

/**
 * The registry of installed connectors. Adding a new data source = implement the
 * Connector interface and register it here. Phase 1 adds search_console, social,
 * crm; each is one entry below with zero orchestrator changes.
 */
const REGISTRY: Record<string, Connector> = {
  [webAnalytics.kind]: webAnalytics,
};

export function getConnector(kind: string): Connector | null {
  return REGISTRY[kind] ?? null;
}

export function registeredKinds(): string[] {
  return Object.keys(REGISTRY);
}

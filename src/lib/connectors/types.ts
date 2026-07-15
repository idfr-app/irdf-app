import type { Signal } from "../types";

/** Context passed to a connector on each Observe tick. */
export interface ConnectorContext {
  tenantId: string;
  config: Record<string, unknown>;   // NON-secret config from the connectors table
}

/**
 * The whole sensor layer is this one small interface — the generalised version
 * of IRDF's observe(). New data sources (search console, social, CRM, product
 * signals) are add-ons that implement fetchSignals(); nothing else changes.
 */
export interface Connector {
  kind: string;                                   // matches connectors.kind
  label: string;
  fetchSignals(ctx: ConnectorContext): Promise<Signal[]>;
}

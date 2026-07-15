/** The seeded demo tenant (see 0002_seed.sql). */
export const DEMO_TENANT = "00000000-0000-0000-0000-000000000001";

/**
 * Phase 1: resolve the active tenant from the signed-in session + memberships,
 * and use the RLS-scoped userClient for all reads. Phase 0 uses DEMO_TENANT so
 * the console runs the moment migrations + env are in place.
 */
export function activeTenant(): string {
  return process.env.IRDF_DEMO_TENANT || DEMO_TENANT;
}

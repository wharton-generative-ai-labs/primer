/**
 * Pick the initial agent key for `PlayPage`.
 *
 * Resolution order:
 *   1. The authored `initialAgent` from the experience config (propagated via
 *      `ConfigResponse.metadata` and surfaced on `ExperienceMetadata`).
 *   2. The first key of the agents map (legacy fallback for experiences that
 *      don't declare `initialAgent`).
 *   3. Empty string when neither is available.
 *
 * Extracted from `PlayPage` so the precedence is unit-testable without
 * mounting the full play surface (which requires several context providers).
 */
export function resolveInitialAgentKey(
  agents: Record<string, unknown> | undefined,
  authoredInitialAgent?: string
): string {
  if (authoredInitialAgent) {
    return authoredInitialAgent;
  }
  if (agents) {
    const first = Object.keys(agents)[0];
    if (first) return first;
  }
  return '';
}

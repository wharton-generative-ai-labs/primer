/**
 * Phase membership computation.
 *
 * Determines which agent keys belong to which workflow phase. A phase's
 * "members" are the agents an agent can transfer to without leaving the
 * phase — its `initialAgent` (and `reentryAgent`, if set) plus everything
 * reachable via `downstreamAgents`, stopping at the boundary formed by
 * *other* phases' anchor agents.
 *
 * Used by the `agent` tool to filter `transfer` targets so a frontend agent
 * cannot accidentally cross a phase boundary by delegating instead of calling
 * `workflowPhase.nextPhase` / `workflowPhase.set`.
 */

import type { AgentConfig } from '@/app/lib/types';

import type { WorkflowPhaseConfig } from './types';

export interface PhaseMembership {
  /** Agent keys belonging to this phase. */
  members: Set<string>;
}

export type PhaseMemberships = Record<string, PhaseMembership>;

/**
 * Resolve a `downstreamAgents` entry (key string, name string, or
 * `{ name }` object) to an agent key from the experience's `agents` map.
 * Returns `undefined` when nothing matches — the caller skips it.
 */
function resolveDownstreamRef(
  ref: string | { name?: string },
  agents: Record<string, AgentConfig>,
): string | undefined {
  const raw = typeof ref === 'string' ? ref : ref?.name;
  if (!raw) return undefined;
  if (agents[raw]) return raw;
  // Match by display name, case-insensitive.
  const lower = raw.toLowerCase();
  for (const [key, cfg] of Object.entries(agents)) {
    if (key.toLowerCase() === lower) return key;
    if (cfg?.name && cfg.name.toLowerCase() === lower) return key;
  }
  return undefined;
}

/**
 * Anchor agents for a phase — `initialAgent` plus `reentryAgent`, deduped.
 * These are the agents authoritatively "owned" by the phase.
 */
function phaseAnchors(phase: WorkflowPhaseConfig): string[] {
  const anchors: string[] = [];
  if (phase.initialAgent) anchors.push(phase.initialAgent);
  if (phase.reentryAgent && phase.reentryAgent !== phase.initialAgent) {
    anchors.push(phase.reentryAgent);
  }
  return anchors;
}

/**
 * Compute phase membership for every phase in the experience.
 *
 * Algorithm: anchor agents (`initialAgent` / `reentryAgent`) for each phase
 * are the seed set. From each seed, BFS the `downstreamAgents` graph, adding
 * every reachable agent to the phase's member set. Traversal halts at any
 * agent that is an anchor of a *different* phase — that agent is owned by
 * its own phase and is not included here.
 *
 * Side effects: none. Pure of `phases` and `agents`.
 */
export function computePhaseMemberships(
  phases: WorkflowPhaseConfig[],
  agents: Record<string, AgentConfig>,
): PhaseMemberships {
  const memberships: PhaseMemberships = {};
  if (phases.length === 0) return memberships;

  // For each agent key, the set of phases that name it as an anchor.
  const anchorOwners = new Map<string, Set<string>>();
  for (const phase of phases) {
    for (const anchor of phaseAnchors(phase)) {
      if (!agents[anchor]) continue;
      if (!anchorOwners.has(anchor)) anchorOwners.set(anchor, new Set());
      anchorOwners.get(anchor)!.add(phase.id);
    }
  }

  for (const phase of phases) {
    const members = new Set<string>();
    const anchors = phaseAnchors(phase).filter((a) => agents[a] !== undefined);

    if (anchors.length === 0) {
      memberships[phase.id] = { members };
      continue;
    }

    const queue: string[] = [...anchors];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (members.has(current)) continue;

      // Boundary check: agent is anchored to a *different* phase only.
      const owners = anchorOwners.get(current);
      if (owners && !owners.has(phase.id)) {
        // Owned by another phase exclusively — don't include, don't traverse.
        continue;
      }

      members.add(current);

      const downstream = agents[current]?.downstreamAgents ?? [];
      for (const ref of downstream) {
        const key = resolveDownstreamRef(ref, agents);
        if (key && !members.has(key)) queue.push(key);
      }
    }

    memberships[phase.id] = { members };
  }

  return memberships;
}

/**
 * Convenience helper: is `agentKey` a member of `phaseId`?
 *
 * Returns `true` when there are no phases (single-screen mode) or when the
 * phase is unknown — callers in non-phased contexts should treat membership
 * as unrestricted, and unknown phase ids must not silently block transfers.
 */
export function isAgentInPhase(
  memberships: PhaseMemberships,
  phaseId: string | undefined,
  agentKey: string,
): boolean {
  if (!phaseId) return true;
  const phase = memberships[phaseId];
  if (!phase) return true;
  return phase.members.has(agentKey);
}

/**
 * Find which phase(s) an agent anchors. Used to point an agent that tried
 * to cross a boundary at the right `workflowPhase` op.
 */
export function findAnchoringPhase(
  phases: WorkflowPhaseConfig[],
  agentKey: string,
): WorkflowPhaseConfig | undefined {
  return phases.find(
    (p) => p.initialAgent === agentKey || p.reentryAgent === agentKey,
  );
}

/**
 * Find the phase an agent lives in. Prefers the phase the agent *anchors*
 * (cleanest signal); falls back to the first phase whose member set contains
 * the agent (downstream-only agents). Returns `undefined` only when the agent
 * is in no phase at all.
 */
export function findContainingPhase(
  phases: WorkflowPhaseConfig[],
  memberships: PhaseMemberships,
  agentKey: string,
): string | undefined {
  const anchor = findAnchoringPhase(phases, agentKey);
  if (anchor) return anchor.id;
  for (const [phaseId, m] of Object.entries(memberships)) {
    if (m.members.has(agentKey)) return phaseId;
  }
  return undefined;
}

/**
 * Workflow-phase error classes.
 *
 * Extracted from `WorkflowPhaseManager.ts` so `loadWorkflowPhases.ts` can
 * throw `InvalidPhaseError` without creating a circular import (the manager
 * already imports the loader). The manager re-exports both classes for
 * backwards compatibility with the existing import sites
 * (`route.ts`, `HarnessToolContext.ts`, the manager test suite, and the
 * runtime `error.name === 'InvalidPhaseError'` string check in
 * `src/app/api/backend-agent/utils/context.ts`). The `name` strings here
 * MUST stay verbatim — that string check is the only signal the backend-
 * agent has when distinguishing a phase-validation failure from an
 * unexpected runtime error.
 */

/**
 * Thrown when a transition request names a phase that doesn't exist, or when
 * a forward-only op (e.g. `set`, `setNext`) is given a backward / current id.
 * Also thrown by the config loader when `workflowPhases` validation fails
 * (duplicate ids, missing ids, unknown agent references, or an
 * `initialWorkflowPhase` that doesn't match any declared phase id) — that
 * gives the transition route a single error class to convert into a 400
 * with the underlying message.
 */
export class InvalidPhaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidPhaseError';
  }
}

/**
 * Thrown when `advance` is called from the last phase with no
 * `nextPhaseOverride` set. The caller is expected to surface this as
 * "the agent should have called finishExperience".
 */
export class NoNextPhaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NoNextPhaseError';
  }
}

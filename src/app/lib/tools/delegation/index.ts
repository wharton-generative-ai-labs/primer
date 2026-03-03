/**
 * Delegation tools for offloading work to backend agents.
 *
 * The delegate() function is now invoked via the unified 'agent' tool
 * (action: 'delegate') in agent-tool.ts. This module still exports the
 * function and the DelegationManager for use by that tool and the UI.
 */

import { delegate } from './delegate';

export { delegate };

export * from './DelegationManager';

/**
 * @deprecated Delegation is now an action of the 'agent' builtin tool.
 * Kept as a no-op for backward compatibility with legacy plugin loading.
 */
export async function registerDelegationTools(): Promise<void> {
  // no-op: delegate is now registered as part of the agent tool
}


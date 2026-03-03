/**
 * DelegationManager
 * 
 * Manages the state of active backend delegations.
 * Tracks which agents are currently running and their status messages.
 */

import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('DelegationManager');

export interface ActiveDelegation {
  id: string;
  agentType: string;
  agentName?: string; // Friendly name of the agent (set by backend)
  status: string; // Current status (kept for backwards compatibility)
  statusHistory: Array<{
    text: string;
    toolName?: string;
    action?: string;
  }>; // Last 5 status updates in chronological order
  startTime: number;
}

class DelegationManager {
  private activeDelegations: Map<string, ActiveDelegation> = new Map();
  private listeners: Set<() => void> = new Set();

  /**
   * Register a new delegation
   */
  startDelegation(id: string, agentType: string): void {
    const delegation: ActiveDelegation = {
      id,
      agentType,
      status: 'Running',
      statusHistory: [{ text: 'Running' }],
      startTime: Date.now()
    };
    
    this.activeDelegations.set(id, delegation);
    this.notifyListeners();
    logger.debug({ delegation }, 'Started delegation');
  }

  /**
   * Update the status message of an active delegation
   */
  updateDelegationStatus(
    id: string, 
    status: string, 
    agentName?: string,
    toolName?: string,
    action?: string
  ): void {
    const delegation = this.activeDelegations.get(id);
    if (delegation) {
      delegation.status = status;
      
      // Remove "Thinking" from history if it's the last item (it's ephemeral)
      if (delegation.statusHistory.length > 0) {
        const lastText = delegation.statusHistory[delegation.statusHistory.length - 1].text;
        if (lastText === 'Thinking' || lastText === 'Thinking...') {
          delegation.statusHistory.pop();
        }
      }
      
      // Add to status history, keeping only the last 5
      delegation.statusHistory.push({
        text: status,
        toolName,
        action
      });
      if (delegation.statusHistory.length > 5) {
        delegation.statusHistory.shift(); // Remove oldest
      }
      
      if (agentName !== undefined) {
        delegation.agentName = agentName;
      }
      this.activeDelegations.set(id, delegation);
      this.notifyListeners();
      logger.debug({ id, status, agentName, toolName, action }, 'Updated delegation status');
    } else {
      // Auto-create delegation entry (server-initiated delegations skip startDelegation)
      const newDelegation: ActiveDelegation = {
        id,
        agentType: agentName || 'unknown',
        agentName,
        status,
        statusHistory: [{ text: status, toolName, action }],
        startTime: Date.now()
      };
      this.activeDelegations.set(id, newDelegation);
      this.notifyListeners();
      logger.debug({ id, status, agentName }, 'Auto-created delegation from status update');
    }
  }

  /**
   * Complete and remove a delegation
   */
  completeDelegation(id: string): void {
    const delegation = this.activeDelegations.get(id);
    if (delegation) {
      this.activeDelegations.delete(id);
      this.notifyListeners();
      logger.debug({
        id,
        duration: Date.now() - delegation.startTime
      }, 'Completed delegation');
    }
  }

  /**
   * Get all active delegations
   */
  getActiveDelegations(): ActiveDelegation[] {
    return Array.from(this.activeDelegations.values());
  }

  /**
   * Get a specific delegation by ID
   */
  getDelegation(id: string): ActiveDelegation | undefined {
    return this.activeDelegations.get(id);
  }

  /**
   * Check if there are any active delegations
   */
  hasActiveDelegations(): boolean {
    return this.activeDelegations.size > 0;
  }

  /**
   * Subscribe to delegation state changes
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all listeners of state changes
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener());
  }

  /**
   * Clear all delegations (useful for cleanup/reset)
   */
  clearAll(): void {
    this.activeDelegations.clear();
    this.notifyListeners();
    logger.debug({}, 'Cleared all delegations');
  }
}

// Singleton instance
let delegationManager: DelegationManager | null = null;

/**
 * Get the singleton DelegationManager instance
 */
export function getDelegationManager(): DelegationManager {
  if (!delegationManager) {
    delegationManager = new DelegationManager();
  }
  return delegationManager;
}

/**
 * Subscribe to delegation state updates
 */
export function subscribeToStateUpdates(listener: () => void): () => void {
  return getDelegationManager().subscribe(listener);
}


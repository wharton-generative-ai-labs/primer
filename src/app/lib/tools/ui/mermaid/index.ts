/**
 * Mermaid plugin public API
 * Exports managers, components, and types for external use
 */

export { getMermaidManager, createMermaidManager, getCurrentDiagram, subscribeToStateUpdates } from './MermaidManager';
export { MermaidDiagram } from './MermaidDiagram';
export type { MermaidToolContext, MermaidManager, MermaidToolResponse } from './types';


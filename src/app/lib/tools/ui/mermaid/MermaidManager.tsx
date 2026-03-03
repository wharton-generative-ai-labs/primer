"use client";

import { MermaidManager } from './types';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('MermaidManager');

// This is a singleton instance that will be used to manage Mermaid diagrams
let mermaidManagerInstance: MermaidManager | null = null;

// Store diagram data instead of React elements
let currentDiagram: { title: string; diagram: string } | null = null;

// State update listeners for subscription pattern
let stateUpdateListeners: (() => void)[] = [];

// Function to notify listeners of state changes
const notifyStateUpdate = () => {
  stateUpdateListeners.forEach(listener => listener());
};

// Subscribe to state updates
export const subscribeToStateUpdates = (listener: () => void): (() => void) => {
  stateUpdateListeners.push(listener);
  return () => {
    stateUpdateListeners = stateUpdateListeners.filter(l => l !== listener);
  };
};

// Get current diagram data
export const getCurrentDiagram = (): { title: string; diagram: string } | null => {
  return currentDiagram;
};

// Set diagram data
export const setDiagramData = (data: { title: string; diagram: string } | null) => {
  currentDiagram = data;
  notifyStateUpdate();
};

// This is the implementation of the MermaidManager
class MermaidManagerImpl implements MermaidManager {
  showMermaidDiagram(title: string, diagram: string): { result: boolean } {
    try {
      // Store the diagram data
      setDiagramData({ title, diagram });
      
      return { result: true };
    } catch (error) {
      logger.error(error, 'Error showing Mermaid diagram');
      return { result: false };
    }
  }

  hideDiagram(): { result: boolean } {
    try {
      // Clear the diagram data
      setDiagramData(null);
      
      return { result: true };
    } catch (error) {
      logger.error(error, 'Error hiding diagram');
      return { result: false };
    }
  }
}

// This is a function to create a new MermaidManager
export const createMermaidManager = (): MermaidManager => {
  if (!mermaidManagerInstance) {
    mermaidManagerInstance = new MermaidManagerImpl();
  }
  return mermaidManagerInstance;
};

// This is a function to get the MermaidManager instance
export const getMermaidManager = (): MermaidManager => {
  if (!mermaidManagerInstance) {
    mermaidManagerInstance = new MermaidManagerImpl();
  }
  return mermaidManagerInstance;
};


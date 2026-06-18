"use client";

/**
 * ComponentManager - Core runtime for custom React components
 * 
 * Phase 0: Runtime Validation
 * 
 * Responsibilities:
 * - Load component code from API
 * - Compile JSX with Babel (import stripping)
 * - Inject scope (React, shadcn/ui, libraries)
 * - Manage component instances
 * - Handle state synchronization
 * - Rate limiting and performance monitoring
 */

import React from 'react';
import { 
  ComponentInfo, 
  CompiledComponent, 
  ComponentScope, 
  ComponentInstance,
  PrimerComponentProps,
  ComponentEvent,
  ComponentStateChangeEvent
} from './types';
import { generateUUID } from '@/app/lib/uuid';
import { createModuleLogger } from '@/lib/logger';

// Import all shadcn/ui components
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Card, 
  CardHeader, 
  CardContent, 
  CardFooter, 
  CardTitle, 
  CardDescription 
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem
} from '@/components/ui/select';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Toggle } from '@/components/ui/toggle';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider
} from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel
} from '@/components/ui/alert-dialog';
import { Slider } from '@/components/ui/slider';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  ChartStyle
} from '@/components/ui/chart';
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuCheckboxItem,
  ContextMenuRadioItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuGroup,
  ContextMenuPortal,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuRadioGroup
} from '@/components/ui/context-menu';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup
} from '@/components/ui/dropdown-menu';
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent
} from '@/components/ui/hover-card';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  Toast,
  ToastProvider,
  ToastViewport,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction
} from '@/components/ui/toast';

const logger = createModuleLogger('ComponentManager');

// Singleton instance
let componentManagerInstance: ComponentManager | null = null;

// Cache for loaded components
const componentCache: Map<string, CompiledComponent> = new Map();

// Active component instances
const activeInstances: Map<string, ComponentInstance> = new Map();

// State update listeners
let stateUpdateListeners: (() => void)[] = [];

// Rate limiting for state updates (100ms throttle)
const stateUpdateQueue: Map<string, { updates: Record<string, any>, timeout: NodeJS.Timeout }> = new Map();

/**
 * Notify all listeners of state changes.
 */
const notifyStateUpdate = () => {
  stateUpdateListeners.forEach(listener => listener());
};

/**
 * Subscribe to state updates.
 */
export const subscribeToStateUpdates = (listener: () => void) => {
  stateUpdateListeners.push(listener);
  return () => {
    stateUpdateListeners = stateUpdateListeners.filter(l => l !== listener);
  };
};

/**
 * Get all active component instances for rendering.
 */
export const getActiveComponentInstances = (): ComponentInstance[] => {
  return Array.from(activeInstances.values());
};

/**
 * Strip import and export statements from component JSX before Babel compilation.
 *
 * Components are executed in a sandboxed `new Function()` scope where React,
 * hooks, and shadcn/ui components are already injected as parameters. Any
 * `import` statement left in the code will be transpiled by Babel into a
 * variable declaration that collides with the injected scope bindings,
 * causing "Identifier '...' has already been declared" errors at runtime.
 *
 * `[\s\S]` is used instead of `.` so that the pattern crosses newlines
 * and multi-line named imports are fully removed:
 *
 *   import {
 *     useState,
 *     useEffect
 *   } from 'react';
 */
export function stripImportsFromComponent(jsxCode: string): {
  cleanedCode: string;
  defaultExportName: string | null;
} {
  let defaultExportName: string | null = null;

  const defaultFunctionMatch = jsxCode.match(/export\s+default\s+function\s+(\w+)/);
  if (defaultFunctionMatch) {
    defaultExportName = defaultFunctionMatch[1];
  }

  if (!defaultExportName) {
    const defaultClassMatch = jsxCode.match(/export\s+default\s+class\s+(\w+)/);
    if (defaultClassMatch) {
      defaultExportName = defaultClassMatch[1];
    }
  }

  if (!defaultExportName) {
    const defaultIdentifierMatch = jsxCode.match(/export\s+default\s+([A-Z]\w*)\s*;/);
    if (defaultIdentifierMatch) {
      defaultExportName = defaultIdentifierMatch[1];
    }
  }

  const cleanedCode = jsxCode
    .replace(/import\s+[\s\S]*?from\s+['"].*?['"];?\s*/g, '')
    .replace(/export\s+default\s+/g, '')
    .replace(/export\s+\{[^}]*\}\s*;?\s*/g, '');

  return { cleanedCode, defaultExportName };
}

/**
 * ComponentManager class - manages component lifecycle.
 */
class ComponentManager {
  private experienceId: string;
  private sessionId: string;

  constructor(experienceId: string, sessionId: string) {
    this.experienceId = experienceId;
    this.sessionId = sessionId;
  }

  /**
   * Load component code from API and inject CSS if available.
   */
  async loadComponent(componentId: string): Promise<{ code: string; metadata: ComponentInfo }> {
    try {
      logger.info(`Loading component: ${componentId}`);

      const response = await fetch(
        `/api/experiences/${this.experienceId}/components/${componentId}`
      );

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Component not found: ${componentId}`);
        }
        throw new Error(`Failed to load component: ${response.statusText}`);
      }

      const data = await response.json();
      logger.info(`Component loaded: ${componentId}`);

      // Load and inject CSS if it exists
      await this.loadComponentCSS(componentId);

      return data;
    } catch (error) {
      logger.error(error, `Error loading component: ${componentId}`);
      throw error;
    }
  }

  /**
   * Load and inject CSS file for a component if it exists.
   */
  async loadComponentCSS(componentId: string): Promise<void> {
    try {
      const cssUrl = `/api/storage/${this.experienceId}/resources/components/${componentId}.css`;
      
      const response = await fetch(cssUrl);
      
      if (response.ok) {
        const css = await response.text();
        
        // Check if CSS is already injected
        const existingStyle = document.getElementById(`component-css-${componentId}`);
        if (existingStyle) {
          existingStyle.textContent = css;
          logger.info(`Updated CSS for component: ${componentId}`);
        } else {
          // Create and inject style tag
          const styleTag = document.createElement('style');
          styleTag.id = `component-css-${componentId}`;
          styleTag.textContent = css;
          document.head.appendChild(styleTag);
          logger.info(`Injected CSS for component: ${componentId}`);
        }
      } else {
        // CSS file doesn't exist - this is okay, component may not use Tailwind
        logger.debug(`No CSS file found for component: ${componentId}`);
      }
    } catch (error) {
      // CSS loading failed - log but don't throw (component can still work)
      logger.warn(error, `Failed to load CSS for component: ${componentId}`);
    }
  }

  /**
   * Compile component JSX with Babel.
   * Strips imports and transforms JSX to React.createElement calls.
   */
  compileComponent(jsxCode: string, componentId: string): string {
    try {
      const startTime = performance.now();
      
      // Check if Babel is available
      if (typeof window === 'undefined' || !(window as any).Babel) {
        throw new Error('Babel is not loaded. Ensure @babel/standalone is included.');
      }

      const Babel = (window as any).Babel;

      const { cleanedCode, defaultExportName } = stripImportsFromComponent(jsxCode);

      // Transform JSX to React.createElement calls
      const result = Babel.transform(cleanedCode, {
        presets: ['react'],
        filename: `${componentId}.jsx`
      });

      const compilationTime = performance.now() - startTime;
      
      if (compilationTime > 300) {
        logger.warn(`Slow compilation for ${componentId}: ${compilationTime.toFixed(0)}ms`);
      } else {
        logger.info(`Compiled ${componentId} in ${compilationTime.toFixed(0)}ms`);
      }

      // Store the default export name for later use
      if (defaultExportName) {
        (this as any)._lastDefaultExport = defaultExportName;
      }

      return result.code;
    } catch (error) {
      logger.error(error, `Error compiling component: ${componentId}`);
      throw error;
    }
  }

  /**
   * Build scope object with all available dependencies.
   * This is injected into the component execution context.
   */
  buildScope(): ComponentScope {
    // Block dangerous APIs
    const blockedAPIs = {
      fetch: undefined,
      localStorage: undefined,
      sessionStorage: undefined,
      eval: undefined,
      Function: undefined,
      XMLHttpRequest: undefined,
    };

    return {
      // React and hooks
      React,
      useState: React.useState,
      useEffect: React.useEffect,
      useRef: React.useRef,
      useCallback: React.useCallback,
      useMemo: React.useMemo,
      useContext: React.useContext,
      useReducer: React.useReducer,
      useLayoutEffect: React.useLayoutEffect,
      useImperativeHandle: React.useImperativeHandle,
      useDebugValue: React.useDebugValue,
      
      // shadcn/ui components - Basic
      Button,
      Input,
      Textarea,
      Label,
      
      // shadcn/ui components - Card
      Card,
      CardHeader,
      CardContent,
      CardFooter,
      CardTitle,
      CardDescription,
      
      // shadcn/ui components - Select
      Select,
      SelectTrigger,
      SelectValue,
      SelectContent,
      SelectItem,
      
      // shadcn/ui components - Dialog
      Dialog,
      DialogTrigger,
      DialogContent,
      DialogHeader,
      DialogFooter,
      DialogTitle,
      DialogDescription,
      
      // shadcn/ui components - Alert Dialog
      AlertDialog,
      AlertDialogTrigger,
      AlertDialogContent,
      AlertDialogHeader,
      AlertDialogFooter,
      AlertDialogTitle,
      AlertDialogDescription,
      AlertDialogAction,
      AlertDialogCancel,
      
      // shadcn/ui components - Toggle
      Toggle,
      ToggleGroup,
      ToggleGroupItem,
      
      // shadcn/ui components - Tooltip
      Tooltip,
      TooltipTrigger,
      TooltipContent,
      TooltipProvider,
      
      // shadcn/ui components - Progress & Slider
      Progress,
      Slider,
      
      // shadcn/ui components - Chart
      ChartContainer,
      ChartTooltip,
      ChartTooltipContent,
      ChartLegend,
      ChartLegendContent,
      ChartStyle,
      
      // shadcn/ui components - Context Menu
      ContextMenu,
      ContextMenuTrigger,
      ContextMenuContent,
      ContextMenuItem,
      ContextMenuCheckboxItem,
      ContextMenuRadioItem,
      ContextMenuLabel,
      ContextMenuSeparator,
      ContextMenuShortcut,
      ContextMenuGroup,
      ContextMenuPortal,
      ContextMenuSub,
      ContextMenuSubContent,
      ContextMenuSubTrigger,
      ContextMenuRadioGroup,
      
      // shadcn/ui components - Dropdown Menu
      DropdownMenu,
      DropdownMenuTrigger,
      DropdownMenuContent,
      DropdownMenuItem,
      DropdownMenuCheckboxItem,
      DropdownMenuRadioItem,
      DropdownMenuLabel,
      DropdownMenuSeparator,
      DropdownMenuShortcut,
      DropdownMenuGroup,
      DropdownMenuPortal,
      DropdownMenuSub,
      DropdownMenuSubContent,
      DropdownMenuSubTrigger,
      DropdownMenuRadioGroup,
      
      // shadcn/ui components - Hover Card
      HoverCard,
      HoverCardTrigger,
      HoverCardContent,
      
      // shadcn/ui components - Scroll Area
      ScrollArea,
      ScrollBar,
      
      // shadcn/ui components - Toast
      Toast,
      ToastProvider,
      ToastViewport,
      ToastTitle,
      ToastDescription,
      ToastClose,
      ToastAction,
      
      // External libraries (from CDN, may be undefined)
      math: typeof window !== 'undefined' ? (window as any).math : undefined,
      _: typeof window !== 'undefined' ? (window as any)._ : undefined,
      THREE: typeof window !== 'undefined' ? (window as any).THREE : undefined,
      Recharts: typeof window !== 'undefined' ? (window as any).Recharts : undefined,
      
      // Block dangerous APIs
      ...blockedAPIs,
    };
  }

  /**
   * Execute compiled component code and return component function.
   */
  executeComponent(compiledCode: string, scope: ComponentScope): React.ComponentType<PrimerComponentProps> {
    try {
      // Create a function that executes the component code with the provided scope
      const scopeKeys = Object.keys(scope);
      const scopeValues = Object.values(scope);
      
      // Get the default export name that was stored during compilation
      const defaultExportName = (this as any)._lastDefaultExport;
      
      // Wrap the code to return the component function
      // If we know the function name, return it directly
      const wrappedCode = defaultExportName 
        ? `${compiledCode}\nreturn ${defaultExportName};`
        : `${compiledCode}\nreturn (typeof exports !== 'undefined' && exports.default) || 
                 (typeof module !== 'undefined' && module.exports && module.exports.default);`;
      
      // Execute in isolated scope
      const componentFunction = new Function(...scopeKeys, wrappedCode);
      const component = componentFunction(...scopeValues);
      
      if (!component) {
        throw new Error('Component did not export a default function');
      }
      
      return component;
    } catch (error) {
      logger.error(error, 'Error executing component code');
      throw error;
    }
  }

  /**
   * Show a component (create new instance).
   */
  async showComponent(
    componentId: string,
    initialState: Record<string, any> = {},
    onEvent?: (event: ComponentEvent) => void,
    onStateChange?: (event: ComponentStateChangeEvent) => void
  ): Promise<string> {
    try {
      logger.info({ componentId, hasOnEvent: !!onEvent, hasOnStateChange: !!onStateChange }, 'showComponent called with callbacks');
      
      // Load and compile component if not cached
      let compiled = componentCache.get(componentId);
      
      if (!compiled) {
        const { code, metadata } = await this.loadComponent(componentId);
        const compiledCode = this.compileComponent(code, componentId);
        
        compiled = {
          id: componentId,
          code: compiledCode,
          metadata,
          compiledAt: Date.now()
        };
        
        componentCache.set(componentId, compiled);
      }
      
      // Build scope and execute component
      const scope = this.buildScope();
      const ComponentFunction = this.executeComponent(compiled.code, scope);
      
      // Generate unique instance ID
      const instanceId = `component-${generateUUID()}`;
      
      // Create props with callbacks
      const props: PrimerComponentProps = {
        initialState,
        externalState: undefined,
        experienceId: this.experienceId,
        sessionId: this.sessionId,
        instanceId,
        onStateChange: (state) => {
          // Update stored state
          const instance = activeInstances.get(instanceId);
          if (instance) {
            instance.state = { ...instance.state, ...state };
          }
          
          // Fire state change event
          if (onStateChange) {
            onStateChange({
              source: 'component',
              instanceId,
              componentId,
              stateChanges: state,
              timestamp: Date.now()
            });
          }
        },
        onEvent: async (eventType, data) => {
          // Fire event
          logger.info({ eventType, data, instanceId, componentId, hasCallback: !!onEvent }, 'Component onEvent called');
          if (onEvent) {
            onEvent({
              source: 'component',
              instanceId,
              componentId,
              eventType,
              eventData: data,
              timestamp: Date.now()
            });
          } else {
            logger.warn({ eventType, componentId }, 'onEvent callback not provided');
          }
        },
        onSubmit: async (data) => {
          // Fire submit event
          if (onEvent) {
            onEvent({
              source: 'component',
              instanceId,
              componentId,
              eventType: 'submit',
              eventData: data,
              timestamp: Date.now()
            });
          }
        }
      };
      
      // Create instance
      const instance: ComponentInstance = {
        instanceId,
        componentId,
        component: ComponentFunction,
        props,
        state: { ...initialState },
        createdAt: Date.now()
      };
      
      activeInstances.set(instanceId, instance);
      notifyStateUpdate();
      
      logger.info(`Component instance created: ${instanceId}`);
      return instanceId;
    } catch (error) {
      logger.error(error, `Error showing component: ${componentId}`);
      throw error;
    }
  }

  /**
   * Update component state (agent-controlled).
   * Implements rate limiting to prevent thrashing.
   */
  updateComponentState(instanceId: string, stateUpdates: Record<string, any>): void {
    try {
      const instance = activeInstances.get(instanceId);
      if (!instance) {
        throw new Error(`Component instance not found: ${instanceId}`);
      }
      
      // Clear existing timeout if any
      const existing = stateUpdateQueue.get(instanceId);
      if (existing) {
        clearTimeout(existing.timeout);
      }
      
      // Merge updates
      const mergedUpdates = {
        ...(existing?.updates || {}),
        ...stateUpdates
      };
      
      // Set new timeout (100ms throttle)
      const timeout = setTimeout(() => {
        // Apply updates
        instance.state = { ...instance.state, ...mergedUpdates };
        instance.props = {
          ...instance.props,
          externalState: mergedUpdates
        };
        
        // Clear from queue
        stateUpdateQueue.delete(instanceId);
        
        // Trigger re-render
        notifyStateUpdate();
        
        logger.info(`State updated for instance: ${instanceId}`);
      }, 100);
      
      stateUpdateQueue.set(instanceId, { updates: mergedUpdates, timeout });
    } catch (error) {
      logger.error(error, `Error updating component state: ${instanceId}`);
      throw error;
    }
  }

  /**
   * Get current component state.
   */
  getComponentState(instanceId: string): Record<string, any> {
    const instance = activeInstances.get(instanceId);
    if (!instance) {
      throw new Error(`Component instance not found: ${instanceId}`);
    }
    return { ...instance.state };
  }

  /**
   * Hide a component (remove instance).
   */
  hideComponent(instanceId: string): void {
    try {
      // Clear any pending state updates
      const existing = stateUpdateQueue.get(instanceId);
      if (existing) {
        clearTimeout(existing.timeout);
        stateUpdateQueue.delete(instanceId);
      }
      
      // Remove instance
      activeInstances.delete(instanceId);
      notifyStateUpdate();
      
      logger.info(`Component instance hidden: ${instanceId}`);
    } catch (error) {
      logger.error(error, `Error hiding component: ${instanceId}`);
      throw error;
    }
  }

  /**
   * List all available components (from experience.json).
   */
  async listComponents(): Promise<ComponentInfo[]> {
    try {
      logger.info(`Listing components for experience: ${this.experienceId}`);

      const response = await fetch(
        `/api/experiences/${this.experienceId}/components`
      );

      if (!response.ok) {
        if (response.status === 404) {
          logger.warn(`Experience not found: ${this.experienceId}`);
          return [];
        }
        throw new Error(`Failed to list components: ${response.statusText}`);
      }

      const data = await response.json();
      logger.info(`Found ${data.components.length} components`);

      return data.components;
    } catch (error) {
      logger.error(error, `Error listing components for experience: ${this.experienceId}`);
      return [];
    }
  }

  /**
   * List all active instances.
   */
  listActiveInstances(): string[] {
    return Array.from(activeInstances.keys());
  }

  /**
   * Clear component cache (force reload on next show).
   * Useful when component code has been updated.
   * Also removes the CSS style tag so it will be reloaded.
   */
  clearComponentCache(componentId: string): void {
    const wasInCache = componentCache.has(componentId);
    componentCache.delete(componentId);
    
    // Remove CSS style tag
    const styleTag = document.getElementById(`component-css-${componentId}`);
    if (styleTag) {
      styleTag.remove();
      logger.info(`Removed CSS for component: ${componentId}`);
    }
    
    if (wasInCache) {
      logger.info(`Cache cleared for component: ${componentId}`);
    } else {
      logger.warn(`Component not in cache: ${componentId}`);
    }
  }

  /**
   * Clear all component caches.
   * Also removes all component CSS style tags.
   */
  clearAllComponentCaches(): void {
    const count = componentCache.size;
    componentCache.clear();
    
    // Remove all component CSS style tags
    const styleTags = document.querySelectorAll('[id^="component-css-"]');
    styleTags.forEach(tag => tag.remove());
    
    logger.info(`All component caches cleared (${count} components, ${styleTags.length} style tags removed)`);
  }
}

/**
 * Create or get ComponentManager instance.
 */
export const createComponentManager = (experienceId: string, sessionId: string): ComponentManager => {
  if (!componentManagerInstance) {
    componentManagerInstance = new ComponentManager(experienceId, sessionId);
  }
  
  return componentManagerInstance;
};

/**
 * Get ComponentManager instance.
 */
export const getComponentManager = (): ComponentManager | null => {
  return componentManagerInstance;
};

/**
 * Reset ComponentManager (for testing).
 */
export const resetComponentManager = () => {
  componentManagerInstance = null;
  componentCache.clear();
  activeInstances.clear();
  stateUpdateQueue.forEach(({ timeout }) => clearTimeout(timeout));
  stateUpdateQueue.clear();
  stateUpdateListeners = [];
};


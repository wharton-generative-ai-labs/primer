# Custom React Components - Phase 1 MVP Specification

## Overview

This document provides the **minimal viable implementation** for custom React components in Primer. The focus is on essential functionality that allows AI agents to use custom interactive components as another tool in their arsenal.

## Core Principle

**Custom components are tools that agents control**, just like slides, sounds, and scenes. The key difference is that components are interactive and stateful, allowing both:
- **Students** to interact with the component (primary use case)
- **Agents** to manipulate the component state to guide learning

## Simplified Scope for MVP

### What We're Building
1. Component execution system (Babel-based)
2. Agent-to-component communication (bidirectional state management)
3. Basic component tool for agents
4. One example component for testing

### What We're NOT Building (Yet)
- ❌ 3D graphics (Three.js) - defer to Phase 2
- ❌ Complex data visualization libraries (D3, Plotly) - defer to Phase 2
- ❌ Audio synthesis (Tone.js) - defer to Phase 2
- ❌ Interface Designer agent - defer to Phase 2
- ❌ Component marketplace - defer to Phase 3
- ❌ Hot reloading - defer to Phase 3

## Available Libraries (Phase 1)

### Core UI & Styling
- **React** (hooks: useState, useEffect, useReducer, useMemo, useCallback, useRef)
- **Tailwind CSS** (all utility classes)
- **Lucide React** (icons)
- **shadcn/ui components** (all components from `/src/components/ui/`)
  - Button, Input, Label, Textarea
  - Dialog, Alert Dialog, Tooltip
  - Card, Select, Dropdown Menu
  - Progress, Toggle, Toggle Group
  - Chart, Toast, Scroll Area
  - Context Menu, Hover Card

### Math & Science
- **MathJS** (mathematical operations, expressions, units)
- **Recharts** (simple charts for data visualization)

### Utilities
- **Lodash** (utility functions)

### Why This Set?
- **React + Tailwind + shadcn/ui**: Beautiful, consistent UI with minimal code
- **MathJS**: Essential for math/physics/chemistry calculations
- **Recharts**: Simple data visualization (graphs, charts)
- **Lodash**: Useful utilities without bloat

## Agent-Component Communication Model

### Key Insight
Components are **stateful tools** that agents can both read from and write to. This allows agents to:
- Initialize component state
- Update component state to guide students
- Read component state to understand student progress
- React to student interactions

### Component State Interface

Every component exposes a state object that agents can manipulate:

```typescript
interface ComponentState {
  // Component-specific state (defined by component creator)
  [key: string]: any;
}
```

### Tool Actions for Agent Control

```typescript
customComponent({
  action: 'show',
  componentId: 'trig-triangle',
  initialState: {
    sideA: 5,
    sideB: null,  // student needs to calculate
    angleC: 30,
    showHint: false
  }
})

// Agent can update state to help student
customComponent({
  action: 'updateState',
  instanceId: 'component-123',
  stateUpdates: {
    showHint: true,
    hintText: "Remember: sin(θ) = opposite/hypotenuse"
  }
})

// Agent can read current state
customComponent({
  action: 'getState',
  instanceId: 'component-123'
})
// Returns: { sideA: 5, sideB: 8.66, angleC: 30, studentAnswer: 8.5, ... }
```

### Example Scenario: Trigonometry Problem

**Setup**: Agent shows triangle component
```javascript
// Agent uses tool
customComponent({
  action: 'show',
  componentId: 'trig-triangle',
  initialState: {
    sideA: 5,
    angleC: 30,
    sideB: null,  // student calculates this
    showWorkingSteps: false
  }
})
```

**Student Interaction**: Student enters answer in component
```javascript
// Component calls onEvent
onEvent('answer-submitted', { 
  sideB: 8.5,  // student's answer
  correct: false 
})
```

**Agent Response**: Agent helps by revealing hint
```javascript
// Agent updates component state
customComponent({
  action: 'updateState',
  instanceId: 'component-123',
  stateUpdates: {
    showWorkingSteps: true,
    step1: "sin(30°) = opposite/hypotenuse",
    step2: "sin(30°) = sideB/5"
  }
})
```

**Agent Voice**: "I've shown you the first steps. Can you solve for sideB now?"

### Example Scenario: Chemistry Molecule Builder

**Setup**: Agent demonstrates molecular structure
```javascript
customComponent({
  action: 'show',
  componentId: 'molecule-builder',
  initialState: {
    atoms: [
      { id: 1, element: 'C', x: 0, y: 0 },
      { id: 2, element: 'H', x: 1, y: 0 }
    ],
    bonds: [{ from: 1, to: 2, type: 'single' }],
    mode: 'view'  // agent controls, student watches
  }
})
```

**Agent Demonstrates**: Agent adds atoms to show structure
```javascript
// Agent updates to add oxygen
customComponent({
  action: 'updateState',
  instanceId: 'component-456',
  stateUpdates: {
    atoms: [
      { id: 1, element: 'C', x: 0, y: 0 },
      { id: 2, element: 'H', x: 1, y: 0 },
      { id: 3, element: 'O', x: -1, y: 0 }  // NEW
    ],
    bonds: [
      { from: 1, to: 2, type: 'single' },
      { from: 1, to: 3, type: 'double' }  // NEW
    ]
  }
})
```

**Agent Voice**: "See how the carbon forms a double bond with oxygen? Now you try building methanol."

**Student Turn**: Agent switches to interactive mode
```javascript
customComponent({
  action: 'updateState',
  instanceId: 'component-456',
  stateUpdates: {
    mode: 'edit',  // student can now interact
    atoms: [{ id: 1, element: 'C', x: 0, y: 0 }],  // reset
    bonds: [],
    targetMolecule: 'methanol'
  }
})
```

## Component Interface (Revised)

### Standard Props

```typescript
interface PrimerComponentProps {
  // Initial state from agent
  initialState?: Record<string, any>;
  
  // Callbacks for student interactions
  onEvent?: (eventType: string, data: any) => void;
  onSubmit?: (data: Record<string, any>) => void;
  
  // Context
  experienceId: string;
  sessionId: string;
  instanceId: string;  // NEW: unique instance identifier
  
  // State management (NEW)
  externalState?: Record<string, any>;  // State updates from agent
  onStateChange?: (newState: Record<string, any>) => void;  // Notify agent of state changes
}
```

### Component Implementation Pattern

```jsx
import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';

export default function TrigTriangle({ 
  initialState,
  externalState,
  onStateChange,
  onEvent,
  onSubmit,
  instanceId
}) {
  // Initialize state from agent
  const [state, setState] = useState({
    sideA: 5,
    angleC: 30,
    sideB: null,
    showHint: false,
    ...initialState
  });
  
  // Track externally-set keys to prevent circular updates
  const externallySetKeys = useRef(new Set());
  const previousState = useRef(state);
  
  // Listen for external state updates from agent
  useEffect(() => {
    if (externalState) {
      // Mark these keys as externally set
      Object.keys(externalState).forEach(key => 
        externallySetKeys.current.add(key)
      );
      
      setState(prev => ({ ...prev, ...externalState }));
      
      // Clear tracking after render cycle
      setTimeout(() => externallySetKeys.current.clear(), 0);
    }
  }, [externalState]);
  
  // Notify agent only of student-initiated changes
  useEffect(() => {
    // Filter out keys that were just set externally
    const internalChanges = {};
    for (const [key, value] of Object.entries(state)) {
      if (!externallySetKeys.current.has(key) && 
          previousState.current[key] !== value) {
        internalChanges[key] = value;
      }
    }
    
    previousState.current = state;
    
    // Only notify if there are actual internal changes
    if (Object.keys(internalChanges).length > 0) {
      onStateChange?.(internalChanges);
    }
  }, [state]);
  
  const handleSubmit = () => {
    const correct = Math.abs(state.studentAnswer - 8.66) < 0.1;
    onEvent?.('answer-submitted', { 
      answer: state.studentAnswer, 
      correct 
    });
    
    if (correct) {
      onSubmit?.({ completed: true, answer: state.studentAnswer });
    }
  };
  
  return (
    <Card className="p-6">
      <h2 className="text-xl font-bold mb-4">Solve for side B</h2>
      
      {/* Triangle visualization */}
      <svg width="300" height="200" className="mb-4">
        {/* Draw triangle based on state */}
      </svg>
      
      {/* Show hint if agent enabled it */}
      {state.showHint && (
        <div className="bg-blue-50 p-4 rounded mb-4">
          <p>Hint: sin(θ) = opposite/hypotenuse</p>
        </div>
      )}
      
      {/* Student input */}
      <Input 
        type="number"
        value={state.studentAnswer || ''}
        onChange={(e) => setState(prev => ({ 
          ...prev, 
          studentAnswer: parseFloat(e.target.value) 
        }))}
        placeholder="Enter length of side B"
      />
      
      <Button onClick={handleSubmit} className="mt-4">
        Check Answer
      </Button>
    </Card>
  );
}
```

## Components to Build

### 1. CustomComponentManager (Core)

**File**: `src/app/lib/tools/ui/components/ComponentManager.tsx`

**Key Methods**:
```typescript
class CustomComponentManager {
  // Load component from experience
  async loadComponent(experienceId: string, componentId: string): Promise<void>
  
  // Compile JSX to React component
  compileComponent(jsxCode: string, componentId: string): CompiledComponent
  
  // Build execution scope
  buildScope(): ComponentScope
  
  // Show component with initial state
  showComponent(
    componentId: string, 
    props: PrimerComponentProps
  ): string  // returns instanceId
  
  // Update component state (NEW)
  updateComponentState(
    instanceId: string, 
    stateUpdates: Record<string, any>
  ): void
  
  // Get component state (NEW)
  getComponentState(instanceId: string): Record<string, any> | null
  
  // Hide component
  hideComponent(instanceId: string): void
  
  // List components
  listComponents(): ComponentInfo[]
}
```

**State Management**:
```typescript
// Store component states
private componentStates: Map<string, Record<string, any>> = new Map();

// Update state and trigger re-render
updateComponentState(instanceId: string, updates: Record<string, any>) {
  const currentState = this.componentStates.get(instanceId) || {};
  const newState = { ...currentState, ...updates };
  this.componentStates.set(instanceId, newState);
  
  // Trigger component re-render with new externalState
  this.updateComponentProps(instanceId, { externalState: updates });
  this.notifyStateUpdate();
}

// Handle state changes from component
handleComponentStateChange(instanceId: string, newState: Record<string, any>) {
  this.componentStates.set(instanceId, newState);
  // Could notify agents via event system if needed
}
```

### 2. Custom Component Tool (Enhanced)

**File**: `src/app/lib/tools/ui/custom-component.ts`

```typescript
export async function customComponent(
  args: {
    action: 'show' | 'hide' | 'updateState' | 'getState' | 'list';
    componentId?: string;
    instanceId?: string;
    initialState?: Record<string, any>;
    stateUpdates?: Record<string, any>;
  },
  context: ToolContext
): Promise<ToolResponse> {
  const manager = getCustomComponentManager();
  
  switch (args.action) {
    case 'show':
      // Load if needed
      if (!manager.isLoaded(args.componentId)) {
        await manager.loadComponent(context.experienceId, args.componentId);
      }
      
      // Show with initial state
      const instanceId = manager.showComponent(args.componentId, {
        initialState: args.initialState,
        experienceId: context.experienceId,
        sessionId: context.sessionId,
        onEvent: (type, data) => {
          // Forward events to agent via callback
          // This triggers a new agent turn with the event data
          context.onComponentEvent?.({
            source: 'component',
            instanceId,
            componentId: args.componentId,
            eventType: type,
            eventData: data,
            timestamp: Date.now()
          });
        },
        onStateChange: (newState) => {
          // Track state changes internally
          manager.handleComponentStateChange(instanceId, newState);
          
          // Optionally notify agent of state changes
          // (Agent can choose to react or ignore based on prompt)
          context.onComponentStateChange?.({
            source: 'component',
            instanceId,
            componentId: args.componentId,
            stateChanges: newState,
            timestamp: Date.now()
          });
        }
      });
      
      return { 
        status: 'success', 
        data: { 
          instanceId,
          message: 'Component displayed. Students can now interact with it.'
        } 
      };
      
    case 'updateState':
      // Agent updates component state
      manager.updateComponentState(args.instanceId, args.stateUpdates);
      return { 
        status: 'success',
        data: { 
          message: 'Component state updated',
          newState: manager.getComponentState(args.instanceId)
        }
      };
      
    case 'getState':
      // Agent reads component state
      const state = manager.getComponentState(args.instanceId);
      return { 
        status: 'success', 
        data: { state } 
      };
      
    case 'hide':
      manager.hideComponent(args.instanceId);
      return { 
        status: 'success',
        data: { message: 'Component hidden' }
      };
      
    case 'list':
      const components = manager.listComponents();
      return { 
        status: 'success', 
        data: { components } 
      };
  }
}
```

### 3. Component Display

**File**: `src/app/components/CustomComponents.tsx`

```typescript
export default function CustomComponents() {
  const instances = getActiveComponentInstances();
  
  if (!instances || instances.length === 0) {
    return null;
  }
  
  return (
    <div className="fixed inset-0 z-custom-component pointer-events-none">
      <div className="pointer-events-auto">
        {instances.map((instance, index) => (
          <ErrorBoundary
            key={`component-${instance.id}-${index}`}
            fallback={
              <ComponentError 
                componentId={instance.componentId}
                instanceId={instance.id}
                onRetry={() => handleRetry(instance.id)}
                onDismiss={() => handleDismiss(instance.id)}
              />
            }
            onError={(error, errorInfo) => {
              // Log error
              logger.error('Component crashed', {
                componentId: instance.componentId,
                instanceId: instance.id,
                error: error.message,
                stack: error.stack,
                errorInfo
              });
            }}
          >
            {instance.element}
          </ErrorBoundary>
        ))}
      </div>
    </div>
  );
}

function ComponentError({ 
  componentId, 
  instanceId, 
  onRetry, 
  onDismiss 
}) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-50">
      <Card className="max-w-md p-6">
        <div className="text-red-600 mb-4">
          <AlertCircle size={48} />
        </div>
        <h2 className="text-xl font-bold mb-2">Component Error</h2>
        <p className="text-gray-600 mb-4">
          This interactive component encountered an error and couldn't be displayed.
        </p>
        <div className="flex gap-2">
          <Button onClick={onRetry} variant="outline">
            Try Again
          </Button>
          <Button onClick={onDismiss}>
            Dismiss
          </Button>
        </div>
      </Card>
    </div>
  );
}
```

**Key Features:**
- **Per-component error boundaries**: Each component instance has its own error boundary, so one crash doesn't affect others
- **Error logging**: All component errors are logged with context
- **Recovery UI**: Students can retry or dismiss crashed components

### 4. Scope Builder (Updated)

**Import Strategy:** Components use standard ES6 imports for readability and validation. During compilation, imports are stripped and all dependencies are injected via scope.

```typescript
// At top of ComponentManager.tsx - import all dependencies
import React, { useState, useEffect, useReducer, useMemo, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
// ... import all other shadcn/ui components

class CustomComponentManager {
  private buildScope(): ComponentScope {
    return {
      // React
      React,
      useState,
      useEffect,
      useReducer,
      useMemo,
      useCallback,
      useRef,
      
      // shadcn/ui components (all imported above)
      Button,
      Input,
      Label,
      Textarea,
      Card,
      CardHeader,
      CardContent,
      CardFooter,
      CardTitle,
      CardDescription,
      Dialog,
      DialogContent,
      DialogHeader,
      DialogTitle,
      DialogDescription,
      DialogFooter,
      Select,
      SelectContent,
      SelectItem,
      SelectTrigger,
      SelectValue,
      Progress,
      Alert,
      AlertDescription,
      AlertTitle,
      Tabs,
      TabsContent,
      TabsList,
      TabsTrigger,
      Slider,
      Switch,
      Checkbox,
      RadioGroup,
      RadioGroupItem,
      Badge,
      Separator,
      Tooltip,
      TooltipContent,
      TooltipProvider,
      TooltipTrigger,
      // ... all other shadcn/ui components
      
      // Math & Science
      math: window.math, // MathJS
      
      // Charts
      Recharts: window.Recharts,
      
      // Utilities
      _: window._, // Lodash
      
      // Icons
      LucideReact: window.LucideReact,
      
      // Blocked for security
      fetch: undefined,
      XMLHttpRequest: undefined,
      localStorage: undefined,
      sessionStorage: undefined,
      eval: undefined
    };
  }
  
  compileComponent(code: string, componentId: string): CompiledComponent {
    const startTime = performance.now();
    
    try {
      // Compile with Babel - strip imports, they're just documentation
      const compiled = Babel.transform(code, {
        presets: ['react'],
        plugins: [
          // Remove all import statements - everything comes from scope
          ['transform-remove-imports']
        ],
        filename: `${componentId}.jsx`
      });
      
      const scope = this.buildScope();
      const scopeKeys = Object.keys(scope);
      const scopeValues = Object.values(scope);
      
      // Execute compiled code with scope injected
      const componentFactory = new Function(
        ...scopeKeys,
        `${compiled.code}\nreturn ${componentId};`
      );
      
      const Component = componentFactory(...scopeValues);
      
      const compileTime = performance.now() - startTime;
      
      if (compileTime > PERFORMANCE_TARGETS.compilation.warn) {
        logger.warn('Slow component compilation', { 
          componentId, 
          compileTime: `${compileTime.toFixed(2)}ms`
        });
      }
      
      logger.debug('Component compiled', {
        componentId,
        compileTime: `${compileTime.toFixed(2)}ms`
      });
      
      return Component;
      
    } catch (error) {
      const compileTime = performance.now() - startTime;
      logger.error('Component compilation failed', {
        componentId,
        compileTime: `${compileTime.toFixed(2)}ms`,
        error: error.message
      });
      throw error;
    }
  }
}
```

**Key Benefits:**
- ✅ Interface Designer (AI) writes natural import statements
- ✅ Components are readable and follow standard React patterns
- ✅ Imports serve as documentation of dependencies
- ✅ Simple compilation: strip imports, inject scope
- ✅ No custom Babel plugins needed (use existing `transform-remove-imports`)

## Component Event System

### Overview

Components communicate with agents through an event-driven architecture. When students interact with components (button clicks, input changes, submissions), the component fires events that trigger new agent turns.

### Event Flow

```
Student interacts with component
  ↓
Component calls onEvent('answer-submitted', { answer: 8.5, correct: false })
  ↓
CustomComponentManager forwards to context.onComponentEvent()
  ↓
Event triggers new agent turn (similar to voice input)
  ↓
Agent receives event as structured data (not as user message)
  ↓
Agent decides how to respond based on prompt
  ↓
Agent may call customComponent({ action: 'updateState', ... })
  ↓
Component updates and student sees feedback
```

### Event Types

Components can fire any event type. Common patterns:

```typescript
// Submission events
onEvent('answer-submitted', { answer: value, correct: boolean, attempts: number });
onEvent('form-completed', { data: formData, isValid: boolean });

// Interaction events
onEvent('hint-requested', { currentState: state });
onEvent('step-completed', { stepNumber: 1, data: stepData });

// Progress events
onEvent('milestone-reached', { milestone: 'halfway', progress: 0.5 });
onEvent('error-encountered', { error: 'validation-failed', details: {...} });
```

### ToolContext Extensions

**New methods needed in ToolContext:**

```typescript
interface ToolContext {
  // ... existing methods
  
  // Component event callback - triggers new agent turn
  onComponentEvent?: (event: ComponentEvent) => void;
  
  // Component state change callback - optional, agent can ignore
  onComponentStateChange?: (event: ComponentStateChangeEvent) => void;
}

interface ComponentEvent {
  source: 'component';
  instanceId: string;
  componentId: string;
  eventType: string;
  eventData: any;
  timestamp: number;
}

interface ComponentStateChangeEvent {
  source: 'component';
  instanceId: string;
  componentId: string;
  stateChanges: Record<string, any>;
  timestamp: number;
}
```

### Agent Integration

**How agents receive events:**

Events should trigger a new agent turn with the event data available in context. The agent's prompt determines how it responds:

**Example Agent Prompt:**
```markdown
## Component Events

You may receive events from interactive components. These are NOT user messages - they are structured data about component interactions.

Event format:
{
  "source": "component",
  "instanceId": "component-123",
  "componentId": "trig-triangle",
  "eventType": "answer-submitted",
  "eventData": { "answer": 8.5, "correct": false, "attempts": 2 }
}

How to respond:
- If the event indicates the student needs help, provide guidance
- Use customComponent({ action: 'updateState' }) to show hints or steps
- Keep your response conversational and encouraging
- Reference the specific data from the event

Example:
Event: { eventType: "answer-submitted", eventData: { answer: 8.5, correct: false } }
Your response: "I see you tried 8.5 - you're close! Let me show you a hint to help you get the exact answer."
[Then call customComponent to update state and show hint]
```

### Implementation Notes

1. **Event callbacks are optional** - If `context.onComponentEvent` is undefined, events are silently ignored
2. **State change events are informational** - Agents can choose to react or ignore based on prompt
3. **Events don't appear in chat transcript** - They're separate from user messages
4. **Events trigger agent turns** - Similar to how voice input triggers turns in Realtime API
5. **Agent response is optional** - Agent can process event silently and just update component state

## Component Deployment API

**File**: `src/app/api/experiences/[experienceId]/components/[componentId]/route.ts`

```typescript
import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

export async function GET(
  request: Request,
  { params }: { params: { experienceId: string; componentId: string } }
) {
  const { experienceId, componentId } = params;
  
  try {
    // Read component file from storage
    const componentPath = path.join(
      process.cwd(),
      'storage',
      experienceId,
      'resources',
      'components',
      `${componentId}.jsx`
    );
    
    if (!fs.existsSync(componentPath)) {
      return NextResponse.json(
        { error: 'Component not found' },
        { status: 404 }
      );
    }
    
    const code = fs.readFileSync(componentPath, 'utf-8');
    
    // Get metadata from experience.json
    const experienceConfigPath = path.join(
      process.cwd(),
      'storage',
      experienceId,
      'experience.json'
    );
    
    let metadata = {};
    if (fs.existsSync(experienceConfigPath)) {
      const config = JSON.parse(fs.readFileSync(experienceConfigPath, 'utf-8'));
      const componentConfig = config.resources?.components?.find(
        (c: any) => c.id === componentId
      );
      if (componentConfig) {
        metadata = componentConfig;
      }
    }
    
    return NextResponse.json({ code, metadata });
    
  } catch (error) {
    console.error('Failed to load component:', error);
    return NextResponse.json(
      { error: 'Failed to load component' },
      { status: 500 }
    );
  }
}
```

**ComponentManager.loadComponent implementation:**

```typescript
async loadComponent(
  experienceId: string, 
  componentId: string
): Promise<void> {
  try {
    // Fetch component code from API
    const response = await fetch(
      `/api/experiences/${experienceId}/components/${componentId}`
    );
    
    if (!response.ok) {
      throw new Error(`Component ${componentId} not found`);
    }
    
    const { code, metadata } = await response.json();
    
    // Compile component
    const compiled = this.compileComponent(code, componentId);
    
    // Store compiled component
    this.components.set(componentId, {
      Component: compiled,
      metadata
    });
    
    logger.info('Component loaded', { experienceId, componentId });
    
  } catch (error) {
    logger.error('Failed to load component', { 
      experienceId, 
      componentId, 
      error 
    });
    throw error;
  }
}
```

## Tool Registration

**File**: `src/app/lib/tools/ui/index.ts`

```typescript
export async function registerCustomComponentTools(): Promise<void> {
  const registry = ToolRegistry.getInstance();
  
  await registry.register({
    type: 'function',
    name: 'customComponent',
    description: `Display and control interactive custom components. Components are stateful - you can update their state to guide students or read their state to track progress.
    
    Use 'show' to display a component with initial state.
    Use 'updateState' to modify component state (e.g., show hints, reveal steps).
    Use 'getState' to read current component state (e.g., check student progress).
    Use 'hide' to remove a component.
    
    Components allow both student interaction AND agent control.`,
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['show', 'hide', 'updateState', 'getState', 'list'],
          description: 'Action to perform'
        },
        componentId: {
          type: 'string',
          description: 'Component ID (required for show)'
        },
        instanceId: {
          type: 'string',
          description: 'Instance ID (required for hide, updateState, getState)'
        },
        initialState: {
          type: 'object',
          description: 'Initial state for component (for show action)'
        },
        stateUpdates: {
          type: 'object',
          description: 'State updates to apply (for updateState action)'
        }
      },
      required: ['action']
    }
  }, customComponent);
}
```

## Example Components

### 1. Trigonometry Triangle (MVP Test Component)

**File**: `test-components/trig-triangle.jsx`

```jsx
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';

export default function TrigTriangle({ 
  initialState = {},
  externalState,
  onStateChange,
  onEvent,
  onSubmit
}) {
  const [state, setState] = useState({
    sideA: 5,
    angleC: 30,
    sideB: null,
    studentAnswer: '',
    showHint: false,
    showSteps: false,
    attempts: 0,
    ...initialState
  });
  
  // Listen for agent state updates
  useEffect(() => {
    if (externalState) {
      setState(prev => ({ ...prev, ...externalState }));
    }
  }, [externalState]);
  
  // Notify agent of state changes
  useEffect(() => {
    onStateChange?.(state);
  }, [state]);
  
  const correctAnswer = state.sideA * Math.sin((state.angleC * Math.PI) / 180);
  
  const handleCheck = () => {
    const answer = parseFloat(state.studentAnswer);
    const correct = Math.abs(answer - correctAnswer) < 0.1;
    
    setState(prev => ({ 
      ...prev, 
      attempts: prev.attempts + 1 
    }));
    
    onEvent?.('answer-checked', { 
      answer, 
      correct, 
      attempts: state.attempts + 1 
    });
    
    if (correct) {
      onSubmit?.({ 
        completed: true, 
        answer, 
        attempts: state.attempts + 1 
      });
    }
  };
  
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-50">
      <Card className="w-[600px] max-h-[80vh] overflow-auto">
        <CardHeader>
          <h2 className="text-2xl font-bold">Trigonometry: Find Side B</h2>
          <p className="text-sm text-gray-600">
            Use sine, cosine, or tangent to find the missing side
          </p>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Triangle SVG */}
          <svg width="400" height="300" className="mx-auto">
            {/* Right triangle */}
            <line x1="50" y1="250" x2="350" y2="250" stroke="black" strokeWidth="2" />
            <line x1="50" y1="250" x2="50" y2="50" stroke="black" strokeWidth="2" />
            <line x1="50" y1="50" x2="350" y2="250" stroke="black" strokeWidth="2" />
            
            {/* Labels */}
            <text x="200" y="270" textAnchor="middle" fontSize="16">
              Side A = {state.sideA}
            </text>
            <text x="30" y="150" textAnchor="middle" fontSize="16">
              Side B = ?
            </text>
            <text x="80" y="230" fontSize="14">
              {state.angleC}°
            </text>
          </svg>
          
          {/* Hints from agent */}
          {state.showHint && (
            <div className="bg-blue-50 border border-blue-200 p-4 rounded">
              <p className="font-semibold">Hint:</p>
              <p>sin(θ) = opposite / hypotenuse</p>
            </div>
          )}
          
          {/* Working steps from agent */}
          {state.showSteps && (
            <div className="bg-green-50 border border-green-200 p-4 rounded space-y-2">
              <p className="font-semibold">Working:</p>
              <p>Step 1: sin({state.angleC}°) = Side B / {state.sideA}</p>
              <p>Step 2: Side B = {state.sideA} × sin({state.angleC}°)</p>
              <p>Step 3: Side B = {state.sideA} × {Math.sin((state.angleC * Math.PI) / 180).toFixed(3)}</p>
            </div>
          )}
          
          {/* Student input */}
          <div className="space-y-2">
            <Label htmlFor="answer">Your Answer:</Label>
            <Input 
              id="answer"
              type="number"
              step="0.01"
              value={state.studentAnswer}
              onChange={(e) => setState(prev => ({ 
                ...prev, 
                studentAnswer: e.target.value 
              }))}
              placeholder="Enter the length of side B"
            />
          </div>
          
          {/* Progress */}
          {state.attempts > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-gray-600">
                Attempts: {state.attempts}
              </p>
              <Progress value={state.attempts * 33} max={100} />
            </div>
          )}
          
          <Button onClick={handleCheck} className="w-full">
            Check Answer
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
```

### 2. Simple Molecule Builder (Future Example)

**File**: `test-components/molecule-builder.jsx`

```jsx
// Simplified molecule builder for chemistry
// Shows atoms and bonds, allows student to build molecules
// Agent can demonstrate by adding atoms/bonds programmatically
// (Implementation details omitted for brevity)
```

## Dependencies

**package.json additions**:
```json
{
  "dependencies": {
    "@babel/standalone": "^7.23.0",
    "babel-plugin-transform-remove-imports": "^1.7.0"
  }
}
```

**Installation:**
```bash
npm install @babel/standalone babel-plugin-transform-remove-imports
```

**CDN Scripts** (load when experience has custom components):
```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/mathjs/11.11.0/math.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/recharts/2.5.0/Recharts.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/lodash.js/4.17.21/lodash.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/lucide/0.263.1/lucide.min.js"></script>
```

## Agent Prompt Guidance

### For Experience Agents

Add to agent instructions:

```markdown
## Custom Interactive Components

You have access to custom interactive components via the `customComponent` tool. These are powerful educational tools that allow students to interact with simulations, visualizations, and exercises.

### When to Use Components

Use components for:
- Interactive math problems (geometry, trigonometry, algebra)
- Science simulations (chemistry molecules, physics experiments)
- Data visualization exercises
- Any interactive learning activity beyond text/slides

### How to Use Components

1. **Show a component** with initial state:
```javascript
customComponent({
  action: 'show',
  componentId: 'trig-triangle',
  initialState: {
    sideA: 5,
    angleC: 30,
    showHint: false
  }
})
```

2. **Help students** by updating component state:
```javascript
// Student is stuck, show a hint
customComponent({
  action: 'updateState',
  instanceId: 'component-123',
  stateUpdates: {
    showHint: true
  }
})
```

3. **Check progress** by reading component state:
```javascript
customComponent({
  action: 'getState',
  instanceId: 'component-123'
})
// Returns current state including student's work
```

4. **Guide learning** by revealing steps:
```javascript
// Student needs more help
customComponent({
  action: 'updateState',
  instanceId: 'component-123',
  stateUpdates: {
    showSteps: true,
    step1: "First, identify the known values..."
  }
})
```

### Best Practices

- **Initialize clearly**: Set up component with appropriate starting values
- **Monitor progress**: Check component state to see how student is doing
- **Provide scaffolding**: Use state updates to reveal hints progressively
- **Maintain dialogue**: Keep talking to the student while they work with the component
- **Celebrate success**: React to component events (answer-checked, completed, etc.)

### Example Interaction

```
Agent: "Let's practice trigonometry. I'm showing you a triangle problem."

[Uses customComponent to show trig-triangle]

Agent: "Take your time. Use sine, cosine, or tangent to find side B."

[Student works on problem, makes attempt]

[Component fires 'answer-checked' event with incorrect answer]

Agent: "Not quite. Let me show you a hint."

[Updates component state to show hint]

Agent: "Remember, sine relates the opposite side to the hypotenuse. Try again!"

[Student makes another attempt]

[Component fires 'answer-checked' event with correct answer]

Agent: "Excellent! You got it! The key was recognizing which ratio to use."
```

### Component State is Persistent

The component maintains its state throughout the interaction. You can:
- Update specific fields without resetting others
- Read state at any time to check progress
- Respond to component events in your conversation

Components are tools in your arsenal - use them to create engaging, interactive learning experiences!
```

## Performance Monitoring

### Performance Targets

```typescript
interface PerformanceTargets {
  compilation: {
    max: 500, // ms
    warn: 300  // ms
  },
  stateUpdate: {
    max: 100,  // ms
    warn: 50   // ms
  },
  render: {
    max: 100,  // ms
    warn: 50   // ms
  },
  memory: {
    maxPerComponent: 50,  // MB
    maxTotal: 200         // MB
  }
}
```

### Implementation in ComponentManager

```typescript
compileComponent(code: string, componentId: string): CompiledComponent {
  const startTime = performance.now();
  
  try {
    // Babel compilation
    const compiled = Babel.transform(code, {
      presets: ['react'],
      filename: `${componentId}.jsx`
    });
    
    const compileTime = performance.now() - startTime;
    
    // Log performance metrics
    if (compileTime > PERFORMANCE_TARGETS.compilation.warn) {
      logger.warn('Slow component compilation', { 
        componentId, 
        compileTime: `${compileTime.toFixed(2)}ms`
      });
    }
    
    logger.debug('Component compiled', {
      componentId,
      compileTime: `${compileTime.toFixed(2)}ms`
    });
    
    return compiled;
    
  } catch (error) {
    const compileTime = performance.now() - startTime;
    logger.error('Component compilation failed', {
      componentId,
      compileTime: `${compileTime.toFixed(2)}ms`,
      error: error.message
    });
    throw error;
  }
}
```

## Rate Limiting

Prevent agents from overwhelming components with rapid state updates:

```typescript
class CustomComponentManager {
  private updateQueue: Map<string, {
    pending: Record<string, any>[];
    lastUpdate: number;
  }> = new Map();
  
  private readonly UPDATE_THROTTLE_MS = 100; // Max 10 updates/sec per component
  
  updateComponentState(
    instanceId: string, 
    updates: Record<string, any>
  ): void {
    const now = Date.now();
    const queue = this.updateQueue.get(instanceId) || {
      pending: [],
      lastUpdate: 0
    };
    
    // Merge updates
    const merged = Object.assign({}, ...queue.pending, updates);
    
    // Check if throttle period has passed
    if (now - queue.lastUpdate >= this.UPDATE_THROTTLE_MS) {
      // Apply immediately
      this.applyStateUpdate(instanceId, merged);
      queue.pending = [];
      queue.lastUpdate = now;
    } else {
      // Queue for next cycle
      queue.pending = [merged];
      
      // Schedule delayed update
      setTimeout(() => {
        const latest = this.updateQueue.get(instanceId);
        if (latest && latest.pending.length > 0) {
          const finalUpdate = Object.assign({}, ...latest.pending);
          this.applyStateUpdate(instanceId, finalUpdate);
          latest.pending = [];
          latest.lastUpdate = Date.now();
        }
      }, this.UPDATE_THROTTLE_MS - (now - queue.lastUpdate));
    }
    
    this.updateQueue.set(instanceId, queue);
  }
  
  private applyStateUpdate(instanceId: string, updates: Record<string, any>): void {
    // Actual state update logic
    const currentState = this.componentStates.get(instanceId) || {};
    const newState = { ...currentState, ...updates };
    this.componentStates.set(instanceId, newState);
    
    // Trigger component re-render with new externalState
    this.updateComponentProps(instanceId, { externalState: updates });
    this.notifyStateUpdate();
  }
}
```

## Component Development Guide

### Component Interface Requirements

Every custom component must:
1. Export a default function component
2. Accept `PrimerComponentProps` interface
3. Handle `externalState` updates from agent
4. Call `onStateChange` for student interactions
5. Use `onEvent` for significant events
6. Call `onSubmit` when complete

### Available Libraries

- **React hooks**: useState, useEffect, useReducer, useMemo, useCallback, useRef
- **UI components**: All shadcn/ui components (Button, Input, Card, Dialog, Select, etc.)
- **Math**: MathJS (window.math)
- **Charts**: Recharts
- **Utilities**: Lodash (_)
- **Icons**: Lucide React

### State Management Pattern

```typescript
const [state, setState] = useState({ ...initialState });

// Listen for agent updates
useEffect(() => {
  if (externalState) {
    setState(prev => ({ ...prev, ...externalState }));
  }
}, [externalState]);

// Notify agent of changes
useEffect(() => {
  onStateChange?.(state);
}, [state]);
```

### Loading State Pattern

Components should show loading states during agent processing:

```jsx
export default function MyComponent({ 
  initialState,
  externalState,
  onStateChange,
  onEvent 
}) {
  const [state, setState] = useState({ ...initialState });
  const [isWaitingForAgent, setIsWaitingForAgent] = useState(false);
  
  const handleSubmit = async () => {
    // Show loading state
    setIsWaitingForAgent(true);
    
    // Fire event
    await onEvent?.('answer-submitted', { answer: state.answer });
    
    // Agent will update state, which will clear loading
  };
  
  // Clear loading when agent responds
  useEffect(() => {
    if (externalState) {
      setIsWaitingForAgent(false);
      setState(prev => ({ ...prev, ...externalState }));
    }
  }, [externalState]);
  
  return (
    <Card>
      {isWaitingForAgent && (
        <div className="absolute inset-0 bg-white/50 flex items-center justify-center">
          <Spinner />
          <p>Processing...</p>
        </div>
      )}
      
      <Button 
        onClick={handleSubmit}
        disabled={isWaitingForAgent}
      >
        Submit
      </Button>
    </Card>
  );
}
```

### Do's and Don'ts

✅ **Do:**
- Use shadcn/ui components for consistent styling
- Provide clear visual feedback
- Handle loading states during agent processing
- Test with various screen sizes
- Use semantic HTML and ARIA labels

❌ **Don't:**
- Use fetch or network requests
- Access localStorage or sessionStorage
- Use external scripts or CDN resources
- Create infinite loops or expensive computations
- Manipulate DOM outside React

## Testing Checklist

### Unit Tests
- [ ] CustomComponentManager compiles valid JSX
- [ ] CustomComponentManager handles invalid JSX gracefully
- [ ] State updates propagate to components
- [ ] State reads return current values
- [ ] Multiple instances maintain separate states

### Integration Tests
- [ ] Load component from experience resources
- [ ] Show component with initial state
- [ ] Update component state from tool
- [ ] Read component state from tool
- [ ] Component events reach agent
- [ ] Multiple components work simultaneously

### E2E Test Scenario
- [ ] Agent shows trig triangle component
- [ ] Student interacts with component
- [ ] Agent reads state to check progress
- [ ] Agent updates state to show hint
- [ ] Student completes problem
- [ ] Component submits results
- [ ] Agent hides component

## Success Criteria

### Functional
- [ ] Components load and compile
- [ ] Components render with shadcn/ui styling
- [ ] Agent can show/hide components
- [ ] Agent can read component state
- [ ] Agent can update component state
- [ ] Students can interact with components
- [ ] Component events reach agents
- [ ] Multiple instances work correctly

### Performance
- [ ] Compilation < 500ms
- [ ] State updates < 50ms
- [ ] No memory leaks

### Integration
- [ ] Works with existing tool system
- [ ] No breaking changes
- [ ] Agents can use alongside other tools (slides, sounds, etc.)

## Timeline

**Week 1**: Core infrastructure
- CustomComponentManager with state management
- Tool implementation with all actions
- Display component
- Component event system
- API endpoint for component loading

**Week 2**: Integration & testing
- shadcn/ui components in scope
- Example trig triangle component (hand-written)
- Integration with PlayPage
- Target experience agent prompt updates
- Testing with hand-written components

**Week 3**: Interface Designer
- Interface Designer agent configuration
- Interface Designer instructions/prompt
- Artifact tool enhancement (jsx type)
- Integration with Design Agent
- Test component generation flow

**Week 4**: Polish & documentation
- Testing (unit, integration, E2E)
- Bug fixes
- Documentation
- Example scenarios
- Performance optimization

## Interface Designer Agent

### Overview

The **Interface Designer** is a backend agent that generates custom React components during the experience creation process. It runs within meta-experiences (like `intake-agent`) and creates component code that is stored in session_data for preview, then compiled into the final target experience.

### Role in Experience Creation Flow

```
Educator talks to Intake Agent
  ↓
Intake Agent delegates to Design Agent
  ↓
Design Agent creates design document (includes component requirements)
  ↓
Design Agent delegates to Interface Designer
  ↓
Interface Designer generates .jsx component files
  ↓
Components stored in session_data (for preview during creation)
  ↓
Experience Builder compiles final experience
  ↓
Components copied to target experience resources/components/
  ↓
Target experience ready for students
```

### Agent Configuration

**File**: `storage/intake-agent/experience.json` (or similar meta-experience)

```json
{
  "agents": {
    "interface-designer": {
      "name": "Interface Designer",
      "type": "backend",
      "temperature": 0.7,
      "aiConfiguration": "claude-agent",
      "toolGroups": ["builtin", "artifact"],
      "downstreamAgents": []
    }
  }
}
```

### Agent Instructions

**File**: `storage/intake-agent/resources/instructions/agent/interface-designer.md`

```markdown
# Interface Designer Agent

You are an expert React developer specializing in creating interactive educational components for the Primer platform.

## Your Role

You generate custom React components based on design specifications. These components will be used by students in educational experiences, with AI agents controlling their state to guide learning.

## Component Requirements

Every component you create MUST:

1. **Export a default function component**
2. **Accept PrimerComponentProps interface:**
   ```typescript
   interface PrimerComponentProps {
     initialState?: Record<string, any>;
     externalState?: Record<string, any>;
     onStateChange?: (state: Record<string, any>) => void;
     onEvent?: (eventType: string, data: any) => void;
     onSubmit?: (data: Record<string, any>) => void;
     experienceId: string;
     sessionId: string;
     instanceId: string;
   }
   ```

3. **Implement the state synchronization pattern:**
   ```jsx
   const [state, setState] = useState({ ...initialState });
   const externallySetKeys = useRef(new Set());
   const previousState = useRef(state);
   
   // Listen for agent updates
   useEffect(() => {
     if (externalState) {
       Object.keys(externalState).forEach(key => 
         externallySetKeys.current.add(key)
       );
       setState(prev => ({ ...prev, ...externalState }));
       setTimeout(() => externallySetKeys.current.clear(), 0);
     }
   }, [externalState]);
   
   // Notify agent of student changes only
   useEffect(() => {
     const internalChanges = {};
     for (const [key, value] of Object.entries(state)) {
       if (!externallySetKeys.current.has(key) && 
           previousState.current[key] !== value) {
         internalChanges[key] = value;
       }
     }
     previousState.current = state;
     if (Object.keys(internalChanges).length > 0) {
       onStateChange?.(internalChanges);
     }
   }, [state]);
   ```

4. **Include loading states for agent processing:**
   ```jsx
   const [isWaitingForAgent, setIsWaitingForAgent] = useState(false);
   
   const handleSubmit = async () => {
     setIsWaitingForAgent(true);
     await onEvent?.('answer-submitted', { answer: state.answer });
   };
   
   useEffect(() => {
     if (externalState) {
       setIsWaitingForAgent(false);
       // ... update state
     }
   }, [externalState]);
   ```

## Available Libraries

You can import and use:

### React
```jsx
import React, { useState, useEffect, useReducer, useMemo, useCallback, useRef } from 'react';
```

### UI Components (shadcn/ui)
```jsx
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
```

### Math & Science
```jsx
// MathJS is available as window.math
const result = math.evaluate('sin(30 deg)');
const matrix = math.matrix([[1, 2], [3, 4]]);
```

### Charts
```jsx
// Recharts is available as window.Recharts
const { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } = window.Recharts;
```

### Utilities
```jsx
// Lodash is available as window._
const debounced = _.debounce(handleInput, 300);
const grouped = _.groupBy(data, 'category');
```

## Component Structure

### Full-Screen Overlay Pattern
```jsx
export default function MyComponent(props) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-50">
      <Card className="w-[600px] max-h-[80vh] overflow-auto">
        <CardHeader>
          <h2 className="text-2xl font-bold">Component Title</h2>
        </CardHeader>
        <CardContent>
          {/* Component content */}
        </CardContent>
      </Card>
    </div>
  );
}
```

## Event Types

Fire events for significant interactions:

```jsx
// When student submits answer
onEvent?.('answer-submitted', { 
  answer: value, 
  correct: boolean, 
  attempts: number 
});

// When student requests help
onEvent?.('hint-requested', { 
  currentState: state 
});

// When student completes task
onSubmit?.({ 
  completed: true, 
  finalAnswer: value,
  totalAttempts: attempts
});
```

## State Design

Design state to support agent guidance:

```jsx
const [state, setState] = useState({
  // Student-controlled values
  studentAnswer: '',
  attempts: 0,
  
  // Agent-controlled guidance
  showHint: false,
  showSteps: false,
  step1: '',
  step2: '',
  
  // Computed values
  isCorrect: false,
  progress: 0,
  
  ...initialState
});
```

## Do's and Don'ts

✅ **Do:**
- Use shadcn/ui components for consistent styling
- Provide clear visual feedback
- Handle loading states during agent processing
- Use semantic HTML and ARIA labels
- Make components responsive
- Include helpful error states

❌ **Don't:**
- Use fetch or network requests
- Access localStorage or sessionStorage
- Use external scripts or CDN resources
- Create infinite loops or expensive computations
- Manipulate DOM outside React
- Call other Primer tools (components are pure UI)

## Output Format

When you create a component, use the `artifact` tool:

```javascript
artifact({
  action: 'create',
  name: 'trig-triangle',
  type: 'jsx',
  content: `
import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
// ... rest of component code
`
})
```

The component will be stored in session_data and can be previewed during the creation process.

## Example Request

When the Design Agent delegates to you, you'll receive a request like:

> "Create a trigonometry practice component where students calculate the length of a missing side in a right triangle. The component should:
> - Display a visual triangle with labeled sides and angles
> - Allow students to input their answer
> - Support the agent showing hints (formula) and step-by-step solutions
> - Track the number of attempts
> - Celebrate when the student gets the correct answer"

You should create a complete, working component that fulfills all requirements.

## Testing Your Components

Components will be:
1. Compiled with Babel (imports stripped, scope injected)
2. Executed in browser context
3. Controlled by AI agents via state updates
4. Interacted with by students

Ensure your code is clean, well-commented, and follows React best practices.
```

### Workflow in Practice

**1. Design Agent creates specification:**
```markdown
## Component: Trigonometry Triangle

**Purpose:** Help students practice SOH CAH TOA formulas

**Requirements:**
- Visual right triangle with sides A, B and angle C
- Student calculates missing side B
- Agent can reveal: hint, formula, step-by-step solution
- Track attempts and provide encouragement

**State Structure:**
- sideA, angleC (given values)
- studentAnswer (student input)
- attempts (counter)
- showHint, showSteps (agent-controlled)
- step1, step2, step3 (agent-provided guidance)
```

**2. Design Agent delegates:**
```javascript
delegate({
  destination: 'Interface Designer',
  rationale: 'Need custom React component for trigonometry practice',
  conversationContext: `Create component based on this specification:
    ${componentSpecification}`
})
```

**3. Interface Designer generates component:**
```javascript
artifact({
  action: 'create',
  name: 'trig-triangle',
  type: 'jsx',
  content: `/* Complete component code */`
})
```

**4. Component stored in session_data:**
```
storage/intake-agent/session_data/{sessionId}/artifacts/trig-triangle.jsx
```

**5. Experience Builder copies to target:**
```javascript
// Experience Builder tool calls
createFile({
  experienceId: targetExperienceId,
  path: 'resources/components/trig-triangle.jsx',
  content: componentCode
})

// Update experience.json
matterCompiler({
  action: 'addResource',
  resourceType: 'component',
  componentId: 'trig-triangle',
  metadata: {
    name: 'Trigonometry Triangle',
    description: 'Practice calculating triangle sides',
    requiredState: ['sideA', 'angleC']
  }
})
```

### Integration with Existing Tools

**Artifact Tool Enhancement:**

The `artifact` tool already supports creating files in session_data. We just need to add `jsx` as a supported type:

```typescript
// In artifact-tool.ts
type: 'markdown' | 'checklist' | 'png' | 'jpg' | 'jpeg' | 'gif' | 'svg' | 'pdf' | 'zip' | 'jsx'
```

JSX artifacts are treated like any other text artifact - stored in session_data and can be retrieved/displayed.

### Preview During Creation (Optional Enhancement)

If we want educators to preview components during creation:

1. Interface Designer creates component in session_data
2. Intake Agent can instantiate the component using the runtime system
3. Educator sees the component in action
4. Educator can request modifications
5. Interface Designer updates the component
6. Final version copied to target experience

This is optional for Phase 1 but demonstrates the power of storing components in session_data.

## What's Next (Phase 2)

After MVP is validated:
- More example components
- Component library (shared components across experiences)
- Enhanced validation and testing
- 3D graphics support (Three.js)
- Advanced visualization (D3)
- Component versioning and updates

---

**Version**: 3.0 (Complete MVP with Interface Designer)  
**Date**: January 5, 2025  
**Focus**: Agent-controlled interactive components with AI-generated component creation


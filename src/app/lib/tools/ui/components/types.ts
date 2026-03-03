/**
 * Type definitions for custom React components system.
 * 
 * Phase 0: Runtime Validation
 */

/**
 * Props passed to all custom components.
 * These props enable bidirectional communication between components and agents.
 */
export interface PrimerComponentProps {
  /** Initial state set by the agent when showing the component */
  initialState?: Record<string, any>;
  
  /** External state updates from the agent (triggers re-render) */
  externalState?: Record<string, any>;
  
  /** Callback when component state changes (student interactions) */
  onStateChange?: (state: Record<string, any>) => void;
  
  /** Callback for custom events (e.g., "answer-checked", "step-completed") */
  onEvent?: (eventType: string, data: any) => Promise<void>;
  
  /** Callback when component is submitted/completed */
  onSubmit?: (data: Record<string, any>) => Promise<void>;
  
  /** Experience ID for context */
  experienceId: string;
  
  /** Session ID for context */
  sessionId: string;
  
  /** Unique instance ID for this component instance */
  instanceId: string;
}

/**
 * Metadata about a component from experience configuration.
 */
export interface ComponentInfo {
  /** Unique component ID (e.g., "trig-triangle") */
  id: string;
  
  /** Human-readable name */
  name: string;
  
  /** Description of what the component does */
  description: string;
  
  /** Path to component file (e.g., "resources/components/trig-triangle.jsx") */
  file: string;
  
  /** Required state keys */
  requiredState?: string[];
  
  /** Optional state keys */
  optionalState?: string[];
}

/**
 * A compiled component ready for execution.
 */
export interface CompiledComponent {
  /** Component ID */
  id: string;
  
  /** Compiled code (transformed by Babel) */
  code: string;
  
  /** Component metadata */
  metadata: ComponentInfo;
  
  /** Timestamp when compiled */
  compiledAt: number;
}

/**
 * Scope object injected into component execution.
 * Contains all available libraries and dependencies.
 */
export interface ComponentScope {
  React: any;
  useState: any;
  useEffect: any;
  useRef: any;
  useCallback: any;
  useMemo: any;
  useContext: any;
  useReducer: any;
  useLayoutEffect: any;
  useImperativeHandle: any;
  useDebugValue: any;
  
  // shadcn/ui components - Basic
  Button: any;
  Input: any;
  Textarea: any;
  Label: any;
  
  // shadcn/ui components - Card
  Card: any;
  CardHeader: any;
  CardContent: any;
  CardFooter: any;
  CardTitle: any;
  CardDescription: any;
  
  // shadcn/ui components - Select
  Select: any;
  SelectTrigger: any;
  SelectValue: any;
  SelectContent: any;
  SelectItem: any;
  
  // shadcn/ui components - Dialog
  Dialog: any;
  DialogTrigger: any;
  DialogContent: any;
  DialogHeader: any;
  DialogFooter: any;
  DialogTitle: any;
  DialogDescription: any;
  
  // shadcn/ui components - Alert Dialog
  AlertDialog: any;
  AlertDialogTrigger: any;
  AlertDialogContent: any;
  AlertDialogHeader: any;
  AlertDialogFooter: any;
  AlertDialogTitle: any;
  AlertDialogDescription: any;
  AlertDialogAction: any;
  AlertDialogCancel: any;
  
  // shadcn/ui components - Toggle
  Toggle: any;
  ToggleGroup: any;
  ToggleGroupItem: any;
  
  // shadcn/ui components - Tooltip
  Tooltip: any;
  TooltipTrigger: any;
  TooltipContent: any;
  TooltipProvider: any;
  
  // shadcn/ui components - Progress & Slider
  Progress: any;
  Slider: any;
  
  // shadcn/ui components - Chart
  ChartContainer: any;
  ChartTooltip: any;
  ChartTooltipContent: any;
  ChartLegend: any;
  ChartLegendContent: any;
  ChartStyle: any;
  
  // shadcn/ui components - Context Menu
  ContextMenu: any;
  ContextMenuTrigger: any;
  ContextMenuContent: any;
  ContextMenuItem: any;
  ContextMenuCheckboxItem: any;
  ContextMenuRadioItem: any;
  ContextMenuLabel: any;
  ContextMenuSeparator: any;
  ContextMenuShortcut: any;
  ContextMenuGroup: any;
  ContextMenuPortal: any;
  ContextMenuSub: any;
  ContextMenuSubContent: any;
  ContextMenuSubTrigger: any;
  ContextMenuRadioGroup: any;
  
  // shadcn/ui components - Dropdown Menu
  DropdownMenu: any;
  DropdownMenuTrigger: any;
  DropdownMenuContent: any;
  DropdownMenuItem: any;
  DropdownMenuCheckboxItem: any;
  DropdownMenuRadioItem: any;
  DropdownMenuLabel: any;
  DropdownMenuSeparator: any;
  DropdownMenuShortcut: any;
  DropdownMenuGroup: any;
  DropdownMenuPortal: any;
  DropdownMenuSub: any;
  DropdownMenuSubContent: any;
  DropdownMenuSubTrigger: any;
  DropdownMenuRadioGroup: any;
  
  // shadcn/ui components - Hover Card
  HoverCard: any;
  HoverCardTrigger: any;
  HoverCardContent: any;
  
  // shadcn/ui components - Scroll Area
  ScrollArea: any;
  ScrollBar: any;
  
  // shadcn/ui components - Toast
  Toast: any;
  ToastProvider: any;
  ToastViewport: any;
  ToastTitle: any;
  ToastDescription: any;
  ToastClose: any;
  ToastAction: any;
  
  // External libraries (from CDN, optional)
  math?: any;      // MathJS (optional)
  _?: any;         // Lodash (optional)
  THREE?: any;     // Three.js for 3D graphics (optional)
  Recharts?: any;  // Recharts for charts/graphs (optional)
}

/**
 * Event fired by a component.
 */
export interface ComponentEvent {
  /** Source identifier */
  source: 'component';
  
  /** Instance ID that fired the event */
  instanceId: string;
  
  /** Component ID */
  componentId: string;
  
  /** Event type (e.g., "answer-checked") */
  eventType: string;
  
  /** Event data */
  eventData: any;
  
  /** Timestamp */
  timestamp: number;
}

/**
 * State change event from a component.
 */
export interface ComponentStateChangeEvent {
  /** Source identifier */
  source: 'component';
  
  /** Instance ID that changed */
  instanceId: string;
  
  /** Component ID */
  componentId: string;
  
  /** Changed state keys and values */
  stateChanges: Record<string, any>;
  
  /** Timestamp */
  timestamp: number;
}

/**
 * Active component instance.
 */
export interface ComponentInstance {
  /** Unique instance ID */
  instanceId: string;
  
  /** Component ID */
  componentId: string;
  
  /** React component */
  component: React.ComponentType<PrimerComponentProps>;
  
  /** Current props */
  props: PrimerComponentProps;
  
  /** Current state */
  state: Record<string, any>;
  
  /** Created timestamp */
  createdAt: number;
}

/**
 * Component configuration in experience.json.
 */
export interface ComponentConfig {
  id: string;
  name: string;
  description: string;
  file: string;
  requiredState?: string[];
  optionalState?: string[];
}


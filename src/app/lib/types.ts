import { ComponentConfig } from './tools/ui/components/types';

export interface AppProps {
  setAvailableScenes: (scenes: Record<string, { path: string; url: string }>) => void;
  setDataChannel?: (dataChannel: RTCDataChannel | null) => void;
}

export type SessionStatus = "DISCONNECTED" | "CONNECTING" | "CONNECTED";

export interface ToolParameterProperty {
  type: string | string[];
  description?: string;
  enum?: string[];
  pattern?: string;
  properties?: Record<string, ToolParameterProperty>;
  required?: string[];
  additionalProperties?: boolean;
  items?: ToolParameterProperty;
}

export interface ToolParameters {
  type: string;
  properties: Record<string, ToolParameterProperty>;
  required?: string[];
  additionalProperties?: boolean;
}

export interface Tool {
  type: 'function';
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      [key: string]: any;
    }>;
    required?: string[];
    additionalProperties?: boolean;
  };
}

export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  parameters: any;
  handlerPath?: string;  // Path to the script containing the handler
}

export interface TranscriptItem {
  itemId: string;
  type: "MESSAGE" | "BREADCRUMB";
  role?: "user" | "assistant";
  title?: string;
  data?: Record<string, any>;
  expanded: boolean;
  timestamp: string;
  createdAtMs: number;
  status: "IN_PROGRESS" | "DONE";
  isHidden: boolean;
}

export interface Log {
  id: number;
  timestamp: string;
  direction: string;
  eventName: string;
  data: any;
  expanded: boolean;
  type: string;
}

export type ServerEvent = {
  type: string;
  delta?: string;
  text?: string;
  item_id?: string;
  data?: any; // For custom events like UI manipulation events
  item?: {
    id: string;
    type: string;
    role: string;
    content: Array<{
      type: string;
      text?: string;
      transcript?: string;
      audio?: string;
    }>;
  };
  response?: {
    id: string;
    object: string;
    created_at: number;
    status: 'in_progress' | 'completed' | 'failed';
    error: {
      code: string;
      message: string;
    } | null;
    incomplete_details: null;
    model: string;
    output: Array<{
      type: string;
      id: string;
      status: string;
      role: string;
      name?: string;
      call_id?: string;
      arguments?: string;
      content?: Array<{
        type: string;
        text: string;
        annotations: any[];
      }>;
    }>;
    parallel_tool_calls: boolean;
    previous_response_id: null;
    reasoning: {
      effort: null;
      generate_summary: null;
    };
    store: boolean;
    temperature: number;
    text: {
      format: {
        type: string;
      };
    };
    tool_choice: string;
    tools: any[];
    top_p: number;
    truncation: string;
    usage: {
      input_tokens: number;
      output_tokens: number;
      output_tokens_details: {
        reasoning_tokens: number;
      };
      total_tokens: number;
    } | null;
  };
  session?: {
    id: string;
    created_at: number;
    status: string;
  };
  output_index?: number;
  content_index?: number;
  transcript?: string;
  error?: {
    type: string;
    code?: string;
    message: string;
  };
};

export interface FileUploadResponse {
  success: boolean;
  fileInfoUrl: string;
  uploadId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
}

export interface ToolResponse {
  status: 'success' | 'error' | 'deferred';
  data?: any;
  message?: string;
}

export interface LoggedEvent {
  id: number;
  direction: "client" | "server";
  expanded: boolean;
  timestamp: string;
  eventName: string;
  eventData: Record<string, any>;
}

export interface AgentConfig {
  name: string;
  voice?: string; // Optional for backend agents
  publicDescription: string;
  instructions: string;
  temperature: number;
  tools: Tool[];
  toolLogic?: Record<
    string,
    (args: any, context: any) => Promise<any> | any
  >;
  downstreamAgents?: AgentConfig[] | { name: string; publicDescription: string }[];
  availableTools?: string[]; // @deprecated - use toolSets instead
  toolGroups?: string[]; // @deprecated - use toolSets instead. Tool groups this agent has access to
  toolSets?: string[]; // Array of toolSet names (configVersion 2+)
  aiConfiguration?: string; // Name of the AI configuration to use
  type?: 'frontend' | 'backend'; // Distinguishes between realtime and API-based agents
  maximumToolCalls?: number; // Maximum number of tool calls before stopping (default: 100)
}

/* --- */

export interface ContentLoader {
  basePath: string;
  loadContent(path: string, objectPath: string): Promise<LoadResult>;
}

export interface Resource {
  path: string;    // Original path
  url: string;     // Absolute URL
}

export type ResourceLoadStatus = {
  friendlyName: string, 
  path: string;          // The resource's URL/file path
  objectPath: string;    // e.g. "resources.scenes" or "resources.instructions.agent"
  status: 'OK' | 'MISSING' | 'INVALID_PLACEHOLDER';
  statusDetail?: string;
};

export type LoadResult = {
  content?: string;
  status: ResourceLoadStatus;
};

export type ValidationReport = {
  statuses: ResourceLoadStatus[];
  hasErrors: boolean;
};

export interface RealtimeSettings {
  silence_duration_ms?: number;  // Duration of silence to detect speech stop (default: 500ms)
  threshold?: number;            // VAD activation threshold 0.0-1.0 (default: 0.5)
  prefix_padding_ms?: number;    // Audio to include before VAD detected speech (default: 300ms)
  create_response?: boolean;     // Auto-generate response on VAD stop (default: true)
  interrupt_response?: boolean;  // Auto-interrupt response on VAD start (default: true)
}

export interface AIConfiguration {
  provider: string;
  api: string;
  model: string;
  imageModel?: string;
  streaming: boolean;
  modalities: string[];
  realtimeSettings?: RealtimeSettings;  // Only used when api === 'realtime'
}

export type ArtifactType = 'markdown' | 'checklist';

export interface ArtifactConfig {
  name: string;
  type: ArtifactType;
  file: string;
  agents?: string[];  // Optional array of agent keys that can access this artifact
  metadata?: {
    description?: string;
    tags?: string[];
    presentation?: {
      type: 'slide' | 'editor' | 'checklist' | 'none';
      options?: Record<string, any>;
    };
  };
}

export interface ExperienceConfig {
  version: string;
  configVersion?: number; // Configuration format version (1 = legacy, 2 = new toolSets format)
  kind?: string; // Experience kind (e.g., 'user', 'debugger', 'template')
  requires?: string[]; // Module IDs that must be installed for this experience to work
  title: string;
  description: string;
  experienceId?: string;
  logo?: Resource;
  aiConfigurations?: Record<string, AIConfiguration>;
  created?: string; // ISO 8601 datetime when experience was first created
  lastModified?: string; // ISO 8601 datetime when experience was last modified
  author?: string; // Name of the user who created the experience
  authorEmail?: string; // Email of the user who created the experience
  usesComponents?: boolean; // If true, component libraries are bootstrapped even when no components are pre-defined (e.g., meta-experiences that create components at runtime)
  initialAgent?: string; // Key of the initial agent to start with
  resources: {
    scenes: Resource[];
    sounds: Resource[];
    artifacts?: ArtifactConfig[];
    instructions: {
      agent: Record<string, Resource>;
      supplemental: Record<string, Resource>;
    };
    components?: ComponentConfig[];
  };
  agents: Record<string, {
    name: string;
    voice?: string; // Optional for backend agents
    publicDescription: string;
    instructions?: string;
    availableTools?: string[]; // @deprecated - use toolSets instead
    toolGroups?: string[]; // @deprecated - use toolSets instead. Tool groups this agent has access to (e.g., ['builtin', 'experience'])
    toolSets?: string[]; // Array of toolSet names from the toolSets config (configVersion 2+)
    downstreamAgents: string[];
    temperature?: number;
    aiConfiguration?: string; // Name of the AI configuration to use
    type?: 'frontend' | 'backend'; // Distinguishes between realtime and API-based agents
    analyticsConfig?: AnalyticsConfig; // Configuration for analytics agents
    maximumToolCalls?: number; // Maximum number of tool calls before stopping (default: 100)
  }>;
  toolSets?: Record<string, string[]>; // Named sets of tools (configVersion 2+). Key = toolSet name, Value = array of tool names
  tools?: {
    builtin?: string[];
    bundled?: string[];
    plugins?: string[]; // @deprecated (configVersion 1) - Array of plugin package names
  };
}

export interface ExperienceMetadata {
  version: string;
  title: string;
  logo?: Resource;
  description: string;
  api?: 'realtime' | 'responses';
  authorEmail?: string; // Email of the experience author for permission checks
  hasReadme?: boolean; // Whether the experience has a README.md file
}

export interface ConfigResponse {
  agents: Record<string, AgentConfig>;
  resources: {
    scenes: Resource[];
    sounds: Resource[];
  };
  metadata: {
    version: string;
    title: string;
    logo?: Resource;
    description: string;
    authorEmail?: string; // Email of the experience author for permission checks
  };
  tools?: Record<string, ToolDefinition>;
  aiConfigurations: Record<string, AIConfiguration>;
}

export type ToolHandler = (args: any, context: any) => Promise<ToolResponse> | ToolResponse;

// ============================================
// Classes Feature Types
// ============================================

/**
 * A member of a class - typically a student
 */
export interface ClassMember {
  email: string;
  addedAt: string; // ISO 8601 datetime
  addedBy?: string; // Email of who added this member (educator)
  name?: string; // Optional display name
}

/**
 * A class represents a group of students authorized to play a specific experience
 */
export interface Class {
  id: string; // Unique identifier for this class
  name: string; // Human-readable name (e.g., "Fall 2025 Physics 101")
  description?: string; // Optional description
  createdBy: string; // Email of the educator who created this class
  createdAt: string; // ISO 8601 datetime
  members: ClassMember[];
  isActive: boolean; // Whether the class is currently active
}

/**
 * The structure of classes.json stored alongside experience.json
 */
export interface ClassesConfig {
  classes: Class[];
  lastModified: string; // ISO 8601 datetime
}

/**
 * Summary of a class for API responses (excludes full member list)
 */
export interface ClassSummary {
  id: string;
  name: string;
  description?: string;
  memberCount: number;
  createdBy: string;
  createdAt: string;
  isActive: boolean;
}

/**
 * Analytics data for a class member based on their session data
 */
export interface ClassMemberAnalytics {
  email: string;
  name?: string;
  sessionsCount: number;
  lastSessionAt?: string;
  totalDuration?: number; // In milliseconds
}

// ============================================
// Analytics Feature Types
// ============================================

/**
 * Configuration for analytics agents in experience.json
 */
export interface AnalyticsConfig {
  type: 'student' | 'class';      // Whether this runs per-student or once per class
  runnable: boolean;               // Whether to show "Run" button in admin UI
  outputPath?: string;             // Where to store output (relative path)
  outputFilename?: string;         // Template for output filename
  dependsOn?: string[];            // Other analytics agents that should run first
}

/**
 * Session info for a class member
 */
export interface MemberSessionInfo {
  sessionId: string;
  startTime: string;           // ISO 8601
  endTime?: string;            // ISO 8601 (if available)
  hasAnalytics: boolean;       // Whether analytics have been generated
  analyticsGeneratedAt?: string; // When analytics were last generated
}

/**
 * A member's sessions in the index
 */
export interface MemberSessionsEntry {
  sessions: MemberSessionInfo[];
  latestSession?: string;      // sessionId of most recent session
  totalSessions: number;
  name?: string;               // User's display name (if known)
}

/**
 * Sessions index for a class - maps emails to their sessions
 */
export interface ClassSessionsIndex {
  classId: string;
  experienceId: string;
  lastUpdated: string;         // ISO 8601
  members: Record<string, MemberSessionsEntry>;  // Key is lowercase email
  totalMembers: number;
  membersWithSessions: number;
}

/**
 * Status of an analytics job
 */
export interface AnalyticsJobStatus {
  jobId: string;
  experienceId: string;
  classId: string;
  agentKey: string;
  type: 'student' | 'class';
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress?: {
    current: number;
    total: number;
    currentStudentEmail?: string;
  };
  startedAt?: string;
  completedAt?: string;
  error?: string;
  results?: AnalyticsResult[];
}

/**
 * Result of a single analytics run
 */
export interface AnalyticsResult {
  sessionId?: string;          // For student-level analytics
  email?: string;              // Student email (if student-level)
  outputPath: string;          // Where the result was saved
  generatedAt: string;         // ISO 8601
  success: boolean;
  error?: string;
}

/**
 * Analytics run request body
 */
export interface AnalyticsRunRequest {
  experienceId: string;
  classId: string;
  agentKey: string;
  scope: 'student' | 'class';
  options?: {
    regenerate?: boolean;      // Regenerate even if exists
    sessionIds?: string[];     // Only run for specific sessions (student-level)
  };
}

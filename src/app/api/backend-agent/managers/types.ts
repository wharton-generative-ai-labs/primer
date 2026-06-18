/**
 * Type definitions for backend-agent managers
 */

/**
 * Request body for backend agent
 */
export interface BackendAgentRequest {
  agentType: string; // Friendly name of the agent (e.g., "Design Agent")
  artifactIds: string[];
  taskDescription?: string;
  experienceId?: string;
  imageNames?: string[];
  delegationId?: string; // ID to track delegation status
  // Note: sessionId comes from headers, not body
}

/**
 * Validated request data
 */
export interface ValidatedRequest {
  agentType: string;
  artifactIds: string[];
  taskDescription: string;
  experienceId: string;
  imageNames: string[];
  delegationId?: string;
  sessionId: string;
  userEmail: string;
}

/**
 * Experience configuration
 */
export interface ExperienceConfig {
  agents: Record<string, AgentConfig>;
  initialAgent?: string;
  resources?: {
    instructions?: {
      agent?: Record<string, string>;
      supplemental?: Record<string, string>;
    };
  };
  aiConfigurations?: Record<string, AIConfiguration>;
  /**
   * Custom toolSet definitions declared at the top level of experience.json.
   * Map: toolSet name → array of tool names. Threaded through to
   * `expandToolSets` so agents can reference experience-specific bundles.
   */
  toolSets?: Record<string, string[]>;
}

/**
 * Agent configuration
 */
export interface AgentConfig {
  name: string;
  publicDescription?: string;
  aiConfiguration?: string;
  temperature?: number;
  toolGroups?: string[]; // @deprecated - use toolSets instead
  toolSets?: string[]; // Array of toolSet names (configVersion 2+)
  maximumToolCalls?: number; // Maximum number of tool calls before stopping (default: 100)
}

/**
 * AI configuration
 */
export interface AIConfiguration {
  provider?: string;
  model?: string;
}

/**
 * Tool definition in OpenAI format
 */
export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: any;
  };
}

/**
 * AI response message
 */
export interface AIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

/**
 * Tool call from AI
 */
export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

/**
 * Loaded experience data
 */
export interface LoadedExperience {
  config: ExperienceConfig;
  agentKey: string;
  agentConfig: AgentConfig;
  instructions: string;
  aiConfig?: AIConfiguration;
  temperature?: number;
}

/**
 * AI provider configuration
 */
export interface AIProviderConfig {
  useAnthropic: boolean;
  modelName: string;
  providerName: string;
}


import { Tool } from '../types';

// Core AI Provider types
export type AIMode = 'realtime' | 'text';
export type AIStatus = 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED';

export interface AIConfig {
  mode: AIMode;
  voice?: string;  // Voice ID for realtime mode
  model?: string;  // Model ID for text mode
  instructions?: string;
  tools?: Tool[];  // Tool definitions
}

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AIResponse {
  message: AIMessage;
  audio?: ArrayBuffer;
}

// Function call types
export interface AIFunctionCall {
  name: string;
  arguments: any;
  call_id?: string;
}

export interface AIFunctionResult {
  call_id?: string;
  result: any;
  error?: string;
}

// Events system
export type AIEventType = 
  | 'message.created'
  | 'message.updated'
  | 'message.completed'
  | 'audio.started'
  | 'audio.stopped'
  | 'connection.established'
  | 'connection.closed'
  | 'data.received'
  | 'data.sent'
  | 'error';

export interface AIEvent {
  type: AIEventType;
  message?: AIMessage;
  data?: any;
  error?: Error | string; // Allow both Error objects and strings
}

export interface AIEventListener {
  (event: AIEvent): void;
}

// Optional data channel interface
export interface AIDataChannel {
  send(data: any): void;
  readyState: 'connecting' | 'open' | 'closing' | 'closed';
}

// Main AI Provider interface
export interface AIProvider {
  // Core functionality
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  sendMessage(content: string): Promise<void>;
  getStatus(): AIStatus;

  // Event system
  addEventListener(listener: AIEventListener): void;
  removeEventListener(listener: AIEventListener): void;

  // Configuration
  getConfig(): AIConfig;
  updateConfig(config: Partial<AIConfig>): Promise<void>;

  // Optional data channel functionality
  getDataChannel?(): AIDataChannel | null;
  sendData?(data: any): void;

  // Optional function call handling
  handleFunctionCall?(functionCall: AIFunctionCall): Promise<void>;
  sendFunctionResult?(result: AIFunctionResult): Promise<void>;
} 
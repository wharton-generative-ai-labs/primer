import { AIConfig, AIEvent, AIEventListener, AIDataChannel, AIProvider, AIStatus, AIMessage } from './types';

export abstract class BaseAIProvider implements AIProvider {
  protected config: AIConfig;
  protected eventListeners: Set<AIEventListener>;
  private _status: AIStatus = 'DISCONNECTED';
  protected dataChannel: AIDataChannel | null;
  protected messages: AIMessage[] = [];

  constructor(config: AIConfig) {
    this.config = config;
    this.eventListeners = new Set();
    this.dataChannel = null;
  }

  // Core functionality - must be implemented by concrete providers
  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract sendMessage(content: string): Promise<void>;

  // Status management
  getStatus(): AIStatus {
    return this._status;
  }

  protected getInternalStatus(): AIStatus {
    return this._status;
  }

  protected setInternalStatus(newStatus: AIStatus): void {
    this._status = newStatus;
    this.emitEvent({
      type: newStatus === 'CONNECTED' ? 'connection.established' : 'connection.closed'
    });
  }

  // Event system
  addEventListener(listener: AIEventListener): void {
    this.eventListeners.add(listener);
  }

  removeEventListener(listener: AIEventListener): void {
    this.eventListeners.delete(listener);
  }

  protected emitEvent(event: AIEvent): void {
    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        // Error in event listener - log but don't break execution
        // Use dynamic import to avoid circular dependencies
        import('@/lib/logger').then(({ createModuleLogger }) => {
          const logger = createModuleLogger('BaseAIProvider');
          logger.error(error, 'Error in event listener');
        }).catch(() => {
          // If logger fails, silently continue
        });
      }
    });
  }

  // Configuration management
  getConfig(): AIConfig {
    return { ...this.config };
  }

  async updateConfig(config: Partial<AIConfig>): Promise<void> {
    const oldConfig = this.config;
    this.config = { ...this.config, ...config };

    // If we're connected and critical config changed, reconnect
    if (this._status === 'CONNECTED' && 
        (oldConfig.mode !== this.config.mode || 
         oldConfig.voice !== this.config.voice || 
         oldConfig.model !== this.config.model)) {
      await this.disconnect();
      await this.connect();
    }
  }

  // Message management
  protected getMessages(): AIMessage[] {
    return [...this.messages];
  }

  protected clearMessages(): void {
    this.messages = [];
  }

  protected addMessage(message: AIMessage): void {
    this.messages.push(message);
    this.emitEvent({ type: 'message.created', message });
  }

  protected updateMessage(message: AIMessage): void {
    const index = this.messages.findIndex(m => m.id === message.id);
    if (index !== -1) {
      this.messages[index] = message;
      this.emitEvent({ type: 'message.updated', message });
    }
  }

  // Optional data channel functionality
  getDataChannel(): AIDataChannel | null {
    return this.dataChannel;
  }

  sendData(data: any): void {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      this.emitEvent({
        type: 'error',
        error: new Error('Data channel not available or not open')
      });
      return;
    }

    try {
      this.dataChannel.send(data);
      this.emitEvent({
        type: 'data.sent',
        data
      });
    } catch (error) {
      this.emitEvent({
        type: 'error',
        error: error instanceof Error ? error : new Error('Failed to send data')
      });
    }
  }

  protected createDataChannel(): AIDataChannel {
    return {
      readyState: 'open',
      send: (data: any) => {
        try {
          this.emitEvent({
            type: 'data.sent',
            data
          });
        } catch (error) {
          this.emitEvent({
            type: 'error',
            error: error instanceof Error ? error : new Error('Failed to send data')
          });
        }
      }
    };
  }
} 
import { BaseAIProvider } from './BaseAIProvider';
import { AIConfig, AIFunctionCall, AIFunctionResult, AIMessage } from './types';
import { v4 as uuidv4 } from 'uuid';

export class TextAIProvider extends BaseAIProvider {
  private currentResponseId: string | null = null;
  private abortController: AbortController | null = null;

  constructor(config: AIConfig) {
    super(config);
  }

  async connect(): Promise<void> {
    if (this.getInternalStatus() !== 'DISCONNECTED') return;
    this.setInternalStatus('CONNECTED');
  }

  async disconnect(): Promise<void> {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.setInternalStatus('DISCONNECTED');
  }

  async sendMessage(message: string): Promise<void> {
    const messageId = uuidv4();
    const userMessage: AIMessage = {
      id: messageId,
      role: 'user',
      content: message
    };

    this.addMessage(userMessage);

    try {
      // Create new abort controller for this request
      if (this.abortController) {
        this.abortController.abort();
      }
      this.abortController = new AbortController();

      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.fetchEphemeralKey()}`
        },
        body: JSON.stringify({
          model: this.config.model || 'gpt-4o',
          input: message,
          stream: true,
          instructions: this.config.instructions,
          tools: this.config.tools,
          previous_response_id: this.currentResponseId
        }),
        signal: this.abortController.signal
      });

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      // Process the stream
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Parse the SSE data
        const text = new TextDecoder().decode(value);
        const events = text.split('\n\n').filter(Boolean);

        for (const event of events) {
          if (event.startsWith('data: ')) {
            const data = JSON.parse(event.slice(6));
            this.handleServerEvent(data);
          }
        }
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        if (error.name !== 'AbortError') {
          // AbortError is expected and doesn't need logging
          const logger = (await import('@/lib/logger')).createModuleLogger('TextAIProvider');
          logger.error(error, 'Error sending message');
          this.emitEvent({ type: 'error', error: error.message });
        }
      } else {
        const logger = (await import('@/lib/logger')).createModuleLogger('TextAIProvider');
        logger.error(error, 'Unknown error sending message');
        this.emitEvent({ type: 'error', error: 'An unknown error occurred' });
      }
    }
  }

  async handleFunctionCall(_functionCall: AIFunctionCall): Promise<void> {
    // Function calls are handled in the response stream
  }

  async sendFunctionResult(result: AIFunctionResult): Promise<void> {
    // Send the function result as a new message
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this.fetchEphemeralKey()}`
      },
      body: JSON.stringify({
        model: this.config.model || 'gpt-4o',
        input: {
          type: 'function_call_output',
          call_id: result.call_id,
          output: JSON.stringify(result.result)
        },
        stream: true,
        instructions: this.config.instructions,
        tools: this.config.tools,
        previous_response_id: this.currentResponseId
      })
    });

    // Process response stream similar to sendMessage
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = new TextDecoder().decode(value);
      const events = text.split('\n\n').filter(Boolean);

      for (const event of events) {
        if (event.startsWith('data: ')) {
          const data = JSON.parse(event.slice(6));
          this.handleServerEvent(data);
        }
      }
    }
  }

  getStatus(): 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' {
    return this.getInternalStatus();
  }

  // Private helper methods
  private async fetchEphemeralKey(): Promise<string> {
    const response = await fetch('/api/session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.model || 'gpt-4o'
      }),
    });

    const data = await response.json();
    if (!data.client_secret?.value) {
      throw new Error('No ephemeral key provided by the server');
    }

    return data.client_secret.value;
  }

  private handleServerEvent(event: any) {
    switch (event.type) {
      case 'response.created':
        this.currentResponseId = event.response.id;
        break;

      case 'response.output_item.added':
        if (event.item.type === 'message' && event.item.role === 'assistant') {
          const message: AIMessage = {
            id: event.item.id,
            role: 'assistant',
            content: ''
          };
          this.addMessage(message);
        }
        break;

      case 'response.output_text.delta':
        if (event.item_id) {
          const message = this.messages.find(m => m.id === event.item_id);
          if (message) {
            message.content += event.delta;
            this.updateMessage(message);
          }
        }
        break;

      case 'response.output_item.done':
        if (event.item.type === 'message') {
          const message = this.messages.find(m => m.id === event.item.id);
          if (message) {
            this.emitEvent({ type: 'message.completed', message });
          }
        }
        break;

      case 'response.done':
        // Handle any cleanup or final processing
        break;

      case 'error':
        this.emitEvent({ type: 'error', error: event.message });
        break;
    }
  }
} 
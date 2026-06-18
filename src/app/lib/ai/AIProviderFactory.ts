import { AIConfig } from './types';
import { BaseAIProvider } from './BaseAIProvider';
import { RealtimeAIProvider } from './RealtimeAIProvider';
import { TextAIProvider } from './TextAIProvider';

export class AIProviderFactory {
  static createProvider(config: AIConfig): BaseAIProvider {
    switch (config.mode) {
      case 'realtime':
        return new RealtimeAIProvider(config);
      case 'text':
        return new TextAIProvider(config);
      default:
        throw new Error(`Unsupported AI provider mode: ${config.mode}`);
    }
  }
} 
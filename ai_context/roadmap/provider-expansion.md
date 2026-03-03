# Multi-Provider AI Architecture for Primer

## Executive Summary

This document outlines a comprehensive architecture for supporting multiple AI providers in Primer, moving away from tight OpenAI coupling to a flexible, extensible system that can work with any AI provider while maintaining feature parity where possible and gracefully degrading when necessary.

## Current State Analysis

### OpenAI Coupling Points

1. **Realtime API Dependency**
   - WebRTC connection directly to OpenAI
   - Specific event types and protocols
   - Voice model selection

2. **Responses API Usage**
   - Server-side streaming implementation
   - Specific response format expectations

3. **Tool/Function Calling**
   - OpenAI function calling format
   - Streaming tool calls
   - Parallel tool execution

4. **Model Configuration**
   - Hard-coded model names
   - OpenAI-specific parameters (temperature, max_tokens)
   - Voice selection for realtime

5. **Authentication**
   - Direct OPENAI_API_KEY usage
   - No abstraction for other providers

## Proposed Architecture

### Core Abstraction Layer

```typescript
interface AIProvider {
  // Provider identification
  name: string;
  capabilities: ProviderCapabilities;
  
  // Core methods
  initialize(config: ProviderConfig): Promise<void>;
  createCompletion(request: UnifiedCompletionRequest): Promise<UnifiedCompletionResponse>;
  createStreamingCompletion(request: UnifiedCompletionRequest): AsyncGenerator<UnifiedStreamChunk>;
  
  // Optional voice support
  supportsVoice(): boolean;
  createVoiceSession?(config: VoiceConfig): Promise<VoiceSession>;
  
  // Health and status
  validateConfig(): Promise<boolean>;
  getUsage(): Promise<UsageStats>;
}

interface ProviderCapabilities {
  text: boolean;
  streaming: boolean;
  voice: boolean;
  tools: boolean;
  vision: boolean;
  maxContextLength: number;
  supportedModalities: Modality[];
  supportedVoices?: Voice[];
  costPerToken: {
    input: number;
    output: number;
  };
}
```

### Unified Request/Response Format

```typescript
interface UnifiedCompletionRequest {
  messages: Message[];
  model?: string; // Provider-specific model selection
  temperature?: number;
  maxTokens?: number;
  tools?: UnifiedTool[];
  systemPrompt?: string;
  responseFormat?: ResponseFormat;
  
  // Provider-specific overrides
  providerOptions?: Record<string, any>;
}

interface UnifiedCompletionResponse {
  content: string;
  toolCalls?: ToolCall[];
  usage: TokenUsage;
  model: string;
  finishReason: FinishReason;
  
  // Provider-specific data
  providerResponse?: any;
}
```

### Provider Implementations

#### 1. OpenAI Provider

```typescript
class OpenAIProvider implements AIProvider {
  name = 'openai';
  
  capabilities: ProviderCapabilities = {
    text: true,
    streaming: true,
    voice: true,
    tools: true,
    vision: true,
    maxContextLength: 128000,
    supportedModalities: ['text', 'voice', 'image'],
    supportedVoices: ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'],
    costPerToken: {
      input: 0.00001,
      output: 0.00003
    }
  };
  
  async createStreamingCompletion(request: UnifiedCompletionRequest) {
    const openAIRequest = this.transformRequest(request);
    const stream = await this.client.chat.completions.create({
      ...openAIRequest,
      stream: true
    });
    
    for await (const chunk of stream) {
      yield this.transformChunk(chunk);
    }
  }
  
  async createVoiceSession(config: VoiceConfig) {
    // Return WebRTC connection details for Realtime API
    return new OpenAIVoiceSession(config);
  }
}
```

#### 2. Anthropic Provider

```typescript
class AnthropicProvider implements AIProvider {
  name = 'anthropic';
  
  capabilities: ProviderCapabilities = {
    text: true,
    streaming: true,
    voice: false, // No native voice support
    tools: true,
    vision: true,
    maxContextLength: 200000,
    supportedModalities: ['text', 'image'],
    costPerToken: {
      input: 0.000008,
      output: 0.000024
    }
  };
  
  async createStreamingCompletion(request: UnifiedCompletionRequest) {
    const claudeRequest = this.transformRequest(request);
    const stream = await this.client.messages.create({
      ...claudeRequest,
      stream: true
    });
    
    for await (const chunk of stream) {
      yield this.transformChunk(chunk);
    }
  }
  
  private transformRequest(request: UnifiedCompletionRequest) {
    // Transform unified format to Claude's format
    return {
      model: request.model || 'claude-3-opus-20240229',
      messages: this.transformMessages(request.messages),
      system: request.systemPrompt,
      max_tokens: request.maxTokens || 4000,
      temperature: request.temperature,
      tools: this.transformTools(request.tools)
    };
  }
}
```

#### 3. Local/Open Source Provider

```typescript
class LocalLLMProvider implements AIProvider {
  name = 'local-llm';
  
  capabilities: ProviderCapabilities = {
    text: true,
    streaming: true,
    voice: false,
    tools: false, // Many local models don't support function calling
    vision: false,
    maxContextLength: 8192,
    supportedModalities: ['text'],
    costPerToken: {
      input: 0,
      output: 0
    }
  };
  
  async createStreamingCompletion(request: UnifiedCompletionRequest) {
    // Connect to local Ollama/llama.cpp/vLLM instance
    const response = await fetch(`${this.baseUrl}/v1/completions`, {
      method: 'POST',
      body: JSON.stringify(this.transformRequest(request)),
      signal: this.abortSignal
    });
    
    // Handle streaming response
    yield* this.parseStreamResponse(response);
  }
}
```

### Voice Abstraction Layer

Since voice is not universally supported, we need a flexible approach:

```typescript
interface VoiceStrategy {
  initialize(provider: AIProvider): Promise<void>;
  startSession(config: VoiceConfig): Promise<VoiceSession>;
  isSupported(): boolean;
}

class NativeVoiceStrategy implements VoiceStrategy {
  // For providers with native voice support (OpenAI Realtime)
  async startSession(config: VoiceConfig) {
    return this.provider.createVoiceSession(config);
  }
}

class STTTTSVoiceStrategy implements VoiceStrategy {
  // For providers without native voice
  private sttProvider: STTProvider;
  private ttsProvider: TTSProvider;
  
  async startSession(config: VoiceConfig) {
    // Use separate STT/TTS services
    return new SyntheticVoiceSession(
      this.sttProvider,
      this.provider,
      this.ttsProvider
    );
  }
}

class TextFallbackStrategy implements VoiceStrategy {
  // Graceful degradation to text
  async startSession(config: VoiceConfig) {
    return new TextOnlySession(this.provider);
  }
}
```

### Provider Registry and Factory

```typescript
class AIProviderRegistry {
  private providers: Map<string, AIProvider> = new Map();
  private defaultProvider: string;
  
  register(provider: AIProvider) {
    this.providers.set(provider.name, provider);
  }
  
  async createProvider(config: ProviderSelectionConfig): Promise<AIProvider> {
    // Smart provider selection based on requirements
    const candidates = this.filterProviders(config.requirements);
    
    if (config.preferredProvider && candidates.includes(config.preferredProvider)) {
      return this.providers.get(config.preferredProvider);
    }
    
    // Cost optimization
    if (config.optimizeFor === 'cost') {
      return this.selectCheapestProvider(candidates, config.estimatedTokens);
    }
    
    // Performance optimization
    if (config.optimizeFor === 'speed') {
      return this.selectFastestProvider(candidates);
    }
    
    return this.providers.get(this.defaultProvider);
  }
  
  private filterProviders(requirements: ProviderRequirements): AIProvider[] {
    return Array.from(this.providers.values()).filter(provider => {
      const caps = provider.capabilities;
      return (
        (!requirements.voice || caps.voice) &&
        (!requirements.tools || caps.tools) &&
        (!requirements.vision || caps.vision) &&
        (!requirements.minContext || caps.maxContextLength >= requirements.minContext)
      );
    });
  }
}
```

### Tool Calling Normalization

Different providers have different tool calling formats:

```typescript
class ToolCallNormalizer {
  // Convert from unified format to provider-specific format
  static toOpenAI(tools: UnifiedTool[]): OpenAITool[] {
    return tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
      }
    }));
  }
  
  static toAnthropic(tools: UnifiedTool[]): AnthropicTool[] {
    return tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.parameters
    }));
  }
  
  static toGenericJSON(tools: UnifiedTool[]): string {
    // For providers without native tool support
    return `Available tools:\n${JSON.stringify(tools, null, 2)}\n\nRespond with tool calls in this format: {"tool": "name", "parameters": {...}}`;
  }
}
```

### Experience Configuration

Experiences can specify provider preferences:

```json
{
  "version": "1.0.0",
  "title": "Multi-Provider Experience",
  "aiConfig": {
    "providers": {
      "primary": {
        "name": "anthropic",
        "model": "claude-3-opus-20240229",
        "temperature": 0.7
      },
      "fallback": {
        "name": "openai",
        "model": "gpt-4-turbo-preview"
      },
      "voice": {
        "name": "openai",
        "model": "realtime-preview",
        "voice": "nova"
      }
    },
    "requirements": {
      "voice": true,
      "tools": true,
      "minContext": 32000
    },
    "optimization": "balanced"
  }
}
```

### Runtime Provider Selection

```typescript
class ExperienceRuntime {
  private providerSelector: ProviderSelector;
  private currentProvider: AIProvider;
  
  async initializeForExperience(experience: Experience) {
    const config = experience.aiConfig;
    
    // Select appropriate provider based on experience needs
    this.currentProvider = await this.providerSelector.selectProvider({
      requirements: config.requirements,
      preferences: config.providers,
      optimization: config.optimization
    });
    
    // Initialize voice if required
    if (config.requirements.voice) {
      await this.initializeVoice();
    }
  }
  
  private async initializeVoice() {
    if (this.currentProvider.supportsVoice()) {
      // Use native voice
      this.voiceSession = await this.currentProvider.createVoiceSession(this.voiceConfig);
    } else {
      // Fall back to STT/TTS or text
      this.voiceSession = await this.voiceStrategy.startSession(this.voiceConfig);
    }
  }
  
  async switchProvider(reason: SwitchReason) {
    // Dynamic provider switching during runtime
    if (reason === 'rate_limit') {
      this.currentProvider = await this.providerSelector.selectAlternative(
        this.currentProvider
      );
    } else if (reason === 'capability_needed') {
      this.currentProvider = await this.providerSelector.selectWithCapability(
        reason.capability
      );
    }
  }
}
```

### Error Handling and Fallbacks

```typescript
class ProviderErrorHandler {
  async handleError(error: ProviderError, context: RequestContext): Promise<RecoveryAction> {
    if (error.type === 'rate_limit') {
      return {
        action: 'switch_provider',
        delay: error.retryAfter
      };
    }
    
    if (error.type === 'context_exceeded') {
      return {
        action: 'truncate_context',
        strategy: 'sliding_window'
      };
    }
    
    if (error.type === 'capability_unsupported') {
      return {
        action: 'fallback',
        degradation: this.getDegradationStrategy(error.capability)
      };
    }
    
    if (error.type === 'provider_unavailable') {
      return {
        action: 'circuit_break',
        fallbackProvider: this.getHealthyProvider()
      };
    }
  }
}
```

### Provider-Specific Optimizations

```typescript
class ProviderOptimizer {
  optimizeForProvider(provider: AIProvider, request: UnifiedCompletionRequest): UnifiedCompletionRequest {
    switch (provider.name) {
      case 'openai':
        return this.optimizeForOpenAI(request);
      case 'anthropic':
        return this.optimizeForAnthropic(request);
      case 'local-llm':
        return this.optimizeForLocal(request);
      default:
        return request;
    }
  }
  
  private optimizeForAnthropic(request: UnifiedCompletionRequest) {
    // Anthropic-specific optimizations
    return {
      ...request,
      // Use system prompts effectively
      systemPrompt: this.enhanceSystemPrompt(request.systemPrompt),
      // Adjust for Claude's preferences
      temperature: request.temperature * 0.8,
      // Use Claude's native XML tags for structure
      messages: this.addXMLStructure(request.messages)
    };
  }
}
```

## Implementation Strategy

### Phase 1: Core Abstraction
1. Define provider interfaces
2. Implement provider registry
3. Create unified request/response formats
4. Build normalization layers

### Phase 2: Provider Implementations
1. Refactor OpenAI to use abstraction
2. Add Anthropic provider
3. Add local LLM support
4. Implement Google/Cohere/etc.

### Phase 3: Advanced Features
1. Dynamic provider switching
2. Cost optimization
3. Load balancing
4. Provider health monitoring

### Phase 4: Voice Abstraction
1. Separate voice from text providers
2. Implement STT/TTS strategies
3. Add voice cloning support
4. Multi-language voice support

## Benefits

### 1. Flexibility
- Use best provider for each task
- Easy to add new providers
- Provider-agnostic experiences

### 2. Cost Optimization
- Choose cheaper providers when possible
- Dynamic switching based on usage
- Budget controls per experience

### 3. Reliability
- Automatic failover
- Load distribution
- No single point of failure

### 4. Performance
- Use fastest provider for time-sensitive tasks
- Parallel requests to multiple providers
- Caching across providers

### 5. Innovation
- Experiment with new models quickly
- A/B test different providers
- Use specialized models for specific tasks

## Challenges and Solutions

### Challenge 1: Feature Parity
**Problem**: Not all providers support all features  
**Solution**: Graceful degradation and clear capability reporting

### Challenge 2: Response Format Differences
**Problem**: Each provider returns data differently  
**Solution**: Comprehensive normalization layer with provider-specific adapters

### Challenge 3: Voice Support Fragmentation
**Problem**: Only OpenAI has native realtime voice  
**Solution**: Multiple voice strategies with automatic selection

### Challenge 4: Tool Calling Variations
**Problem**: Different formats and capabilities  
**Solution**: Unified tool format with bidirectional conversion

### Challenge 5: Cost Management
**Problem**: Different pricing models  
**Solution**: Built-in cost tracking and optimization

## Configuration Examples

### Multi-Provider Setup
```yaml
providers:
  - name: anthropic
    apiKey: ${ANTHROPIC_API_KEY}
    models:
      - claude-3-opus-20240229
      - claude-3-sonnet-20240229
    rateLimit:
      requestsPerMinute: 50
      
  - name: openai
    apiKey: ${OPENAI_API_KEY}
    models:
      - gpt-4-turbo-preview
      - gpt-3.5-turbo
    features:
      - voice
      - dalle
      
  - name: local
    endpoint: http://localhost:11434
    models:
      - llama2:70b
      - mistral:latest
    features:
      - text

routing:
  default: anthropic
  voice: openai
  image_generation: openai
  fallback_chain:
    - anthropic
    - openai
    - local
```

### Experience-Specific Provider Selection
```json
{
  "requirements": {
    "capabilities": ["voice", "tools"],
    "minContextLength": 100000,
    "maxLatency": 2000
  },
  "preferences": {
    "provider": "anthropic",
    "voiceProvider": "openai",
    "optimizeFor": "quality"
  },
  "fallbacks": {
    "text": "any",
    "voice": "disable"
  }
}
```

## Monitoring and Analytics

```typescript
interface ProviderMetrics {
  provider: string;
  model: string;
  requestCount: number;
  totalTokens: TokenCount;
  totalCost: number;
  averageLatency: number;
  errorRate: number;
  capabilities: {
    toolCallsUsed: number;
    voiceMinutes: number;
    imagesGenerated: number;
  };
}

class ProviderAnalytics {
  async getRecommendation(usage: UsagePattern): Promise<ProviderRecommendation> {
    // Analyze usage patterns and recommend optimal provider mix
    const analysis = await this.analyzeUsage(usage);
    
    return {
      primary: this.selectOptimalProvider(analysis),
      costSavings: this.calculatePotentialSavings(analysis),
      performanceImpact: this.estimatePerformanceChange(analysis)
    };
  }
}
```

## Future Considerations

### 1. Fine-Tuned Models
- Support for custom fine-tuned models
- Provider-specific fine-tuning formats
- Model versioning and rollback

### 2. Hybrid Approaches
- Use multiple providers in single conversation
- Specialized providers for specific tasks
- Ensemble responses for critical decisions

### 3. Edge Deployment
- Local model support for offline/privacy
- WebAssembly models in browser
- Hybrid cloud/edge architectures

### 4. Compliance and Privacy
- Region-specific provider selection
- Data residency requirements
- GDPR/HIPAA compliant providers

## Conclusion

This multi-provider architecture transforms Primer from an OpenAI-specific platform to a flexible, provider-agnostic system. It enables cost optimization, improves reliability, and allows for innovation while maintaining a consistent experience across different AI providers. The abstraction layers ensure that adding new providers is straightforward, and the system can gracefully handle differences in capabilities across providers.
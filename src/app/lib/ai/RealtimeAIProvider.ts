import { BaseAIProvider } from './BaseAIProvider';
import { AIConfig, AIFunctionCall, AIFunctionResult, AIMessage } from './types';
import { v4 as uuidv4 } from 'uuid';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('RealtimeAIProvider');

export class RealtimeAIProvider extends BaseAIProvider {
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private audioElement: HTMLAudioElement | null = null;

  constructor(config: AIConfig) {
    super(config);
    this.audioElement = document.createElement('audio');
    this.audioElement.autoplay = true;
  }

  async connect(): Promise<void> {
    if (this.getStatus() !== 'DISCONNECTED') return;
    
    try {
      this.updateStatus('CONNECTING');
      const ephemeralKey = await this.fetchEphemeralKey();
      await this.setupWebRTC(ephemeralKey);
    } catch (error) {
      this.updateStatus('DISCONNECTED');
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.pc) {
      this.pc.getSenders().forEach(sender => {
        if (sender.track) {
          sender.track.stop();
        }
      });
      this.pc.close();
      this.pc = null;
    }
    this.dc = null;
    this.updateStatus('DISCONNECTED');
  }

  async sendMessage(message: string): Promise<void> {
    if (!this.dc || this.dc.readyState !== 'open') {
      throw new Error('Data channel not ready');
    }

    const messageId = uuidv4();
    const aiMessage: AIMessage = {
      id: messageId,
      role: 'user',
      content: message
    };

    this.addMessage(aiMessage);

    // Send through data channel
    this.dc.send(JSON.stringify({
      type: 'conversation.item.create',
      item: {
        id: messageId,
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: message }],
      },
    }));

    // Trigger response
    this.dc.send(JSON.stringify({ type: 'response.create' }));
  }

  async handleFunctionCall(functionCall: AIFunctionCall): Promise<void> {
    if (!this.dc || this.dc.readyState !== 'open') {
      throw new Error('Data channel not ready');
    }

    // Send function call result through data channel
    this.dc.send(JSON.stringify({
      type: 'conversation.item.create',
      item: {
        type: 'function_call',
        call_id: functionCall.call_id,
        name: functionCall.name,
        arguments: JSON.stringify(functionCall.arguments),
      },
    }));
  }

  async sendFunctionResult(result: AIFunctionResult): Promise<void> {
    if (!this.dc || this.dc.readyState !== 'open') {
      throw new Error('Data channel not ready');
    }

    // Send function call result through data channel
    this.dc.send(JSON.stringify({
      type: 'conversation.item.create',
      item: {
        type: 'function_call_output',
        call_id: result.call_id,
        output: JSON.stringify(result.result),
      },
    }));

    // Trigger response after function call
    this.dc.send(JSON.stringify({ type: 'response.create' }));
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
        voice: this.config.voice || 'ballad'
      }),
    });

    const data = await response.json();
    if (!data.client_secret?.value) {
      throw new Error('No ephemeral key provided by the server');
    }

    return data.client_secret.value;
  }

  private updateStatus(newStatus: 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED') {
    this.setInternalStatus(newStatus);
    if (newStatus === 'CONNECTED') {
      this.emitEvent({ type: 'connection.established' });
    }
  }

  private async setupWebRTC(ephemeralKey: string): Promise<void> {
    // Create and configure RTCPeerConnection
    this.pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    // Create data channel
    this.dc = this.pc.createDataChannel('events');
    this.setupDataChannelHandlers();

    // Handle ICE candidates
    this.pc.onicecandidate = async (event) => {
      if (event.candidate === null) {
        try {
          const response = await fetch('https://api.openai.com/v1/audio/streaming', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${ephemeralKey}`,
            },
            body: JSON.stringify({
              offer: this.pc!.localDescription,
            }),
          });

          const data = await response.json();
          await this.pc!.setRemoteDescription(new RTCSessionDescription(data.answer));
        } catch (error) {
          logger.error(error, 'Error in ICE negotiation');
          throw error;
        }
      }
    };

    // Handle incoming audio stream
    this.pc.ontrack = (event) => {
      if (this.audioElement) {
        this.audioElement.srcObject = event.streams[0];
      }
    };

    // Create and set local description
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
  }

  private setupDataChannelHandlers() {
    if (!this.dc) return;

    this.dc.onopen = () => {
      this.updateStatus('CONNECTED');
    };

    this.dc.onclose = () => {
      this.updateStatus('DISCONNECTED');
    };

    this.dc.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.handleServerEvent(data);
    };
  }

  private handleServerEvent(event: any) {
    // Handle different server event types
    switch (event.type) {
      case 'response.text.delta':
        if (event.item_id && event.delta) {
          const message = this.getMessages().find(m => m.id === event.item_id);
          if (message) {
            const updatedMessage = { ...message, content: message.content + event.delta };
            this.updateMessage(updatedMessage);
          }
        }
        break;

      case 'output_audio_buffer.started':
        this.emitEvent({ type: 'audio.started' });
        break;

      case 'output_audio_buffer.stopped':
        this.emitEvent({ type: 'audio.stopped' });
        break;

      case 'response.done':
        if (event.response?.output) {
          event.response.output.forEach((outputItem: any) => {
            if (outputItem.type === 'function_call' && outputItem.name && outputItem.arguments) {
              this.handleFunctionCall({
                name: outputItem.name,
                call_id: outputItem.call_id,
                arguments: JSON.parse(outputItem.arguments)
              });
            }
          });
        }
        break;
    }
  }
} 
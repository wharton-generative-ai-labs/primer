import { Resource, SoundManager } from './types';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('AudioManager');

export interface AudioManagerConfig {
  sounds: Resource[];
}

type SoundMap = Record<string, Resource>;

class AudioManagerImpl implements SoundManager {
  private soundMap: SoundMap;
  private audioContext: AudioContext | null = null;
  private audioBuffers: Map<string, AudioBuffer> = new Map();
  private activeSources: Map<string, AudioBufferSourceNode> = new Map();

  constructor(config: AudioManagerConfig) {
    this.soundMap = {};
    this.initializeSoundMap(config.sounds);
    this.initializeAudioContext();
  }

  private async initializeAudioContext() {
    try {
      this.audioContext = new AudioContext();
      // Preload all sounds
      for (const [name, resource] of Object.entries(this.soundMap)) {
        const response = await fetch(resource.url);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await this.audioContext!.decodeAudioData(arrayBuffer);
        this.audioBuffers.set(name, audioBuffer);
      }
    } catch (error) {
      logger.error(error, 'Error initializing audio context');
    }
  }

  private initializeSoundMap(sounds: Resource[]): void {
    this.soundMap = sounds.reduce((map, sound) => {
      const soundName = sound.path.split('/').pop()?.split('.')[0] || '';
      if (soundName) {
        map[soundName] = sound;
      }
      return map;
    }, {} as SoundMap);
  }

  playSound(
    sound: string,
    options: { volume?: number; loop?: boolean } = {}
  ) {
    const { volume = 0.1 } = options;
    let { loop = false } = options;

    // NOTE: Audio looping is currently disabled across all sounds.
    // This was implemented as a temporary workaround due to issues with
    // looping behavior. If looping is needed in the future, this should be
    // re-enabled after proper testing and fixing any underlying issues.
    loop = false;

    const soundResource = this.soundMap[sound];

    if (!soundResource) {
      return {
        result: false,
        error: "Sound not found.",
        availableSounds: Object.keys(this.soundMap)
      };
    }

    // Stop the same sound if it's already playing
    this.stopSound(sound);

    // Get the audio buffer
    const audioBuffer = this.audioBuffers.get(sound);
    if (!audioBuffer) {
      return {
        result: false,
        error: "Sound not loaded.",
        availableSounds: Object.keys(this.soundMap)
      };
    }

    // Create and configure source node
    const source = this.audioContext!.createBufferSource();
    source.buffer = audioBuffer;
    source.loop = loop;

    // Create and configure gain node for volume control
    const gainNode = this.audioContext!.createGain();
    gainNode.gain.value = Math.min(Math.max(volume, 0), 1);

    // Connect nodes
    source.connect(gainNode);
    gainNode.connect(this.audioContext!.destination);

    // Store the source node
    this.activeSources.set(sound, source);

    // Play the sound
    try {
      source.start(0);
      return {
        result: true,
        item: {
          output: {
            success: true,
            sound: sound,
            volume: volume,
            loop: loop
          }
        }
      };
    } catch (error) {
      logger.error(error, 'Error playing sound');
      return {
        result: false,
        error: error instanceof Error ? error.message : 'Failed to play sound',
        item: {
          output: {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to play sound'
          }
        }
      };
    }
  }

  stopSound(sound: string): void {
    const source = this.activeSources.get(sound);
    if (source) {
      source.stop();
      this.activeSources.delete(sound);
    }
  }

  stopAllSounds(): void {
    this.activeSources.forEach((source, sound) => {
      this.stopSound(sound);
    });
  }

  getAvailableSounds(): string[] {
    return Object.keys(this.soundMap);
  }
}

let audioManagerInstance: SoundManager | null = null;

export const createAudioManager = (config: AudioManagerConfig): SoundManager => {
  audioManagerInstance = new AudioManagerImpl(config);
  return audioManagerInstance;
};

export const getAudioManager = (): SoundManager => {
  if (!audioManagerInstance) {
    throw new Error('AudioManager has not been initialized. Call createAudioManager first.');
  }
  return audioManagerInstance;
};


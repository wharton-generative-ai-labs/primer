import { ToolResponse } from '@/app/lib/tools/types';

export interface Resource {
  path: string;
  url: string;
}

export interface SoundToolContext {
  getAvailableSounds: () => string[];
  playSound: (sound: string, options?: { volume?: number; loop?: boolean }) => { result: boolean | string; availableSounds?: string[] };
}

export interface SoundManager {
  getAvailableSounds: () => string[];
  playSound: (sound: string, options?: { volume?: number; loop?: boolean }) => { result: boolean | string; availableSounds?: string[] };
  stopSound: (sound: string) => void;
  stopAllSounds: () => void;
}

export interface SoundToolResponse extends ToolResponse {
  data: {
    availableSounds?: string[];
    result?: boolean | string;
    error?: string;
  };
}


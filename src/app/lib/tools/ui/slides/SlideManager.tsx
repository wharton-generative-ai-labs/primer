"use client";

import { SlideToolContext } from './types';
import React from 'react';
import { SlideComponent } from './SlideComponent';
import { generateUUID } from '@/app/lib/uuid';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('SlideManager');

// This is a singleton instance that will be used to manage slides
let slideManagerInstance: SlideToolContext | null = null;

// Store slides in memory
const slides: Record<string, string> = {};

// Store active slide components
const activeSlides: Record<string, React.ReactNode> = {};

// Add state update listeners
let stateUpdateListeners: (() => void)[] = [];

// Function to notify listeners of state changes
const notifyStateUpdate = () => {
  stateUpdateListeners.forEach(listener => listener());
};

// This is a function to set the slide component
export const setSlideComponent = (id: string, component: React.ReactNode | null) => {
  if (component === null) {
    delete activeSlides[id];
  } else {
    activeSlides[id] = component;
  }
  notifyStateUpdate();
};

// Remove a slide component (alias for setSlideComponent(id, null))
export const removeSlideComponent = (id: string) => {
  setSlideComponent(id, null);
};

// Add function to subscribe to state updates
export const subscribeToStateUpdates = (listener: () => void) => {
  stateUpdateListeners.push(listener);
  return () => {
    stateUpdateListeners = stateUpdateListeners.filter(l => l !== listener);
  };
};

// This is a function to get all active slide components
export const getActiveSlides = (): React.ReactNode[] => {
  return Object.values(activeSlides);
};

// This is a function to get a specific slide component
export const getSlideComponent = (id: string): React.ReactNode | null => {
  return activeSlides[id] || null;
};

// This is the implementation of the SlideManager
class SlideManager implements SlideToolContext {
  showSlide(title: string, content: string): { result: boolean } {
    try {
      // Store the slide content
      slides[title] = content;
      
      // Create a new slide component with a unique ID
      const id = `slide-${generateUUID()}`;
      const component = <SlideComponent id={id} title={title} content={content} />;
      
      // Set the component
      setSlideComponent(id, component);
      
      return { result: true };
    } catch (error) {
      logger.error(error, 'Error showing slide');
      return { result: false };
    }
  }

  showExistingSlide(title: string): { result: boolean } {
    try {
      if (!slides[title]) {
        return { result: false };
      }
      
      // Create a new slide component with existing content
      const id = `slide-${generateUUID()}`;
      const component = <SlideComponent id={id} title={title} content={slides[title]} />;
      
      // Set the component
      setSlideComponent(id, component);
      
      return { result: true };
    } catch (error) {
      logger.error(error, 'Error showing existing slide');
      return { result: false };
    }
  }

  getSlideContent(title: string): { result: boolean; content: string } {
    try {
      if (!slides[title]) {
        return { result: false, content: '' };
      }
      return { result: true, content: slides[title] };
    } catch (error) {
      logger.error(error, 'Error getting slide content');
      return { result: false, content: '' };
    }
  }

  hideSlide(id: string): void {
    setSlideComponent(id, null);
  }

  hideAllSlides(): void {
    Object.keys(activeSlides).forEach(id => {
      setSlideComponent(id, null);
    });
  }

  listSlides(): { titles: string[]; count: number } {
    const titles = Object.keys(slides);
    return { titles, count: titles.length };
  }

  listActiveSlides(): { ids: string[]; count: number } {
    const ids = Object.keys(activeSlides);
    return { ids, count: ids.length };
  }
}

// This is a function to create a new SlideManager
export const createSlideManager = (): SlideToolContext => {
  if (!slideManagerInstance) {
    slideManagerInstance = new SlideManager();
  }
  return slideManagerInstance;
};

// This is a function to get the SlideManager instance
export const getSlideManager = (): SlideManager => {
  if (!slideManagerInstance) {
    slideManagerInstance = new SlideManager();
  }
  return slideManagerInstance;
};


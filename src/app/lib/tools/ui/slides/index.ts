/**
 * Slide plugin public API
 * Exports managers, components, and types for external use
 */

export { getSlideManager, createSlideManager, getActiveSlides, getSlideComponent, subscribeToStateUpdates } from './SlideManager';
export { SlideComponent } from './SlideComponent';
export type { Slide, SlideToolContext, SlideToolResponse } from './types';


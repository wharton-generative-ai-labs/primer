/**
 * UIElementManager - Centralized manager for all UI elements
 * 
 * Maintains a registry of all active UI elements (slides, components, etc.)
 * and provides methods to manipulate them.
 */

import { PrimerUIElement, UIElementKind } from './types';

type StateUpdateCallback = () => void;

class UIElementManager {
  private elements: Map<string, PrimerUIElement> = new Map();
  private listeners: Set<StateUpdateCallback> = new Set();
  private highestZIndex: number = 20;

  /**
   * Register a new UI element
   */
  register(element: PrimerUIElement): void {
    this.elements.set(element.id, element);
    this.notifyListeners();
  }

  /**
   * Unregister a UI element
   */
  unregister(id: string): void {
    this.elements.delete(id);
    this.notifyListeners();
  }

  /**
   * Get a UI element by ID
   */
  get(id: string): PrimerUIElement | undefined {
    return this.elements.get(id);
  }

  /**
   * Get all UI elements
   */
  getAll(): PrimerUIElement[] {
    return Array.from(this.elements.values());
  }

  /**
   * Get all visible UI elements
   */
  getVisible(): PrimerUIElement[] {
    return this.getAll().filter(el => el.visible);
  }

  /**
   * Get UI elements by kind
   */
  getByKind(kind: UIElementKind): PrimerUIElement[] {
    return this.getAll().filter(el => el.kind === kind);
  }

  /**
   * Update a UI element
   */
  update(id: string, updates: Partial<PrimerUIElement>): boolean {
    const element = this.elements.get(id);
    if (!element) return false;

    Object.assign(element, updates);
    this.notifyListeners();
    return true;
  }

  /**
   * Show a UI element
   */
  show(id: string): boolean {
    return this.update(id, { visible: true });
  }

  /**
   * Hide a UI element
   */
  hide(id: string): boolean {
    return this.update(id, { visible: false });
  }

  /**
   * Hide all UI elements
   */
  hideAll(): void {
    this.elements.forEach(element => {
      element.visible = false;
    });
    this.notifyListeners();
  }

  /**
   * Move a UI element
   */
  move(id: string, x: number, y: number): boolean {
    return this.update(id, { x, y });
  }

  /**
   * Resize a UI element
   */
  resize(id: string, w: number, h: number): boolean {
    return this.update(id, { w, h });
  }

  /**
   * Maximize a UI element
   */
  maximize(id: string, maximized: boolean = true): boolean {
    return this.update(id, { maximized });
  }

  /**
   * Bring element to front
   */
  bringToFront(id: string): number {
    this.highestZIndex += 1;
    this.update(id, { zIndex: this.highestZIndex });
    return this.highestZIndex;
  }

  /**
   * Get next z-index
   */
  getNextZIndex(): number {
    this.highestZIndex += 1;
    return this.highestZIndex;
  }

  /**
   * Subscribe to state changes
   */
  subscribe(callback: StateUpdateCallback): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Notify all listeners of state change
   */
  private notifyListeners(): void {
    this.listeners.forEach(callback => callback());
  }

  /**
   * Clear all elements
   */
  clear(): void {
    this.elements.clear();
    this.notifyListeners();
  }

  /**
   * Get the currently anchored element, if any
   * @deprecated Use getAnchoredElements() for multiple anchored windows
   */
  getAnchoredElement(): PrimerUIElement | null {
    const anchored = this.getAll().find(el => el.anchoredTo && el.visible);
    return anchored || null;
  }

  /**
   * Get all currently anchored elements
   */
  getAnchoredElements(): PrimerUIElement[] {
    return this.getAll().filter(el => el.anchoredTo && el.visible);
  }

  /**
   * Get layout insets caused by anchored windows
   * Returns { left, right, top, bottom } in pixels
   * Now supports multiple anchored windows (one per edge)
   */
  getAnchoredInsets(): { left: number; right: number; top: number; bottom: number } {
    const anchoredElements = this.getAnchoredElements();
    const insets = { left: 0, right: 0, top: 0, bottom: 0 };

    for (const element of anchoredElements) {
      if (!element.anchoredTo) continue;

      switch (element.anchoredTo) {
        case 'left':
          insets.left = Math.max(insets.left, element.w);
          break;
        case 'right':
          insets.right = Math.max(insets.right, element.w);
          break;
        case 'top':
          insets.top = Math.max(insets.top, element.h);
          break;
        case 'bottom':
          insets.bottom = Math.max(insets.bottom, element.h);
          break;
      }
    }

    return insets;
  }

  /**
   * Anchor a UI element to an edge
   * Allows multiple windows to be anchored (one per edge)
   */
  anchor(id: string, edge: import('./types').AnchorEdge, preAnchorState: { x: number; y: number; w: number; h: number }): boolean {
    // Check if another window is already anchored to this specific edge
    const anchoredElements = this.getAnchoredElements();
    const existingOnEdge = anchoredElements.find(el => el.anchoredTo === edge && el.id !== id);
    
    // If another window is anchored to this edge, unanchor it
    if (existingOnEdge) {
      this.unanchor(existingOnEdge.id);
    }

    return this.update(id, { 
      anchoredTo: edge,
      preAnchorState 
    });
  }

  /**
   * Unanchor a UI element
   */
  unanchor(id: string): boolean {
    return this.update(id, { 
      anchoredTo: null,
      preAnchorState: null 
    });
  }
}

// Singleton instance
let managerInstance: UIElementManager | null = null;

export function getUIElementManager(): UIElementManager {
  if (!managerInstance) {
    managerInstance = new UIElementManager();
  }
  return managerInstance;
}

export function subscribeToUIElements(callback: StateUpdateCallback): () => void {
  return getUIElementManager().subscribe(callback);
}

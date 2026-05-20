/**
 * PrimerUIElement - Shared interface for draggable utility windows and
 * compatibility note metadata.
 * 
 * New scene/document content does not use this layer; workspace layout is
 * derived from content visibility.
 */

export type UIElementKind = 'slide' | 'component' | 'note' | 'mermaid';

export type AnchorEdge = 'left' | 'right' | 'top' | 'bottom';

export interface PrimerUIElement {
  /** Unique identifier for the UI element */
  id: string;
  
  /** Type of UI element */
  kind: UIElementKind;
  
  /** Display title */
  title: string;
  
  /** X position (left edge, relative to content area) */
  x: number;
  
  /** Y position (top edge, relative to content area) */
  y: number;
  
  /** Width in pixels */
  w: number;
  
  /** Height in pixels */
  h: number;
  
  /** Visibility state */
  visible: boolean;
  
  /** Z-index for layering */
  zIndex: number;
  
  /** Whether the element is maximized */
  maximized?: boolean;
  
  /** Which edge the window is anchored to, if any */
  anchoredTo?: AnchorEdge | null;
  
  /** Pre-anchor state for restoration when un-anchoring */
  preAnchorState?: {
    x: number;
    y: number;
    w: number;
    h: number;
  } | null;
}

/**
 * Callbacks for UI element state changes
 */
export interface UIElementCallbacks {
  onMove?: (id: string, x: number, y: number) => void;
  onResize?: (id: string, w: number, h: number) => void;
  onVisibilityChange?: (id: string, visible: boolean) => void;
  onMaximize?: (id: string, maximized: boolean) => void;
  onClose?: (id: string) => void;
  onBringToFront?: (id: string, zIndex: number) => void;
  onAnchor?: (id: string, anchoredTo: AnchorEdge | null, preAnchorState?: { x: number; y: number; w: number; h: number }) => void;
}

/**
 * Props for DraggableWindow component
 */
export interface DraggableWindowProps {
  element: PrimerUIElement;
  callbacks?: UIElementCallbacks;
  children: React.ReactNode;
  icon?: React.ReactNode;
}

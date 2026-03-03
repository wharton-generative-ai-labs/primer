import { ToolContext, ToolResponse } from '@/app/lib/tools/types';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('observe-tool');

/**
 * @tool observe
 * @description Observe the current UI state. Returns information about all UI elements (visible and hidden), their positions, sizes, and spatial relationships.
 * @param {object} args - The arguments for the tool (currently none required)
 * @param {object} context - The context object
 * @returns {Promise<ToolResponse>} Tool response with UI state and spatial analysis
 */
export async function observe(
  _args: Record<string, never>,
  context: ToolContext
): Promise<ToolResponse> {
  try {
    // Check if we have the necessary context for socket communication
    if (!context.sendClientEvent) {
      return {
        status: 'error',
        data: { error: 'Socket communication not available in this context' }
      };
    }

    // Generate a unique call ID for this observation request
    const callId = `observe_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    logger.debug({ callId }, 'Requesting UI state from client');

    // Get the request manager from context
    const requestManager = (context as any).requestManager;
    if (!requestManager) {
      return {
        status: 'error',
        data: { error: 'Request manager not available in context' }
      };
    }

    // Create a pending request that will resolve when we receive the UI state
    const uiStatePromise = requestManager.createPendingRequest(callId, 'observe', 5000) as Promise<{
      elements: any[];
      viewport: { width: number; height: number };
      insets: { left: number; right: number; top: number; bottom: number };
    }>;

    // Send the observe request to the client via socket
    context.sendClientEvent({
      type: 'ui.observe.request',
      data: { callId }
    });

    // Wait for the client to respond with UI state
    const { elements, viewport, insets } = await uiStatePromise;

    logger.debug({ 
      elementCount: elements.length, 
      viewport, 
      insets 
    }, 'Received UI state from client');

    // Compute spatial relationships
    const spatialAnalysis = computeSpatialRelationships(elements, viewport, insets);

    // Group elements by visibility
    const visibleElements = elements.filter((el: any) => el.visible);
    const hiddenElements = elements.filter((el: any) => !el.visible);

    return {
      status: 'success',
      data: {
        elements,
        viewport,
        summary: {
          total: elements.length,
          visible: visibleElements.length,
          hidden: hiddenElements.length,
          visibleIds: visibleElements.map(el => el.id),
          hiddenIds: hiddenElements.map(el => el.id)
        },
        spatial: spatialAnalysis
      }
    };
  } catch (error) {
    logger.error(error, 'Error in observe tool');
    return {
      status: 'error',
      data: { 
        error: error instanceof Error ? error.message : 'Unknown error in observe tool' 
      }
    };
  }
}

/**
 * Compute spatial relationships between UI elements
 */
function computeSpatialRelationships(
  elements: any[],
  viewport: { width: number; height: number },
  insets: { left: number; right: number; top: number; bottom: number }
) {
  const relationships: Array<{
    id: string;
    title: string;
    position: string;
    neighbors: {
      left?: string[];
      right?: string[];
      above?: string[];
      below?: string[];
    };
    overlapping?: string[];
  }> = [];

  // Only analyze visible elements for spatial relationships
  const visibleElements = elements.filter((el: any) => el.visible);

  for (const element of visibleElements) {
    const neighbors = {
      left: [] as string[],
      right: [] as string[],
      above: [] as string[],
      below: [] as string[]
    };
    const overlapping: string[] = [];

    // Calculate element's bounding box (x, y are top-left corner)
    const elLeft = element.x;
    const elRight = element.x + element.w;
    const elTop = element.y;
    const elBottom = element.y + element.h;
    const elCenterX = element.x + element.w / 2;
    const elCenterY = element.y + element.h / 2;

    // Find neighboring elements
    for (const other of visibleElements) {
      if (other.id === element.id) continue;

      // Calculate other element's bounding box
      const otherLeft = other.x;
      const otherRight = other.x + other.w;
      const otherTop = other.y;
      const otherBottom = other.y + other.h;
      const otherCenterX = other.x + other.w / 2;
      const otherCenterY = other.y + other.h / 2;

      // Check if elements overlap
      const xOverlap = (elLeft < otherRight) && (elRight > otherLeft);
      const yOverlap = (elTop < otherBottom) && (elBottom > otherTop);

      if (xOverlap && yOverlap) {
        // Elements overlap - check z-index
        if (other.zIndex !== element.zIndex) {
          overlapping.push(`${other.title} (${other.id})`);
        }
      } else {
        // Determine relative position using centers
        const threshold = 50; // pixels of tolerance for "aligned"

        // Left/Right (vertically aligned)
        if (Math.abs(elCenterY - otherCenterY) < threshold) {
          if (otherCenterX < elCenterX) {
            neighbors.left.push(`${other.title} (${other.id})`);
          } else {
            neighbors.right.push(`${other.title} (${other.id})`);
          }
        }

        // Above/Below (horizontally aligned)
        if (Math.abs(elCenterX - otherCenterX) < threshold) {
          if (otherCenterY < elCenterY) {
            neighbors.above.push(`${other.title} (${other.id})`);
          } else {
            neighbors.below.push(`${other.title} (${other.id})`);
          }
        }
      }
    }

    // Determine general position in viewport (using center of element)
    // Account for anchored windows taking up space
    const availableWidth = viewport.width - insets.left - insets.right;
    const availableHeight = viewport.height - insets.top - insets.bottom;
    const relX = (elCenterX - insets.left) / availableWidth;
    const relY = (elCenterY - insets.top) / availableHeight;

    let position = '';
    if (relY < 0.33) position += 'top';
    else if (relY > 0.67) position += 'bottom';
    else position += 'middle';

    position += ' ';

    if (relX < 0.33) position += 'left';
    else if (relX > 0.67) position += 'right';
    else position += 'center';

    // Check if anchored
    if (element.anchoredTo) {
      position += ` (anchored to ${element.anchoredTo})`;
    }

    // Check if maximized
    if (element.maximized) {
      position += ' (maximized)';
    }

    relationships.push({
      id: element.id,
      title: element.title,
      position,
      neighbors,
      ...(overlapping.length > 0 && { overlapping })
    });
  }

  return relationships;
}

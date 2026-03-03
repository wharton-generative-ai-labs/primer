/**
 * Client-side UI event handlers
 * 
 * These handlers respond to UI manipulation commands from the server
 * and execute the actual UI operations using UIElementManager.
 */

import { getUIElementManager } from '@/app/lib/ui/UIElementManager';
import { createModuleLogger } from '@/lib/logger';
import { getGlobalSocket } from '@/app/lib/tools/client/tool-calling-shim';
import type { 
  UIElementShowEvent, 
  UIElementHideEvent, 
  UIElementMoveEvent, 
  UIElementResizeEvent,
  UIElementMaximizeEvent,
  UIElementDestroyEvent,
  UIObserveRequestEvent
} from '@/app/types/socket';

const logger = createModuleLogger('ui-event-handlers');

/**
 * Handle ui.element.show event
 */
export function handleUIElementShow(data: UIElementShowEvent) {
  logger.debug({ callId: data.callId, id: data.id }, 'Handling ui.element.show');
  
  const socket = getGlobalSocket();
  if (!socket) {
    logger.error('No socket available for tool.result');
    return;
  }

  try {
    const manager = getUIElementManager();
    const success = manager.show(data.id);
    
    if (!success) {
      socket.emit('tool.result', {
        callId: data.callId,
        status: 'error',
        data: { error: `UI element with id '${data.id}' not found` }
      });
    } else {
      socket.emit('tool.result', {
        callId: data.callId,
        status: 'success',
        data: { result: true, id: data.id }
      });
    }
  } catch (error) {
    logger.error(error, 'Error in handleUIElementShow');
    socket.emit('tool.result', {
      callId: data.callId,
      status: 'error',
      data: { error: error instanceof Error ? error.message : 'Unknown error' }
    });
  }
}

/**
 * Handle ui.element.hide event
 */
export function handleUIElementHide(data: UIElementHideEvent) {
  logger.debug({ callId: data.callId, id: data.id }, 'Handling ui.element.hide');
  
  const socket = getGlobalSocket();
  if (!socket) {
    logger.error('No socket available for tool.result');
    return;
  }

  try {
    const manager = getUIElementManager();
    
    // Special case: hide all elements
    if (data.id === '*') {
      manager.hideAll();
      socket.emit('tool.result', {
        callId: data.callId,
        status: 'success',
        data: { result: true }
      });
      return;
    }
    
    const success = manager.hide(data.id);
    
    if (!success) {
      socket.emit('tool.result', {
        callId: data.callId,
        status: 'error',
        data: { error: `UI element with id '${data.id}' not found` }
      });
    } else {
      socket.emit('tool.result', {
        callId: data.callId,
        status: 'success',
        data: { result: true, id: data.id }
      });
    }
  } catch (error) {
    logger.error(error, 'Error in handleUIElementHide');
    socket.emit('tool.result', {
      callId: data.callId,
      status: 'error',
      data: { error: error instanceof Error ? error.message : 'Unknown error' }
    });
  }
}

/**
 * Handle ui.element.move event
 */
export function handleUIElementMove(data: UIElementMoveEvent) {
  logger.debug({ callId: data.callId, id: data.id, x: data.x, y: data.y }, 'Handling ui.element.move');
  
  const socket = getGlobalSocket();
  if (!socket) {
    logger.error('No socket available for tool.result');
    return;
  }

  try {
    const manager = getUIElementManager();
    const success = manager.move(data.id, data.x, data.y);
    
    if (!success) {
      socket.emit('tool.result', {
        callId: data.callId,
        status: 'error',
        data: { error: `UI element with id '${data.id}' not found` }
      });
    } else {
      socket.emit('tool.result', {
        callId: data.callId,
        status: 'success',
        data: { result: true, id: data.id, x: data.x, y: data.y }
      });
    }
  } catch (error) {
    logger.error(error, 'Error in handleUIElementMove');
    socket.emit('tool.result', {
      callId: data.callId,
      status: 'error',
      data: { error: error instanceof Error ? error.message : 'Unknown error' }
    });
  }
}

/**
 * Handle ui.element.resize event
 */
export function handleUIElementResize(data: UIElementResizeEvent) {
  logger.debug({ callId: data.callId, id: data.id, w: data.w, h: data.h }, 'Handling ui.element.resize');
  
  const socket = getGlobalSocket();
  if (!socket) {
    logger.error('No socket available for tool.result');
    return;
  }

  try {
    const manager = getUIElementManager();
    const success = manager.resize(data.id, data.w, data.h);
    
    if (!success) {
      socket.emit('tool.result', {
        callId: data.callId,
        status: 'error',
        data: { error: `UI element with id '${data.id}' not found` }
      });
    } else {
      socket.emit('tool.result', {
        callId: data.callId,
        status: 'success',
        data: { result: true, id: data.id, w: data.w, h: data.h }
      });
    }
  } catch (error) {
    logger.error(error, 'Error in handleUIElementResize');
    socket.emit('tool.result', {
      callId: data.callId,
      status: 'error',
      data: { error: error instanceof Error ? error.message : 'Unknown error' }
    });
  }
}

/**
 * Handle ui.element.maximize event
 */
export function handleUIElementMaximize(data: UIElementMaximizeEvent) {
  logger.debug({ callId: data.callId, id: data.id, maximized: data.maximized }, 'Handling ui.element.maximize');
  
  const socket = getGlobalSocket();
  if (!socket) {
    logger.error('No socket available for tool.result');
    return;
  }

  try {
    const manager = getUIElementManager();
    const success = manager.maximize(data.id, data.maximized);
    
    if (!success) {
      socket.emit('tool.result', {
        callId: data.callId,
        status: 'error',
        data: { error: `UI element with id '${data.id}' not found` }
      });
    } else {
      socket.emit('tool.result', {
        callId: data.callId,
        status: 'success',
        data: { result: true, id: data.id, maximized: data.maximized }
      });
    }
  } catch (error) {
    logger.error(error, 'Error in handleUIElementMaximize');
    socket.emit('tool.result', {
      callId: data.callId,
      status: 'error',
      data: { error: error instanceof Error ? error.message : 'Unknown error' }
    });
  }
}

/**
 * Handle ui.element.destroy event
 * Permanently removes a UI element and cleans up associated resources
 */
export function handleUIElementDestroy(data: UIElementDestroyEvent) {
  logger.debug({ callId: data.callId, id: data.id }, 'Handling ui.element.destroy');
  
  const socket = getGlobalSocket();
  if (!socket) {
    logger.error('No socket available for tool.result');
    return;
  }

  try {
    const manager = getUIElementManager();
    const element = manager.get(data.id);
    
    if (!element) {
      socket.emit('tool.result', {
        callId: data.callId,
        status: 'error',
        data: { error: `UI element with id '${data.id}' not found` }
      });
      return;
    }
    
    // Dispatch to appropriate cleanup based on element kind
    (async () => {
      try {
        switch (element.kind) {
          case 'component': {
            // Clean up component instance
            const { getComponentManager } = await import('@/app/lib/tools/ui/components/ComponentManager');
            const componentManager = getComponentManager();
            if (componentManager) {
              componentManager.hideComponent(data.id);
            }
            break;
          }
          
          case 'slide': {
            // Clean up slide
            const { removeSlideComponent } = await import('@/app/lib/tools/ui/slides/SlideManager');
            removeSlideComponent(data.id);
            break;
          }
          
          case 'note': {
            // Clean up note
            const { getNotesManager } = await import('@/app/lib/tools/ui/notes/NotesManager');
            const notesManager = getNotesManager();
            notesManager.deleteNote(data.id);
            break;
          }
          
          default:
            // For unknown types, just unregister from UIElementManager
            logger.warn({ kind: element.kind }, 'Unknown element kind, only unregistering from UIElementManager');
        }
        
        // Unregister from UIElementManager (if not already done by cleanup)
        manager.unregister(data.id);
        
        socket.emit('tool.result', {
          callId: data.callId,
          status: 'success',
          data: { result: true, id: data.id, kind: element.kind }
        });
        
        logger.debug({ id: data.id, kind: element.kind }, 'Element destroyed successfully');
      } catch (error) {
        logger.error(error, 'Error during element cleanup');
        socket.emit('tool.result', {
          callId: data.callId,
          status: 'error',
          data: { error: error instanceof Error ? error.message : 'Unknown error during cleanup' }
        });
      }
    })();
  } catch (error) {
    logger.error(error, 'Error in handleUIElementDestroy');
    socket.emit('tool.result', {
      callId: data.callId,
      status: 'error',
      data: { error: error instanceof Error ? error.message : 'Unknown error' }
    });
  }
}

/**
 * Handle ui.observe.request event
 */
export function handleUIObserveRequest(data: UIObserveRequestEvent) {
  logger.debug({ callId: data.callId }, 'Handling ui.observe.request');
  
  try {
    const socket = getGlobalSocket();
    if (!socket) {
      logger.error('No socket available for ui.observe.response');
      return;
    }

    const manager = getUIElementManager();
    
    // Get all UI elements (visible and hidden)
    const elements = manager.getAll().map(el => ({
      id: el.id,
      kind: el.kind,
      title: el.title,
      visible: el.visible,
      x: el.x,
      y: el.y,
      w: el.w,
      h: el.h,
      zIndex: el.zIndex,
      maximized: el.maximized || false,
      anchoredTo: el.anchoredTo || null
    }));
    
    // Get content area dimensions (not full viewport)
    // This is the available presentation area, excluding header/footer
    const contentElement = document.querySelector('.z-play-content') || document.querySelector('.z-content');
    let contentHeight = window.innerHeight;
    
    if (contentElement) {
      const rect = contentElement.getBoundingClientRect();
      contentHeight = rect.height;
    }
    
    // Report content area as "viewport" - this is what agents should work with
    const viewport = {
      width: window.innerWidth,
      height: contentHeight
    };
    
    // Get anchored element insets (still useful for internal calculations)
    const insets = manager.getAnchoredInsets();
    
    logger.debug({ 
      elementCount: elements.length, 
      viewport, 
      insets 
    }, 'Sending UI state to server via socket');
    
    // Send directly to Socket.IO server
    socket.emit('ui.observe.response', {
      callId: data.callId,
      elements,
      viewport,
      insets
    });
  } catch (error) {
    logger.error(error, 'Error in handleUIObserveRequest');
  }
}

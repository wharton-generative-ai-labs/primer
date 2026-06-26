"use client";

/**
 * EventsWindow - Floating window wrapper for Event Log
 */

import React, { useEffect, useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { DraggableWindow } from '@/app/lib/ui/DraggableWindow';
import { getUIElementManager } from '@/app/lib/ui/UIElementManager';
import { PrimerUIElement } from '@/app/lib/ui/types';
import { useEvent } from "@/app/contexts/EventContext";
import { LoggedEvent } from "@/app/lib/types";

interface EventsWindowProps {
  isExpanded: boolean;
  setIsExpanded: (expanded: boolean) => void;
}

export function EventsWindow({ isExpanded, setIsExpanded }: EventsWindowProps) {
  const elementId = 'events-window';
  const [prevEventLogs, setPrevEventLogs] = useState<LoggedEvent[]>([]);
  const eventLogsContainerRef = useRef<HTMLDivElement | null>(null);

  const { 
    loggedEvents, 
    toggleExpand, 
    showAudioTranscriptDeltas, 
    toggleShowAudioTranscriptDeltas, 
    showClientEvents,
    showServerEvents,
    toggleShowClientEvents,
    toggleShowServerEvents,
    clearLoggedEvents 
  } = useEvent();

  const [element, setElement] = useState<PrimerUIElement>(() => {
    // Get content area dimensions
    const contentElement = document.querySelector('.z-play-content') || document.querySelector('.z-content');
    let contentHeight = window.innerHeight;
    
    if (contentElement) {
      const rect = contentElement.getBoundingClientRect();
      contentHeight = rect.height;
    }
    
    // Calculate safe initial position (offset from transcript, top-left corner coordinates)
    const width = 400;
    const height = 600;
    const transcriptWidth = 450; // Transcript is typically 450px wide
    const x = Math.max(0, window.innerWidth - transcriptWidth - width - 40); // Leave gap between windows
    const y = Math.max(0, (contentHeight - height) / 2); // Center vertically in content area
    
    return {
      id: elementId,
      kind: 'note',
      title: 'Event Log',
      x,
      y,
      w: width,
      h: height,
      visible: isExpanded,
      zIndex: 50
    };
  });

  // Register/unregister based on isExpanded (toolbar icon state)
  useEffect(() => {
    const uiManager = getUIElementManager();
    
    if (isExpanded) {
      // Register when toolbar icon is active
      const existing = uiManager.get(elementId);
      if (!existing) {
        const elementToRegister = {
          ...element,
          visible: true,
          zIndex: uiManager.getNextZIndex()
        };
        uiManager.register(elementToRegister);
        setElement(elementToRegister);
      } else {
        // Already registered, just make sure it's visible
        uiManager.show(elementId);
      }
    } else {
      // Unregister when toolbar icon is inactive
      uiManager.unregister(elementId);
    }
  }, [isExpanded, elementId]);

  // Subscribe to UIElementManager updates for z-index changes
  useEffect(() => {
    if (!isExpanded) return;
    
    const uiManager = getUIElementManager();
    const unsubscribe = uiManager.subscribe(() => {
      const updated = uiManager.get(elementId);
      if (updated) {
        setElement(_prev => ({
          ...updated,
          zIndex: updated.zIndex
        }));
      }
    });
    return unsubscribe;
  }, [elementId, isExpanded]);

  const getDirectionArrow = (log: LoggedEvent) => {
    if (log.direction === "client") return { symbol: "▲", color: "#7f5af0" };
    if (log.direction === "server" && log.eventName.includes("delta")) return { symbol: "▼", color: "rgb(245 158 11 / 0.9)" };
    if (log.direction === "server") return { symbol: "▼", color: "#2cb67d" };
    return { symbol: "•", color: "#555" };
  };

  useEffect(() => {
    const hasNewEvent = loggedEvents.length > prevEventLogs.length;

    if (element.visible && hasNewEvent && eventLogsContainerRef.current) {
      eventLogsContainerRef.current.scrollTop =
        eventLogsContainerRef.current.scrollHeight;
    }

    setPrevEventLogs(loggedEvents);
  }, [loggedEvents, element.visible]);

  const handleClose = () => {
    // Disable the toolbar icon, which will trigger unregistration
    setIsExpanded(false);
  };

  const handleBringToFront = () => {
    const uiManager = getUIElementManager();
    uiManager.bringToFront(elementId);
  };

  const handleAnchor = (id: string, anchoredTo: import('@/app/lib/ui/types').AnchorEdge | null, preAnchorState?: { x: number; y: number; w: number; h: number }) => {
    const uiManager = getUIElementManager();
    if (anchoredTo && preAnchorState) {
      uiManager.anchor(id, anchoredTo, preAnchorState);
    } else {
      uiManager.unanchor(id);
    }
  };

  if (!isExpanded) {
    return null;
  }

  return (
    <DraggableWindow
      element={element}
      callbacks={{
        onMove: (id, x, y) => {
          const uiManager = getUIElementManager();
          uiManager.move(id, x, y);
        },
        onResize: (id, w, h) => {
          const uiManager = getUIElementManager();
          uiManager.resize(id, w, h);
        },
        onMaximize: (id, maximized) => {
          const uiManager = getUIElementManager();
          uiManager.maximize(id, maximized);
        },
        onClose: handleClose,
        onBringToFront: handleBringToFront,
        onAnchor: handleAnchor,
      }}
    >
      <div className="flex flex-col h-full bg-white/70 backdrop-blur-lg">
        <div className="px-4 py-2 border-b text-black flex justify-end items-center gap-2">
          <Button
            onClick={toggleShowClientEvents}
            variant={showClientEvents ? "customPurple" : "customGray"}
            size="xs"
          >
            Client
          </Button>
          <Button
            onClick={toggleShowServerEvents}
            variant={showServerEvents ? "customGreen" : "customGray"}
            size="xs"
          >
            Server
          </Button>
          <Button
            onClick={toggleShowAudioTranscriptDeltas}
            variant={showAudioTranscriptDeltas ? "customAmber" : "customGray"}
            size="xs"
          >
            Deltas
          </Button>
          <Button
            onClick={clearLoggedEvents}
            variant="customGray"
            size="xs"
          >
            Clear
          </Button>
        </div>

        <div 
          ref={eventLogsContainerRef}
          className="flex-1 overflow-auto text-sm"
        >
          {loggedEvents.map((log) => {
            const arrowInfo = getDirectionArrow(log);
            const isError =
              log.eventName.toLowerCase().includes("error") ||
              log.eventData?.response?.status_details?.error != null;

            return (
              <div
                key={log.id}
                className="border-t border-gray-200 py-1 px-3 font-mono text-[0.75em]"
              >
                <div
                  onClick={() => toggleExpand(log.id)}
                  className="flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center flex-1">
                    <span
                      style={{ color: arrowInfo.color }}
                      className="mr-1"
                    >
                    {arrowInfo.symbol}
                    </span>
                    <span
                      className={
                        "flex-1 " +
                        (isError ? "text-red-600" : "text-gray-800")
                      }
                    >
                      {log.eventName}
                    </span>
                  </div>
                  <div className="text-gray-500 ml-1 whitespace-nowrap">
                    {log.timestamp}
                  </div>
                </div>

                {log.expanded && log.eventData && (
                  <div className="text-gray-800 text-left">
                    <pre className="border-l-2 ml-0.5 border-gray-200 whitespace-pre-wrap break-words font-mono mb-1 mt-1 pl-1.5 leading-snug">
                      {JSON.stringify(log.eventData, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </DraggableWindow>
  );
}

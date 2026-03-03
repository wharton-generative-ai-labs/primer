"use client";

/**
 * TranscriptWindow - Floating window wrapper for Conversation Transcript
 */

import React, { useEffect, useState, useRef } from 'react';
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { DraggableWindow } from '@/app/lib/ui/DraggableWindow';
import { getUIElementManager } from '@/app/lib/ui/UIElementManager';
import { PrimerUIElement } from '@/app/lib/ui/types';
import { TranscriptItem } from "@/app/lib/types";
import { useTranscript } from "@/app/contexts/TranscriptContext";

interface TranscriptWindowProps {
  userText: string;
  setUserText: (val: string) => void;
  onSendMessage: () => void;
  canSend: boolean;
  isExpanded: boolean;
  setIsExpanded: (expanded: boolean) => void;
}

export function TranscriptWindow({
  userText,
  setUserText,
  onSendMessage,
  canSend,
  isExpanded,
  setIsExpanded,
}: TranscriptWindowProps) {
  const elementId = 'transcript-window';
  const { transcriptItems, toggleTranscriptItemExpand } = useTranscript();
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const [prevLogs, setPrevLogs] = useState<TranscriptItem[]>([]);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const [element, setElement] = useState<PrimerUIElement>(() => {
    // Initial state with approximate dimensions
    // Will be recalculated after mount when DOM is ready
    const width = 450;
    
    // Get content area for proper initial positioning
    const contentElement = document.querySelector('.z-play-content') || document.querySelector('.z-content');
    let contentHeight = window.innerHeight;
    
    if (contentElement) {
      const rect = contentElement.getBoundingClientRect();
      contentHeight = rect.height;
    }
    
    const padding = 8;
    const height = contentHeight - padding;
    
    // For right-anchored: x is left edge (content-area-relative), y is top edge
    const x = window.innerWidth - width - (padding / 2);
    const y = padding / 2;
    
    return {
      id: elementId,
      kind: 'note',
      title: 'Conversation Transcript',
      x,
      y,
      w: width,
      h: height,
      visible: isExpanded,
      zIndex: 50,
      anchoredTo: 'right',
      preAnchorState: null
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

  // Recalculate proper anchored position after DOM is ready
  useEffect(() => {
    if (!isExpanded) return;
    
    const recalculateAnchoredPosition = () => {
      const contentElement = document.querySelector('.z-play-content');
      if (!contentElement) return;
      
      const rect = contentElement.getBoundingClientRect();
      const padding = 8;
      const width = 450;
      
      // Match DraggableWindow's calculateAnchoredPosition logic (top-left corner, content-relative)
      const contentHeight = rect.height;
      const availableHeight = contentHeight - padding;
      const x = window.innerWidth - width - (padding / 2);
      const y = padding / 2;
      
      const uiManager = getUIElementManager();
      uiManager.update(elementId, {
        x,
        y,
        h: availableHeight
      });
    };
    
    // Use requestAnimationFrame to ensure DOM is painted
    requestAnimationFrame(recalculateAnchoredPosition);
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

  function scrollToBottom() {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }

  useEffect(() => {
    const hasNewMessage = transcriptItems.length > prevLogs.length;
    const hasUpdatedMessage = transcriptItems.some((newItem, index) => {
      const oldItem = prevLogs[index];
      return (
        oldItem &&
        (newItem.title !== oldItem.title || newItem.data !== oldItem.data)
      );
    });

    if (hasNewMessage || hasUpdatedMessage) {
      scrollToBottom();
    }

    setPrevLogs(transcriptItems);
  }, [transcriptItems]);

  useEffect(() => {
    if (canSend && inputRef.current && isExpanded) {
      inputRef.current.focus();
    }
  }, [canSend, isExpanded]);

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

  const renderMessage = (item: TranscriptItem) => {
    const { itemId, role, title = "", timestamp, isHidden } = item;

    if (isHidden) {
      return null;
    }

    const isUser = role === "user";
    const baseContainer = "flex justify-end flex-col";
    const containerClasses = `${baseContainer} ${isUser ? "items-end" : "items-start"}`;
    const bubbleBase = `max-w-lg p-3 rounded-xl ${isUser ? "bg-gray-900 text-gray-100" : "bg-gray-100 text-black"}`;
    const isBracketedMessage = title.startsWith("[") && title.endsWith("]");
    const messageStyle = isBracketedMessage ? "italic text-gray-400" : "";
    const displayTitle = isBracketedMessage ? title.slice(1, -1) : title;

    return (
      <div key={itemId} className={containerClasses}>
        <div className={bubbleBase}>
          <div className={`${isUser ? "text-gray-400" : "text-gray-500"} font-mono leading-none text-[0.75em]`}>
            {timestamp}
          </div>
          <div className={`whitespace-pre-wrap ${messageStyle}`}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{displayTitle}</ReactMarkdown>
          </div>
        </div>
      </div>
    );
  };

  const renderBreadcrumb = (item: TranscriptItem) => {
    const { itemId, title = "", timestamp, data, expanded } = item;

    return (
      <div
        key={itemId}
        className="flex flex-col justify-start items-start text-gray-500"
      >
        <span className="font-mono text-[0.75em] leading-none">{timestamp}</span>
        <div
          className={`whitespace-pre-wrap flex items-center font-mono text-[0.75em] text-gray-800 ${data ? "cursor-pointer" : ""
            }`}
          onClick={() => data && toggleTranscriptItemExpand(itemId)}
        >
          {data && (
            <span
              className={`text-gray-400 mr-1 transform transition-transform duration-200 select-none font-mono ${expanded ? "rotate-90" : "rotate-0"
                }`}
            >
              ▶
            </span>
          )}
          {title}
        </div>
        {expanded && data && (
          <div className="text-gray-800 text-left">
            <pre className="border-l-2 ml-1 border-gray-200 whitespace-pre-wrap break-words font-mono text-[0.75em] mb-2 mt-2 pl-2 leading-snug">
              {JSON.stringify(data, null, 2)}
            </pre>
          </div>
        )}
      </div>
    );
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
      <div className="flex flex-col h-full bg-white/70 backdrop-blur-lg text-sm md:text-base">
        <div className="relative flex-1 min-h-0">
          <div
            ref={transcriptRef}
            className="overflow-auto p-4 flex flex-col gap-y-4 h-full"
          >
            {transcriptItems.map((item) =>
              item.type === "MESSAGE" ? renderMessage(item) : renderBreadcrumb(item)
            )}
          </div>
        </div>

        <div className="p-4 flex-shrink-0 border-t border-gray-200">
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={userText}
            onChange={(e) => setUserText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && canSend) {
                e.preventDefault();
                onSendMessage();
              }
            }}
            className="w-full px-4 py-2 text-black focus:outline-none resize-y min-h-[3.5rem] border border-gray-300 rounded-md"
            placeholder="Type a message... (Shift+Enter for new line)"
            rows={2}
          />
        </div>
      </div>
    </DraggableWindow>
  );
}

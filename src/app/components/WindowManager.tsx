"use client";

/**
 * WindowManager - Taskbar for managing UI elements
 * 
 * Displays active UI elements and allows switching between them.
 * Similar to Mac dock or Windows taskbar.
 */

import React, { useState, useEffect } from 'react';
import { FileText, Box, StickyNote, GitBranch, ChevronDown, MessageCircle, ScrollText } from 'lucide-react';
import { getUIElementManager, subscribeToUIElements } from '@/app/lib/ui/UIElementManager';
import { PrimerUIElement, UIElementKind } from '@/app/lib/ui/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

// Icon mapping for different UI element types
const ELEMENT_ICONS: Record<UIElementKind, React.ComponentType<{ className?: string }>> = {
  slide: FileText,
  component: Box,
  note: StickyNote,
  mermaid: GitBranch,
};

// Color mapping for different UI element types
const ELEMENT_COLORS: Record<UIElementKind, string> = {
  slide: 'text-blue-600',
  component: 'text-purple-600',
  note: 'text-yellow-600',
  mermaid: 'text-green-600',
};

function truncateTitle(title: string, maxLength: number = 35): string {
  if (title.length <= maxLength) return title;
  return title.substring(0, maxLength - 3) + '...';
}

export function WindowManager() {
  const [elements, setElements] = useState<PrimerUIElement[]>([]);
  const [activeElement, setActiveElement] = useState<PrimerUIElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const updateElements = () => {
      const manager = getUIElementManager();
      const allElements = manager.getAll();
      setElements(allElements);

      // Find the active (visible) element with highest z-index
      const visibleElements = allElements.filter(el => el.visible);
      if (visibleElements.length > 0) {
        const active = visibleElements.reduce((max, el) => 
          el.zIndex > max.zIndex ? el : max
        );
        setActiveElement(active);
      } else {
        setActiveElement(null);
      }
    };

    updateElements();
    const unsubscribe = subscribeToUIElements(updateElements);
    return () => unsubscribe();
  }, []);

  const handleElementClick = (element: PrimerUIElement) => {
    const manager = getUIElementManager();
    
    if (element.visible) {
      // If already visible, bring to front
      manager.bringToFront(element.id);
    } else {
      // Show the element
      manager.show(element.id);
      manager.bringToFront(element.id);
    }
    
    setIsOpen(false);
  };

  // Don't show anything if there are no elements at all
  if (elements.length === 0) {
    return null;
  }

  const Icon = activeElement ? ELEMENT_ICONS[activeElement.kind] : FileText;
  const iconColor = activeElement ? ELEMENT_COLORS[activeElement.kind] : 'text-gray-600';
  
  // If no active element, show count of hidden elements
  let displayTitle: string;
  if (activeElement) {
    displayTitle = truncateTitle(activeElement.title);
  } else {
    const hiddenCount = elements.filter(el => !el.visible).length;
    displayTitle = hiddenCount === 1 ? '1 element' : `${hiddenCount} elements`;
  }

  return (
    <div className="flex justify-center">
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="h-8 px-2 min-[540px]:px-3 gap-1 min-[540px]:gap-2 hover:bg-bay-blue hover:text-white min-[540px]:w-64"
          >
            <Icon className={`size-5 flex-shrink-0 ${iconColor}`} />
            <span className="text-sm font-medium flex-1 truncate text-left hidden min-[540px]:block">
              {displayTitle}
            </span>
            <ChevronDown className="size-5 opacity-50 flex-shrink-0" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="w-64" style={{ zIndex: 9999 }}>
          {elements.length === 0 ? (
            <div className="px-2 py-3 text-sm text-gray-500 text-center">
              No windows available
            </div>
          ) : (
            elements.map((element) => {
              // Special handling for system windows
              let ElementIcon = ELEMENT_ICONS[element.kind];
              let elementColor = ELEMENT_COLORS[element.kind];
              
              if (element.id === 'transcript-window') {
                ElementIcon = MessageCircle;
                elementColor = 'text-green-600';
              } else if (element.id === 'events-window') {
                ElementIcon = ScrollText;
                elementColor = 'text-orange-600';
              }
              
              const isActive = activeElement?.id === element.id;
              
              return (
                <DropdownMenuItem
                  key={element.id}
                  onClick={() => handleElementClick(element)}
                  className={`flex items-center gap-2 cursor-pointer ${
                    isActive ? 'bg-bay-blue/10' : ''
                  }`}
                >
                  <ElementIcon className={`w-4 h-4 ${elementColor}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {element.title}
                    </div>
                    <div className="text-xs text-gray-500 capitalize">
                      {element.kind}
                    </div>
                  </div>
                  {!element.visible && (
                    <span className="text-xs text-gray-400">(hidden)</span>
                  )}
                </DropdownMenuItem>
              );
            })
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

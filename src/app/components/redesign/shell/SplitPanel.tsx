'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

// --- Phase heading ---

interface PhaseHeadingProps {
  children: React.ReactNode;
  className?: string;
}

export function PhaseHeading({ children, className }: PhaseHeadingProps) {
  return (
    <h2
      className={cn(
        'm-0 text-center font-serif font-bold text-2xl text-brand md:text-3xl',
        className
      )}
    >
      {children}
    </h2>
  );
}

// --- Step dots (progress indicator) ---

interface StepDotsProps {
  total: number;
  current: number; // 0-indexed
  className?: string;
}

export function StepDots({ total, current, className }: StepDotsProps) {
  return (
    <div className={cn('flex items-center justify-center gap-2', className)}>
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={cn(
            'h-2 w-2 rounded-full transition-colors duration-200',
            i === current ? 'bg-penn-blue' : i < current ? 'bg-penn-blue/40' : 'bg-slate-300'
          )}
        />
      ))}
    </div>
  );
}

// --- Split panel layout ---

interface SplitPanelProps {
  /** Phase heading shown above the panels */
  heading?: React.ReactNode;
  /** Left panel content (typically chat/conversation) */
  left: React.ReactNode;
  /** Right panel content (typically document/output) */
  right: React.ReactNode;
  /** Optional navigation bar below panels: breadcrumb left, step dots center */
  nav?: {
    breadcrumb?: React.ReactNode;
    stepDots?: React.ReactNode;
  };
  /** Shift visual focus to the right (document) panel by dimming the left */
  focusRight?: boolean;
  /** When true, hide the left panel and show an edge toggle to restore it */
  leftCollapsed?: boolean;
  /** When true, hide the right panel and show an edge toggle to restore it */
  rightCollapsed?: boolean;
  onToggleLeft?: () => void;
  onToggleRight?: () => void;
  className?: string;
}

export function SplitPanel({
  heading,
  left,
  right,
  nav,
  focusRight,
  leftCollapsed,
  rightCollapsed,
  onToggleLeft,
  onToggleRight,
  className,
}: SplitPanelProps) {
  return (
    <div className={cn('flex h-full flex-col', className)}>
      {/* Phase heading */}
      {heading && <div className="mb-4 px-4">{heading}</div>}

      {/* Panels */}
      <div className="relative flex flex-1 gap-4 overflow-hidden px-4">
        {/* Left — chat */}
        {!leftCollapsed && (
          <div
            className={cn(
              // If the right panel is collapsed the left takes the full width.
              rightCollapsed ? 'flex-1' : 'w-[38%] flex-shrink-0',
              'flex flex-col overflow-hidden rounded-2xl bg-white/90 shadow-md backdrop-blur-sm transition-opacity duration-300',
              focusRight && 'opacity-60'
            )}
          >
            {left}
          </div>
        )}

        {/* Right — document */}
        {!rightCollapsed && (
          <div
            className={cn(
              'flex flex-1 flex-col overflow-hidden rounded-2xl bg-white shadow-md'
            )}
          >
            {right}
          </div>
        )}

        {/* Edge toggles — click to restore a collapsed panel. Hidden when both
            are collapsed (you'd end up with a blank canvas and two restore
            buttons, which is fine but noisy — keep the UI quiet). */}
        {leftCollapsed && onToggleLeft && (
          <button
            type="button"
            onClick={onToggleLeft}
            aria-label="Show chat panel"
            title="Show chat"
            className="absolute left-0 top-1/2 z-10 -translate-y-1/2 rounded-r-lg bg-white/90 p-1.5 shadow-md backdrop-blur-sm hover:bg-white"
          >
            <ChevronRight className="h-4 w-4 text-slate-600" />
          </button>
        )}
        {rightCollapsed && onToggleRight && (
          <button
            type="button"
            onClick={onToggleRight}
            aria-label="Show document panel"
            title="Show document"
            className="absolute right-0 top-1/2 z-10 -translate-y-1/2 rounded-l-lg bg-white/90 p-1.5 shadow-md backdrop-blur-sm hover:bg-white"
          >
            <ChevronLeft className="h-4 w-4 text-slate-600" />
          </button>
        )}
      </div>

      {/* Navigation bar */}
      {nav && (
        <div className="mt-3 flex items-center justify-between px-4 pb-2">
          <div className="flex-1">{nav.breadcrumb ?? <span />}</div>
          <div className="flex-shrink-0">{nav.stepDots}</div>
          <div className="flex-1" />
        </div>
      )}
    </div>
  );
}

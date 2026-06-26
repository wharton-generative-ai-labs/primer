'use client';

import React, { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { TranscriptItem } from '@/app/lib/types';

/**
 * Inline amber callout surfaced in the chat stream when a tool call failed.
 * Always visible (not gated by debug mode) so silent failures become loud:
 * if an agent narrates "I'm having trouble showing that", the user can now
 * see the underlying error right next to it.
 *
 * Clickable to expand the full payload for paste-into-a-bug-report.
 */
export function ToolErrorNotice({ item }: { item: TranscriptItem }) {
  const [expanded, setExpanded] = useState(false);
  const toolName = (item.data?.toolName as string | undefined) ?? 'tool';
  const message = (item.data?.message as string | undefined) ?? item.title;

  return (
    <div className="my-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-start gap-2 text-left"
      >
        <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 translate-y-[1px] text-amber-600" />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="font-semibold">
            <code className="font-mono">{toolName}</code> tool call failed
          </span>
          <span className="truncate text-amber-800">{message}</span>
        </span>
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 translate-y-[1px] text-amber-600" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 translate-y-[1px] text-amber-600" />
        )}
      </button>
      {expanded && item.data && (
        <pre className="mt-2 whitespace-pre-wrap break-words rounded bg-white/60 p-2 font-mono text-[10px] leading-snug text-amber-900">
          {JSON.stringify(item.data, null, 2)}
        </pre>
      )}
    </div>
  );
}

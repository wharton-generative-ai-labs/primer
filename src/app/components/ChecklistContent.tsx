'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { BarChart3, CheckCircle2, Circle } from 'lucide-react';
import { useArtifact, Artifact as ArtifactType } from '@/app/contexts/ArtifactContext';

/**
 * Inline rendering of a checklist artifact — used by the document panel's
 * Checklist tab. This was previously packaged inside the floating,
 * draggable `ChecklistViewer`; the new layout surfaces it as a tab so
 * it stays integrated with the rest of the document panel. Parsing and
 * progress math are unchanged from the original.
 *
 * Read-only: the AI is the one who updates check state (via the
 * `checklist` tool's `check`/`uncheck` actions, which rewrite the
 * artifact content). This component reflects whatever the underlying
 * artifact says.
 */

interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
  line: number;
  type: 'header' | 'item';
  level?: number;
}

function parseChecklistContent(content: string): ChecklistItem[] {
  if (!content) return [];
  const lines = content.split('\n');
  const out: ChecklistItem[] = [];
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    const headerMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headerMatch) {
      out.push({
        id: `header-${index}`,
        text: headerMatch[2],
        checked: false,
        line: index,
        type: 'header',
        level: headerMatch[1].length,
      });
    } else if (trimmed.match(/^- \[[ x]\]/)) {
      out.push({
        id: `item-${index}`,
        text: trimmed.replace(/^- \[[ x]\]\s*/, ''),
        checked: trimmed.startsWith('- [x]'),
        line: index,
        type: 'item',
      });
    }
  });
  return out;
}

export function ChecklistContent({
  artifactId,
  agentName,
}: {
  artifactId: string;
  agentName?: string;
}) {
  const { getArtifact, artifacts } = useArtifact();
  const [artifact, setArtifact] = useState<ArtifactType | null>(null);
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadArtifact = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getArtifact(artifactId);
      if (data) {
        setArtifact(data);
        setItems(parseChecklistContent(data.content));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load checklist');
    } finally {
      setIsLoading(false);
    }
  }, [artifactId, getArtifact]);

  // Initial load
  useEffect(() => {
    loadArtifact();
  }, [loadArtifact]);

  // Reload when the artifact's updatedAt changes upstream (e.g. the AI
  // just marked an item done).
  useEffect(() => {
    const latest = artifacts.find((a) => a.id === artifactId);
    if (latest && latest.updatedAt !== artifact?.updatedAt) {
      loadArtifact();
    }
  }, [artifacts, artifactId, artifact, loadArtifact]);

  const onlyItems = items.filter((i) => i.type === 'item');
  const total = onlyItems.length;
  const done = onlyItems.filter((i) => i.checked).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 pb-3">
        <BarChart3 className="h-5 w-5 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-foreground">
            {agentName ? `${agentName} Checklist` : artifact?.name ?? 'Checklist'}
          </h3>
          <p className="text-xs text-muted-foreground">
            {done}/{total} items ({pct}%)
          </p>
        </div>
      </div>

      <div className="mb-3 h-1.5 w-full rounded-full bg-muted">
        <div
          className="h-1.5 rounded-full bg-primary transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-primary" />
        </div>
      ) : error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : items.length === 0 ? (
        <p className="py-6 text-center text-sm italic text-muted-foreground">No checklist items found.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {items.map((item) => {
            if (item.type === 'header') {
              return (
                <li
                  key={item.id}
                  className={
                    item.level === 1
                      ? 'mt-3 border-t border-border pt-3'
                      : 'mt-2'
                  }
                >
                  <h4
                    className={`font-semibold text-foreground ${
                      item.level === 1 ? 'text-base' : 'text-sm'
                    }`}
                  >
                    {item.text}
                  </h4>
                </li>
              );
            }
            return (
              <li
                key={item.id}
                className={`flex items-center gap-2 rounded px-2 py-1.5 text-sm ${
                  item.checked
                    ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100'
                    : 'bg-muted/60 text-foreground'
                }`}
              >
                {item.checked ? (
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Circle className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                )}
                <span className={item.checked ? 'line-through' : ''}>{item.text}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

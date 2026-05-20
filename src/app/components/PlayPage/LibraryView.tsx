'use client';

import React from 'react';
import { Undo2Icon } from 'lucide-react';
import type { ActiveContent } from '@/app/contexts/ArtifactContext';
import { panelContentDedupKey, useArtifact } from '@/app/contexts/ArtifactContext';
import type { ArtifactRevisionMeta } from '@/app/lib/artifacts/types';
import { getRelativeTimeString } from '@/app/lib/date-utils';
import { Button } from '@/components/ui/button';

/**
 * Build the list rendered by the All Documents tab: the currently-active
 * content (if any) prepended to the past-document `library`, deduped by
 * stable identity so the active doc never appears twice (e.g. if a stale
 * library entry pointing to the same artifact slipped through earlier
 * persistence layers). Pure helper so it can be unit-tested without the
 * full provider tree.
 */
export function buildAllDocumentsList(
  activeContent: ActiveContent | null,
  library: ActiveContent[],
): ActiveContent[] {
  if (!activeContent) return library;
  const activeKey = panelContentDedupKey(activeContent);
  const filteredLibrary = library.filter(
    (item) => panelContentDedupKey(item) !== activeKey,
  );
  return [activeContent, ...filteredLibrary];
}

/**
 * Helper: pick a display name for a revision's author. Mirrors the
 * VersionSwitcher copy so the library and switcher stay in lockstep.
 */
function revisionAuthorLabel(meta: ArtifactRevisionMeta): string {
  const { author } = meta;
  if (author.kind === 'user') return author.name || author.email;
  if (author.kind === 'agent') return author.name;
  return 'System';
}

function contentLabel(content: ActiveContent | null | undefined, fallback = 'Document'): string {
  if (!content) return fallback;
  if (content.kind === 'document') return content.name || fallback;
  if (content.kind === 'diagram') return content.name || 'Diagram';
  return 'Component';
}

/**
 * "All Documents" panel.
 *
 * Each library item renders as a tile. For document-kind items we surface
 * every revision inline as a clickable row (newest first); each row's click
 * sets focusedRev for that artifact and switches to the active tab so the
 * doc panel renders the picked version. Diagrams / components don't have a
 * revision system, so they fall back to a single-row tile.
 *
 * Empty state copy intentionally identical to the original; the structural
 * change is the per-row revision drill-in.
 *
 * Lives in its own file (rather than inside `PlayPageSplitContent.tsx`) so
 * RTL tests can import it without dragging in `react-markdown`, which is
 * pure ESM and trips Jest's CommonJS transformer.
 */
export function LibraryView({
  library,
  onOpenRevision,
  onRestoreRevision,
}: {
  library: ActiveContent[];
  onOpenRevision: (item: ActiveContent, rev?: number) => void;
  onRestoreRevision: (artifactId: string, rev: number) => void;
}) {
  const { artifacts, revisionsByArtifact } = useArtifact();

  if (library.length === 0) {
    return (
      <div className="flex h-full min-h-[12rem] w-full items-center justify-center bg-background">
        <p className="text-sm italic text-muted-foreground">
          Past documents will appear here after the agent moves on.
        </p>
      </div>
    );
  }

  return (
    <ul className="flex w-full min-h-full flex-col gap-3 bg-background">
      {library.map((item) => {
        const docName = contentLabel(item);
        const isDocument = item.kind === 'document';
        const artifactKey = isDocument ? item.artifactId ?? item.id : item.id;
        const artifact = isDocument ? artifacts.find((a) => a.id === artifactKey) : undefined;
        const revs = isDocument ? revisionsByArtifact[artifactKey] : undefined;
        const sortedRevs =
          Array.isArray(revs) && revs.length > 0
            ? [...revs].sort((a, b) => b.rev - a.rev)
            : null;

        if (sortedRevs && artifact) {
          return (
            <li
              key={item.id}
              className="overflow-hidden rounded-lg border border-border bg-card"
            >
              <div className="flex items-center gap-3 border-b border-border bg-muted/40 px-3 py-2">
                <span className="truncate text-sm font-medium text-foreground">
                  {docName}
                </span>
              </div>
              <ul className="divide-y divide-border">
                {sortedRevs.map((rev) => {
                  const isLatest = rev.rev === artifact.currentRev;
                  return (
                    <li key={rev.rev} className="flex items-center  transition-colors hover:bg-muted/50">
                      <button
                        type="button"
                        onClick={() => onOpenRevision(item, rev.rev)}
                        className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left"
                      >
                        <span className="truncate text-sm text-foreground">
                          Version {rev.rev} · {revisionAuthorLabel(rev)} · {getRelativeTimeString(rev.createdAt)}
                        </span>
                      </button>
                      {isLatest ? (
                        <div className="text-sm text-muted-foreground pr-2">Current</div>
                      ) : (
                        <div className="flex-shrink-0 pr-2">
                          <Button
                            type="button"
                            size="xs"
                            variant="outline"
                            onClick={() => onRestoreRevision(artifactKey, rev.rev)}
                          >
                            <Undo2Icon className="size-4" />
                            Restore
                          </Button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        }

        // Fallback: non-document item, or a doc whose revisions sidecar
        // hasn't been hydrated yet (network in-flight). Keep the original
        // single-row tile so the user always sees something clickable.
        return (
          <li
            key={item.id}
            className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 transition-colors hover:border-border hover:bg-muted/50"
          >
            <button
              type="button"
              onClick={() => onOpenRevision(item)}
              className="flex min-w-0 flex-1 flex-col items-start text-left"
            >
              <span className="truncate text-sm font-medium text-foreground">
                {docName}
              </span>
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                {item.kind}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

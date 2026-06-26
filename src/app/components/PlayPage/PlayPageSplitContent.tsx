'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useTranscript } from '@/app/contexts/TranscriptContext';
import { useArtifact, ActiveContent } from '@/app/contexts/ArtifactContext';
import { useExperienceUrl } from '@/app/hooks/useExperienceUrl';
import { getExistingSessionId } from '@/app/lib/session-utils';
import { DocBanner } from '@/app/components/DocBanner/DocBanner';
import { VersionSwitcher } from '@/app/components/RevisionHistory/VersionSwitcher';
import { DocumentToc, type TocHeading } from '@/app/components/PlayPage/DocumentToc';
import { LibraryView, buildAllDocumentsList } from '@/app/components/PlayPage/LibraryView';
import { ChecklistContent } from '../ChecklistContent';
import { useLayout } from '@/app/contexts/LayoutContext';
import { useWorkflowPhase } from '@/app/contexts/WorkflowPhaseContext';
import { computePhaseMemberships } from '@/app/lib/workflow-phases';
import { WorkflowPhaseStrip } from '@/app/components/WorkflowPhaseStrip/WorkflowPhaseStrip';
import { getNotesManager, subscribeToStateUpdates as subscribeToNotes, Note } from '@/app/lib/tools/ui/notes/NotesManager';
import { MermaidDiagram } from '@/app/lib/tools/ui/mermaid/index';
import { getActiveComponentInstances, subscribeToStateUpdates as subscribeToComponents } from '@/app/lib/tools/ui/components/ComponentManager';
import { ComponentErrorBoundary } from '../CustomComponents';
import { PhaseHeading, WelcomeOverlay } from '../redesign';
import { SessionStatus, AgentConfig } from '@/app/lib/types';
import { ChatPanel } from './ChatPanel';

// Figma 520:7927 — light tints; dark: uses the same hue at low opacity on bg-background.
// Agent is still the source of truth via Note.color; legacy colors map to warm tiles.
const NOTE_BG: Record<string, string> = {
  amber:
    'bg-amber-100 dark:border dark:border-amber-900/35 dark:bg-amber-950/30',
  yellow:
    'bg-yellow-100 dark:border dark:border-yellow-900/35 dark:bg-yellow-950/30',
  pink: 'bg-pink-100 dark:border dark:border-pink-900/40 dark:bg-pink-950/30',
  orange:
    'bg-orange-100 dark:border dark:border-orange-900/35 dark:bg-orange-950/30',
  green: 'bg-amber-100 dark:border dark:border-amber-900/35 dark:bg-amber-950/30',
  blue: 'bg-pink-100 dark:border dark:border-pink-900/40 dark:bg-pink-950/30',
  purple: 'bg-pink-100 dark:border dark:border-pink-900/40 dark:bg-pink-950/30',
};
const NOTE_BG_FALLBACK = NOTE_BG.amber;

interface PlayPageSplitContentProps {
  userText: string;
  setUserText: (text: string) => void;
  onSendMessage: () => void;
  sessionStatus: SessionStatus;
  experienceTitle: string;
  /** Whether the workflow phase strip should display the position count (e.g.
   *  "2/5 · Phase Title"). Mirrors `ExperienceConfig.showPhaseCount`. */
  showPhaseCount?: boolean;
  agents: Record<string, AgentConfig>;
  selectedAgentKey: string;
  setSelectedAgentKey: (key: string) => void;
  /** `SWITCH_AGENTS` and >1 non-backend agent — when true, agent name + switcher under headline. */
  canSwitchAgents: boolean;
  /** Manual agent switching is debug-only; the switcher is hidden unless debug mode is on. */
  isDebugModeEnabled: boolean;
  /** Key of the agent we are about to hand off to. Set from the moment the
   *  tool call lands until setSelectedAgentKey fires; drives the "switching"
   *  UI so the user sees *something* during the pre-reconnect silence. */
  queuedAgentKey: string | null;
  hasAudio: boolean;
  isMuted: boolean;
  setIsMuted: (muted: boolean) => void;
  isAudioPlaybackEnabled: boolean;
  setIsAudioPlaybackEnabled: (enabled: boolean) => void;
  isAIAudioPlaying: boolean;
  /** Display tool-call errors inline in the chat. Admin/technical users. */
  showToolErrors: boolean;
}

/**
 * Renders only when the parent has already gated on permission + >1 agent.
 */
function AgentNameWithSwitcher({
  agents,
  selectedAgentKey,
  setSelectedAgentKey,
  phaseMemberKeys,
}: {
  agents: Record<string, AgentConfig>;
  selectedAgentKey: string;
  setSelectedAgentKey: (key: string) => void;
  /** Restrict the dropdown to these keys when set (phased experience). Undefined = no phase restriction. */
  phaseMemberKeys?: Set<string>;
}) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const frontendAgents = Object.entries(agents).filter(
    ([key, agent]) =>
      agent.type !== "backend" &&
      (!phaseMemberKeys || phaseMemberKeys.has(key) || key === selectedAgentKey)
  );
  if (!selectedAgentKey) {
    return null;
  }
  const displayName = agents[selectedAgentKey]?.name || selectedAgentKey;
  return (
    <div
      className="relative"
      onMouseEnter={() => setIsDropdownOpen(true)}
      onMouseLeave={() => setIsDropdownOpen(false)}
    >
      <span className="flex cursor-pointer items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground">
        {displayName}
        <svg
          className="h-3 w-3"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </span>
      {isDropdownOpen && (
        <div className="absolute top-full left-1/2 z-50 -translate-x-1/2 pt-1">
          <div className="absolute top-0 right-0 left-0 h-1" />
          <div className="min-w-[150px] rounded-lg border border-border bg-background py-1 shadow-lg">
            {frontendAgents.map(([key, agent]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setSelectedAgentKey(key);
                  setIsDropdownOpen(false);
                }}
                className={`w-full px-3 py-1.5 text-left text-xs transition-colors hover:bg-muted ${
                  key === selectedAgentKey
                    ? "font-medium text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                {agent.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Pulls H1/H2/H3 headings out of raw markdown, in document order, with
 * deduplicated slugs. Skips headings inside fenced code blocks. Cheap regex
 * pass — keeps us out of an extra remark/rehype dep just for the TOC.
 */
function extractHeadings(markdown: string): TocHeading[] {
  if (!markdown) return [];
  const lines = markdown.split('\n');
  const headings: TocHeading[] = [];
  const seen = new Map<string, number>();
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const match = /^(#{1,3})\s+(.+?)\s*#*\s*$/.exec(line);
    if (!match) continue;
    const level = match[1].length;
    const text = match[2].replace(/[*_`~]+/g, '').trim();
    if (!text) continue;
    const baseSlug = slugify(text) || `heading-${i + 1}`;
    const count = seen.get(baseSlug) ?? 0;
    const slug = count === 0 ? baseSlug : `${baseSlug}-${count}`;
    seen.set(baseSlug, count + 1);
    headings.push({ level, text, slug, line: i + 1 });
  }
  return headings;
}

/**
 * Display label for the active-document tab.
 * `document` and `diagram` entries carry a `name`; `component` entries don't.
 */
function activeDocumentName(content: ActiveContent | null | undefined): string | undefined {
  if (!content) return undefined;
  switch (content.kind) {
    case 'document':
    case 'diagram':
      return content.name;
    case 'component':
      return 'Component';
  }
}

export function DocumentPanel({
  agentName,
  showPhaseCount,
}: {
  agentName?: string;
  showPhaseCount?: boolean;
}) {
  const {
    activeContent,
    library,
    viewedContent,
    viewDocument,
    activeChecklistId,
    setFocusedRev,
    restoreRevision,
  } = useArtifact();
  const { documentTab, setDocumentTab } = useLayout();
  const { phases } = useWorkflowPhase();
  const [notes, setNotes] = useState<Note[]>([]);
  const [notesFlash, setNotesFlash] = useState(false);

  // The All Documents tab lists every doc the agent has surfaced this
  // session — the currently-active one as well as past entries demoted
  // into `library`. Building the combined list here (rather than inside
  // LibraryView) lets the tab badge count match the tile count.
  const allDocuments = useMemo(
    () => buildAllDocumentsList(activeContent, library),
    [activeContent, library],
  );

  // Subscribe to NotesManager. Notes live inside this panel under the Notes
  // tab; drag/resize is dropped since the panel has fixed bounds.
  useEffect(() => {
    const readNotes = () => setNotes(getNotesManager().getVisibleNotes());
    readNotes();
    return subscribeToNotes(readNotes);
  }, []);

  // When the agent surfaces new content, jump to the Active tab so the user
  // sees what was just shown.
  const lastActiveId = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (activeContent && activeContent.id !== lastActiveId.current) {
      lastActiveId.current = activeContent.id;
      setDocumentTab('active');
    }
  }, [activeContent]);

  // Flash the Notes tab briefly when a new note arrives while on another
  // tab, so the user knows something was pinned.
  const prevNoteCount = useRef(0);
  useEffect(() => {
    if (notes.length > prevNoteCount.current && documentTab !== 'notes') {
      setNotesFlash(true);
      const t = setTimeout(() => setNotesFlash(false), 1500);
      return () => clearTimeout(t);
    }
    prevNoteCount.current = notes.length;
  }, [notes.length, documentTab]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Figma 507:17582 — tab bar uses bg-muted, h-16, pl-6 pr-[18px], border-b */}
      <div className="flex h-16 shrink-0 items-center rounded-t-2xl border-b border-border bg-muted pl-6 pr-[18px]">
        <div className="flex h-full items-center gap-8 overflow-clip">
          <TabButton
            active={documentTab === 'active'}
            onClick={() => setDocumentTab('active')}
            label={activeDocumentName(viewedContent) ?? 'Current Document'}
          />
          {
            notes.length > 0 && (
              <TabButton
                active={documentTab === 'notes'}
                onClick={() => setDocumentTab('notes')}
                label="Notes"
                badge={notes.length > 0 ? notes.length : undefined}
                flash={notesFlash}
              />
            )
          }
          {
            allDocuments.length > 1 && (
              <TabButton
                active={documentTab === 'library'}
                onClick={() => setDocumentTab('library')}
                label="All Documents"
                badge={allDocuments.length > 0 ? allDocuments.length : undefined}
              />
            )
          }
          {activeChecklistId && (
            <TabButton
              active={documentTab === 'checklist'}
              onClick={() => setDocumentTab('checklist')}
              label="Checklist"
            />
          )}
        </div>
      </div>

      {/* Figma 153:2894 — banner row pinned outside the scroll container so
          it stays put while the article scrolls. Only renders on the active
          tab; the helper itself returns null when there's nothing to show. */}
      {documentTab === 'active' && <DocumentPanelBanner />}

      {/* Figma 507:17585 — body uses pt-8 pl-6 pr-3 pb-6; bg-background for dark mode */}
      <div className="min-h-0 flex-1 overflow-y-auto bg-background pl-6 pr-3 pt-8 pb-6 [scrollbar-color:hsl(var(--border))_transparent] [scrollbar-gutter:stable] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar]:w-3">
        {documentTab === 'active' ? (
          <div className="min-h-full w-full bg-background">
            <ContentRenderer content={viewedContent} revisionChrome tabLabel={activeDocumentName(viewedContent)} />
          </div>
        ) : documentTab === 'notes' ? (
          <div className="min-h-full w-full bg-background">
            {notes.length > 0 ? (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                {notes.map((n) => (
                  <NoteCard key={n.id} note={n} />
                ))}
              </div>
            ) : (
              <div className="flex h-full min-h-[12rem] items-center justify-center">
                <p className="text-sm italic text-muted-foreground">
                  Key points the agent pins will appear here.
                </p>
              </div>
            )}
          </div>
        ) : documentTab === 'library' ? (
          <LibraryView
            library={allDocuments}
            onOpenRevision={(item, rev) => {
              const artifactKey =
                item.kind === 'document' ? item.artifactId ?? item.id : item.id;
              if (rev !== undefined) {
                setFocusedRev(artifactKey, rev);
              }
              // Open in the Active tab without changing the AI's active pointer.
              viewDocument(item.id);
              setDocumentTab('active');
            }}
            onRestoreRevision={(artifactId, rev) => void restoreRevision(artifactId, rev)}
          />
        ) : documentTab === 'checklist' && activeChecklistId ? (
          <div className="min-h-full w-full bg-background">
            <ChecklistContent artifactId={activeChecklistId} agentName={agentName} />
          </div>
        ) : (
          // If the Checklist tab was selected but the active checklist was
          // cleared, snap back to Active so the user isn't staring at a
          // blank pane. Matches the tab's own "hide when nothing to show"
          // behaviour above.
          <div className="min-h-full w-full bg-background">
            <ContentRenderer content={viewedContent} revisionChrome={false} tabLabel={activeDocumentName(viewedContent)} />
          </div>
        )}
      </div>

      {phases.length > 0 && (
        <WorkflowPhaseStrip showPhaseCount={showPhaseCount} />
      )}
    </div>
  );
}


/**
 * Document-kind renderer. Lifted out of ContentRenderer so we can use hooks
 * (useMemo for heading extraction) without violating rules-of-hooks for the
 * other branches.
 *
 * Renders Figma 507:17585 — explicit token typography (no `prose`), with the
 * document title as the H1 and a right-side TOC sidebar that mirrors
 * 507:17597. The first paragraph after the H1 auto-promotes to text-lg via
 * `[&_h1+p]` so authors get a "lead" without extra markup.
 */
function DocumentArticle({
  name,
  hideTitle = false,
  markdown,
  versionSwitcher,
  versionSwitcherCompact,
}: {
  name: string;
  /** When true, suppresses the article <h1> — use when the tab already shows the same title. */
  hideTitle?: boolean;
  markdown: string;
  /** Full-width switcher rendered in the sidebar on lg+ viewports. */
  versionSwitcher?: React.ReactNode;
  /** Icon-only switcher rendered as an absolute chip on small containers. */
  versionSwitcherCompact?: React.ReactNode;
}) {
  const headings = useMemo(() => extractHeadings(markdown), [markdown]);

  // Cheap line-keyed lookup so each markdown heading element knows its slug.
  // We extract slugs from the source text once, then react-markdown forwards
  // the source `position` on each rendered node so we can rejoin without a
  // second pass.
  const slugByLine = useMemo(() => {
    const map = new Map<number, string>();
    for (const h of headings) map.set(h.line, h.slug);
    return map;
  }, [headings]);

  // Show the sidebar when there's a version switcher or enough headings for
  // a TOC. The switcher always occupies the header slot; TOC list renders
  // only when headings >= 2 (handled inside DocumentToc itself).
  const showSidebar = versionSwitcher !== undefined || headings.length >= 2;

  // react-markdown 9 forwards the hast node on `props.node`. We read
  // `position.start.line` to find the matching slug.
  const idForNode = (node: { position?: { start?: { line?: number } } } | undefined) => {
    const line = node?.position?.start?.line;
    return line ? slugByLine.get(line) : undefined;
  };

  return (
    <div className="relative flex gap-6">
      {/* Small-container fallback: icon-only chip, absolutely positioned so
          it never affects article text flow. Hidden once the sidebar appears. */}
      {versionSwitcherCompact && (
        <div className="absolute top-0 right-0 z-10 bg-background lg:hidden">
          {versionSwitcherCompact}
        </div>
      )}
      <article className="min-w-0 flex-1 text-foreground [&_h1+p]:text-lg [&_h1+p]:leading-7 [&_h2]:scroll-mt-4 [&_h3]:scroll-mt-4">
        {!hideTitle && <h1 className="pb-2.5 text-3xl font-bold leading-9 text-foreground">{name}</h1>}
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({ node, ...props }) => <h1 id={idForNode(node)} className="pb-2.5 pt-5 text-3xl font-bold leading-9 text-foreground" {...props} />,
            h2: ({ node, ...props }) => <h2 id={idForNode(node)} className="pb-2.5 pt-5 text-2xl font-bold leading-8 text-foreground" {...props} />,
            h3: ({ node, ...props }) => <h3 id={idForNode(node)} className="pb-1.5 pt-4 text-xl font-bold leading-7 text-foreground" {...props} />,
            h4: (props) => <h4 className="pb-1.5 pt-4 text-base font-bold leading-6 text-foreground" {...props} />,
            p: (props) => <p className="pb-2.5 text-base leading-6 text-foreground" {...props} />,
            ul: (props) => <ul className="list-disc pb-2.5 pl-6 text-base leading-6 text-foreground [&_ul]:list-[circle] [&_ul]:pb-0" {...props} />,
            ol: (props) => <ol className="list-decimal pb-2.5 pl-6 text-base leading-6 text-foreground [&_ol]:pb-0" {...props} />,
            li: (props) => <li className="pb-1" {...props} />,
            a: (props) => <a className="text-primary underline underline-offset-2 hover:text-primary/80" {...props} />,
            strong: (props) => <strong className="font-bold" {...props} />,
            em: (props) => <em className="italic" {...props} />,
            code: (props) => <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]" {...props} />,
            pre: (props) => <pre className="mb-2.5 overflow-x-auto rounded-md bg-muted p-4 text-sm" {...props} />,
            blockquote: (props) => <blockquote className="my-2.5 border-l-4 border-border pl-4 italic text-muted-foreground" {...props} />,
          }}
        >
          {markdown}
        </ReactMarkdown>
      </article>
      {showSidebar && <DocumentToc headings={headings} header={versionSwitcher} />}
    </div>
  );
}

function DocumentContentWithRevisions({
  content,
  revisionChrome,
  tabLabel,
}: {
  content: ActiveContent & { kind: 'document' };
  revisionChrome: boolean;
  tabLabel?: string;
}) {
  const {
    artifacts,
    viewState,
    setFocusedRev,
    ensureRevisionsList,
    revisionsByArtifact,
  } = useArtifact();
  const { getExperienceId } = useExperienceUrl();

  const artifactKey = content.artifactId ?? content.id;
  const artifact = artifacts.find((a) => a.id === artifactKey);
  const currentRev = artifact?.currentRev ?? 1;
  const focusedRev = viewState[artifactKey]?.focusedRev ?? currentRev;

  // Seed from the live artifact content when available so the initial render
  // reflects any edits that happened before this component mounted.
  const [displayMarkdown, setDisplayMarkdown] = useState(
    () => artifact?.content ?? content.content,
  );

  useEffect(() => {
    if (!revisionChrome) {
      setDisplayMarkdown(artifact?.content ?? content.content);
      return;
    }
    if (focusedRev === currentRev) {
      setDisplayMarkdown(artifact?.content ?? content.content);
      return;
    }

    const experienceId = getExperienceId();
    const sessionId = getExistingSessionId();
    if (!experienceId || !sessionId) {
      setDisplayMarkdown(artifact?.content ?? content.content);
      return;
    }

    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/artifacts/${artifactKey}/revisions/${focusedRev}`, {
        headers: {
          'x-experience-id': experienceId,
          'x-session-id': sessionId,
        },
      });
      if (!res.ok || cancelled) return;
      const data = (await res.json()) as { content?: string };
      if (!cancelled && typeof data.content === 'string') {
        setDisplayMarkdown(data.content);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    revisionChrome,
    artifactKey,
    focusedRev,
    currentRev,
    artifact?.content,
    content.content,
    getExperienceId,
  ]);

  const artifactRevisions = revisionsByArtifact[artifactKey];
  const showRevisionUi = (
    revisionChrome &&
    currentRev > 1 &&
    Array.isArray(artifactRevisions) &&
    artifactRevisions.length > 1
  );

  // Prefer the live artifact name over the frozen snapshot in `content` so
  // the title updates immediately when the agent renames the document.
  const displayName = artifact?.name ?? content.name;

  const switcherProps = showRevisionUi
    ? {
        artifactId: artifactKey,
        currentRev,
        focusedRev,
        revisions: artifactRevisions,
        onOpen: () => ensureRevisionsList(artifactKey),
        onSelectRev: setFocusedRev,
      }
    : null;

  return (
    <DocumentArticle
      name={displayName}
      hideTitle={!!tabLabel && tabLabel === displayName}
      markdown={displayMarkdown}
      versionSwitcher={switcherProps ? <VersionSwitcher {...switcherProps} /> : undefined}
      versionSwitcherCompact={switcherProps ? <VersionSwitcher {...switcherProps} compact /> : undefined}
    />
  );
}

/**
 * Panel-level banner row. Mounted as a sibling of the document scroll
 * container so it pins to the top of the doc panel rather than scrolling
 * with the article. Renders only on the Current Document tab and only when
 * the viewed artifact has > 1 revision.
 *
 * Note `restoreRevision` is intentionally not destructured into a stable ref:
 * the closure runs once per render so it always reads the latest focusedRev.
 */
function DocumentPanelBanner() {
  const { viewedContent, artifacts, viewState, restoreRevision } = useArtifact();
  if (!viewedContent || viewedContent.kind !== 'document') return null;
  const artifactKey = viewedContent.artifactId ?? viewedContent.id;
  const artifact = artifacts.find((a) => a.id === artifactKey);
  const currentRev = artifact?.currentRev ?? 1;
  if (currentRev <= 1) return null;
  const focusedRev = viewState[artifactKey]?.focusedRev ?? currentRev;
  return (
    <DocBanner
      currentRev={currentRev}
      focusedRev={focusedRev}
      onRestore={() => restoreRevision(artifactKey, focusedRev)}
    />
  );
}

/**
 * Picks a renderer based on the active content kind:
 *   - document → GFM markdown via <ReactMarkdown>
 *   - diagram  → <MermaidDiagram>
 *   - component → compiled React component from ComponentManager
 */
function ContentRenderer({
  content,
  revisionChrome = false,
  tabLabel,
}: {
  content: ActiveContent | null;
  revisionChrome?: boolean;
  /** The label currently shown in the tab — used to suppress a redundant article h1. */
  tabLabel?: string;
}) {
  if (!content) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm italic text-muted-foreground">
          Documents will appear here as the conversation progresses.
        </p>
      </div>
    );
  }

  if (content.kind === 'document') {
    return <DocumentContentWithRevisions content={content} revisionChrome={revisionChrome} tabLabel={tabLabel} />;
  }

  if (content.kind === 'diagram') {
    return (
      <div className="flex h-full flex-col">
        <h1 className="mb-4 font-serif text-2xl font-bold text-foreground">{content.name}</h1>
        <div className="flex-1 min-h-0">
          <MermaidDiagram title={content.name} diagram={content.diagram} theme="light" />
        </div>
      </div>
    );
  }

  if (content.kind === 'component') {
    return <ComponentSlot instanceId={content.id} />;
  }

  return null;
}

/**
 * Renders a custom React component instance inside the DocumentPanel. Looks
 * the compiled component up from ComponentManager by instance id. Subscribes
 * to manager updates so prop/state changes re-render.
 */
function ComponentSlot({ instanceId }: { instanceId: string }) {
  const [, setTick] = useState(0);

  useEffect(() => {
    // Re-read on every state change — the instance lookup is cheap.
    return subscribeToComponents(() => setTick((t) => t + 1));
  }, []);

  const instance = getActiveComponentInstances().find((i) => i.instanceId === instanceId);

  if (!instance) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm italic text-muted-foreground">Component unavailable.</p>
      </div>
    );
  }

  const Component = instance.component;

  // Defensive container for agent-authored components:
  //   - `w-full` so percentage-width components fill the panel
  //   - `overflow-x-auto` so fixed-pixel-width components scroll instead of
  //     breaking the split layout
  //   - `min-h-[240px]` so components that render very little don't collapse
  //     the pane visually
  // Agent-authored components previously got a ~70vw × 70vh floating window;
  // here they inherit the panel's width (minus padding) and should use
  // responsive styling.
  return (
    <div className="w-full min-h-[240px] overflow-x-auto">
      <ComponentErrorBoundary
        instanceId={instance.instanceId}
        componentId={instance.componentId}
        onRetry={() => setTick((t) => t + 1)}
        onDismiss={() => { /* dismissal is agent-driven in the split-panel layout */ }}
      >
        <Component {...instance.props} />
      </ComponentErrorBoundary>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  badge,
  flash,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  badge?: number;
  flash?: boolean;
}) {
  // Figma 524:11791 — full-height tab item, 5px primary underline when active.
  // Inactive items keep a transparent 5px border so the baseline stays aligned.
  return (
    <button
      onClick={onClick}
      className={`flex h-full items-center gap-2 whitespace-nowrap border-b-[5px] text-base leading-6 transition-colors ${
        active
          ? 'border-primary font-bold text-foreground'
          : 'border-transparent font-medium text-muted-foreground hover:text-foreground'
      }`}
    >
      {label}
      {badge !== undefined && (
        <span
          className={`inline-flex h-5 w-5 items-center justify-center rounded-full bg-background text-sm font-medium leading-5 text-foreground ${
            flash ? 'animate-pulse ring-2 ring-primary/40' : ''
          }`}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

function NoteCard({ note }: { note: Note }) {
  const bg = NOTE_BG[note.color] ?? NOTE_BG_FALLBACK;
  // Figma 520:7985 — flat tile, p-5 / rounded-sm; light tints, dark: translucent + border
  return (
    <div className={`${bg} rounded-sm p-5 text-base leading-6 text-foreground`}>
      <div className="whitespace-pre-wrap">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{note.content}</ReactMarkdown>
      </div>
    </div>
  );
}

function PanelCard({
  children,
  className = '',
  translucent = false,
}: {
  children: React.ReactNode;
  className?: string;
  translucent?: boolean;
}) {
  return (
    <section
      className={`flex min-h-0 flex-col overflow-hidden rounded-2xl shadow-md ${
        translucent ? 'bg-background/90 backdrop-blur-sm' : 'bg-background'
      } ${className}`}
    >
      {children}
    </section>
  );
}

export function PlayPageSplitContent({
  userText,
  setUserText,
  onSendMessage,
  sessionStatus,
  experienceTitle,
  showPhaseCount,
  agents,
  selectedAgentKey,
  setSelectedAgentKey,
  canSwitchAgents,
  isDebugModeEnabled,
  queuedAgentKey,
  hasAudio,
  isMuted,
  setIsMuted,
  isAudioPlaybackEnabled,
  setIsAudioPlaybackEnabled,
  isAIAudioPlaying,
  showToolErrors,
}: PlayPageSplitContentProps) {
  const { transcriptItems } = useTranscript();
  const {
    getWorkspaceLayout,
  } = useLayout();
  const { currentPhase, phases } = useWorkflowPhase();
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);

  // Phase title goes in the navigation strip, not the big heading. The central
  // heading stays at the experience identity unless the author opts in to a
  // phase-specific heading via `WorkflowPhaseConfig.heading`.
  const heading = currentPhase?.heading ?? experienceTitle;

  // Dismiss welcome once the first transcript message arrives
  useEffect(() => {
    if (!welcomeDismissed && transcriptItems.some((item) => item.type === 'MESSAGE')) {
      setWelcomeDismissed(true);
    }
  }, [transcriptItems, welcomeDismissed]);

  const showWelcome = !welcomeDismissed && sessionStatus !== 'CONNECTED';

  const workspaceLayout = getWorkspaceLayout();

  // Restrict the manual switcher to the current phase's members, mirroring the
  // agent.transfer phase gate. Undefined when the experience isn't phased.
  const phaseMemberKeys = useMemo<Set<string> | undefined>(() => {
    if (!currentPhase || phases.length === 0) return undefined;
    const memberships = computePhaseMemberships(phases, agents);
    return memberships[currentPhase.id]?.members;
  }, [agents, phases, currentPhase]);

  const showAgentSwitcher = useMemo(() => {
    if (!isDebugModeEnabled) return false;
    if (!canSwitchAgents) return false;
    const eligible = Object.entries(agents).filter(
      ([key, agent]) =>
        agent.type !== "backend" &&
        (!phaseMemberKeys || phaseMemberKeys.has(key))
    );
    return eligible.length > 1;
  }, [agents, canSwitchAgents, isDebugModeEnabled, phaseMemberKeys]);

  const chatPanel = (
    <ChatPanel
      userText={userText}
      setUserText={setUserText}
      onSendMessage={onSendMessage}
      canSend={sessionStatus === 'CONNECTED'}
      agents={agents}
      queuedAgentKey={queuedAgentKey}
      isReconnecting={sessionStatus === 'CONNECTING'}
      hasAudio={hasAudio}
      isMuted={isMuted}
      setIsMuted={setIsMuted}
      isAudioPlaybackEnabled={isAudioPlaybackEnabled}
      setIsAudioPlaybackEnabled={setIsAudioPlaybackEnabled}
      isAIAudioPlaying={isAIAudioPlaying}
      showToolErrors={showToolErrors}
    />
  );

  const documentPanel = (
    <DocumentPanel
      agentName={agents[selectedAgentKey]?.name}
      showPhaseCount={showPhaseCount}
    />
  );

  return (
    <div className="relative flex-1 overflow-hidden py-2">
      <AnimatePresence>
        <WelcomeOverlay visible={showWelcome} />
      </AnimatePresence>

      <div className="flex h-full flex-col">
        <div className="mb-6 flex flex-col items-center gap-1 px-4">
          <PhaseHeading>{heading}</PhaseHeading>
          {showAgentSwitcher && (
            <AgentNameWithSwitcher
              agents={agents}
              selectedAgentKey={selectedAgentKey}
              setSelectedAgentKey={setSelectedAgentKey}
              phaseMemberKeys={phaseMemberKeys}
            />
          )}
        </div>

        <div className="flex flex-1 gap-4 xl:gap-9 overflow-hidden px-4 pb-2">
          {workspaceLayout === 'document-only' && (
            <>
              <PanelCard className="w-[30%] min-w-[280px] flex-shrink-0" translucent>
                {chatPanel}
              </PanelCard>
              <PanelCard className="flex-1">{documentPanel}</PanelCard>
            </>
          )}

          {workspaceLayout === 'chat-only' && (
            <PanelCard className="mx-auto w-full max-w-[470px] xl:max-w-2xl" translucent>
              {chatPanel}
            </PanelCard>
          )}
        </div>
      </div>
    </div>
  );
}

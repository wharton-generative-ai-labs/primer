'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useArtifact } from '@/app/contexts/ArtifactContext';
import { PhaseHeading } from '@/app/components/redesign';
import { ExperienceCard, ExperienceCardSkeleton } from '@/app/components/ExperienceCard';
import type { WorkflowPhaseConfig } from '@/app/lib/workflow-phases/types';

/**
 * `mode: 'result'` surface — the deliverable tile shown after an automated
 * phase produces a built artifact. For the experience-creator's `handoff`
 * phase, this surfaces the freshly-built experience so the educator can
 * play it or copy a share link.
 *
 * **Built-experience id discovery:** the platform writes the new
 * experienceId into the shared text artifact tagged `result:experience-id`
 * during build (see `writeBuiltExperienceArtifact`). When the artifact
 * resolves with a non-empty content body and `ctaTarget === 'play-built'`,
 * we fetch `/api/storage/<id>/experience.json` to render the tile's title,
 * description, and preview image.
 *
 * **Render states:**
 * - `loading` — no tagged artifact has been registered yet (fresh session
 *   or experience configured without the convention). Renders a skeleton.
 * - `missing-content` — the tagged artifact exists but its content is
 *   empty/whitespace. The platform write didn't land — visible failure
 *   beats silent skeleton. Renders an error tile with a Reload page button.
 * - `ready` — content present. Renders the experience card (or its
 *   skeleton while `experience.json` meta is being fetched).
 */
export function ResultPhaseSurface({
  phase,
}: {
  phase: WorkflowPhaseConfig;
}) {
  const { artifacts, getArtifact } = useArtifact();
  const { toast } = useToast();
  const [failureMessage, setFailureMessage] = useState<string | null>(null);

  const taggedArtifact = useMemo(() => {
    return (
    artifacts.find((a) => {
      const tags = a.metadata?.tags ?? [];
      return tags.includes('result:experience-id');
    }) ?? null
    );
  }, [artifacts]);

  const builtExperienceId = useMemo<string | null>(() => {
    // Content can be undefined briefly while the artifact body is still
    // being fetched after a fresh listing. Bail out instead of crashing —
    // the recovery effect below pulls the body in via getArtifact and
    // mergeArtifactUpdate so this memo re-runs when the content lands.
    if (!taggedArtifact?.content) return null;
    const id = taggedArtifact.content.trim();
    return id.length > 0 ? id : null;
  }, [taggedArtifact]);

  type RenderState = 'loading' | 'missing-content' | 'ready';
  const renderState = useMemo<RenderState>(() => {
    if (!taggedArtifact) return 'loading';
    const trimmed = (taggedArtifact.content ?? '').trim();
    return trimmed.length > 0 ? 'ready' : 'missing-content';
  }, [taggedArtifact]);

  const handleReload = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  }, []);

  // Defense in depth against the "artifact tagged, content missing" race:
  // /api/artifacts/list inlines content for non-binary artifacts (so this
  // path normally never fires), but if we ever land in the metadata-only
  // window — bootstrap response in flight, an older client cache, etc. —
  // pull the content body explicitly. mergeArtifactUpdate inside
  // getArtifact will refresh the artifact in the context, the
  // taggedArtifact memo re-runs, and the tile renders the play CTA.
  //
  // The ref tracks artifact ids we've already fetched so we don't loop:
  // if the read genuinely returns empty content (e.g. orchestrator wrote
  // the tag before writing the body), repeated invocations would just
  // hammer the API.
  const fetchedContentForIds = useRef(new Set<string>());
  useEffect(() => {
    if (!taggedArtifact) return;
    if (taggedArtifact.content) return;
    if (fetchedContentForIds.current.has(taggedArtifact.id)) return;
    fetchedContentForIds.current.add(taggedArtifact.id);
    // Fire-and-forget; the result lands via mergeArtifactUpdate.
    void getArtifact(taggedArtifact.id);
  }, [taggedArtifact, getArtifact]);

  const [meta, setMeta] = useState<{
    title: string;
    description?: string;
    previewImageUrl?: string;
  } | null>(null);

  useEffect(() => {
    if (!builtExperienceId) return;
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(
          `/api/storage/${builtExperienceId}/experience.json`,
        );
        if (!res.ok) return;
        const cfg = await res.json();
        if (cancelled) return;
        const firstScene = cfg?.resources?.scenes?.[0];
        setMeta({
          title: cfg?.title ?? builtExperienceId!,
          description: cfg?.description,
          previewImageUrl: firstScene
            ? `/api/storage/${builtExperienceId}/${firstScene}`
            : undefined,
        });
      } catch {
        // Network/parse failure — leave meta null; tile renders the
        // experience id as a fallback title and the user can still
        // click through to the play route.
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [builtExperienceId]);

  // Subscribe to phase-failure events. Result phases rarely fail (the heavy
  // build work happens in the prior phase), but if the orchestrator does
  // emit a destructive toast here, surface a retry rather than leaving the
  // user staring at a missing tile with no way to ask for help.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as
        | { phaseId?: string; message?: string }
        | undefined;
      if (!detail) return;
      if (detail.phaseId && detail.phaseId !== phase.id) return;
      setFailureMessage(detail.message ?? 'Something went wrong.');
    };
    window.addEventListener('phase-failure', handler);
    return () => window.removeEventListener('phase-failure', handler);
  }, [phase.id]);

  useEffect(() => {
    setFailureMessage(null);
  }, [phase.id]);

  const handleRetry = useCallback(() => {
    // Same wire as BuildPhaseSurface — piggyback on workflow-phase-change
    // so useAgentSwitching forwards a system message into the realtime
    // session on the current agent.
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('workflow-phase-change', {
          detail: {
            systemMessage:
              `[SYSTEM/phase_retry]\n` +
              `The user requested a retry for workflow phase ` +
              `"${phase.title}" (${phase.id}). The previous ` +
              `attempt failed. Inspect existing artifact state ` +
              `via tool calls (artifact discover) and re-run ` +
              `the failed step. Do NOT restart steps that ` +
              `already completed; resume from where the ` +
              `failure occurred.`,
            toAgent: undefined,
          },
        }),
      );
    }
    setFailureMessage(null);
  }, [phase.id, phase.title]);

  const playHref = builtExperienceId ? `/play/${builtExperienceId}` : null;

  const handleCopyLink = async () => {
    if (!playHref) return;
    const fullUrl =
      typeof window === 'undefined'
        ? playHref
        : new URL(playHref, window.location.origin).toString();
    try {
      await navigator.clipboard.writeText(fullUrl);
      toast({ title: 'Link copied to clipboard' });
    } catch {
      toast({
        title: 'Could not copy link',
        description: fullUrl,
        variant: 'destructive',
      });
    }
  };

  const heading = phase.heading ?? 'Your experience is ready!';
  return (
    <div className="flex flex-1 flex-col min-h-0">
      <div className="mb-6 flex flex-col items-center gap-1 px-4">
        <PhaseHeading>{heading}</PhaseHeading>
        <p className="text-base leading-6 text-muted-foreground text-center">
        You can now play the experience and share it with students.
        </p>
      </div>

      <div
        className="flex flex-1 items-start justify-center px-4"
        role="status"
        aria-live="polite"
      >
        <div className="flex w-full max-w-[470px] xl:max-w-2xl flex-col items-center gap-6">
          {renderState === 'missing-content' ? (
            <div
              className="flex flex-col items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center"
              role="alert"
            >
              <p className="text-base font-medium text-foreground">
                This build didn&apos;t link to a playable experience.
              </p>
              <p className="text-sm text-muted-foreground">
                Reload the page to retry.
              </p>
              <Button variant="outline" size="sm" onClick={handleReload}>
                <RotateCcw aria-hidden />
                Reload page
              </Button>
            </div>
          ) : renderState === 'ready' && meta && playHref ? (
            <ExperienceCard
              experience={{
                id: builtExperienceId!,
                title: meta.title,
                description: meta.description ?? '',
                version: '',
                previewImageUrl: meta.previewImageUrl,
                agents: [],
              }}
              copyLinkButton
              onCopyLink={handleCopyLink}
              viewDetailsButton={false}
            />
          ) : (
            <ExperienceCardSkeleton />
          )}

          {failureMessage && renderState !== 'missing-content' && (
            <div className="flex flex-col items-center gap-3" role="alert">
              <p className="text-sm text-destructive text-center">
                {failureMessage}
              </p>
              <Button variant="outline" size="sm" onClick={handleRetry}>
                <RotateCcw aria-hidden />
                Retry
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

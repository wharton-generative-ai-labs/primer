'use client';

import { useEffect } from 'react';
import { BuildingPanel } from '@/app/components/ExperienceBuildSequence';
import PlayShell from './PlayShell';

interface PlayErrorBoundaryProps {
    error: Error & { digest?: string };
    reset: () => void;
}

/**
 * Catches runtime errors thrown anywhere in the `/play/[id]` subtree that
 * weren't already converted into a {@link PlayErrorScreen} by `page.tsx`
 * — e.g. an exception inside `PlayClient`'s effect tree, a Suspense
 * boundary throw past the page-level try/catch (such as a `use()` call
 * unwrapping a rejected `sessionPromise`), or a render-phase failure.
 *
 * Mirrors the loading shell (same `PrimerBackground` + placeholder title
 * + card chrome) so users don't see a stark Next.js default error page.
 * The card itself is rendered via {@link BuildingPanel} in `error` mode,
 * which exposes a Return-to-home CTA. `reset()` is intentionally not
 * surfaced — these are post-mount failures whose root cause we have no
 * visibility into, and a "Try again" button risks looping the same crash.
 */
export default function PlayErrorBoundary({ error }: PlayErrorBoundaryProps) {
    useEffect(() => {
        // Client-side fallback only — server-side faults are already
        // pino-logged by the page RSC's catch blocks before this boundary
        // ever renders.
        console.error('[play] error boundary', { digest: error.digest, error });
    }, [error]);

    return (
        <PlayShell title="Your experience is being prepared.">
            <div className="flex h-full flex-col items-center justify-center gap-8 px-4">
                <BuildingPanel
                    mode={{
                        kind: 'error',
                        message:
                            'Something unexpected went wrong loading this Experience. Please return to the catalog and try again.',
                    }}
                />
            </div>
        </PlayShell>
    );
}

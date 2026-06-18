import { BuildingPanel } from '@/app/components/ExperienceBuildSequence';
import PlayShell from './PlayShell';

/**
 * Full-route loading UI for `/play/[id]`. Renders the same chrome the play
 * route paints once the RSC resolves — `PrimerBackground` (initial backdrop,
 * no reveal yet), `ExperienceTitle` (fixed placeholder copy shown until the
 * experience is fully ready), and the all-pending checklist from
 * {@link BuildingPanel}.
 *
 * Intentionally inert: no client cascade, no JS-driven animation. Real
 * progress signals from `ConfigLoader` start firing only after `PlayClient`
 * mounts, at which point its own `BuildingPanel` instance takes over via
 * Suspense; the user sees a smooth handoff because the all-pending paint
 * here matches the all-pending fallback {@link PlayClient} renders while it
 * unwraps the streamed `sessionPromise`.
 */
export default function PlayLoading() {
    return (
        <PlayShell title="Your experience is being prepared.">
            <div className="flex h-full flex-col items-center justify-start gap-6 px-4 pt-10">
                <BuildingPanel mode={{ kind: 'allPending' }} />
            </div>
        </PlayShell>
    );
}

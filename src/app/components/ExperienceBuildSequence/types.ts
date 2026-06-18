import type { LoadPhase } from '@/app/lib/ConfigLoader';

/**
 * Visible steps the {@link BuildingPanel} renders, in design display order.
 *
 * The first four values map 1:1 to {@link LoadPhase} events emitted by
 * `ConfigLoader`. The fifth, `starting-up`, is emitted by `PlayClientInner`
 * itself once the sound + scene managers have been initialized — it has no
 * `ConfigLoader` analogue.
 *
 * **Display order vs. real firing order:** the `ConfigLoader` always fires
 * `experience-data` → `media` → `tools-plugins` → `ai-models`. The design
 * displays them in a different order (`experience-data` → `ai-models` →
 * `media` → `tools-plugins` → `starting-up`). Consumers should populate a
 * `Set<BuildPhase>` of fired events and let the panel render its strict
 * top-down cascading reveal — see the docstring on {@link BuildingPanel} for
 * the cascading model.
 */
export type BuildPhase = LoadPhase | 'starting-up';

export const BUILD_STEPS: ReadonlyArray<{ phase: BuildPhase; label: string }> = [
    { phase: 'experience-data', label: 'Loading experience data' },
    { phase: 'ai-models', label: 'Configuring AI agents' },
    { phase: 'media', label: 'Loading instructions and content' },
    { phase: 'tools-plugins', label: 'Registering tools' },
    { phase: 'starting-up', label: 'Launching...' },
];

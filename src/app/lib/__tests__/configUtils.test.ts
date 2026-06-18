/**
 * @jest-environment jsdom
 *
 * Tests for the phase-fanout layer in `configUtils`. The interesting
 * behaviour lives in {@link getConfig}'s subscriber tracking — the loader
 * itself is mocked here so we can drive phase emissions on a deterministic
 * timeline (no network, no real `experience.json`).
 */

import type { LoadPhase, LoadPhaseCallback } from '../ConfigLoader/ConfigLoader';

interface MockLoaderControls {
    emit: (phase: LoadPhase) => void;
    finishExperience: () => void;
    finishConfig: (response: unknown) => void;
}

let pending: MockLoaderControls | null = null;

jest.mock('../ConfigLoader', () => {
    return {
        ConfigLoader: jest.fn().mockImplementation(() => ({
            loadExperience: jest.fn(
                (_path: string, onPhase?: LoadPhaseCallback) =>
                    new Promise<void>((resolve) => {
                        const controls: MockLoaderControls = {
                            emit: (phase) => onPhase?.(phase),
                            finishExperience: () => resolve(),
                            finishConfig: () => {},
                        };
                        pending = { ...(pending ?? ({} as MockLoaderControls)), ...controls };
                    }),
            ),
            loadConfig: jest.fn(
                (onPhase?: LoadPhaseCallback) =>
                    new Promise<unknown>((resolve) => {
                        const controls: Partial<MockLoaderControls> = {
                            finishConfig: (response: unknown) => {
                                onPhase?.('ai-models');
                                resolve(response);
                            },
                        };
                        pending = { ...(pending ?? ({} as MockLoaderControls)), ...controls } as MockLoaderControls;
                    }),
            ),
            getValidationReport: jest.fn(() => ({ hasErrors: false })),
        })),
    };
});

jest.mock('../HttpLoader', () => ({
    HttpLoader: jest.fn().mockImplementation(() => ({
        basePath: '',
        seed: jest.fn(),
    })),
}));

jest.mock('../experience-url-utils', () => ({
    ExperienceURLError: class ExperienceURLError extends Error {},
    validateAndProcessExperienceURL: (url: string) => url,
}));

describe('configUtils phase fanout', () => {
    let getConfig: typeof import('../configUtils').getConfig;

    beforeEach(async () => {
        jest.resetModules();
        pending = null;
        // Re-import after resetModules so each test gets a fresh
        // currentEntry / lastConfigUrl module-level state.
        ({ getConfig } = await import('../configUtils'));
    });

    it('forwards phase events to the initial subscriber in firing order', async () => {
        const seen: LoadPhase[] = [];
        const promise = getConfig('https://example/exp1.json', (phase) => seen.push(phase));

        expect(pending).not.toBeNull();
        pending!.emit('experience-data');
        pending!.emit('media');
        pending!.emit('tools-plugins');
        pending!.finishExperience();
        await Promise.resolve();
        pending!.finishConfig({ ok: true });

        await promise;

        expect(seen).toEqual(['experience-data', 'media', 'tools-plugins', 'ai-models']);
    });

    it('replays already-resolved phases synchronously to a late subscriber', async () => {
        const first: LoadPhase[] = [];
        const promise = getConfig('https://example/exp2.json', (phase) => first.push(phase));

        expect(pending).not.toBeNull();
        pending!.emit('experience-data');
        pending!.emit('media');

        const late: LoadPhase[] = [];
        getConfig('https://example/exp2.json', (phase) => late.push(phase));

        // Late subscriber receives both already-emitted phases synchronously.
        expect(late).toEqual(['experience-data', 'media']);

        // Subsequent phases reach both subscribers.
        pending!.emit('tools-plugins');
        expect(first).toEqual(['experience-data', 'media', 'tools-plugins']);
        expect(late).toEqual(['experience-data', 'media', 'tools-plugins']);

        pending!.finishExperience();
        await Promise.resolve();
        pending!.finishConfig({ ok: true });
        await promise;

        expect(first).toEqual(['experience-data', 'media', 'tools-plugins', 'ai-models']);
        expect(late).toEqual(['experience-data', 'media', 'tools-plugins', 'ai-models']);
    });

    it('isolates phase tracking per memoized URL', async () => {
        const aSeen: LoadPhase[] = [];
        const promiseA = getConfig('https://example/expA.json', (phase) => aSeen.push(phase));
        // Silence the unhandled-rejection warning if this loader gets
        // abandoned by a URL switch — the test below intentionally swaps
        // currentEntry without finishing expA.
        promiseA.catch(() => undefined);

        pending!.emit('experience-data');
        pending!.emit('media');
        expect(aSeen).toEqual(['experience-data', 'media']);

        // Switching URLs creates a new entry; new subscribers should not
        // receive phases recorded for the previous URL.
        const bSeen: LoadPhase[] = [];
        const promiseB = getConfig('https://example/expB.json', (phase) =>
            bSeen.push(phase),
        );
        expect(bSeen).toEqual([]);

        pending!.emit('experience-data');
        expect(bSeen).toEqual(['experience-data']);

        // expA's subscriber sees no events from expB's load.
        expect(aSeen).toEqual(['experience-data', 'media']);

        pending!.finishExperience();
        await Promise.resolve();
        pending!.finishConfig({ ok: true });
        await promiseB;
    });

    it('survives a subscriber that throws without disrupting siblings', async () => {
        const seen: LoadPhase[] = [];
        getConfig('https://example/expC.json', () => {
            throw new Error('subscriber blew up');
        });
        getConfig('https://example/expC.json', (phase) => seen.push(phase));

        pending!.emit('experience-data');
        expect(seen).toEqual(['experience-data']);
    });
});

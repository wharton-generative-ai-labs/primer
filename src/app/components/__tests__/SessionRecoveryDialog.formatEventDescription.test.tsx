/**
 * @jest-environment jsdom
 */

import { formatEventDescription } from '../SessionRecoveryDialog';
import { SESSION_EVENTS, SessionEvent } from '../../lib/file-utils';

const baseEvent = (overrides: Partial<SessionEvent>): SessionEvent => ({
    event: 'unknown',
    agent: 'system',
    timestamp: '2026-01-01T00:00:00Z',
    ...overrides,
});

describe('formatEventDescription', () => {
    it('describes session_started', () => {
        expect(
            formatEventDescription(
                baseEvent({ event: SESSION_EVENTS.SESSION_STARTED }),
            ),
        ).toBe('Session started');
    });

    it('describes session_completed', () => {
        expect(
            formatEventDescription(
                baseEvent({ event: SESSION_EVENTS.SESSION_COMPLETED }),
            ),
        ).toBe('Experience completed');
    });

    it('describes phase_completed with phase data', () => {
        expect(
            formatEventDescription(
                baseEvent({
                    event: SESSION_EVENTS.PHASE_COMPLETED,
                    data: { phase: 'design' },
                }),
            ),
        ).toBe('Phase "design" marked complete');
    });

    it('describes workflow_phase_entered with phase id', () => {
        expect(
            formatEventDescription(
                baseEvent({
                    event: SESSION_EVENTS.WORKFLOW_PHASE_ENTERED,
                    data: { phase: 'design' },
                }),
            ),
        ).toBe('Entered: design');
    });

    it('describes workflow_phase_entered without phase id', () => {
        expect(
            formatEventDescription(
                baseEvent({ event: SESSION_EVENTS.WORKFLOW_PHASE_ENTERED }),
            ),
        ).toBe('Entered phase');
    });

    it('describes workflow_phase_left with phase id', () => {
        expect(
            formatEventDescription(
                baseEvent({
                    event: SESSION_EVENTS.WORKFLOW_PHASE_LEFT,
                    data: { phase: 'intro' },
                }),
            ),
        ).toBe('Left: intro');
    });

    it('describes workflow_phase_skipped with skipped count', () => {
        expect(
            formatEventDescription(
                baseEvent({
                    event: SESSION_EVENTS.WORKFLOW_PHASE_SKIPPED,
                    data: { skipped: ['phase-2', 'phase-3'] },
                }),
            ),
        ).toBe('Skipped 2 phase(s)');
    });

    it('describes workflow_phase_skipped with no skipped data', () => {
        expect(
            formatEventDescription(
                baseEvent({ event: SESSION_EVENTS.WORKFLOW_PHASE_SKIPPED }),
            ),
        ).toBe('Skipped 0 phase(s)');
    });

    it('describes workflow_phase_revisited with phase id', () => {
        expect(
            formatEventDescription(
                baseEvent({
                    event: SESSION_EVENTS.WORKFLOW_PHASE_REVISITED,
                    data: { phase: 'design' },
                }),
            ),
        ).toBe('Revisited: design');
    });

    it('describes workflow_next_overridden with phase id', () => {
        expect(
            formatEventDescription(
                baseEvent({
                    event: SESSION_EVENTS.WORKFLOW_NEXT_OVERRIDDEN,
                    data: { phase: 'phase-3' },
                }),
            ),
        ).toBe('Next phase set to: phase-3');
    });

    it('describes experience_completed', () => {
        expect(
            formatEventDescription(
                baseEvent({ event: SESSION_EVENTS.EXPERIENCE_COMPLETED }),
            ),
        ).toBe('Experience completed');
    });

    it('describes experience_rewound', () => {
        expect(
            formatEventDescription(
                baseEvent({ event: SESSION_EVENTS.EXPERIENCE_REWOUND }),
            ),
        ).toBe('Experience rewound');
    });

    it('falls back to humanized event name for unknown events', () => {
        expect(
            formatEventDescription(
                baseEvent({ event: 'something_custom_happened' }),
            ),
        ).toBe('something custom happened');
    });
});

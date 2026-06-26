/**
 * @jest-environment jsdom
 *
 * Tests for `useTranscriptPersistence`.
 *
 * Behavior under test:
 *  - Debounced writes to the `conversation_transcript` artifact via the
 *    ArtifactContext `createArtifact` API.
 *  - No-op skip when the rendered markdown hasn't changed since the last
 *    successful write.
 *  - Disabled (no `autoTranscript` flag) means the hook never writes.
 *  - Unmount flushes a pending write so the conversation tail isn't lost.
 *
 * The hook reads from `useTranscript` and `useArtifact`; we mock those
 * modules so the test focuses purely on the persistence loop without
 * dragging in next-auth, the realtime client, or the artifact API.
 */

import React from 'react';
import { act, render } from '@testing-library/react';

import type { TranscriptItem } from '@/app/lib/types';

// Mutable refs accessed by the mocked context hooks below.
let mockTranscriptItems: TranscriptItem[] = [];
let mockCreateArtifact: jest.Mock = jest.fn();

jest.mock('@/app/contexts/TranscriptContext', () => ({
  useTranscript: () => ({
    transcriptItems: mockTranscriptItems,
    addTranscriptMessage: jest.fn(),
    updateTranscriptMessage: jest.fn(),
    addTranscriptBreadcrumb: jest.fn(),
    addTranscriptBreadcrumbWithId: jest.fn(),
    addTranscriptHandoff: jest.fn(),
    addTranscriptToolError: jest.fn(),
    updateTranscriptBreadcrumb: jest.fn(),
    toggleTranscriptItemExpand: jest.fn(),
    updateTranscriptItemStatus: jest.fn(),
    clearTranscript: jest.fn(),
    setActiveAgent: jest.fn(),
    activeAgent: null,
  }),
}));

jest.mock('@/app/contexts/ArtifactContext', () => ({
  useArtifact: () => ({
    createArtifact: mockCreateArtifact,
  }),
}));

import { useTranscriptPersistence } from '@/app/hooks/useTranscriptPersistence';

function userMessage(itemId: string, text: string): TranscriptItem {
  return {
    itemId,
    type: 'MESSAGE',
    role: 'user',
    title: text,
    expanded: false,
    timestamp: '12:34:56 PM',
    createdAtMs: Date.now(),
    status: 'DONE',
    isHidden: false,
  };
}

function assistantMessage(itemId: string, text: string): TranscriptItem {
  return {
    itemId,
    type: 'MESSAGE',
    role: 'assistant',
    title: text,
    expanded: false,
    timestamp: '12:35:02 PM',
    createdAtMs: Date.now(),
    status: 'DONE',
    isHidden: false,
    agentName: 'Intake',
  };
}

function Harness({
  enabled = true,
  debounceMs,
}: {
  enabled?: boolean;
  debounceMs?: number;
}) {
  useTranscriptPersistence({ enabled, debounceMs });
  return null;
}

describe('useTranscriptPersistence', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockTranscriptItems = [];
    mockCreateArtifact = jest.fn().mockResolvedValue({ id: 'conversation_transcript' });
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('writes the rendered transcript to the artifact after the debounce window', async () => {
    mockTranscriptItems = [
      userMessage('u1', 'What can you build?'),
      assistantMessage('a1', "Tell me about your class."),
    ];

    render(<Harness debounceMs={1000} />);

    // Before the debounce fires, nothing is written.
    expect(mockCreateArtifact).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    expect(mockCreateArtifact).toHaveBeenCalledTimes(1);
    const [name, content, type, metadata] = mockCreateArtifact.mock.calls[0];
    expect(name).toBe('conversation_transcript');
    expect(type).toBe('markdown');
    expect(content).toContain('# Conversation Transcript');
    expect(content).toContain('What can you build?');
    expect(content).toContain('**Intake**');
    expect(metadata?.tags).toContain('system:transcript');
  });

  it('skips a redundant write when the rendered markdown is unchanged', async () => {
    mockTranscriptItems = [userMessage('u1', 'Hi')];

    const { rerender } = render(<Harness debounceMs={1000} />);

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(mockCreateArtifact).toHaveBeenCalledTimes(1);

    // Re-render with the same items — debounce reschedules but content is
    // identical, so no second write.
    rerender(<Harness debounceMs={1000} />);
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(mockCreateArtifact).toHaveBeenCalledTimes(1);
  });

  it('does nothing when disabled', async () => {
    mockTranscriptItems = [userMessage('u1', 'Hello')];

    render(<Harness enabled={false} debounceMs={500} />);

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });

    expect(mockCreateArtifact).not.toHaveBeenCalled();
  });

  it('flushes a pending write on unmount so the conversation tail lands', async () => {
    mockTranscriptItems = [userMessage('u1', 'Last message before nav-away')];

    const { unmount } = render(<Harness debounceMs={1500} />);

    // Unmount before the debounce timer fires.
    await act(async () => {
      unmount();
    });
    // Flush any microtasks the cleanup triggered.
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockCreateArtifact).toHaveBeenCalledTimes(1);
    expect(mockCreateArtifact.mock.calls[0][1]).toContain('Last message before nav-away');
  });

  it('coalesces multiple item changes into one write per debounce window', async () => {
    mockTranscriptItems = [userMessage('u1', 'first')];
    const { rerender } = render(<Harness debounceMs={1000} />);

    // Before the timer fires, the items list grows three more times. The
    // debounce should reset on each change so only the last snapshot lands.
    mockTranscriptItems = [
      userMessage('u1', 'first'),
      assistantMessage('a1', 'second'),
    ];
    rerender(<Harness debounceMs={1000} />);
    mockTranscriptItems = [
      userMessage('u1', 'first'),
      assistantMessage('a1', 'second'),
      userMessage('u2', 'third'),
    ];
    rerender(<Harness debounceMs={1000} />);

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    expect(mockCreateArtifact).toHaveBeenCalledTimes(1);
    const content = mockCreateArtifact.mock.calls[0][1];
    expect(content).toContain('third');
  });
});

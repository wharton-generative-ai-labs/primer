/**
 * @jest-environment jsdom
 *
 * Tests for the workflow phase strip footer that lives inside
 * `DocumentPanel`. The strip used to be rendered at the page-shell level in
 * `PlayPage.tsx`; it now sits at the bottom of the document panel card so
 * the navigation chrome stays attached to the document context.
 *
 * The strip's own behavior (Back/Next, label format, override indicator) is
 * covered by `WorkflowPhaseStrip.test.tsx`. Here we mock the strip with a
 * marker stub so the assertions are about *integration* — does
 * `DocumentPanel` mount the footer when (and only when) phases are present,
 * and does it forward `showPhaseCount`?
 */

import React from 'react';
import { render, screen } from '@testing-library/react';

import type { WorkflowPhaseConfig } from '@/app/lib/workflow-phases';
import type { WorkflowPhaseContextValue } from '@/app/contexts/WorkflowPhaseContext';

// react-markdown / remark-gfm ship ESM-only; ts-jest can't transform them.
// Stub them out — we never assert on rendered markdown, and the active-doc
// branch isn't reached because we keep documentTab on 'library'.
jest.mock('react-markdown', () => ({
  __esModule: true,
  default: ({ children }: { children?: React.ReactNode }) =>
    React.createElement('div', null, children),
}));
jest.mock('remark-gfm', () => ({ __esModule: true, default: () => null }));

// AnimatePresence/motion.* stubbed the same way ExperienceBuildSequence's
// test does — pass children through, strip framer-only props.
jest.mock('framer-motion', () => ({
  __esModule: true,
  AnimatePresence: ({ children }: { children?: React.ReactNode }) => children,
  motion: new Proxy(
    {},
    {
      get:
        (_target, key: string) =>
        ({
          children,
          ...rest
        }: { children?: React.ReactNode } & Record<string, unknown>) =>
          React.createElement(key, rest, children),
    },
  ),
}));

// Heavy sibling components imported at the top of PlayPageSplitContent.
// DocumentPanel never renders them in our test scenarios, but they load on
// module evaluation, so cheap stubs keep the import chain quiet.
jest.mock('@/app/components/PlayPage/ChatPanel', () => ({
  ChatPanel: () => null,
}));
jest.mock('@/app/lib/tools/ui/mermaid/index', () => ({
  __esModule: true,
  MermaidDiagram: () => null,
}));

// Replace WorkflowPhaseStrip with a marker so we can assert presence and
// inspect the props it received. This keeps the test focused on the
// DocumentPanel integration rather than re-validating strip internals.
jest.mock('@/app/components/WorkflowPhaseStrip/WorkflowPhaseStrip', () => ({
  __esModule: true,
  WorkflowPhaseStrip: ({ showPhaseCount }: { showPhaseCount?: boolean }) =>
    React.createElement('div', {
      'data-testid': 'workflow-phase-strip',
      'data-show-phase-count':
        showPhaseCount === undefined ? 'undefined' : String(showPhaseCount),
    }),
}));

// Notes subscription — DocumentPanel's mount effect calls into the manager.
// Provide a no-op subscription that returns zero notes.
jest.mock('@/app/lib/tools/ui/notes/NotesManager', () => ({
  __esModule: true,
  getNotesManager: () => ({ getVisibleNotes: () => [] }),
  subscribeToStateUpdates: () => () => {},
}));

// LibraryView is the documentTab='library' body. Stub it so we don't need
// to wire artifact revisions; the footer renders alongside the body
// regardless of which tab is active.
jest.mock('@/app/components/PlayPage/LibraryView', () => ({
  __esModule: true,
  LibraryView: () => null,
  buildAllDocumentsList: () => [],
}));

// ChecklistContent is only mounted when documentTab='checklist'. Stub for
// safety in case future cases change the default tab.
jest.mock('@/app/components/ChecklistContent', () => ({
  __esModule: true,
  ChecklistContent: () => null,
}));

// Drive the contexts that DocumentPanel reads. Each test seeds the
// workflow-phase value via the mock; artifact + layout values are static.
jest.mock('@/app/contexts/ArtifactContext', () => ({
  __esModule: true,
  useArtifact: () => ({
    activeContent: undefined,
    library: [],
    viewedContent: undefined,
    viewDocument: jest.fn(),
    clearContent: jest.fn(),
    activeChecklistId: null,
    setFocusedRev: jest.fn(),
    restoreRevision: jest.fn(),
  }),
}));

jest.mock('@/app/contexts/LayoutContext', () => ({
  __esModule: true,
  useLayout: () => ({
    documentTab: 'library',
    setDocumentTab: jest.fn(),
    getWorkspaceLayout: () => 'document-only',
  }),
}));

const mockUseWorkflowPhase = jest.fn<WorkflowPhaseContextValue, []>();
jest.mock('@/app/contexts/WorkflowPhaseContext', () => ({
  __esModule: true,
  useWorkflowPhase: () => mockUseWorkflowPhase(),
}));

// `import` after mocks so the module under test picks up the stubs.
import { DocumentPanel } from '../PlayPageSplitContent';

const PHASES: WorkflowPhaseConfig[] = [
  { id: 'intro', title: 'Intro' },
  { id: 'pitch', title: 'Pitch' },
];

function buildPhaseValue(
  overrides: Partial<WorkflowPhaseContextValue> = {},
): WorkflowPhaseContextValue {
  return {
    phases: PHASES,
    currentPhase: PHASES[0],
    furthestPhase: PHASES[0],
    visited: ['intro'],
    completedPhases: [],
    nextPhaseOverride: undefined,
    experienceCompleted: false,
    isLoading: false,
    goToPhase: jest.fn().mockResolvedValue(undefined),
    advance: jest.fn().mockResolvedValue(undefined),
    goBack: jest.fn().mockResolvedValue(undefined),
    resolvedNextPhaseId: 'pitch',
    ...overrides,
  };
}

beforeEach(() => {
  mockUseWorkflowPhase.mockReset();
});

describe('<DocumentPanel /> — workflow phase strip footer', () => {
  it('renders the phase strip footer when phases.length > 0', () => {
    mockUseWorkflowPhase.mockReturnValue(buildPhaseValue());
    render(<DocumentPanel />);
    expect(screen.getByTestId('workflow-phase-strip')).toBeInTheDocument();
  });

  it('does NOT render the phase strip when phases is empty', () => {
    mockUseWorkflowPhase.mockReturnValue(
      buildPhaseValue({
        phases: [],
        currentPhase: undefined,
        furthestPhase: undefined,
        visited: [],
        resolvedNextPhaseId: undefined,
      }),
    );
    render(<DocumentPanel />);
    expect(
      screen.queryByTestId('workflow-phase-strip'),
    ).not.toBeInTheDocument();
  });

  it('forwards showPhaseCount=false to the strip', () => {
    mockUseWorkflowPhase.mockReturnValue(buildPhaseValue());
    render(<DocumentPanel showPhaseCount={false} />);
    expect(screen.getByTestId('workflow-phase-strip')).toHaveAttribute(
      'data-show-phase-count',
      'false',
    );
  });

  it('forwards showPhaseCount=true to the strip', () => {
    mockUseWorkflowPhase.mockReturnValue(buildPhaseValue());
    render(<DocumentPanel showPhaseCount={true} />);
    expect(screen.getByTestId('workflow-phase-strip')).toHaveAttribute(
      'data-show-phase-count',
      'true',
    );
  });

  it('passes undefined showPhaseCount through unchanged (lets the strip apply its default)', () => {
    mockUseWorkflowPhase.mockReturnValue(buildPhaseValue());
    render(<DocumentPanel />);
    expect(screen.getByTestId('workflow-phase-strip')).toHaveAttribute(
      'data-show-phase-count',
      'undefined',
    );
  });

  it('renders the strip after the document body so it acts as a footer', () => {
    mockUseWorkflowPhase.mockReturnValue(buildPhaseValue());
    const { container } = render(<DocumentPanel />);
    // The outer DocumentPanel root is the only top-level child of the
    // testing-library container's root div. Its lastElementChild should be
    // the strip — the body region (tabs + scroll area) sits above it.
    const root = container.firstElementChild as HTMLElement;
    expect(root).not.toBeNull();
    const last = root.lastElementChild as HTMLElement;
    expect(last).toHaveAttribute('data-testid', 'workflow-phase-strip');
  });
});

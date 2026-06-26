import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ActiveContent } from '@/app/contexts/ArtifactContext';
import type { ArtifactRevisionMeta } from '@/app/lib/artifacts/types';

// Stub the artifact context so we can drive LibraryView with a fixed
// (artifacts, revisionsByArtifact) snapshot per test instead of standing
// up the full provider + experience url + session storage chain.
const mockArtifactState = {
  artifacts: [] as Array<{ id: string; name: string; type: string; currentRev?: number }>,
  revisionsByArtifact: {} as Record<string, ArtifactRevisionMeta[] | undefined>,
};

jest.mock('@/app/contexts/ArtifactContext', () => {
  const actual = jest.requireActual('@/app/contexts/ArtifactContext');
  return {
    ...actual,
    useArtifact: () => ({
      artifacts: mockArtifactState.artifacts,
      revisionsByArtifact: mockArtifactState.revisionsByArtifact,
    }),
  };
});

// ArtifactProvider isn't needed because LibraryView only pulls artifacts +
// revisionsByArtifact via the mocked hook above. Importing the dedicated
// module (rather than re-exporting through PlayPageSplitContent) keeps the
// test out of react-markdown's ESM transform path.
import { LibraryView, buildAllDocumentsList } from '../LibraryView';

function makeRev(rev: number, authorName: string, msAgo: number): ArtifactRevisionMeta {
  return {
    rev,
    artifactId: 'art1',
    contentHash: `h-${rev}`,
    author: { kind: 'agent', agentKey: authorName.toLowerCase(), name: authorName },
    parentRev: rev === 1 ? null : rev - 1,
    createdAt: new Date(Date.now() - msAgo).toISOString(),
  };
}

const docItem = (id: string, name: string, artifactId?: string): ActiveContent => ({
  kind: 'document',
  id,
  name,
  content: '',
  artifactId,
});

afterEach(() => {
  mockArtifactState.artifacts = [];
  mockArtifactState.revisionsByArtifact = {};
});

describe('LibraryView', () => {
  it('renders empty-state copy when library is empty', () => {
    render(
      <LibraryView library={[]} onOpenRevision={jest.fn()} onRestoreRevision={jest.fn()} />,
    );
    expect(
      screen.getByText(/past documents will appear here/i),
    ).toBeInTheDocument();
  });

  it('does not render any dismiss controls (designer QA: dismiss removed)', () => {
    mockArtifactState.artifacts = [
      { id: 'art1', name: 'Design', type: 'markdown', currentRev: 1 },
    ];
    mockArtifactState.revisionsByArtifact = {
      art1: [makeRev(1, 'Hal', 60_000 * 5)],
    };

    render(
      <LibraryView
        library={[docItem('art1', 'Design'), docItem('art2', 'Pending')]}
        onOpenRevision={jest.fn()}
        onRestoreRevision={jest.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: /dismiss/i })).toBeNull();
    expect(screen.queryByLabelText(/dismiss/i)).toBeNull();
  });

  it('renders one row per revision (newest first) for a doc with multiple revs', () => {
    mockArtifactState.artifacts = [
      { id: 'art1', name: 'Design', type: 'markdown', currentRev: 3 },
    ];
    mockArtifactState.revisionsByArtifact = {
      art1: [
        makeRev(1, 'Hal', 60_000 * 30),
        makeRev(2, 'Hal', 60_000 * 15),
        makeRev(3, 'Carol', 60_000 * 2),
      ],
    };

    render(
      <LibraryView
        library={[docItem('art1', 'Design')]}
        onOpenRevision={jest.fn()}
        onRestoreRevision={jest.fn()}
      />,
    );

    // Expect three "Version N" rows. Order matches newest-first.
    const rows = screen.getAllByRole('button', { name: /version \d/i });
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent(/version 3/i);
    expect(rows[1]).toHaveTextContent(/version 2/i);
    expect(rows[2]).toHaveTextContent(/version 1/i);
    // The newest row should also surface the author name (Carol).
    expect(rows[0]).toHaveTextContent(/Carol/);
  });

  it('clicking a revision row invokes onOpenRevision with that rev number', async () => {
    const user = userEvent.setup();
    const onOpenRevision = jest.fn();
    mockArtifactState.artifacts = [
      { id: 'art1', name: 'Design', type: 'markdown', currentRev: 2 },
    ];
    mockArtifactState.revisionsByArtifact = {
      art1: [makeRev(1, 'Hal', 60_000 * 10), makeRev(2, 'Hal', 60_000 * 1)],
    };
    const item = docItem('art1', 'Design');

    render(
      <LibraryView
        library={[item]}
        onOpenRevision={onOpenRevision}
        onRestoreRevision={jest.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /version 1/i }));
    expect(onOpenRevision).toHaveBeenCalledTimes(1);
    expect(onOpenRevision.mock.calls[0][0].id).toBe('art1');
    expect(onOpenRevision.mock.calls[0][1]).toBe(1);
  });

  it('falls back to a single-row tile when revisions sidecar is not loaded', async () => {
    const user = userEvent.setup();
    const onOpenRevision = jest.fn();
    // Simulate the moment after a doc is shown but before its revisions
    // have hydrated (cache miss). The tile should still render and click.
    mockArtifactState.artifacts = [
      { id: 'art1', name: 'Pending', type: 'markdown', currentRev: 1 },
    ];
    mockArtifactState.revisionsByArtifact = {};

    render(
      <LibraryView
        library={[docItem('art1', 'Pending')]}
        onOpenRevision={onOpenRevision}
        onRestoreRevision={jest.fn()}
      />,
    );

    // No "Version N" rows — only the single tile button. Match by the kind
    // suffix the tile renders ("Pending document") so the assertion stays
    // robust if the doc name is reused elsewhere in the row.
    expect(screen.queryByRole('button', { name: /version \d/i })).toBeNull();
    const tile = screen.getByRole('button', { name: /pending\s+document/i });
    await user.click(tile);
    expect(onOpenRevision).toHaveBeenCalledTimes(1);
    // Fallback path passes no rev so the caller leaves focusedRev untouched.
    expect(onOpenRevision.mock.calls[0][1]).toBeUndefined();
  });

  it('renders the active doc tile when only an active doc is provided (no past entries)', () => {
    mockArtifactState.artifacts = [
      { id: 'lorem', name: 'Lorem Ipsum', type: 'markdown', currentRev: 3 },
    ];
    mockArtifactState.revisionsByArtifact = {
      lorem: [
        makeRev(1, 'Hal', 60_000 * 30),
        makeRev(2, 'Hal', 60_000 * 15),
        makeRev(3, 'Hal', 60_000 * 2),
      ],
    };
    // Mirrors what DocumentPanel passes when the agent has only ever shown
    // one doc this session — buildAllDocumentsList prepends activeContent.
    const list = buildAllDocumentsList(
      docItem('slide-uuid-1', 'Lorem Ipsum', 'lorem'),
      [],
    );

    render(
      <LibraryView
        library={list}
        onOpenRevision={jest.fn()}
        onRestoreRevision={jest.fn()}
      />,
    );

    // Empty-state copy must NOT render — there is one doc to show.
    expect(
      screen.queryByText(/past documents will appear here/i),
    ).toBeNull();
    expect(screen.getByText('Lorem Ipsum')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /version \d/i })).toHaveLength(3);
  });
});

describe('buildAllDocumentsList', () => {
  it('returns library unchanged when there is no active content', () => {
    const lib = [docItem('a', 'A', 'a-art'), docItem('b', 'B', 'b-art')];
    expect(buildAllDocumentsList(null, lib)).toEqual(lib);
  });

  it('prepends active content when library is empty', () => {
    const active = docItem('slide-1', 'Lorem Ipsum', 'lorem');
    expect(buildAllDocumentsList(active, [])).toEqual([active]);
  });

  it('prepends active content to library, preserving order of past entries', () => {
    const active = docItem('slide-active', 'Active Doc', 'active-art');
    const lib = [docItem('slide-foo', 'Foo', 'foo-art'), docItem('slide-bar', 'Bar', 'bar-art')];
    expect(buildAllDocumentsList(active, lib)).toEqual([active, ...lib]);
  });

  it('drops a library entry whose document artifactId matches the active doc', () => {
    // Defensive: the showContent / seedPanelState dedup already prevents
    // this, but if a stale entry slips through we must not render the
    // active doc twice in All Documents.
    const active = docItem('slide-new', 'Lorem Ipsum', 'lorem');
    const stale = docItem('slide-old', 'Lorem Ipsum', 'lorem');
    const other = docItem('slide-foo', 'Foo', 'foo-art');
    expect(buildAllDocumentsList(active, [stale, other])).toEqual([active, other]);
  });

  it('drops a library entry matching by id when the doc has no artifactId (ad-hoc slide)', () => {
    const active: ActiveContent = { kind: 'document', id: 'slide-x', name: 'Ad-hoc', content: '' };
    const stale: ActiveContent = { kind: 'document', id: 'slide-x', name: 'Ad-hoc', content: '' };
    const other = docItem('slide-y', 'Other', 'other-art');
    expect(buildAllDocumentsList(active, [stale, other])).toEqual([active, other]);
  });
});

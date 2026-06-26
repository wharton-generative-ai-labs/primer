import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VersionSwitcher } from '../VersionSwitcher';
import type { ArtifactRevisionMeta } from '@/app/lib/artifacts/types';

// Three revs spaced 5 / 2 minutes ago. Hardcoded ISO timestamps via
// Date.now() at test setup so getRelativeTimeString resolves to stable
// "X minutes ago" strings for the trigger-label assertions below.
function makeRevs(): ArtifactRevisionMeta[] {
  const now = Date.now();
  const make = (rev: number, msAgo: number, name: string): ArtifactRevisionMeta => ({
    rev,
    artifactId: 'art1',
    contentHash: `hash-${rev}`,
    author: { kind: 'user', email: `${name.toLowerCase()}@x`, name },
    parentRev: rev === 1 ? null : rev - 1,
    createdAt: new Date(now - msAgo).toISOString(),
  });
  return [
    make(1, 1000 * 60 * 60, 'Alice'),
    make(2, 1000 * 60 * 30, 'Bob'),
    make(3, 1000 * 60 * 5, 'Carol'),
  ];
}

describe('VersionSwitcher', () => {
  it('is hidden when currentRev <= 1', () => {
    const { container } = render(
      <VersionSwitcher
        artifactId="art1"
        currentRev={1}
        focusedRev={1}
        revisions={undefined}
        onOpen={jest.fn()}
        onSelectRev={jest.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders trigger as "Latest version" when focusedRev === currentRev', () => {
    render(
      <VersionSwitcher
        artifactId="art1"
        currentRev={3}
        focusedRev={3}
        revisions={makeRevs()}
        onOpen={jest.fn()}
        onSelectRev={jest.fn()}
      />,
    );
    // Radix renders the SelectValue text inside the trigger; using the
    // accessible name (aria-label) to find it would also surface the
    // child label, so target the trigger by role and assert its text.
    const trigger = screen.getByRole('combobox', { name: /document version/i });
    expect(trigger).toHaveTextContent(/latest version/i);
  });

  it('renders trigger as "Version N · time" when focusedRev < currentRev', () => {
    render(
      <VersionSwitcher
        artifactId="art1"
        currentRev={3}
        focusedRev={2}
        revisions={makeRevs()}
        onOpen={jest.fn()}
        onSelectRev={jest.fn()}
      />,
    );
    const trigger = screen.getByRole('combobox', { name: /document version/i });
    // Body shape: "Version 2 · {relative time}". We don't pin the exact
    // relative time string (locale + minute jitter) — just that "Version 2"
    // appears so we know textValue is being honored over the historical
    // SelectItem instead of the head one.
    expect(trigger).toHaveTextContent(/version 2/i);
    expect(trigger).not.toHaveTextContent(/latest version/i);
  });

  it('opens on click and invokes onSelectRev when a historical rev is picked', async () => {
    const user = userEvent.setup();
    const onSelectRev = jest.fn();
    const onOpen = jest.fn();
    render(
      <VersionSwitcher
        artifactId="art1"
        currentRev={3}
        focusedRev={3}
        revisions={makeRevs()}
        onOpen={onOpen}
        onSelectRev={onSelectRev}
      />,
    );

    await user.click(screen.getByRole('combobox', { name: /document version/i }));

    // Pick "Version 1" — SelectItem renders the dropdown body ("Version 1
    // · Alice · {time}"), which is what role=option's accessible name
    // matches.
    const opt = await screen.findByRole('option', { name: /version 1.*alice/i });
    await user.click(opt);

    expect(onSelectRev).toHaveBeenCalledWith('art1', 1);
  });

  it('calls onOpen as a cache-miss safety net when revisions arrive lazily', async () => {
    const user = userEvent.setup();
    const onOpen = jest.fn();
    render(
      <VersionSwitcher
        artifactId="art1"
        currentRev={3}
        focusedRev={3}
        revisions={undefined}
        onOpen={onOpen}
        onSelectRev={jest.fn()}
      />,
    );

    await user.click(screen.getByRole('combobox', { name: /document version/i }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});

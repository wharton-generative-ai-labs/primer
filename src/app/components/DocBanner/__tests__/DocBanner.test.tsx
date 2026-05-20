import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DocBanner } from '../DocBanner';

describe('DocBanner', () => {
  it('renders nothing when currentRev <= 1 (first draft, no banner)', () => {
    const { container } = render(
      <DocBanner currentRev={1} focusedRev={1} onRestore={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders Updated row (success variant) when viewing latest with multiple revs', () => {
    render(<DocBanner currentRev={3} focusedRev={3} onRestore={() => {}} />);
    // Figma 153:2894 — single line, role="status", success variant, no
    // separate title element.
    const banner = screen.getByRole('status');
    expect(banner).toHaveTextContent(/Your simulation design has been successfully updated\./);
    expect(banner).toHaveClass('bg-success');
    // Restore button is Historical-only.
    expect(screen.queryByRole('button', { name: /Restore this version/i })).toBeNull();
  });

  it('renders Historical row (accent variant) with inline Restore when on an older rev', async () => {
    const user = userEvent.setup();
    const onRestore = jest.fn();
    render(<DocBanner currentRev={3} focusedRev={2} onRestore={onRestore} />);
    const banner = screen.getByRole('status');
    expect(banner).toHaveTextContent(/Viewing version 2 of 3\./);
    expect(banner).toHaveClass('bg-accent');
    // The Restore button must be a child of the same single-line banner row,
    // not a separate sibling — that's the "inline Restore" guarantee from
    // Figma 153:2894. `toContainElement` walks the subtree.
    const restore = screen.getByRole('button', { name: /Restore this version/i });
    expect(banner).toContainElement(restore);
    await user.click(restore);
    expect(onRestore).toHaveBeenCalledTimes(1);
  });
});

'use client';

import React from 'react';

/**
 * Audio toggle tile. Matches the designer's icon spec: rounded square,
 * green fill when ON, slate fill when OFF. A pulse ring signals that audio
 * is currently flowing (mic picking up user, or agent talking).
 */
export function AudioIconButton({
  onClick,
  on,
  title,
  children,
}: {
  onClick: () => void;
  on: boolean;
  pulsing?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-border transition-colors ${
        on
          ? 'bg-success text-success-foreground hover:bg-success/90'
          : 'bg-muted text-muted-foreground hover:bg-muted/80'
      }`}
    >
      {children}
    </button>
  );
}

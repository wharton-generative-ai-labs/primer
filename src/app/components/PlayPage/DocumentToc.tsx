'use client';

import type { ReactNode } from 'react';

export interface TocHeading {
  /** 1 / 2 / 3 — H4+ are intentionally excluded from the sidebar. */
  level: number;
  text: string;
  /** URL-safe id used as the heading's DOM id and the TOC link target. */
  slug: string;
  /** 1-based markdown source line; used to wire react-markdown nodes back to slugs. */
  line: number;
}

export function DocumentToc({
  headings,
  header,
}: {
  headings: TocHeading[];
  /** Optional node rendered at the top of the sidebar before the TOC list
   *  (e.g. the VersionSwitcher). Always visible regardless of heading count. */
  header?: ReactNode;
}) {
  const onJump = (slug: string) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const target = document.getElementById(slug);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const minLevel = headings.length > 0 ? Math.min(...headings.map((h) => h.level)) : 1;

  return (
    <aside className="sticky top-0 hidden w-[180px] shrink-0 self-start xl:w-[300px] lg:block">
      {header}
      {headings.length >= 2 && (
        <>
          <h2 className="pt-3 pb-0.5 text-base font-bold leading-6 text-foreground">In this document</h2>
          <ul className="list-disc pl-5 text-base leading-6 text-foreground">
            {headings.map((h) => (
              <li
                key={h.slug}
                className="pb-0.5"
                style={{ marginLeft: `${(h.level - minLevel) * 16}px` }}
              >
                <a
                  href={`#${h.slug}`}
                  onClick={onJump(h.slug)}
                  className="text-pretty underline underline-offset-2 hover:text-primary"
                >
                  {h.text}
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
    </aside>
  );
}

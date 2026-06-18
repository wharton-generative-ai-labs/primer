'use client';

import React from 'react';

export interface WelcomePanelImageProps {
    /**
     * URL of the welcome scene image (a scene file whose name starts with
     * `welcome` per `PlayClientInner`’s bootstrap). Required: when no welcome
     * scene exists, the play flow skips the welcome
     * phase entirely; this body is not rendered in that case.
     */
    sceneImageUrl: string;
    /**
     * Verbatim experience title from bootstrap — used for default `alt` when
     * {@link sceneImageAlt} is omitted.
     */
    title: string;
    /** Alt text for the welcome scene image. */
    sceneImageAlt?: string;
}

type WelcomePanelProps = WelcomePanelImageProps;

/**
 * Final pre-`PlayPage` panel — the welcome card. Matches Figma frame
 * `601:6748`: an 800×600 rounded card with the welcome scene image
 * inside (no header copy, no Begin button). The chrome is structurally
 * identical to the loading/ready cards (same `bg-background border
 * rounded-lg overflow-clip` pattern) so the morphing
 * `ExperienceBuildSequence` host can tween a single shared card
 * chrome from the small text card to the larger image card.
 *
 * Body is exposed as {@link WelcomePanelBody} so the morph host can swap
 * content while preserving the shared parent.
 */

const WelcomePanelBody: React.FC<WelcomePanelImageProps> = ({
    title,
    sceneImageUrl,
    sceneImageAlt,
}) => {
    return (
        <div className="relative w-full overflow-hidden aspect-[4/3]">
            {/*
              * Using <img> instead of next/image intentionally. The src is an
              * absolute URL built by ResourceManager against the /api/storage
              * route (a custom API handler, not a static file). next/image
              * optimization fetches the source server-side via /_next/image,
              * which fails against a dynamic route in the custom server setup.
              * fetchpriority="high" gives the same browser-level LCP hint as
              * next/image's priority prop; the storage route already returns
              * proper Cache-Control headers.
              */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={sceneImageUrl}
                alt={sceneImageAlt ?? title}
                className="block h-full w-full object-cover"
                decoding="async"
                fetchPriority="high"
            />
        </div>
    );
};

const WelcomePanel: React.FC<WelcomePanelProps> = (props) => {
    return (
        <div className="flex w-full items-center justify-center">
            <div className="relative aspect-[4/3] w-full max-w-[800px] overflow-hidden rounded-lg border bg-background shadow-lg">
                <WelcomePanelBody {...props} />
            </div>
        </div>
    );
};

export default WelcomePanel;
export { WelcomePanelBody };

/**
 * Layout constants for consistent spacing across the application
 * These values define the chrome (header/footer) dimensions and content area calculations
 */

// Header dimensions (mobile / desktop)
export const HEADER_HEIGHT_MOBILE = 40; // px - reduced from ~52px
export const HEADER_HEIGHT_DESKTOP = 56; // px - reduced from ~72px

// Footer dimensions (mobile / desktop)  
export const FOOTER_HEIGHT_MOBILE = 40; // px - reduced from ~52px
export const FOOTER_HEIGHT_DESKTOP = 56; // px - reduced from ~72px

// Gap between header/footer and content
export const CHROME_GAP = 4; // px - reduced from 8px

// Total vertical chrome space (header + footer + gaps)
export const TOTAL_CHROME_HEIGHT_MOBILE = HEADER_HEIGHT_MOBILE + FOOTER_HEIGHT_MOBILE + (CHROME_GAP * 2);
export const TOTAL_CHROME_HEIGHT_DESKTOP = HEADER_HEIGHT_DESKTOP + FOOTER_HEIGHT_DESKTOP + (CHROME_GAP * 2);

// Tailwind class helpers for consistent styling
export const HEADER_CLASSES = "p-1.5 md:p-2 backdrop-blur-lg bg-black/50 mb-1 relative min-h-[40px] md:min-h-[56px]";
export const FOOTER_CLASSES = "backdrop-blur-lg bg-black/50 mt-1 px-1 py-1.5 min-[460px]:px-2 min-[460px]:py-2";

// Content area positioning (for absolute positioned elements)
export const CONTENT_TOP_OFFSET = "top-[calc(40px+0.25rem)]"; // mobile: header + gap
export const CONTENT_TOP_OFFSET_MD = "md:top-[calc(56px+0.25rem)]"; // desktop: header + gap
export const CONTENT_BOTTOM_OFFSET = "bottom-[calc(40px+0.25rem)]"; // mobile: footer + gap
export const CONTENT_BOTTOM_OFFSET_MD = "md:bottom-[calc(56px+0.25rem)]"; // desktop: footer + gap

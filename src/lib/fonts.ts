import { Roboto_Flex } from 'next/font/google';

export const robotoFlex = Roboto_Flex({
  subsets: ['latin'],
  variable: '--font-roboto',
  display: 'swap',
  axes: ['wdth'],
});

/**
 * Minion Pro @font-face is declared in globals.css rather than via
 * next/font/local because fontkit (used internally by next/font) cannot parse
 * the CFF-flavored WOFF2 files and throws "Unknown font format".
 * optimizeFonts is disabled in next.config.ts to prevent the CSS scanner
 * from attempting to process these files.
 *
 * Fira Code @font-face is also declared in globals.css (as 'Fira Code Custom').
 *
 * License: Confirm with the team that distributing these files from the repo
 * is covered by the existing Wharton/Adobe agreement before merging.
 */

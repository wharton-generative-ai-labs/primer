/**
 * Impressed into `footerApiRef` by `PlayPage` so the play route can wire
 * the shared `Footer` (lesson) to the experience session.
 */
export type PlayPageFooterApi = {
  onRequestLeave: () => void
  onToggleTranscript: () => void
  onToggleEvents: () => void
  onToggleDebug: () => void
  onOpenInfo: () => void
}

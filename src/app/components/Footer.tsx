'use client'

import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { ArrowLeft, Bug, Info, MessageCircle, NotepadText, Pencil, ShieldCheck } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Permission } from '@/config/auth'
import { usePermissions } from '@/app/hooks/usePermissions'
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card'
import { Button } from '@/components/ui/button'
import { Toggle } from '@/components/ui/toggle'
import { getVersionInfo } from '../../version'

/** outline + light text on the dark lesson/home footer bar (plain buttons) */
const footerBtnOutline = cn(
  'border-white/30 bg-transparent text-white shadow-sm hover:bg-white/10 hover:text-white',
)

const footerBtnOutlineWithLabel = 'h-10 min-w-0 gap-1.5 px-6 sm:px-6'

/**
 * shadcn Toggle, styled as an outline icon button. Uses `pressed` (Switch-like)
 * with Radix `data-state=on` for the “active” look.
 */
const footerIconToggle = cn(
  'h-10 min-h-10 min-w-10 shrink-0 border border-white/30 bg-transparent p-0 text-white shadow-sm',
  'hover:bg-white/10 hover:text-white',
  '[&_svg]:!size-5',
)

export type FooterType = 'home' | 'modules' | 'builder' | 'lesson' | 'preview'

interface FooterProps {
  type?: FooterType
  className?: string
  /**
   * Text shown after "Currently running:". Defaults to `Primer <version>`
   * which is appropriate for the `home` variant. Other variants should
   * pass their own subject (e.g. "Experience Creator 0.16.0", "The Feedback Conversation").
   */
  runningSubject?: string

  // Left-cluster actions
  /** Used by `builder` / `lesson` (route navigation handled by parent). The `modules` variant uses `<Link href="/" />` instead. */
  onBack?: () => void
  onMakeChanges?: () => void   // shown on `preview`
  onLeftInfo?: () => void      // shown on `preview`
  onPublish?: () => void       // shown on `preview`

  // Right-cluster actions
  onInfo?: () => void          // shown on `builder` / `lesson` / `preview`
  onBug?: () => void           // shown on `builder` / `lesson` / `preview`
  /** Visual pressed state for the Bug (debug) button. */
  bugActive?: boolean
  /** Transcript / conversation panel toggle (e.g. Experience / lesson). */
  onTranscript?: () => void
  transcriptActive?: boolean
  onEvents?: () => void
  eventsActive?: boolean
}

const BACK_LABEL: Partial<Record<FooterType, string>> = {
  modules: 'Back to Experiences',
  builder: 'Leave Creator',
  lesson: 'Leave Experience',
}

export function Footer({
  type = 'home',
  className,
  runningSubject,
  onBack,
  onMakeChanges,
  onLeftInfo,
  onPublish,
  onInfo,
  onBug,
  bugActive,
  onTranscript,
  transcriptActive,
  onEvents,
  eventsActive,
}: FooterProps) {
  const { status } = useSession()
  const isAuthenticated = status === 'authenticated'
  const { can } = usePermissions()
  const isAdmin = can(Permission.ADMIN_USERS)
  const versionInfo = getVersionInfo()
  const buildDate = versionInfo.buildTime
    ? new Date(versionInfo.buildTime).toLocaleString()
    : 'Unknown'
  const subject = runningSubject ?? `Primer ${versionInfo.version}`

  const showRightUtilityButtons =
    type === 'builder' || type === 'lesson' || type === 'preview'
  const backLabel = BACK_LABEL[type]

  const hasExperienceUtilityCluster =
    showRightUtilityButtons &&
    (onInfo != null || onBug != null || onTranscript != null || onEvents != null)

  return (
    <div
      className={cn(
        'px-4 py-3.5 xl:px-28 fixed bottom-0 left-0 right-0 w-full',
        type === 'preview' ? 'bg-[#c70036]/50' : 'bg-black/50',
        className
      )}
    >
      <div className="mx-auto flex max-w-screen-2xl items-center justify-between gap-6">
        <div className="flex items-center gap-2.5">
          {type === 'modules' && (
            <Button
              asChild
              variant="outline"
              size="lg"
              className={cn(footerBtnOutline, footerBtnOutlineWithLabel)}
            >
              <Link href="/">
                <ArrowLeft className="size-5" />
                <span>{BACK_LABEL.modules}</span>
              </Link>
            </Button>
          )}
          {type !== 'modules' && backLabel && onBack && (
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={onBack}
              className={cn(footerBtnOutline, footerBtnOutlineWithLabel)}
            >
              <ArrowLeft className="size-5" />
              <span>{backLabel}</span>
            </Button>
          )}
          {type === 'preview' && (
            <>
              {onMakeChanges && (
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={onMakeChanges}
                  className={cn(footerBtnOutline, footerBtnOutlineWithLabel)}
                >
                  <Pencil className="size-5" />
                  <span>Make Changes</span>
                </Button>
              )}
              {onLeftInfo && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={onLeftInfo}
                  aria-label="More info"
                  className={footerBtnOutline}
                >
                  <Info className="size-5" />
                </Button>
              )}
              {onPublish && (
                <Button
                  type="button"
                  variant="default"
                  size="lg"
                  onClick={onPublish}
                  className="h-10"
                >
                  <span>Publish Experience</span>
                </Button>
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-6">
          <HoverCard>
            <HoverCardTrigger asChild>
              <div className="flex cursor-help flex-col gap-0.5 text-right text-xs leading-4 text-white">
                <span>Currently running:</span>
                <span className="font-semibold">{subject}</span>
              </div>
            </HoverCardTrigger>
            <HoverCardContent className="w-80 border-gray-700 bg-black/90 z-modal">
              <div className="text-xs text-white/70">
                <p className="mb-1 font-semibold">Build Information:</p>
                <p>Version: {versionInfo.version}</p>
                <p>Branch: {versionInfo.gitBranch || 'Unknown'}</p>
                <p>Commit: {versionInfo.gitCommit?.substring(0, 7) || 'Unknown'}</p>
                <p>Built: {buildDate}</p>
              </div>
            </HoverCardContent>
          </HoverCard>

          {type === 'home' && isAuthenticated && (
            <div className="flex items-center gap-2.5">
              {isAdmin && (
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className={cn(footerBtnOutline, footerBtnOutlineWithLabel)}
                >
                  <a href="/admin/users">
                    <ShieldCheck className="size-5" />
                    Admin
                  </a>
                </Button>
              )}
              <Button
                asChild
                variant="outline"
                size="lg"
                className={cn(footerBtnOutline, footerBtnOutlineWithLabel)}
              >
                <Link href="/modules">View Modules</Link>
              </Button>
            </div>
          )}

          {hasExperienceUtilityCluster && (
            <div className="flex items-center gap-2.5">
              {onTranscript && (
                <div className="hidden">
                  <Toggle
                    variant="outline"
                    size="lg"
                    pressed={transcriptActive}
                    onPressedChange={onTranscript}
                    aria-label={
                      transcriptActive ? 'Hide conversation transcript' : 'Show conversation transcript'
                    }
                    className={footerIconToggle}
                  >
                    <MessageCircle className="size-5" />
                  </Toggle>
                </div>
              )}
              {onEvents && (
                <Toggle
                  variant="outline"
                  size="lg"
                  pressed={eventsActive}
                  onPressedChange={onEvents}
                  aria-label={eventsActive ? 'Hide event log' : 'Show event log'}
                  className={footerIconToggle}
                >
                  <NotepadText className="size-5" />
                </Toggle>
              )}
              {onInfo && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={onInfo}
                  aria-label="View experience info"
                  className={footerBtnOutline}
                >
                  <Info className="size-5" />
                </Button>
              )}
              {onBug && (
                <Toggle
                  variant="outline"
                  size="lg"
                  pressed={bugActive}
                  onPressedChange={onBug}
                  aria-label={bugActive ? 'Disable debug mode' : 'Enable debug mode'}
                  className={footerIconToggle}
                >
                  <Bug className="size-5" />
                </Toggle>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

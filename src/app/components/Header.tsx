'use client'

import Image from 'next/image'
import Link from 'next/link'
import { signOut, useSession } from 'next-auth/react'
import { LogOut } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ModeToggle } from '@/components/mode-toggle'
import { getEffectiveUserEmail, isDevAuthBypassEnabled } from '@/lib/devAuth'

interface HeaderProps {
  className?: string
}

export function Header({ className }: HeaderProps) {
  const { data: session, status } = useSession()
  const effectiveUserEmail = getEffectiveUserEmail(session?.user?.email ?? null)
  const showDevBypass = status !== 'authenticated' && isDevAuthBypassEnabled()
  const isAuthenticated = status === 'authenticated' || showDevBypass

  return (
    <div
      className={cn(
        'border-b border-border bg-background px-4 py-3.5 xl:px-28',
        className
      )}
    >
      <div className="mx-auto flex w-full max-w-screen-2xl items-center">
        <Link href="/" className="flex flex-1 justify-start">
          {/*
            Both variants render and one is hidden via `dark:hidden`/`dark:block`
            (display:none), which means the browser downloads both regardless.
            `priority` must therefore be set on both so the visible variant gets
            preloaded in dark mode too — without it, dark-mode LCP regressed by
            the asymmetric preload. Replacing this with a single CSS swap would
            be cleaner but requires inlining the SVGs.
          */}
          <Image
            src="/images/gail_logo_light.svg"
            alt="Wharton Generative AI Labs"
            width={327}
            height={41}
            className="h-auto w-[300px] max-w-full dark:hidden"
            sizes="(min-width: 1280px) 300px, 90vw"
            priority
          />
          <Image
            src="/images/gail_logo_dark.svg"
            alt=""
            aria-hidden="true"
            width={327}
            height={41}
            className="hidden h-auto w-[300px] max-w-full dark:block"
            sizes="(min-width: 1280px) 300px, 90vw"
            priority
          />
        </Link>

        <div className="flex flex-1 justify-center">
          <h1 className="font-serif font-bold text-base text-brand md:text-2xl">Primer</h1>
        </div>

        <div className="flex flex-1 items-center justify-end gap-4">
          {effectiveUserEmail && (
            <span className="hidden text-sm font-medium text-accent-foreground md:inline md:text-nowrap">
              Hi, {effectiveUserEmail}
            </span>
          )}
          {showDevBypass && (
            <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
              Dev
            </span>
          )}
          <div className="flex items-center justify-end gap-2.5">
            {isAuthenticated && (
              <Button
                variant="outline"
                aria-label="Sign Out"
                onClick={() => signOut({ callbackUrl: '/auth/signin' })}
                className="size-10 md:size-auto [&_svg]:size-5"
              >
                <LogOut />
                <span className="hidden md:inline">Sign Out</span>
              </Button>
            )}
            <ModeToggle />
          </div>
        </div>
      </div>
    </div>
  )
}

'use client'

import { Suspense } from "react"
import { useSearchParams } from 'next/navigation'
import { signIn } from "next-auth/react"
import PrimerBackground from "@/app/components/PrimerBackground"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { isDevAuthBypassEnabled } from "@/lib/devAuth"

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      fill="transparent"
    >
      <path
        d="M20.839 10.38H12.183V13.71H17.2477C17.1556 14.52 16.6031 15.78 15.406 16.59C14.6693 17.13 13.5643 17.49 12.183 17.49C9.10409 17.49 6.65793 14.918 6.65793 11.91C6.65793 8.98727 9.243 6.42 12.183 6.42C13.9326 6.42 15.0376 7.14 15.7743 7.77L18.3527 5.25C16.7873 3.9 14.6693 3 12.183 3C8.59171 3 5.46083 4.98 3.98747 7.95C2.67084 10.5236 2.67084 13.4764 3.98747 16.05C5.46083 19.02 8.59171 21 12.183 21C14.6693 21 16.7873 20.19 18.2606 18.84C20.6615 16.7405 21.3561 13.4127 20.839 10.38Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeMiterlimit="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function SignInCard({ children }: { children: React.ReactNode }) {
  return (
    <Card className="flex w-full max-w-md flex-col items-stretch gap-7 rounded-lg border bg-card p-14 shadow-lg">
      {children}
    </Card>
  )
}

function SignInContent() {
  const searchParams = useSearchParams()
  const returnUrl = searchParams.get('returnUrl')
  const callbackUrl = returnUrl ? decodeURIComponent(returnUrl) : "/"
  const devAuthBypassEnabled = isDevAuthBypassEnabled()

  return (
    <SignInCard>
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-3xl font-semibold leading-9 text-card-foreground">
          Welcome to Primer
        </h1>
        <p className="text-xl leading-7 text-muted-foreground">
          {devAuthBypassEnabled
            ? 'Dev auth bypass is enabled for this branch.'
            : 'You must sign in to continue.'}
        </p>
      </div>
      <div className="flex w-full items-center justify-center">
        {devAuthBypassEnabled ? (
          <Button
            onClick={() => window.location.assign(callbackUrl)}
            size="lg"
          >
            Enter Primer
          </Button>
        ) : (
          <Button
            onClick={() => signIn("google", { callbackUrl })}
            size="lg"
          >
            <GoogleIcon className="size-5" />
            Sign in with Google
          </Button>
        )}
      </div>
    </SignInCard>
  )
}

export default function SignIn() {
  return (
    <PrimerBackground useInitialBackdrop={true}>
      <div className="relative flex h-full items-center justify-center px-4">
        <div
          className="pointer-events-none absolute inset-0 bg-black/70"
          aria-hidden="true"
        />
        <div className="relative w-full max-w-md animate-in fade-in duration-500">
          <Suspense
            fallback={
              <SignInCard>
                <p className="text-center text-muted-foreground">Loading…</p>
              </SignInCard>
            }
          >
            <SignInContent />
          </Suspense>
        </div>
      </div>
    </PrimerBackground>
  )
}

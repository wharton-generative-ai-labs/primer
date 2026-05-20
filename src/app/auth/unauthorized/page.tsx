'use client'

import { signOut } from "next-auth/react"
import PrimerBackground from "@/app/components/PrimerBackground"
import { Button } from "@/components/ui/button"

export default function Unauthorized() {
  return (
    <PrimerBackground useInitialBackdrop={true}>
      <div className="flex h-full items-end justify-center pb-4">
        <div className="mx-4 w-full max-w-2xl">
            <div className={`rounded-lg p-8 text-center backdrop-blur-lg shadow-2xl text-white bg-black/30 transition-opacity duration-500 ${true ? 'opacity-100' : 'opacity-0'}`}>
              <div>
                <h2 className="text-xl font-semibold mb-6">
                  Unauthorized Access
                </h2>
                <div className="mb-4 text-white/90">
                  You are not authorized to use Primer.
                  <br />
                  Please contact the administrator for access.
                </div>
              </div>
              <div className="flex justify-center">
                <Button
                  onClick={() => signOut({ callbackUrl: '/auth/signin' })}
                  variant="customDestructive"
                  size="sm"
                >
                  Sign Out
                </Button>
              </div>
            </div>
          </div>
      </div>
    </PrimerBackground>
  )
} 
'use client'

import { useState, useEffect, Suspense } from "react"
import { useSearchParams } from 'next/navigation'
import { signIn } from "next-auth/react"
import PrimerBackground from "@/app/components/PrimerBackground"
import { Button } from "@/components/ui/button"

function SignInContent() {
  const searchParams = useSearchParams()
  const returnUrl = searchParams.get('returnUrl')
  const callbackUrl = returnUrl ? decodeURIComponent(returnUrl) : "/"

  // State to control the fade-in animation
  const [isVisible, setIsVisible] = useState(false);
  
  // Apply the fade-in effect only when the component mounts
  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <div className="absolute inset-0 flex items-end justify-center pb-[calc(40px+1rem)] md:pb-[calc(56px+1rem)]">
      <div className="max-w-2xl w-full mx-4">
          <div className={`rounded-lg p-8 text-center backdrop-blur-lg shadow-2xl text-white bg-black/30 transition-opacity duration-500 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
            <h2 className="text-xl font-semibold mb-6">
              Sign in to Primer
            </h2>
            <div className="mb-4 text-white/90">
              Please sign in to continue
            </div>
            <div className="flex justify-center">
              <Button
                onClick={() => signIn("google", { callbackUrl })}
                variant="custom"
                size="sm"
                className="flex items-center gap-2"
              >
                Sign in with Google
              </Button>
            </div>
          </div>
      </div>
    </div>
  )
}

export default function SignIn() {
  return (
    <PrimerBackground useInitialBackdrop={true}>
      <Suspense fallback={
        <div className="absolute inset-0 flex items-end justify-center pb-[calc(40px+1rem)] md:pb-[calc(56px+1rem)]">
          <div className="max-w-2xl w-full mx-4">
              <div className="rounded-lg p-8 text-center backdrop-blur-lg shadow-2xl text-white bg-black/30">
                Loading...
              </div>
          </div>
      </div>
      }>
        <SignInContent />
      </Suspense>
      
      <style jsx global>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        .animate-fade-in {
          animation: fade-in 0.5s ease-out forwards;
        }
      `}</style>
    </PrimerBackground>
  )
} 
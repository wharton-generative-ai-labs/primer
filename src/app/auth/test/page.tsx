'use client'

import { useSession, signIn, signOut } from "next-auth/react"
import PrimerBackground from "../../components/PrimerBackground"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"

export default function TestAuth() {
  const { data: session, status } = useSession()

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-foreground">Loading...</p>
      </div>
    )
  }

  return (
    <PrimerBackground useInitialBackdrop={true}>
      <div className="flex h-full items-center justify-center py-8">
        <div className="mx-4 w-full max-w-2xl">
            <div className="bg-black/30 backdrop-blur-lg rounded-xl shadow-2xl overflow-hidden p-8">
                <div className="flex justify-between items-center mb-4">
                  <h1 className="text-2xl font-bold">Authentication Test Page</h1>
                  {session ? (
                    <Button
                      onClick={() => signOut()}
                      variant="custom"
                      size="sm"
                    >
                      Sign Out
                    </Button>
                  ) : (
                    <Button
                      onClick={() => signIn("google")}
                      variant="custom"
                      size="sm"
                    >
                      Sign In with Google
                    </Button>
                  )}
                </div>
                <div className="mb-4">
                  <p className="text-lg mb-2">Status: <span className="font-semibold">{status}</span></p>
                  {session ? (
                    <>
                      <p className="mb-2">Signed in as: <span className="font-semibold">{session.user?.email}</span></p>
                      <p className="mb-2">Roles: <span className="font-semibold">{session.user?.roles.map(r => r.key).join(', ')}</span></p>
                      <p className="mb-2">Privileges: <span className="font-semibold">{session.user?.privileges.join(', ')}</span></p>
                    </>
                  ) : null}
                </div>

                <div className="mt-8 border text-gray-200 p-4 rounded-lg">
                  <h2 className="text-lg font-semibold mb-2">Session Data:</h2>
                  <ScrollArea className="h-[200px] w-full rounded-md">
                    <pre className="whitespace-pre-wrap text-sm p-4">
                      {JSON.stringify(session, null, 2)}
                    </pre>
                  </ScrollArea>
                </div>
              </div>
          </div>
      </div>
    </PrimerBackground>
  )
} 
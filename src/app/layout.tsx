import type { Metadata } from 'next'
import './globals.css'
import { NextAuthProvider } from './providers'
import { Toaster } from "@/components/ui/toaster"
import { getCachedSession } from '@/lib/getCachedSession'
import { robotoFlex } from '@/lib/fonts'

export const metadata: Metadata = {
  title: 'Primer',
  description: 'Open-source AI platform enabling educators to create interactive learning tools without coding. Transform teaching expertise into personalized simulations and tutors through natural language. Created by Wharton Generative AI Labs.',
  icons: {
    icon: '/images/favicon.png',
  },
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getCachedSession()

  return (
    <html lang="en" suppressHydrationWarning className={robotoFlex.variable}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className="overscroll-none">
        <NextAuthProvider session={session}>
          {children}
          <Toaster />
        </NextAuthProvider>
      </body>
    </html>
  )
}
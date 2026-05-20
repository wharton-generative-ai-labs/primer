import '../globals.css'
import { getCachedSession } from '@/lib/getCachedSession'
import { PlaySessionProvider } from './PlaySessionProvider'

export const metadata = {
    title: 'A Primer Experience',
    description: 'Created by Wharton Generative AI Labs.',
    icons: {
        icon: '/images/favicon.png',
    },
}

export default async function PlayLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const session = await getCachedSession()
    return <PlaySessionProvider session={session}>{children}</PlaySessionProvider>
}

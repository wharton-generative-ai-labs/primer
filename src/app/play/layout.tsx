import '../globals.css'

export const metadata = {
    title: 'A Primer Experience',
    description: 'Created by Wharton Generative AI Labs.',
    icons: {
        icon: '/images/favicon.png',
    },
}

export default function PlayLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return children;
}
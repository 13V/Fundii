import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'GrantBase — Find Government Grants for Your Australian Business',
  description: 'GrantBase matches your business with government and private grants you qualify for. Smart matching, instant email alerts, and AI-drafted applications. Find funding in 5 minutes.',
  metadataBase: new URL('https://grantbase.com.au'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'GrantBase — Find Government Grants for Your Australian Business',
    description: 'Smart grant matching for Australian small businesses. Get matched with government & private grants in 5 minutes. AI-drafted applications included.',
    url: 'https://grantbase.com.au',
    siteName: 'GrantBase',
    locale: 'en_AU',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'GrantBase — Find Government Grants for Your Australian Business',
    description: 'Smart grant matching for Australian small businesses. Find funding in 5 minutes.',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Source+Serif+4:wght@400;600;700;800;900&family=IBM+Plex+Sans:wght@400;500;600;700&family=DM+Serif+Display:ital@0;1&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  )
}

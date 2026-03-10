import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Grant Base — Find Government Grants for Your Australian Business',
  description: 'Grant Base matches your business with government and private grants you qualify for. Smart matching, instant email alerts, and AI-drafted applications. Find funding in 5 minutes.',
  metadataBase: new URL('https://grantbase.com.au'),
  alternates: {
    canonical: '/',
  },
  keywords: [
    'Australian government grants', 'small business grants Australia',
    'business grants NSW', 'business grants VIC', 'business grants QLD',
    'business grants SA', 'business grants WA', 'grant finder Australia',
    'government funding small business', 'startup grants Australia',
    'SME grants', 'grant matching', 'AI grant application',
  ],
  openGraph: {
    title: 'Grant Base — Find Government Grants for Your Australian Business',
    description: 'Smart grant matching for Australian small businesses. Get matched with government & private grants in 5 minutes. AI-drafted applications included.',
    url: 'https://grantbase.com.au',
    siteName: 'Grant Base',
    locale: 'en_AU',
    type: 'website',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Grant Base — Find Government Grants for Australian Businesses' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Grant Base — Find Government Grants for Your Australian Business',
    description: 'Smart grant matching for Australian small businesses. Find funding in 5 minutes.',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-snippet': -1, 'max-image-preview': 'large' },
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

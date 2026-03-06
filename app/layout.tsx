import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GrantMate — Free Money, Found Fast",
  description:
    "GrantMate finds Australian government grants you're eligible for and drafts your application with AI. 3,900+ programs. Built for Australian SMEs.",
  keywords: "australian grants, small business grants, government grants australia, grant finder, ai grant writer",
  openGraph: {
    title: "GrantMate — Free Money, Found Fast",
    description: "AI-powered grant finder for Australian small businesses. Find and apply in minutes.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
  );
}

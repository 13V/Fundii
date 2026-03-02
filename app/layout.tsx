import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fundii — Free Money, Found Fast",
  description:
    "Fundii finds Australian government grants you're eligible for, scores them by match, and drafts your application with AI. Built for Australian SMEs.",
  keywords: "australian grants, small business grants, government grants australia, grant finder",
  openGraph: {
    title: "Fundii — Free Money, Found Fast",
    description: "AI-powered grant finder for Australian small businesses",
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
      <body className="min-h-screen bg-[#F8FAFB]">{children}</body>
    </html>
  );
}

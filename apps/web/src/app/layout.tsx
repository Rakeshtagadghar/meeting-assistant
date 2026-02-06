import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    template: "%s | AINotes - AI-powered private notes",
    default: "AINotes - AI-powered private notes",
  },
  description:
    "AI-powered meeting notes that are private by default. Capture, transcribe, and summarize your meetings locally.",
  openGraph: {
    type: "website",
    locale: "en_GB",
    siteName: "AINotes",
  },
  twitter: {
    card: "summary_large_image",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}

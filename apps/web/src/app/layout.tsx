import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://meeting-assistant-web.vercel.app/"),
  title: {
    template: "%s | AINotes",
    default: "AINotes",
  },
  description:
    "AI-powered meeting notes that are private by default. Local audio processing, secure exports, and developer-friendly.",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
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

import { Providers } from "./providers";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-gray-900 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

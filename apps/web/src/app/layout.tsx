import type { Metadata } from "next";
import type { ReactNode } from "react";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.goldenminutes.co.uk/"),
  manifest: "/manifest.json",
  title: {
    template: "%s | Golden Minutes",
    default: "Golden Minutes",
  },
  description:
    "AI-powered meeting notes that are private by default. Local audio processing, secure exports, and developer-friendly.",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: "Golden Minutes",
    images: [
      {
        url: "/apple-icon.png",
        width: 180,
        height: 180,
        alt: "Golden Minutes",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/apple-icon.png"],
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon0.svg", type: "image/svg+xml" },
      { url: "/icon1.png", type: "image/png", sizes: "96x96" },
    ],
    shortcut: ["/favicon.ico"],
    apple: [{ url: "/apple-icon.png", type: "image/png", sizes: "180x180" }],
  },
  verification: {
    google: "AYCHjs_y4yxgXdKULXw5n_h97yeWBHxw7aicgeTN3l0",
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
      <body className="min-h-screen bg-warm-50 text-gray-900 antialiased">
        <GoogleAnalytics />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

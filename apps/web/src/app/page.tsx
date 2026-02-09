import type { Metadata } from "next";
import { Navbar } from "@/features/marketing/components/Navbar";
import { Hero } from "@/features/marketing/components/Hero";
import { SocialProof } from "@/features/marketing/components/SocialProof";
import { FeatureGrid } from "@/features/marketing/components/FeatureGrid";
import { HowItWorks } from "@/features/marketing/components/HowItWorks";
import { PrivacySection } from "@/features/marketing/components/PrivacySection";
import { FAQ } from "@/features/marketing/components/FAQ";
import { FinalCTA } from "@/features/marketing/components/FinalCTA";
import { Footer } from "@/features/marketing/components/Footer";
import { CookieBanner } from "@/features/marketing/components/CookieBanner";

export const metadata: Metadata = {
  title: "AINotes - Private AI Meeting Notes & Transcription",
  description:
    "Capture, transcribe, and summarize your meetings with AI. Live transcript during meetings, one-click summaries, action items, and exports. Private by default and consent-first.",
  keywords: [
    "ai meeting notes",
    "private ai notes",
    "meeting transcription",
    "summarize notes",
    "meeting summary",
    "action items",
  ],
  openGraph: {
    title: "AINotes - Private AI Meeting Notes",
    description:
      "Live transcript during meetings, then one-click AI summaries, action items, and exports. Private by default.",
    type: "website",
  },
};

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col bg-white">
      <Navbar />
      <Hero />
      <SocialProof />
      <FeatureGrid />
      <HowItWorks />
      <PrivacySection />
      <FAQ />
      <FinalCTA />
      <Footer />
      <CookieBanner />
    </main>
  );
}

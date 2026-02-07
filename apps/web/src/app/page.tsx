import type { Metadata } from "next";
import { Hero } from "@/features/marketing/components/Hero";
import { FeatureGrid } from "@/features/marketing/components/FeatureGrid";
import { Footer } from "@/features/marketing/components/Footer";
import { CookieBanner } from "@/features/marketing/components/CookieBanner";

export const metadata: Metadata = {
  title: "Home",
  description: "AINotes: AI-powered meeting notes that are private by default.",
};

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col bg-white">
      <Hero />
      <FeatureGrid />
      <Footer />
      <CookieBanner />
    </main>
  );
}

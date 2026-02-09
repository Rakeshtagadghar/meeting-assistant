import type { Metadata } from "next";
import { Navbar } from "@/features/marketing/components/Navbar";
import { Footer } from "@/features/marketing/components/Footer";
import { CheckIcon } from "@heroicons/react/24/outline";

export const metadata: Metadata = {
  title: "Pricing",
  description: "AINotes pricing - free to get started with local AI.",
};

const features = [
  "Live meeting transcription",
  "AI-powered summaries",
  "Action items extraction",
  "PDF/DOCX exports",
  "Private by default",
  "Consent-first recording",
];

export default function PricingPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen pt-20">
        {/* Hero section */}
        <section className="gradient-hero-bg py-24 sm:py-32">
          <div className="mx-auto max-w-4xl px-6 lg:px-8 text-center">
            <h1 className="text-4xl font-bold tracking-tight text-text-heading sm:text-5xl">
              Simple, transparent pricing
            </h1>
            <p className="mt-6 text-lg text-text-body max-w-2xl mx-auto">
              Start for free with all core features. No credit card required.
            </p>
          </div>
        </section>

        {/* Pricing card */}
        <section className="py-16 px-6 lg:px-8">
          <div className="mx-auto max-w-lg">
            <div className="glass-card rounded-3xl p-8">
              <div className="text-center mb-8">
                <span className="gradient-badge px-4 py-1 rounded-full text-sm font-medium text-text-body">
                  Most Popular
                </span>
                <h2 className="mt-6 text-3xl font-bold text-text-heading">
                  Free
                </h2>
                <p className="mt-2 text-text-muted">
                  Everything you need to get started
                </p>
              </div>

              <div className="flex items-baseline justify-center gap-x-2 mb-8">
                <span className="text-5xl font-bold tracking-tight gradient-text">
                  $0
                </span>
                <span className="text-text-muted">/month</span>
              </div>

              <ul className="space-y-4 mb-8">
                {features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full icon-gradient flex items-center justify-center flex-shrink-0 mt-0.5">
                      <CheckIcon className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-text-body">{feature}</span>
                  </li>
                ))}
              </ul>

              <button className="w-full btn-gradient-primary py-3 rounded-xl text-white font-semibold">
                Get started for free
              </button>
            </div>

            <p className="mt-8 text-center text-sm text-text-muted">
              Need more? Contact us for enterprise pricing.
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

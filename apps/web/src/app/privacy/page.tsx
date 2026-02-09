import type { Metadata } from "next";
import { Navbar } from "@/features/marketing/components/Navbar";
import { Footer } from "@/features/marketing/components/Footer";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Our commitment to your privacy.",
};

export default function PrivacyPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen pt-20">
        {/* Hero section */}
        <section className="gradient-hero-bg py-16 sm:py-20">
          <div className="mx-auto max-w-3xl px-6 lg:px-8 text-center">
            <h1 className="text-4xl font-bold tracking-tight text-text-heading sm:text-5xl">
              Privacy Policy
            </h1>
            <p className="mt-4 text-text-muted">
              Last updated: {new Date().toLocaleDateString()}
            </p>
          </div>
        </section>

        {/* Content */}
        <section className="py-16 px-6 lg:px-8">
          <div className="mx-auto max-w-3xl">
            <div className="glass-card rounded-3xl p-8 sm:p-12">
              <div className="prose prose-gray max-w-none">
                <p className="text-lg text-text-body leading-relaxed">
                  At AINotes, we take your privacy seriously. This application
                  is designed to process your data locally on your device
                  whenever possible.
                </p>

                <h2 className="mt-8 text-xl font-semibold text-text-heading border-b border-gray-200 pb-2">
                  1. Data Collection
                </h2>
                <p className="text-text-body mt-4">
                  We do not collect personal data without your explicit consent.
                  When you use our services, we may collect:
                </p>
                <ul className="list-disc pl-5 text-text-body space-y-2 mt-4">
                  <li>Account information (email, name) for authentication</li>
                  <li>Usage analytics (with your consent)</li>
                  <li>Notes and transcripts you choose to sync</li>
                </ul>

                <h2 className="mt-8 text-xl font-semibold text-text-heading border-b border-gray-200 pb-2">
                  2. Data Storage
                </h2>
                <p className="text-text-body mt-4">
                  By default, audio is processed locally and not stored on our
                  servers. Only transcripts and summaries are stored when you
                  choose to sync.
                </p>

                <h2 className="mt-8 text-xl font-semibold text-text-heading border-b border-gray-200 pb-2">
                  3. Data Sharing
                </h2>
                <p className="text-text-body mt-4">
                  We do not sell your data. We only share data with third
                  parties when necessary to provide our services (e.g., cloud
                  storage providers).
                </p>

                <h2 className="mt-8 text-xl font-semibold text-text-heading border-b border-gray-200 pb-2">
                  4. Your Rights
                </h2>
                <p className="text-text-body mt-4">
                  You have the right to access, correct, or delete your personal
                  data at any time. Contact us to exercise these rights.
                </p>

                <h2 className="mt-8 text-xl font-semibold text-text-heading border-b border-gray-200 pb-2">
                  5. Contact Us
                </h2>
                <p className="text-text-body mt-4">
                  If you have questions about this privacy policy, please
                  contact us at privacy@ainotes.app.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

import type { Metadata } from "next";
import { Navbar } from "@/features/marketing/components/Navbar";
import { Footer } from "@/features/marketing/components/Footer";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms and conditions for using AINotes.",
};

export default function TermsPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen pt-20">
        {/* Hero section */}
        <section className="gradient-hero-bg py-16 sm:py-20">
          <div className="mx-auto max-w-3xl px-6 lg:px-8 text-center">
            <h1 className="text-4xl font-bold tracking-tight text-text-heading sm:text-5xl">
              Terms of Service
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
                  By using AINotes, you agree to these terms. Please read them
                  carefully.
                </p>

                <h2 className="mt-8 text-xl font-semibold text-text-heading border-b border-gray-200 pb-2">
                  1. Usage
                </h2>
                <p className="text-text-body mt-4">
                  You are responsible for your use of the application. You agree
                  to use AINotes only for lawful purposes and in accordance with
                  these terms.
                </p>

                <h2 className="mt-8 text-xl font-semibold text-text-heading border-b border-gray-200 pb-2">
                  2. Account
                </h2>
                <p className="text-text-body mt-4">
                  You are responsible for maintaining the security of your
                  account and any activities that occur under your account.
                </p>

                <h2 className="mt-8 text-xl font-semibold text-text-heading border-b border-gray-200 pb-2">
                  3. Content
                </h2>
                <p className="text-text-body mt-4">
                  You retain ownership of all content you create using AINotes.
                  We do not claim any rights to your notes or transcripts.
                </p>

                <h2 className="mt-8 text-xl font-semibold text-text-heading border-b border-gray-200 pb-2">
                  4. Consent for Recording
                </h2>
                <p className="text-text-body mt-4">
                  When using meeting transcription features, you are responsible
                  for obtaining consent from all participants as required by
                  applicable laws.
                </p>

                <h2 className="mt-8 text-xl font-semibold text-text-heading border-b border-gray-200 pb-2">
                  5. Limitation of Liability
                </h2>
                <p className="text-text-body mt-4">
                  AINotes is provided &quot;as is&quot; without warranties. We
                  are not liable for any damages arising from your use of the
                  service.
                </p>

                <h2 className="mt-8 text-xl font-semibold text-text-heading border-b border-gray-200 pb-2">
                  6. Changes
                </h2>
                <p className="text-text-body mt-4">
                  We may update these terms from time to time. Continued use of
                  the service constitutes acceptance of any changes.
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

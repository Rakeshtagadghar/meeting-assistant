import type { Metadata } from "next";
import { Navbar } from "@/features/marketing/components/Navbar";
import { Footer } from "@/features/marketing/components/Footer";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description: "How we use cookies.",
};

export default function CookiesPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen pt-20">
        {/* Hero section */}
        <section className="gradient-hero-bg py-16 sm:py-20">
          <div className="mx-auto max-w-3xl px-6 lg:px-8 text-center">
            <h1 className="text-4xl font-bold tracking-tight text-text-heading sm:text-5xl">
              Cookie Policy
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
                  We use cookies to improve your experience. This policy
                  explains what cookies we use and why.
                </p>

                <h2 className="mt-8 text-xl font-semibold text-text-heading border-b border-gray-200 pb-2">
                  1. Necessary Cookies
                </h2>
                <p className="text-text-body mt-4">
                  These are required for the app to function (e.g.,
                  authentication, session management). You cannot opt out of
                  these cookies.
                </p>

                <h2 className="mt-8 text-xl font-semibold text-text-heading border-b border-gray-200 pb-2">
                  2. Analytics Cookies
                </h2>
                <p className="text-text-body mt-4">
                  We use analytics cookies to understand how you use our
                  application and improve our services. These are only set after
                  you provide consent.
                </p>

                <h2 className="mt-8 text-xl font-semibold text-text-heading border-b border-gray-200 pb-2">
                  3. Managing Cookies
                </h2>
                <p className="text-text-body mt-4">
                  You can manage your cookie preferences using the cookie banner
                  that appears when you first visit our site, or through your
                  browser settings.
                </p>

                <h2 className="mt-8 text-xl font-semibold text-text-heading border-b border-gray-200 pb-2">
                  4. Third-Party Cookies
                </h2>
                <p className="text-text-body mt-4">
                  We use Google Analytics for usage tracking. These cookies are
                  only set after you opt-in via our consent banner.
                </p>

                <h2 className="mt-8 text-xl font-semibold text-text-heading border-b border-gray-200 pb-2">
                  5. Contact
                </h2>
                <p className="text-text-body mt-4">
                  If you have questions about our cookie policy, please contact
                  us at privacy@ainotes.app.
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

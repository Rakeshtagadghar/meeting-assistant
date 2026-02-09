"use client";

import { Navbar } from "@/features/marketing/components/Navbar";
import { Footer } from "@/features/marketing/components/Footer";
import { EnvelopeIcon, MapPinIcon } from "@heroicons/react/24/outline";

export default function ContactPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen pt-20">
        {/* Hero section */}
        <section className="gradient-hero-bg py-16 sm:py-20">
          <div className="mx-auto max-w-3xl px-6 lg:px-8 text-center">
            <h1 className="text-4xl font-bold tracking-tight text-text-heading sm:text-5xl">
              Contact Us
            </h1>
            <p className="mt-4 text-lg text-text-body">
              Have questions? We&apos;d love to hear from you.
            </p>
          </div>
        </section>

        {/* Contact form */}
        <section className="py-16 px-6 lg:px-8">
          <div className="mx-auto max-w-2xl">
            <div className="glass-card rounded-3xl p-8 sm:p-12">
              <form className="space-y-6">
                <div>
                  <label
                    htmlFor="name"
                    className="block text-sm font-medium text-text-heading mb-2"
                  >
                    Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white/50 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                    placeholder="Your name"
                  />
                </div>

                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-text-heading mb-2"
                  >
                    Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white/50 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                    placeholder="you@example.com"
                  />
                </div>

                <div>
                  <label
                    htmlFor="subject"
                    className="block text-sm font-medium text-text-heading mb-2"
                  >
                    Subject
                  </label>
                  <input
                    type="text"
                    id="subject"
                    name="subject"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white/50 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                    placeholder="How can we help?"
                  />
                </div>

                <div>
                  <label
                    htmlFor="message"
                    className="block text-sm font-medium text-text-heading mb-2"
                  >
                    Message
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    rows={5}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white/50 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors resize-none"
                    placeholder="Tell us more..."
                  />
                </div>

                <button
                  type="submit"
                  className="w-full btn-gradient-primary py-3 rounded-xl text-white font-semibold"
                >
                  Send Message
                </button>
              </form>
            </div>

            {/* Contact info */}
            <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="flex items-center gap-4 glass-card rounded-2xl p-6">
                <div className="w-12 h-12 rounded-xl icon-gradient flex items-center justify-center">
                  <EnvelopeIcon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-text-muted">Email</p>
                  <p className="font-medium text-text-heading">
                    support@ainotes.app
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 glass-card rounded-2xl p-6">
                <div className="w-12 h-12 rounded-xl icon-gradient flex items-center justify-center">
                  <MapPinIcon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-text-muted">Location</p>
                  <p className="font-medium text-text-heading">
                    San Francisco, CA
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

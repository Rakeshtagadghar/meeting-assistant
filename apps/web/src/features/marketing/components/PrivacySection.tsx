"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ShieldCheckIcon } from "@heroicons/react/24/outline";

const privacyFeatures = [
  "No audio stored by default (transcript + summaries only)",
  "Share is explicit and restricted by default",
  "Delete notes and transcripts anytime",
  "GDPR-ready controls and clear retention",
];

export function PrivacySection() {
  return (
    <section id="privacy" className="py-24 sm:py-32 gradient-hero-bg">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left - Icon */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="flex justify-center"
          >
            <div className="relative">
              <div className="w-48 h-48 rounded-full gradient-primary opacity-20 absolute -inset-4 blur-2xl" />
              <div className="relative w-40 h-40 rounded-3xl glass-card flex items-center justify-center">
                <ShieldCheckIcon className="w-20 h-20 text-primary" />
              </div>
            </div>
          </motion.div>

          {/* Right - Content */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-3xl font-bold tracking-tight text-text-heading sm:text-4xl mb-6">
              Privacy-first by default
            </h2>

            <ul className="space-y-4 mb-8">
              {privacyFeatures.map((feature, index) => (
                <li key={index} className="flex items-start gap-3">
                  <svg
                    className="w-5 h-5 text-primary mt-0.5 flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="text-text-body">{feature}</span>
                </li>
              ))}
            </ul>

            <Link
              href="/privacy"
              className="inline-flex items-center gap-2 text-primary font-medium hover:underline"
            >
              Read privacy policy
              <span aria-hidden="true">→</span>
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

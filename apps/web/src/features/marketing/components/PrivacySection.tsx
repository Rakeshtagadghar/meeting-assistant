"use client";

import Link from "next/link";
import { ShieldCheckIcon } from "@heroicons/react/24/outline";

const privacyFeatures = [
  "No audio stored by default (transcript + summaries only)",
  "Sharing is explicit and restricted by default",
  "Delete notes and transcripts anytime",
  "GDPR-ready controls and clear retention policy",
];

export function PrivacySection() {
  return (
    <section id="privacy" className="relative py-24 sm:py-28">
      <div className="mx-auto max-w-7xl px-6 lg:px-8" data-stagger-group>
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
          <div data-stagger-item className="flex justify-center">
            <div className="relative">
              <div className="landing-preview-glow absolute -inset-6" />
              <div className="landing-glass-card relative flex h-44 w-44 items-center justify-center rounded-[2rem]">
                <ShieldCheckIcon className="h-20 w-20 text-primary" />
              </div>
            </div>
          </div>

          <div>
            <h2
              data-stagger-item
              className="landing-section-title text-4xl font-extrabold tracking-tight sm:text-5xl"
            >
              <span className="landing-gradient-title">
                Privacy-first by default.
              </span>
            </h2>

            <ul className="mt-8 space-y-4">
              {privacyFeatures.map((feature) => (
                <li
                  key={feature}
                  data-stagger-item
                  className="landing-pill flex items-start gap-3 px-4 py-3"
                >
                  <svg
                    className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary"
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
              data-stagger-item
              href="/privacy"
              className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-primary transition-colors hover:text-primary-hover"
            >
              Read privacy policy -&gt;
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

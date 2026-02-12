"use client";

import Link from "next/link";
import { useSession, signIn } from "next-auth/react";
import { motion } from "framer-motion";
import { useFeatureFlagVariantKey } from "posthog-js/react";
import { MockPreview } from "./MockPreview";

const heroFade = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55 },
  },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
};

const trustItems = [
  "No audio stored by default",
  "Consent-first meeting mode",
  "Works on desktop + web",
];

function getCtaProps(variant: string | boolean | undefined) {
  switch (variant) {
    case "cta_primary_blue":
      return {
        className:
          "bg-blue-600 hover:bg-blue-700 px-8 py-3 rounded-2xl text-white font-semibold text-lg flex items-center gap-2 transition-colors",
        text: "Sign in with Google",
      };
    case "cta_primary_copy_v2":
      return {
        className:
          "btn-gradient-primary px-8 py-3 rounded-2xl text-white font-semibold text-lg flex items-center gap-2",
        text: "Start taking notes free",
      };
    default:
      return {
        className:
          "btn-gradient-primary px-8 py-3 rounded-2xl text-white font-semibold text-lg flex items-center gap-2",
        text: "Sign in with Google",
      };
  }
}

const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24">
    <path
      fill="currentColor"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="currentColor"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="currentColor"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <path
      fill="currentColor"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
);

export function Hero() {
  const { data: session } = useSession();
  const ctaVariant = useFeatureFlagVariantKey("exp_landing_cta");
  const cta = getCtaProps(ctaVariant);

  return (
    <section className="relative overflow-hidden gradient-hero-bg px-6 py-24 sm:py-32 lg:px-8">
      {/* Background decoration */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-gradient-to-br from-primary/20 to-accent-pink/20 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-gradient-to-tr from-accent-pink/20 to-primary/20 blur-3xl" />
      </div>

      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left column - Text content */}
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            className="text-center lg:text-left"
          >
            <motion.h1
              variants={heroFade}
              className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl"
            >
              <span className="gradient-text">Write notes like normal.</span>
              <br />
              <span className="text-text-heading">
                Get a clean summary after.
              </span>
            </motion.h1>

            <motion.p
              variants={heroFade}
              className="mt-6 text-lg leading-8 text-text-body max-w-xl mx-auto lg:mx-0"
            >
              Live transcript during meetings, then one-click AI summaries,
              action items, and exports. Private by default and consent-first.
            </motion.p>

            <motion.div
              variants={heroFade}
              className="mt-10 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4"
            >
              {session ? (
                <Link href="/notes">
                  <button className="btn-gradient-primary px-8 py-3 rounded-2xl text-white font-semibold text-lg">
                    Go to Notes
                  </button>
                </Link>
              ) : (
                <>
                  <button
                    onClick={() => signIn("google", { callbackUrl: "/notes" })}
                    className={cta.className}
                  >
                    <GoogleIcon />
                    {cta.text}
                  </button>
                  <Link
                    href="#how-it-works"
                    className="text-sm font-semibold leading-6 text-text-heading hover:text-primary transition-colors"
                  >
                    See how it works <span aria-hidden="true">→</span>
                  </Link>
                </>
              )}
            </motion.div>

            {/* Trust row */}
            <motion.div
              variants={heroFade}
              className="mt-10 flex flex-wrap items-center justify-center lg:justify-start gap-x-6 gap-y-2"
            >
              {trustItems.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 text-sm text-text-muted"
                >
                  <svg
                    className="w-4 h-4 text-primary"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {item}
                </div>
              ))}
            </motion.div>
          </motion.div>

          {/* Right column - Mock preview */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="hidden lg:block"
          >
            <MockPreview />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

"use client";

import Link from "next/link";
import { useSession, signIn } from "next-auth/react";
import { useFeatureFlagVariantKey } from "posthog-js/react";
import { MockPreview } from "./MockPreview";

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
          "btn-gradient-landing px-8 py-3 rounded-2xl text-white font-semibold text-lg flex items-center gap-2",
        text: "Start taking notes free",
      };
    default:
      return {
        className:
          "btn-gradient-landing px-8 py-3 rounded-2xl text-white font-semibold text-lg flex items-center gap-2",
        text: "Sign in with Google",
      };
  }
}

const GoogleIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24">
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
    <section className="relative overflow-hidden px-6 pb-24 pt-28 sm:pb-28 sm:pt-36 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
          <div className="text-center lg:text-left">
            <p data-hero-stagger className="landing-kicker mx-auto lg:mx-0">
              PRIVATE AI MEETING NOTES
            </p>

            <h1
              data-hero-stagger
              className="landing-section-title mt-5 text-5xl font-extrabold leading-tight tracking-tight sm:text-6xl lg:text-7xl"
            >
              <span className="landing-gradient-title">Write less.</span>
              <br />
              <span className="landing-gradient-title">Decide faster.</span>
            </h1>

            <p
              data-hero-stagger
              className="mx-auto mt-7 max-w-xl text-lg leading-8 text-text-body lg:mx-0"
            >
              Capture live transcript while the conversation happens, then turn
              it into polished summaries, action items, and exports after the
              meeting.
            </p>

            <div
              data-hero-stagger
              className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row lg:justify-start"
            >
              {session ? (
                <Link href="/notes">
                  <button className="btn-gradient-landing rounded-2xl px-8 py-3 text-lg font-semibold text-white">
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
                    className="text-sm font-semibold leading-6 text-text-heading transition-colors hover:text-primary"
                  >
                    See how it works -&gt;
                  </Link>
                </>
              )}
            </div>

            <div
              data-hero-stagger
              className="mt-10 grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3"
            >
              {trustItems.map((item) => (
                <div
                  key={item}
                  className="landing-pill flex items-center justify-center gap-2 px-4 py-2 text-sm text-text-body lg:justify-start"
                >
                  <svg
                    className="h-4 w-4 text-primary"
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
            </div>
          </div>

          <div className="hidden lg:block">
            <div
              data-hero-stagger
              data-float
              className="relative mx-auto max-w-lg"
            >
              <div className="landing-preview-glow absolute -inset-10 -z-10" />
              <MockPreview />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

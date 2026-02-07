"use client";

import Link from "next/link";
import { Button } from "@ainotes/ui";
import { useSession, signIn } from "next-auth/react";

export function Hero() {
  const { data: session } = useSession();

  return (
    <section className="bg-white px-6 py-24 sm:py-32 lg:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
          Private AI Meeting Notes
        </h1>
        <p className="mt-6 text-lg leading-8 text-gray-600">
          Capture, transcribe, and summarize your meetings locally. Your data
          stays on your device. Open source and developer-friendly.
        </p>
        <div className="mt-10 flex items-center justify-center gap-x-6">
          {session ? (
            <Link href="/notes">
              <Button size="lg" variant="primary">
                Go to Notes
              </Button>
            </Link>
          ) : (
            <div className="flex gap-x-4">
              <Button
                size="lg"
                variant="primary"
                onClick={() => signIn(undefined, { callbackUrl: "/notes" })}
              >
                Sign up
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => signIn(undefined, { callbackUrl: "/notes" })}
              >
                Log in
              </Button>
            </div>
          )}
          <Link
            href="https://github.com/Rakeshtagadghar/meeting-assistant"
            target="_blank"
          >
            <span className="text-sm font-semibold leading-6 text-gray-900">
              View on GitHub <span aria-hidden="true">→</span>
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}

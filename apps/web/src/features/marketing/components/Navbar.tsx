"use client";

import Link from "next/link";
import { useSession, signIn, signOut } from "next-auth/react";
import { useState, useEffect } from "react";

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Privacy", href: "#privacy" },
  { label: "Pricing", href: "/pricing" },
];

export function Navbar() {
  const { data: session } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 12);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "border-b border-white/30 bg-white/70 shadow-[0_8px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl"
          : "bg-transparent"
      }`}
    >
      <nav
        className="mx-auto flex max-w-7xl items-center justify-between p-4 lg:px-8"
        aria-label="Global"
      >
        <div className="flex lg:flex-1" data-hero-stagger>
          <Link
            href="/"
            className="landing-section-title -m-1.5 p-1.5 text-xl font-bold landing-gradient-title"
          >
            AINotes
          </Link>
        </div>

        <div className="flex lg:hidden">
          <button
            type="button"
            className="-m-2.5 inline-flex items-center justify-center rounded-md p-2.5 text-text-heading"
            onClick={() => setMobileMenuOpen(true)}
          >
            <span className="sr-only">Open main menu</span>
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
              />
            </svg>
          </button>
        </div>

        <div className="hidden lg:flex lg:gap-x-8">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="text-sm font-semibold text-text-body transition-colors hover:text-primary"
              data-hero-stagger
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="hidden lg:flex lg:flex-1 lg:items-center lg:justify-end lg:gap-4">
          {session ? (
            <>
              <Link
                href="/notes"
                className="text-sm font-semibold text-text-body transition-colors hover:text-primary"
              >
                Dashboard
              </Link>
              <button
                onClick={() => signOut()}
                className="text-sm font-semibold text-text-muted transition-colors hover:text-text-heading"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => signIn()}
                className="text-sm font-semibold text-text-body transition-colors hover:text-primary"
                data-hero-stagger
              >
                Sign in
              </button>
              <button
                onClick={() => signIn(undefined, { callbackUrl: "/notes" })}
                className="btn-gradient-landing rounded-xl px-4 py-2 text-sm font-medium text-white"
                data-hero-stagger
              >
                Get started
              </button>
            </>
          )}
        </div>
      </nav>

      {mobileMenuOpen && (
        <div className="lg:hidden" role="dialog" aria-modal="true">
          <div
            className="fixed inset-0 z-50 bg-slate-900/20 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="fixed inset-y-0 right-0 z-50 w-full overflow-y-auto bg-white px-6 py-6 sm:max-w-sm">
            <div className="flex items-center justify-between">
              <Link
                href="/"
                className="landing-section-title -m-1.5 p-1.5 text-xl font-bold landing-gradient-title"
              >
                AINotes
              </Link>
              <button
                type="button"
                className="-m-2.5 rounded-md p-2.5 text-text-heading"
                onClick={() => setMobileMenuOpen(false)}
              >
                <span className="sr-only">Close menu</span>
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="1.5"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="mt-6 flow-root">
              <div className="-my-6 divide-y divide-gray-200">
                <div className="space-y-2 py-6">
                  {navLinks.map((link) => (
                    <Link
                      key={link.label}
                      href={link.href}
                      className="-mx-3 block rounded-lg px-3 py-2 text-base font-medium text-text-heading hover:bg-gray-50"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
                <div className="space-y-3 py-6">
                  {session ? (
                    <>
                      <Link
                        href="/notes"
                        className="-mx-3 block rounded-lg px-3 py-2.5 text-base font-semibold text-text-heading hover:bg-gray-50"
                      >
                        Dashboard
                      </Link>
                      <button
                        onClick={() => signOut()}
                        className="-mx-3 block w-full rounded-lg px-3 py-2.5 text-left text-base font-semibold text-text-heading hover:bg-gray-50"
                      >
                        Sign out
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => signIn()}
                        className="-mx-3 block w-full rounded-lg px-3 py-2.5 text-left text-base font-medium text-text-heading hover:bg-gray-50"
                      >
                        Sign in
                      </button>
                      <button
                        onClick={() =>
                          signIn(undefined, { callbackUrl: "/notes" })
                        }
                        className="btn-gradient-landing w-full rounded-xl px-4 py-3 text-base font-medium text-white"
                      >
                        Get started
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

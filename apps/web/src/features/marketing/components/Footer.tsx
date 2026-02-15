import Link from "next/link";

const footerLinks = [
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Cookies", href: "/cookies" },
  { label: "Contact", href: "/contact" },
];

export function Footer() {
  return (
    <footer className="relative pb-10 pt-6">
      <div
        className="mx-auto max-w-7xl overflow-hidden px-6 lg:px-8"
        data-stagger-group
      >
        <div className="landing-glass-card flex flex-col items-center justify-between gap-6 rounded-3xl px-6 py-8 sm:flex-row">
          <Link
            href="/"
            data-stagger-item
            className="landing-section-title text-xl font-bold landing-gradient-title"
          >
            AINotes
          </Link>

          <nav
            className="flex flex-wrap justify-center gap-x-8 gap-y-2"
            aria-label="Footer"
          >
            {footerLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                data-stagger-item
                className="text-sm font-medium text-text-muted transition-colors hover:text-text-heading"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <p className="mt-8 text-center text-xs text-text-muted">
          Copyright {new Date().getFullYear()} AINotes. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

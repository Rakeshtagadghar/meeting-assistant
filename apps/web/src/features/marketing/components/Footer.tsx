import Link from "next/link";

const footerLinks = [
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Cookies", href: "/cookies" },
  { label: "Contact", href: "/contact" },
];

export function Footer() {
  return (
    <footer className="bg-white border-t border-gray-100">
      <div className="mx-auto max-w-7xl overflow-hidden px-6 py-12 lg:px-8">
        {/* Logo and nav */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <Link href="/" className="text-xl font-bold gradient-text">
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
                className="text-sm text-text-muted hover:text-text-heading transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Copyright */}
        <p className="mt-8 text-center text-xs text-text-muted">
          © {new Date().getFullYear()} AINotes. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

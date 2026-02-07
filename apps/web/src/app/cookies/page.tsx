import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description: "How we use cookies.",
};

export default function CookiesPage() {
  return (
    <div className="mx-auto max-w-3xl p-8">
      <h1 className="mb-6 text-3xl font-bold">Cookie Policy</h1>
      <div className="prose">
        <p>We use cookies to improve your experience.</p>
        <h2>1. Necessary Cookies</h2>
        <p>
          These are required for the app to function (e.g., authentication).
        </p>
        {/* Add full legal text here */}
      </div>
    </div>
  );
}

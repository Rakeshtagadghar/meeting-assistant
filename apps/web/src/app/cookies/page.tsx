import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description: "AINotes cookie policy - how we use cookies.",
};

export default function CookiesPage() {
  return (
    <main className="mx-auto max-w-4xl p-8">
      <h1 className="text-3xl font-bold">Cookie Policy</h1>
      <p className="mt-4 text-gray-600">
        We only use necessary cookies by default. Analytics require your
        consent.
      </p>
    </main>
  );
}

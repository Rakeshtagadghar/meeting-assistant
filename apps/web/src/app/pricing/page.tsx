import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing",
  description: "AINotes pricing - free to get started with local AI.",
};

export default function PricingPage() {
  return (
    <main className="mx-auto max-w-4xl p-8">
      <h1 className="text-3xl font-bold">Pricing</h1>
      <p className="mt-4 text-gray-600">
        Free tier with local AI. No credit card required.
      </p>
    </main>
  );
}

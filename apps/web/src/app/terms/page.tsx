import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms and Conditions",
  description: "AINotes terms and conditions of service.",
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-4xl p-8">
      <h1 className="text-3xl font-bold">Terms and Conditions</h1>
      <p className="mt-4 text-gray-600">
        By using AINotes, you agree to these terms.
      </p>
    </main>
  );
}

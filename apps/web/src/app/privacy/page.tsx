import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "AINotes privacy policy - how we handle your data.",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-4xl p-8">
      <h1 className="text-3xl font-bold">Privacy Policy</h1>
      <p className="mt-4 text-gray-600">
        Your data is private by default. We only store what you choose to share.
      </p>
    </main>
  );
}

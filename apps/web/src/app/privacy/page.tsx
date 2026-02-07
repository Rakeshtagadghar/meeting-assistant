import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Our commitment to your privacy.",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl p-8">
      <h1 className="mb-6 text-3xl font-bold">Privacy Policy</h1>
      <p className="mb-4">Last updated: {new Date().toLocaleDateString()}</p>
      <div className="prose">
        <p>
          At AINotes, we take your privacy seriously. This application is
          designed to process your data locally on your device whenever
          possible.
        </p>
        <h2>1. Data Collection</h2>
        <p>We do not collect personal data without your explicit consent.</p>
        {/* Add full legal text here */}
      </div>
    </div>
  );
}

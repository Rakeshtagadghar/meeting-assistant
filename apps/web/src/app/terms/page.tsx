import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms and conditions for using AINotes.",
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl p-8">
      <h1 className="mb-6 text-3xl font-bold">Terms of Service</h1>
      <div className="prose">
        <p>By using AINotes, you agree to these terms.</p>
        <h2>1. Usage</h2>
        <p>You are responsible for your use of the application.</p>
        {/* Add full legal text here */}
      </div>
    </div>
  );
}

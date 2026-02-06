import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Home",
  description: "AINotes: AI-powered meeting notes that are private by default.",
};

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold tracking-tight">AINotes</h1>
      <p className="mt-4 text-lg text-gray-600">
        AI-powered meeting notes, private by default.
      </p>
    </main>
  );
}

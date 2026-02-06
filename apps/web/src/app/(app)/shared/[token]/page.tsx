import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shared Note",
};

export default function SharedNotePage() {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">Shared Note</h1>
    </main>
  );
}

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Notes",
};

export default function NotesPage() {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">My Notes</h1>
    </main>
  );
}

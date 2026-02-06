import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Note Editor",
};

export default function NoteEditorPage() {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">Note Editor</h1>
    </main>
  );
}

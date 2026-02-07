import type { Metadata } from "next";
import { NoteEditor } from "@/features/editor";

export const metadata: Metadata = {
  title: "Note Editor",
};

export default async function NoteEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <NoteEditor noteId={id} />;
}

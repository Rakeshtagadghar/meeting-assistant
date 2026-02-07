import type { Metadata } from "next";
import { NotesListView } from "@/features/notes";

export const metadata: Metadata = {
  title: "Notes",
};

export default function NotesPage() {
  return <NotesListView />;
}

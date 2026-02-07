import type { Metadata } from "next";
import { SharedNoteView } from "@/features/share";

export const metadata: Metadata = {
  title: "Shared Note",
};

export default async function SharedNotePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <SharedNoteView token={token} />;
}

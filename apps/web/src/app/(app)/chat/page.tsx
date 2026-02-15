import type { Metadata } from "next";
import { ChatWithNotesView } from "@/features/chat";

export const metadata: Metadata = {
  title: "Chat",
};

export default function ChatPage() {
  return <ChatWithNotesView />;
}

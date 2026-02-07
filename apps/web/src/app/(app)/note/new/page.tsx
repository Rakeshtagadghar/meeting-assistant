"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@ainotes/ui";

export default function NewNotePage() {
  const router = useRouter();
  const created = useRef(false);

  useEffect(() => {
    if (created.current) return;
    created.current = true;

    async function create() {
      try {
        const res = await fetch("/api/notes", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: "Untitled Note",
            contentRich: {},
            contentPlain: "",
          }),
        });

        if (!res.ok) {
          throw new Error("Failed to create note");
        }

        const data = await res.json();
        router.replace(`/note/${data.noteId}`);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Error creating note:", error);
        router.push("/notes");
      }
    }

    create();
  }, [router]);

  return (
    <div className="flex h-[50vh] w-full flex-col items-center justify-center gap-4">
      <Spinner size="lg" />
      <p className="text-gray-500">Creating new note...</p>
    </div>
  );
}

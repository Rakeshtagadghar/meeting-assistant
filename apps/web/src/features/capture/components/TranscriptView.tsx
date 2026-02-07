"use client";

import { useEffect, useRef } from "react";
import { Card } from "@ainotes/ui";
import { type TranscriptSegment } from "../hooks/use-transcript";

interface TranscriptViewProps {
  segments: TranscriptSegment[];
}

export function TranscriptView({ segments }: TranscriptViewProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [segments]);

  if (segments.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-gray-400">
        <p>Waiting for audio...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      {segments.map((segment) => (
        <Card key={segment.id} className="p-3">
          <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
            <span className="font-semibold text-blue-600">
              {segment.speaker}
            </span>
            <span>{new Date(segment.timestamp).toLocaleTimeString()}</span>
          </div>
          <p className="text-gray-800">{segment.text}</p>
        </Card>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}

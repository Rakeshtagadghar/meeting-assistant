"use client";

interface TranscriptBubbleProps {
  speaker: string | null;
  text: string;
  timestamp?: string;
  isPartial?: boolean;
  showTimestamp?: boolean;
  alignment?: "left" | "right";
  /** Override speaker label color class */
  speakerClassName?: string;
  /** Override bubble background color class */
  bubbleClassName?: string;
}

export function TranscriptBubble({
  speaker,
  text,
  timestamp,
  isPartial = false,
  showTimestamp = false,
  alignment = "left",
  speakerClassName,
  bubbleClassName,
}: TranscriptBubbleProps) {
  const isRight = alignment === "right";

  const defaultBubbleBg = isRight ? "bg-[#d4e4bc]" : "bg-warm-200";
  const bubbleBg = bubbleClassName ?? defaultBubbleBg;

  return (
    <div
      className={`flex flex-col gap-0.5 ${isRight ? "items-end" : "items-start"}`}
    >
      {/* Speaker label */}
      {speaker && (
        <span
          className={`px-1 text-xs font-semibold ${speakerClassName ?? "text-warm-500"}`}
        >
          {speaker}
        </span>
      )}

      {/* Bubble */}
      <div
        className={`max-w-[85%] px-3 py-2 text-sm text-gray-800 ${
          isRight
            ? `rounded-lg rounded-br-sm ${bubbleBg}`
            : `rounded-lg rounded-bl-sm ${bubbleBg}`
        }`}
      >
        <span>{text}</span>
        {isPartial && (
          <span className="ml-0.5 inline-block h-3.5 w-1 animate-pulse bg-warm-400" />
        )}
      </div>

      {/* Timestamp */}
      {showTimestamp && timestamp && (
        <span className="px-1 text-[10px] text-warm-400">{timestamp}</span>
      )}
    </div>
  );
}

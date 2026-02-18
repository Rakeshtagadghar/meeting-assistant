"use client";

interface TranscriptBubbleProps {
  speaker: string | null;
  text: string;
  timestamp?: string;
  isPartial?: boolean;
  showTimestamp?: boolean;
  showSpeaker?: boolean;
  confidence?: number | null;
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
  showSpeaker = true,
  confidence = null,
  alignment = "left",
  speakerClassName,
  bubbleClassName,
}: TranscriptBubbleProps) {
  const isRight = alignment === "right";

  const defaultBubbleBg = isRight
    ? "border border-emerald-200 bg-emerald-50"
    : "border border-warm-200 bg-warm-100";
  const bubbleBg = bubbleClassName ?? defaultBubbleBg;

  return (
    <div
      className={`flex flex-col gap-0.5 ${isRight ? "items-end" : "items-start"}`}
    >
      {/* Speaker label */}
      {speaker && showSpeaker && (
        <span
          className={`px-1 text-xs font-semibold ${speakerClassName ?? "text-warm-500"}`}
        >
          {speaker}
        </span>
      )}

      {/* Bubble */}
      <div
        className={`max-w-[88%] px-3 py-2 text-sm text-gray-800 shadow-sm ${
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
      {(showTimestamp && timestamp) || confidence !== null ? (
        <div className="flex items-center gap-2 px-1 text-[10px] text-warm-400">
          {showTimestamp && timestamp && <span>{timestamp}</span>}
          {confidence !== null && (
            <span>Conf {Math.round(confidence * 100)}%</span>
          )}
        </div>
      ) : null}
    </div>
  );
}

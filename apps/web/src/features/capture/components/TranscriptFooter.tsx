"use client";

import { Button } from "@ainotes/ui";
import { MicLevelIndicator } from "./MicLevelIndicator";
import { LanguageSelector } from "./LanguageSelector";

export type TranscriptWindowState =
  | "idle"
  | "listening"
  | "paused"
  | "processing"
  | "completed";

interface TranscriptFooterProps {
  windowState: TranscriptWindowState;
  micLevel: number;
  language: string;
  onLanguageChange: (lang: string) => void;
  onPauseResume: () => void;
  onStop: () => void;
}

export function TranscriptFooter({
  windowState,
  micLevel,
  language,
  onLanguageChange,
  onPauseResume,
  onStop,
}: TranscriptFooterProps) {
  const isActive = windowState === "listening" || windowState === "paused";
  const isPaused = windowState === "paused";

  return (
    <div className="flex items-center justify-between border-t border-warm-200/60 bg-warm-50 px-3 py-2">
      {/* Left: mic level */}
      <MicLevelIndicator
        level={micLevel}
        isActive={windowState === "listening"}
      />

      {/* Center: controls */}
      <div className="flex items-center gap-2">
        {isActive && (
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={onPauseResume}
              className="text-xs"
            >
              {isPaused ? "Resume" : "Pause"}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={onStop}
              className="bg-red-50 text-xs text-red-600 hover:bg-red-100"
            >
              Stop
            </Button>
          </>
        )}
        {windowState === "processing" && (
          <span className="text-xs text-warm-400">Finalizing...</span>
        )}
        {windowState === "completed" && (
          <span className="text-xs text-green-600">Transcript saved</span>
        )}
      </div>

      {/* Right: language selector */}
      <LanguageSelector value={language} onChange={onLanguageChange} />
    </div>
  );
}

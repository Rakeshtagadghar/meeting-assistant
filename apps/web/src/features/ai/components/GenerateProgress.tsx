"use client";

import { useCallback } from "react";
import { Button, ProgressBar, Badge } from "@ainotes/ui";
import { useGenerate } from "../hooks/use-generate";

export interface GenerateProgressProps {
  noteId: string;
  onComplete?: () => void;
}

const statusVariant = (status: string | null) => {
  switch (status) {
    case "COMPLETED":
      return "success" as const;
    case "FAILED":
      return "error" as const;
    case "CANCELLED":
      return "warning" as const;
    case "RUNNING":
      return "info" as const;
    case "QUEUED":
      return "default" as const;
    default:
      return "default" as const;
  }
};

const progressBarVariant = (status: string | null) => {
  switch (status) {
    case "COMPLETED":
      return "success" as const;
    case "FAILED":
      return "error" as const;
    case "CANCELLED":
      return "warning" as const;
    default:
      return "default" as const;
  }
};

export function GenerateProgress({
  noteId,
  onComplete,
}: GenerateProgressProps) {
  const { generate, status, progressPct, message, cancel, error } =
    useGenerate(noteId);

  const handleGenerate = useCallback(async () => {
    await generate();
  }, [generate]);

  const handleComplete = useCallback(() => {
    onComplete?.();
  }, [onComplete]);

  const isGenerating = status === "QUEUED" || status === "RUNNING";
  const isComplete = status === "COMPLETED";
  const isIdle = status === null;

  return (
    <div className="space-y-3">
      {isIdle && <Button onClick={handleGenerate}>Generate</Button>}

      {status && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant={statusVariant(status)}>{status}</Badge>
            {message && (
              <span className="text-sm text-gray-600">{message}</span>
            )}
          </div>

          <ProgressBar
            value={progressPct}
            label="Generation progress"
            variant={progressBarVariant(status)}
          />

          {isGenerating && (
            <Button variant="secondary" onClick={cancel}>
              Cancel
            </Button>
          )}

          {isComplete && <Button onClick={handleComplete}>Done</Button>}
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

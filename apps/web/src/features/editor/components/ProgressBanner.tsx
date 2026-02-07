"use client";

import { Button } from "@ainotes/ui";

export interface ProgressBannerProps {
  progressPct: number;
  message: string;
  onCancel: () => void;
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED" | "IDLE";
}

export function ProgressBanner({
  progressPct,
  message,
  onCancel,
  status,
}: ProgressBannerProps) {
  if (status === "IDLE" || status === "COMPLETED" || status === "CANCELLED") {
    return null;
  }

  const isError = status === "FAILED";

  return (
    <div
      className={`flex items-center justify-between border-b px-4 py-2 text-sm ${
        isError ? "bg-red-50 border-red-200" : "bg-blue-50 border-blue-200"
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-1 items-center gap-4">
        {isError ? (
          <span className="font-medium text-red-700">Error: {message}</span>
        ) : (
          <div className="flex w-full items-center gap-4">
            <span className="whitespace-nowrap font-medium text-blue-700">
              {message || "Processing..."}
            </span>
            <div className="h-2 w-full max-w-xs overflow-hidden rounded-full bg-blue-200">
              <div
                className="h-full bg-blue-600 transition-all duration-500 ease-out"
                style={{ width: `${Math.max(5, progressPct)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {!isError && (
        <Button
          variant="secondary"
          onClick={onCancel}
          className="ml-4 h-7 min-w-[70px] px-2 text-xs"
        >
          Cancel
        </Button>
      )}
    </div>
  );
}

"use client";

import { Button } from "@ainotes/ui";

export interface EmptyStateProps {
  onCreateNote?: () => void;
}

export function EmptyState({ onCreateNote }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <svg
        className="mb-4 h-16 w-16 text-gray-300"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
      <h2 className="text-xl font-semibold text-gray-900">No notes yet</h2>
      <p className="mt-2 text-sm text-gray-500">
        Get started by creating your first note to capture ideas, meetings, and
        more.
      </p>
      {onCreateNote && (
        <Button className="mt-6" onClick={onCreateNote}>
          Create your first note
        </Button>
      )}
    </div>
  );
}

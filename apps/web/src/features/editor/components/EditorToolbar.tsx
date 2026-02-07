"use client";

import { Button, Spinner } from "@ainotes/ui";

export interface EditorToolbarProps {
  onBold?: () => void;
  onItalic?: () => void;
  onHeading?: () => void;
  onBulletList?: () => void;
  onGenerate: () => void;
  isGenerating?: boolean;
  disabled?: boolean;
}

export function EditorToolbar({
  onBold,
  onItalic,
  onHeading,
  onBulletList,
  onGenerate,
  isGenerating = false,
  disabled = false,
}: EditorToolbarProps) {
  return (
    <div
      className="flex items-center gap-1 border-b border-gray-200 p-2"
      role="toolbar"
      aria-label="Editor toolbar"
    >
      <div className="flex items-center gap-1 border-r border-gray-200 pr-2">
        <button
          type="button"
          onClick={onBold}
          disabled={disabled}
          className="rounded p-2 hover:bg-gray-100 disabled:opacity-50"
          title="Bold"
          aria-label="Bold"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 12h8a4 4 0 100-8H6v8zm0 0h9a4 4 0 110 8H6v-8z"
            />
          </svg>
        </button>

        <button
          type="button"
          onClick={onItalic}
          disabled={disabled}
          className="rounded p-2 hover:bg-gray-100 disabled:opacity-50"
          title="Italic"
          aria-label="Italic"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 4h4m-2 0v16m-4 0h8"
            />
          </svg>
        </button>

        <button
          type="button"
          onClick={onHeading}
          disabled={disabled}
          className="rounded p-2 hover:bg-gray-100 disabled:opacity-50"
          title="Heading"
          aria-label="Heading"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h8"
            />
          </svg>
        </button>

        <button
          type="button"
          onClick={onBulletList}
          disabled={disabled}
          className="rounded p-2 hover:bg-gray-100 disabled:opacity-50"
          title="Bullet list"
          aria-label="Bullet list"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h.01M8 6h12M4 12h.01M8 12h12M4 18h.01M8 18h12"
            />
          </svg>
        </button>
      </div>

      <div className="flex-1" />

      <Button
        onClick={onGenerate}
        disabled={disabled || isGenerating}
        variant="primary"
      >
        {isGenerating ? (
          <>
            <Spinner size="sm" />
            <span className="ml-2">Generating...</span>
          </>
        ) : (
          "Generate"
        )}
      </Button>
    </div>
  );
}

"use client";

import { useState, useRef, useEffect } from "react";

interface TranscriptHeaderProps {
  onClose?: () => void;
  onSearch?: (query: string) => void;
}

export function TranscriptHeader({ onClose, onSearch }: TranscriptHeaderProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchOpen) {
      inputRef.current?.focus();
    }
  }, [searchOpen]);

  const handleToggleSearch = () => {
    if (searchOpen) {
      setSearchQuery("");
      onSearch?.("");
      setSearchOpen(false);
    } else {
      setSearchOpen(true);
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    onSearch?.(value);
  };

  return (
    <div className="flex items-center justify-between border-b border-warm-200/60 bg-warm-50 px-3 py-2">
      {/* Left: search */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleToggleSearch}
          className="rounded p-1 text-warm-400 transition-colors hover:bg-warm-100 hover:text-warm-600"
          aria-label={searchOpen ? "Close search" : "Search transcript"}
        >
          {searchOpen ? (
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          ) : (
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          )}
        </button>
        {searchOpen && (
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search transcript..."
            className="w-48 rounded border border-warm-200 bg-white px-2 py-1 text-xs text-gray-700 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
          />
        )}
      </div>

      {/* Right: close */}
      <div className="flex items-center gap-1">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-warm-400 transition-colors hover:bg-warm-100 hover:text-warm-600"
            aria-label="Close"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

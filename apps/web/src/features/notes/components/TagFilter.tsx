"use client";

import { Badge } from "@ainotes/ui";

export interface TagFilterProps {
  tags: readonly string[];
  selectedTag: string | null;
  onTagSelect: (tag: string | null) => void;
}

export function TagFilter({ tags, selectedTag, onTagSelect }: TagFilterProps) {
  return (
    <div
      className="flex flex-wrap gap-2"
      role="group"
      aria-label="Filter by tag"
    >
      <button
        type="button"
        onClick={() => onTagSelect(null)}
        className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
          selectedTag === null
            ? "bg-blue-600 text-white"
            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
        }`}
        aria-pressed={selectedTag === null}
      >
        All
      </button>

      {tags.map((tag) => (
        <Badge
          key={tag}
          variant={selectedTag === tag ? "info" : "default"}
          onClick={() => onTagSelect(tag)}
          className="cursor-pointer"
        >
          {tag}
        </Badge>
      ))}
    </div>
  );
}

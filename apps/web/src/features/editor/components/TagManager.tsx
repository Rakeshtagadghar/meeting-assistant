"use client";

import { useState } from "react";
import { Badge, Input } from "@ainotes/ui";

export interface TagManagerProps {
  tags: readonly string[];
  onTagsChange: (tags: string[]) => void;
  maxTags?: number;
}

export function TagManager({
  tags,
  onTagsChange,
  maxTags = 10,
}: TagManagerProps) {
  const [inputValue, setInputValue] = useState("");

  const handleAddTag = () => {
    const newTag = inputValue.trim().toLowerCase();

    if (newTag && !tags.includes(newTag) && tags.length < maxTags) {
      onTagsChange([...tags, newTag]);
      setInputValue("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    onTagsChange(tags.filter((tag) => tag !== tagToRemove));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2" role="list" aria-label="Tags">
        {tags.map((tag) => (
          <Badge
            key={tag}
            variant="default"
            removable
            onRemove={() => handleRemoveTag(tag)}
          >
            {tag}
          </Badge>
        ))}
      </div>

      {tags.length < maxTags && (
        <div className="flex gap-2">
          <Input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add tag..."
            aria-label="Add new tag"
            className="flex-1"
          />
          <button
            type="button"
            onClick={handleAddTag}
            disabled={!inputValue.trim()}
            className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Add
          </button>
        </div>
      )}

      {tags.length >= maxTags && (
        <p className="text-sm text-gray-500">Maximum {maxTags} tags reached</p>
      )}
    </div>
  );
}

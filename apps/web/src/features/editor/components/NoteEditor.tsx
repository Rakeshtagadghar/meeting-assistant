"use client";

import { useState, useCallback, useEffect } from "react";
import { Input, Badge, Button, Spinner } from "@ainotes/ui";
import { useNote } from "../hooks/use-note";
import { useAutosave } from "../hooks/use-autosave";
import { SummaryPanel } from "./SummaryPanel";

export interface NoteEditorProps {
  noteId: string;
}

export function NoteEditor({ noteId }: NoteEditorProps) {
  const { note, summaries, artifacts, loading, error } = useNote(noteId);
  const { save, saving, lastSaved } = useAutosave(noteId);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [pinned, setPinned] = useState(false);
  const [tagInput, setTagInput] = useState("");

  // Sync local state when note loads
  useEffect(() => {
    if (note) {
      setTitle(note.title);
      setContent(note.contentPlain);
      setTags([...note.tags]);
      setPinned(note.pinned);
    }
  }, [note]);

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newTitle = e.target.value;
      setTitle(newTitle);
      save({ title: newTitle });
    },
    [save],
  );

  const handleContentChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newContent = e.target.value;
      setContent(newContent);
      save({ contentPlain: newContent });
    },
    [save],
  );

  const handleTogglePin = useCallback(() => {
    const newPinned = !pinned;
    setPinned(newPinned);
    save({ pinned: newPinned });
  }, [pinned, save]);

  const handleAddTag = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && tagInput.trim()) {
        e.preventDefault();
        const newTag = tagInput.trim().toLowerCase();
        if (!tags.includes(newTag)) {
          const newTags = [...tags, newTag];
          setTags(newTags);
          save({ tags: newTags });
        }
        setTagInput("");
      }
    },
    [tagInput, tags, save],
  );

  const handleRemoveTag = useCallback(
    (tagToRemove: string) => {
      const newTags = tags.filter((t) => t !== tagToRemove);
      setTags(newTags);
      save({ tags: newTags });
    },
    [tags, save],
  );

  if (loading) {
    return (
      <div
        className="flex items-center justify-center p-8"
        data-testid="editor-loading"
      >
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-red-600" role="alert">
        <p>Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          {saving && <span>Saving...</span>}
          {lastSaved && !saving && (
            <span>Last saved {lastSaved.toLocaleTimeString()}</span>
          )}
        </div>
        <Button
          variant={pinned ? "primary" : "secondary"}
          onClick={handleTogglePin}
          aria-label={pinned ? "Unpin note" : "Pin note"}
          aria-pressed={pinned}
        >
          {pinned ? "Pinned" : "Pin"}
        </Button>
      </div>

      {/* Title */}
      <Input
        value={title}
        onChange={handleTitleChange}
        placeholder="Untitled note"
        aria-label="Note title"
        className="text-2xl font-bold"
      />

      {/* Content area (placeholder textarea until TipTap is integrated) */}
      <textarea
        value={content}
        onChange={handleContentChange}
        placeholder="Start writing..."
        aria-label="Note content"
        className="min-h-[300px] w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
        rows={12}
      />

      {/* Tags */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2" data-testid="tags-container">
          {tags.map((tag) => (
            <Badge key={tag} removable onRemove={() => handleRemoveTag(tag)}>
              {tag}
            </Badge>
          ))}
        </div>
        <Input
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={handleAddTag}
          placeholder="Add a tag and press Enter"
          aria-label="Add tag"
        />
      </div>

      {/* Summary Panel */}
      <SummaryPanel summaries={summaries} artifacts={artifacts} />
    </div>
  );
}

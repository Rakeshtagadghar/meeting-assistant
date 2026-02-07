import { useState, useCallback, useEffect } from "react";
import { Input, Badge, Button, Spinner } from "@ainotes/ui";
import { useNote } from "../hooks/use-note";
import { useAutosave } from "../hooks/use-autosave";
import { useJobProgress } from "../hooks/use-job-progress";
import { SummaryPanel } from "./SummaryPanel";
import { ProgressBanner } from "./ProgressBanner";
import { EditorToolbar } from "./EditorToolbar"; // Assuming this is imported, though not in original file it was used in NoteEditor? checking original file...
// Wait, original file didn't import EditorToolbar in the snippet I saw in step 335.
// Ah, NoteEditor uses EditorToolbar? No, looking at step 335, NoteEditor doesn't seem to use EditorToolbar?
// Check NoteEditor again.
// It seems I missed EditorToolbar usage in NoteEditor in step 335?
// StartLine: 13, EndLine: 162.
// I see imports: Input, Badge, Button, Spinner, useNote, useAutosave, SummaryPanel.
// I DO NOT see EditorToolbar in imports or usage in the snippet in step 335.
// Maybe it allows passing it as children or it's not used there?
// Implementation plan said "MODIFY NoteEditor.tsx - Pass isGenerating state to EditorToolbar".
// If EditorToolbar is not in NoteEditor, where is it?
// Maybe it's in a parent component?
// Let's check where EditorToolbar is used.
// But for now, I will assume I need to add it or it was omitted in my previous read?
// Step 335 output shows lines 1-8 and 9-11 and 13-162.
// The snippet 13-162 shows the component body.
// It returns a div with Header, Title, Content area (textarea), Tags, SummaryPanel.
// It DOES NOT render EditorToolbar.
// This means EditorToolbar might be rendered by a parent (`page.tsx`?) or I missed it.
// Let's check `apps/web/src/app/app/note/[id]/page.tsx` or similar?

// Wait, I should add EditorToolbar to NoteEditor if it's missing, or find where it is.
// But the plan "Editor UI + Progress" implies adding these controls.
// If NoteEditor currently just has a textarea, I should probably add EditorToolbar above it?
// The task "Editor UI + Generate progress banner" suggests I should add these.
// So I will import EditorToolbar and add it.

export interface NoteEditorProps {
  noteId: string;
}

export function NoteEditor({ noteId }: NoteEditorProps) {
  const { note, summaries, artifacts, loading, error, refetch } =
    useNote(noteId);
  const { save, saving, lastSaved } = useAutosave(noteId);

  const {
    progressPct,
    message,
    status: jobStatus,
    startTracking,
    cancelJob,
    reset: resetJob,
  } = useJobProgress();

  const isGenerating = jobStatus === "QUEUED" || jobStatus === "RUNNING";

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

  // Refresh note data when job completes to show new summaries/artifacts
  useEffect(() => {
    if (jobStatus === "COMPLETED") {
      void refetch();
    }
  }, [jobStatus, refetch]);

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

  const handleGenerate = useCallback(async () => {
    try {
      resetJob();
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteId }),
      });

      if (!res.ok) throw new Error("Failed to start generation");

      const data = await res.json();
      if (data.jobId) {
        startTracking(data.jobId);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Generate failed", error);
      // Optional: show toast or error state
    }
  }, [noteId, resetJob, startTracking]);

  const handleCancelGenerate = useCallback(async () => {
    await cancelJob();
  }, [cancelJob]);

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
        <div className="flex items-center gap-2">
          {/* EditorToolbar could be here or above content */}
          <Button
            variant={pinned ? "primary" : "secondary"}
            onClick={handleTogglePin}
            aria-label={pinned ? "Unpin note" : "Pin note"}
            aria-pressed={pinned}
          >
            {pinned ? "Pinned" : "Pin"}
          </Button>
        </div>
      </div>

      <EditorToolbar
        onGenerate={handleGenerate}
        isGenerating={isGenerating}
        disabled={loading}
      />

      <ProgressBanner
        status={jobStatus}
        progressPct={progressPct}
        message={message}
        onCancel={handleCancelGenerate}
      />

      {/* Title */}
      <Input
        value={title}
        onChange={handleTitleChange}
        placeholder="Untitled note"
        aria-label="Note title"
        className="text-2xl font-bold"
      />

      {/* Content area */}
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
      <SummaryPanel
        summaries={summaries}
        artifacts={artifacts}
        isGenerating={isGenerating}
      />
    </div>
  );
}

import { GripVertical, X } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";

interface TemplateSectionCardProps {
  id: string;
  title: string;
  hint: string;
  onUpdate: (field: "title" | "hint", value: string) => void;
  onDelete: () => void;
}

export function TemplateSectionCard({
  id,
  title,
  hint,
  onUpdate,
  onDelete,
}: TemplateSectionCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-all hover:border-gray-300",
        isDragging && "z-10 shadow-lg ring-1 ring-indigo-500/50",
      )}
    >
      <div
        {...attributes}
        {...listeners}
        className="mt-1 flex h-6 w-6 cursor-grab items-center justify-center rounded text-gray-400 hover:bg-gray-50 hover:text-gray-600 active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" />
      </div>

      <div className="flex-1 space-y-3">
        <div>
          <input
            type="text"
            value={title}
            onChange={(e) => onUpdate("title", e.target.value)}
            placeholder="Section title"
            className="w-full text-base font-medium text-gray-900 placeholder:text-gray-300 focus:outline-none"
          />
        </div>
        <div>
          <textarea
            value={hint || ""}
            onChange={(e) => onUpdate("hint", e.target.value)}
            placeholder="Optional guidance for AI (what to capture)"
            rows={2}
            className="w-full resize-none text-sm text-gray-600 placeholder:text-gray-300 focus:outline-none"
          />
        </div>
      </div>

      <button
        onClick={onDelete}
        className="flex h-6 w-6 items-center justify-center rounded text-gray-300 opacity-0 bg-gray-50 hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 transition-all"
        title="Delete section"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

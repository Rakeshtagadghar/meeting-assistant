import { useEffect, useState } from "react";
import type { Template, TemplateSection } from "@prisma/client";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { TemplateSectionCard } from "./TemplateSectionCard";
import { Plus, Save, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface TemplateEditorProps {
  template: Template & { sections: TemplateSection[] };
  onSave: (
    data: Partial<Template> & { sections: Partial<TemplateSection>[] },
  ) => Promise<void>;
  onCancel: () => void;
  className?: string;
}

export function TemplateEditor({
  template,
  onSave,
  onCancel,
  className,
}: TemplateEditorProps) {
  const [name, setName] = useState(template.name);
  const [meetingContext, setMeetingContext] = useState(template.meetingContext);
  const [sections, setSections] = useState<Partial<TemplateSection>[]>(
    template.sections || [],
  );
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Reset state when template changes
  useEffect(() => {
    setName(template.name);
    setMeetingContext(template.meetingContext);
    setSections(template.sections || []);
    setHasChanges(false);
  }, [template]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setSections((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        const newItems = arrayMove(items, oldIndex, newIndex);
        return newItems.map((item, index) => ({ ...item, order: index }));
      });
      setHasChanges(true);
    }
  };

  const handleAddSection = () => {
    const newSection: Partial<TemplateSection> = {
      id: `temp-${Date.now()}`,
      title: "",
      hint: "",
      order: sections.length,
    };
    setSections([...sections, newSection]);
    setHasChanges(true);
  };

  const handleUpdateSection = (
    id: string,
    field: "title" | "hint",
    value: string,
  ) => {
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)),
    );
    setHasChanges(true);
  };

  const handleDeleteSection = (id: string) => {
    setSections((prev) => prev.filter((s) => s.id !== id));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({
        name,
        meetingContext,
        sections: sections.map((s, i) => ({
          ...s,
          order: i,
          id: s.id?.startsWith("temp-") ? undefined : s.id,
        })),
      });
      setHasChanges(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={cn("flex flex-col h-full bg-transparent", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="flex-1 mr-4">
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setHasChanges(true);
            }}
            className="w-full text-2xl font-bold text-gray-900 placeholder:text-gray-300 focus:outline-none bg-transparent"
            placeholder="Untitled template"
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            className="px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors"
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={
              !hasChanges || isSaving || !name.trim() || sections.length === 0
            }
            className={cn(
              "flex items-center gap-2 rounded-xl btn-gradient-primary px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none",
            )}
          >
            {isSaving ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save changes
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-8 pb-32">
        <div className="mx-auto max-w-3xl space-y-8">
          {/* Meeting Context */}
          <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-amber-500" />
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                AI Context
              </h3>
            </div>
            <div className="relative">
              <textarea
                value={meetingContext}
                onChange={(e) => {
                  setMeetingContext(e.target.value);
                  setHasChanges(true);
                }}
                className="w-full min-h-[100px] resize-none rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm leading-relaxed text-gray-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none transition-all placeholder:text-gray-400"
                placeholder="Describe what this meeting is about. The AI will use this context to generate better summaries..."
              />
            </div>
            <p className="mt-2 text-xs text-gray-500 ml-1">
              This context helps the AI understand the significance of the
              discussion.
            </p>
          </section>

          {/* Sections */}
          <section>
            <div className="flex items-center justify-between mb-4 px-1">
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                Structure
              </h3>
              <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                {sections.length} section{sections.length !== 1 ? "s" : ""}
              </span>
            </div>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={sections.map((s) => s.id!)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-4">
                  {sections.map((section) => (
                    <TemplateSectionCard
                      key={section.id}
                      id={section.id!}
                      title={section.title || ""}
                      hint={section.hint || ""}
                      onUpdate={(field, val) =>
                        handleUpdateSection(section.id!, field, val)
                      }
                      onDelete={() => handleDeleteSection(section.id!)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            <button
              onClick={handleAddSection}
              className="group mt-6 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 py-4 text-sm font-medium text-gray-500 hover:border-indigo-300 hover:bg-indigo-50/50 hover:text-indigo-600 transition-all"
            >
              <div className="p-1 rounded-full bg-gray-100 group-hover:bg-indigo-100 transition-colors">
                <Plus className="h-4 w-4" />
              </div>
              Add new section
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}

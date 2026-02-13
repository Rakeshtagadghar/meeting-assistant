"use client";

import { useEffect, useState, useCallback } from "react";
import { TemplateOwnerType } from "@prisma/client";
import type { Template, TemplateSection } from "@prisma/client";
import { TemplateList } from "@/features/templates/components/TemplateList";
import { TemplateEditor } from "@/features/templates/components/TemplateEditor";

// Extended type including sections
type TemplateWithSections = Template & { sections: TemplateSection[] };

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<TemplateWithSections[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Fetch templates
  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/templates");
      if (!res.ok) throw new Error("Failed to fetch templates");
      const data = await res.json();
      setTemplates(data);
    } catch (error) {
      console.error(error);
      // TODO: Show toast
    }
  }, []);

  useEffect(() => {
    void fetchTemplates();
  }, [fetchTemplates]);

  // Derived state for the selected template (or new draft)
  const selectedTemplate = templates.find((t) => t.id === selectedId) || null;

  const handleSelect = (template: Template) => {
    setSelectedId(template.id);
    setIsCreating(false);
  };

  const handleCreate = () => {
    // We'll handle "creating" by showing a blank editor state
    // but not actually creating a DB record until save.
    // For now, let's just create a dummy object in memory.
    setIsCreating(true);
    setSelectedId(null);
  };

  const handleDuplicate = async (template: Template) => {
    if (!confirm(`Duplicate "${template.name}"?`)) return;

    try {
      const source = templates.find((t) => t.id === template.id);
      if (!source) return;

      const payload = {
        name: `${source.name} (Copy)`,
        icon: source.icon,
        meetingContext: source.meetingContext,
        sections: source.sections.map((s: { title: string; hint: string }) => ({
          title: s.title,
          hint: s.hint,
        })),
      };

      const createRes = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!createRes.ok) throw new Error("Failed to duplicate");
      await fetchTemplates();
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = async (template: Template) => {
    if (!confirm(`Delete "${template.name}"?`)) return;

    try {
      const res = await fetch(`/api/templates/${template.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");

      if (selectedId === template.id) {
        setSelectedId(null);
      }
      await fetchTemplates();
    } catch (error) {
      console.error(error);
    }
  };

  const handleSave = async (data: Partial<TemplateWithSections>) => {
    try {
      if (isCreating) {
        // Create
        const res = await fetch("/api/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error("Failed to create");
        const newTemplate = await res.json();
        await fetchTemplates();
        setSelectedId(newTemplate.id);
        setIsCreating(false);
      } else if (selectedId) {
        // Update
        const res = await fetch(`/api/templates/${selectedId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error("Failed to update");
        await fetchTemplates();
      }
    } catch (error) {
      console.error(error);
      alert("Failed to save template");
    }
  };

  // Draft template for creation mode
  const draftTemplate: TemplateWithSections = {
    id: "new",
    ownerType: TemplateOwnerType.USER,
    ownerUserId: null,
    name: "Untitled template",
    icon: null,
    meetingContext:
      "Capture concise, actionable meeting notes in a structured format.",
    createdAt: new Date(),
    updatedAt: new Date(),
    isDeleted: false,
    sections: [
      {
        id: "s1",
        templateId: "new",
        order: 0,
        title: "Summary",
        hint: "Brief overview of what was discussed.",
      },
      {
        id: "s2",
        templateId: "new",
        order: 1,
        title: "Key points",
        hint: "Important details and insights.",
      },
      {
        id: "s3",
        templateId: "new",
        order: 2,
        title: "Action items",
        hint: "Tasks with owners and due dates if mentioned.",
      },
    ] as TemplateSection[],
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-bg-secondary">
      {/* Sidebar List */}
      <div className="w-80 flex-shrink-0 border-r border-gray-200 bg-white">
        <TemplateList
          templates={templates}
          selectedTemplateId={isCreating ? "new" : selectedId}
          onSelect={handleSelect}
          onCreate={handleCreate}
          onDuplicate={handleDuplicate}
          onDelete={handleDelete}
          className="h-full"
        />
      </div>

      {/* Main Content / Editor */}
      <div className="flex-1 overflow-hidden">
        {isCreating ? (
          <TemplateEditor
            key="new" // Force remount on new
            template={draftTemplate}
            onSave={handleSave}
            onCancel={() => setIsCreating(false)}
            className="h-full"
          />
        ) : selectedTemplate ? (
          <TemplateEditor
            key={selectedTemplate.id}
            template={selectedTemplate}
            onSave={handleSave}
            onCancel={() => setSelectedId(null)}
            className="h-full"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-gray-400">
            <p className="text-lg font-medium">
              Select a template to view or edit
            </p>
            <button
              onClick={handleCreate}
              className="mt-4 text-sm text-indigo-600 hover:text-indigo-800"
            >
              Or create a new one
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

import { TemplateOwnerType } from "@prisma/client";
import type { Template } from "@prisma/client";
import { Plus, Trash2, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

interface TemplateListProps {
  templates: Template[];
  selectedTemplateId: string | null;
  onSelect: (template: Template) => void;
  onCreate: () => void;
  onDuplicate: (template: Template) => void;
  onDelete: (template: Template) => void;
  className?: string;
}

export function TemplateList({
  templates,
  selectedTemplateId,
  onSelect,
  onCreate,
  onDuplicate,
  onDelete,
  className,
}: TemplateListProps) {
  // Group templates
  const systemTemplates = templates.filter(
    (t) => t.ownerType === TemplateOwnerType.SYSTEM,
  );
  const userTemplates = templates.filter(
    (t) => t.ownerType === TemplateOwnerType.USER,
  );

  return (
    <div
      className={cn(
        "flex flex-col h-full bg-white border-r border-gray-200",
        className,
      )}
    >
      <div className="p-4 border-b border-gray-200 space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold gradient-text">Templates</h2>
        </div>

        <button
          onClick={onCreate}
          className="w-full flex items-center justify-center gap-2 rounded-xl btn-gradient-primary px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:shadow-md"
        >
          <Plus className="h-4 w-4" />
          New template
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-6">
        {userTemplates.length > 0 && (
          <div>
            <h3 className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              My templates
            </h3>
            <div className="space-y-1">
              {userTemplates.map((template) => (
                <TemplateItem
                  key={template.id}
                  template={template}
                  isSelected={template.id === selectedTemplateId}
                  onClick={() => onSelect(template)}
                  onDuplicate={() => onDuplicate(template)}
                  onDelete={() => onDelete(template)}
                />
              ))}
            </div>
          </div>
        )}

        {systemTemplates.length > 0 && (
          <div>
            <h3 className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Recommended
            </h3>
            <div className="space-y-1">
              {systemTemplates.map((template) => (
                <TemplateItem
                  key={template.id}
                  template={template}
                  isSelected={template.id === selectedTemplateId}
                  onClick={() => onSelect(template)}
                  onDuplicate={() => onDuplicate(template)}
                  // System templates cannot be deleted by user
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface TemplateItemProps {
  template: Template;
  isSelected: boolean;
  onClick: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
}

function TemplateItem({
  template,
  isSelected,
  onClick,
  onDuplicate,
  onDelete,
}: TemplateItemProps) {
  return (
    <div
      className={cn(
        "group flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all",
        isSelected
          ? "bg-indigo-50/80 text-indigo-900 shadow-sm ring-1 ring-indigo-200"
          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
      )}
      onClick={onClick}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={cn(
            "flex-shrink-0 h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold transition-colors",
            isSelected
              ? "bg-white text-indigo-600 shadow-sm"
              : "bg-gray-100 text-gray-500 group-hover:bg-white group-hover:shadow-sm",
          )}
        >
          {template.icon || template.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{template.name}</p>
        </div>
      </div>

      <div
        className={cn(
          "flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity",
          isSelected && "opacity-100",
        )}
      >
        {onDuplicate && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate();
            }}
            className={cn(
              "p-1.5 rounded-md transition-colors",
              isSelected
                ? "text-indigo-400 hover:text-indigo-700 hover:bg-indigo-100"
                : "text-gray-400 hover:text-gray-700 hover:bg-gray-100",
            )}
            title="Duplicate"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        )}
        {onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className={cn(
              "p-1.5 rounded-md transition-colors",
              isSelected
                ? "text-indigo-400 hover:text-red-600 hover:bg-red-50"
                : "text-gray-400 hover:text-red-600 hover:bg-red-50",
            )}
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

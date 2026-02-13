import { useState, useEffect, useRef } from "react";
import type { Template } from "@prisma/client";
import { TemplateOwnerType } from "@prisma/client";
import { ChevronDown, Check, Settings, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface TemplateSelectorProps {
  selectedTemplateId: string | null;
  onSelect: (templateId: string | null) => void;
  className?: string;
}

export function TemplateSelector({
  selectedTemplateId,
  onSelect,
  className,
}: TemplateSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  // Fetch templates
  useEffect(() => {
    fetch("/api/templates")
      .then((res) => res.json())
      .then(setTemplates)
      .catch((err) => console.error("Failed to load templates", err));
  }, []);

  const systemTemplates = templates.filter(
    (t) => t.ownerType === TemplateOwnerType.SYSTEM,
  );
  const userTemplates = templates.filter(
    (t) => t.ownerType === TemplateOwnerType.USER,
  );

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  const handleSelect = (id: string | null) => {
    onSelect(id);
    setIsOpen(false);
  };

  return (
    <div
      className={cn("relative inline-block text-left", className)}
      ref={containerRef}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 ring-1 ring-inset ring-gray-300"
      >
        {selectedTemplate ? (
          <>
            <span className="text-gray-900">
              {selectedTemplate.icon || "📄"}
            </span>
            <span>{selectedTemplate.name}</span>
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4 text-indigo-500" />
            <span>Auto</span>
          </>
        )}
        <ChevronDown className="h-4 w-4 text-gray-500" />
      </button>

      {isOpen && (
        <div className="absolute left-0 z-50 mt-2 w-64 origin-top-left rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
          <div className="py-1">
            <div className="px-3 py-2 flex items-center justify-between border-b border-gray-100">
              <span className="text-xs font-semibold text-gray-500">
                Templates
              </span>
              <Link
                href="/app/templates"
                className="text-xs text-indigo-600 hover:text-indigo-800"
              >
                <button className="flex items-center gap-1">
                  New template
                </button>
              </Link>
            </div>

            {/* Auto Option */}
            <button
              onClick={() => handleSelect(null)}
              className={cn(
                "flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-gray-50",
                selectedTemplateId === null
                  ? "bg-indigo-50 text-indigo-900"
                  : "text-gray-700",
              )}
            >
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-indigo-500" />
                <span>Auto</span>
              </div>
              {selectedTemplateId === null && (
                <Check className="h-4 w-4 text-indigo-600" />
              )}
            </button>

            {/* User Templates */}
            {userTemplates.length > 0 && (
              <>
                <div className="px-4 py-1 text-xs font-semibold text-gray-500 mt-2">
                  My templates
                </div>
                {userTemplates.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => handleSelect(t.id)}
                    className={cn(
                      "flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-gray-50",
                      selectedTemplateId === t.id
                        ? "bg-indigo-50 text-indigo-900"
                        : "text-gray-700",
                    )}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span>{t.icon || "👤"}</span>
                      <span className="truncate">{t.name}</span>
                    </div>
                    {selectedTemplateId === t.id && (
                      <Check className="h-4 w-4 text-indigo-600" />
                    )}
                  </button>
                ))}
              </>
            )}

            {/* System Templates */}
            {systemTemplates.length > 0 && (
              <>
                <div className="px-4 py-1 text-xs font-semibold text-gray-500 mt-2">
                  Recommended
                </div>
                {systemTemplates.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => handleSelect(t.id)}
                    className={cn(
                      "flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-gray-50",
                      selectedTemplateId === t.id
                        ? "bg-indigo-50 text-indigo-900"
                        : "text-gray-700",
                    )}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span>{t.icon || "🏢"}</span>
                      <span className="truncate">{t.name}</span>
                    </div>
                    {selectedTemplateId === t.id && (
                      <Check className="h-4 w-4 text-indigo-600" />
                    )}
                  </button>
                ))}
              </>
            )}

            <div className="border-t border-gray-100 mt-2 pt-1">
              <Link
                href="/app/templates"
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-xs text-gray-500 hover:bg-gray-50 hover:text-gray-900"
              >
                <Settings className="h-3 w-3" />
                Manage templates...
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

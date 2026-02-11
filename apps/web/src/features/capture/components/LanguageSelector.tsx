"use client";

import { Dropdown } from "@ainotes/ui";

const LANGUAGES = [
  { id: "auto", label: "Auto Detect" },
  { id: "en", label: "English" },
  { id: "es", label: "Spanish" },
  { id: "fr", label: "French" },
  { id: "de", label: "German" },
  { id: "ja", label: "Japanese" },
  { id: "zh", label: "Chinese" },
  { id: "ko", label: "Korean" },
  { id: "pt", label: "Portuguese" },
  { id: "it", label: "Italian" },
  { id: "ru", label: "Russian" },
  { id: "ar", label: "Arabic" },
  { id: "hi", label: "Hindi" },
] as const;

interface LanguageSelectorProps {
  value: string;
  onChange: (langId: string) => void;
}

export function LanguageSelector({ value, onChange }: LanguageSelectorProps) {
  const current = LANGUAGES.find((l) => l.id === value) ?? LANGUAGES[0];

  return (
    <Dropdown
      trigger={
        <button
          type="button"
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-warm-500 transition-colors hover:bg-warm-100"
        >
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
            />
          </svg>
          <span>{current.label}</span>
          <svg
            className="h-3 w-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>
      }
      items={LANGUAGES.map((lang) => ({
        id: lang.id,
        label: (
          <span className={lang.id === value ? "font-semibold" : ""}>
            {lang.label}
          </span>
        ),
        onClick: () => onChange(lang.id),
      }))}
      align="right"
    />
  );
}

import { useState } from "react";

interface Props {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
}

export function DenylistEditor({ label, items, onChange }: Props) {
  const [input, setInput] = useState("");

  const handleAdd = () => {
    const hostname = input.trim().toLowerCase();
    if (hostname && !items.includes(hostname)) {
      onChange([...items, hostname]);
      setInput("");
    }
  };

  const handleRemove = (hostname: string) => {
    onChange(items.filter((h) => h !== hostname));
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-800 mb-2">
        {label}
      </label>
      <div className="flex gap-2 mb-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="example.com"
          className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
        />
        <button
          onClick={handleAdd}
          disabled={!input.trim()}
          className="px-4 py-2 bg-gray-100 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Add
        </button>
      </div>
      {items.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {items.map((hostname) => (
            <span
              key={hostname}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 rounded-lg text-xs text-gray-600"
            >
              {hostname}
              <button
                onClick={() => handleRemove(hostname)}
                className="text-gray-400 hover:text-red-500 transition-colors ml-0.5"
                aria-label={`Remove ${hostname}`}
              >
                &times;
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

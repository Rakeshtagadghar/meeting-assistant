import { clsx } from "clsx";

interface ToggleSwitchProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  label: string;
  description?: string;
}

export function ToggleSwitch({
  enabled,
  onChange,
  label,
  description,
}: ToggleSwitchProps) {
  return (
    <button
      role="switch"
      aria-checked={enabled}
      onClick={() => onChange(!enabled)}
      className="flex items-center justify-between w-full p-3 rounded-xl bg-white/60 backdrop-blur-sm hover:bg-white/80 transition-all duration-200 group"
    >
      <div className="text-left">
        <span className="text-sm font-medium text-gray-800 group-hover:text-gray-900">
          {label}
        </span>
        {description && (
          <p className="text-xs text-gray-500 mt-0.5">{description}</p>
        )}
      </div>
      <div
        className={clsx(
          "relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0 ml-3",
          enabled ? "bg-gradient-to-r from-[#667eea] to-[#764ba2]" : "bg-gray-300",
        )}
      >
        <div
          className={clsx(
            "absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-200",
            enabled ? "translate-x-[22px]" : "translate-x-0.5",
          )}
        />
      </div>
    </button>
  );
}

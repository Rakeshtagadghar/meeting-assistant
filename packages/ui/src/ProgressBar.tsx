import type { HTMLAttributes } from "react";

export type ProgressBarVariant = "default" | "success" | "warning" | "error";

export interface ProgressBarProps extends HTMLAttributes<HTMLDivElement> {
  value: number;
  label?: string;
  variant?: ProgressBarVariant;
}

const barColors: Record<ProgressBarVariant, string> = {
  default: "bg-blue-600",
  success: "bg-green-600",
  warning: "bg-yellow-500",
  error: "bg-red-600",
};

export function ProgressBar({
  value,
  label,
  variant = "default",
  className = "",
  ...props
}: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <div className={className} {...props}>
      {label && (
        <div className="mb-1 flex justify-between text-sm">
          <span className="text-gray-700">{label}</span>
          <span className="text-gray-500">{Math.round(clamped)}%</span>
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? "Progress"}
        className="h-2 w-full overflow-hidden rounded-full bg-gray-200"
      >
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColors[variant]}`}
          style={{ width: `${String(clamped)}%` }}
        />
      </div>
    </div>
  );
}

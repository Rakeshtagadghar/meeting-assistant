"use client";

interface MicLevelIndicatorProps {
  level: number; // 0-1
  isActive: boolean;
}

const BAR_COUNT = 4;
const BAR_MIN_HEIGHT = 4; // px
const BAR_MAX_HEIGHT = 18; // px

export function MicLevelIndicator({ level, isActive }: MicLevelIndicatorProps) {
  const clampedLevel = Math.max(0, Math.min(1, level));

  return (
    <div
      className="flex items-end gap-[2px]"
      role="meter"
      aria-label="Microphone level"
      aria-valuenow={Math.round(clampedLevel * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      {Array.from({ length: BAR_COUNT }, (_, i) => {
        // Each bar responds at different thresholds for visual variety
        const threshold = (i + 1) / (BAR_COUNT + 1);
        const barLevel = isActive
          ? Math.max(
              0,
              (clampedLevel - threshold * 0.5) / (1 - threshold * 0.5),
            )
          : 0;
        const height =
          BAR_MIN_HEIGHT + barLevel * (BAR_MAX_HEIGHT - BAR_MIN_HEIGHT);

        return (
          <div
            key={i}
            className={`w-[3px] rounded-full transition-all duration-75 ${
              isActive ? "bg-green-500" : "bg-warm-300"
            }`}
            style={{ height: `${height}px` }}
          />
        );
      })}
    </div>
  );
}

import type { HTMLAttributes } from "react";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
}

export function Card({
  hoverable,
  className = "",
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={`rounded-lg border border-gray-200 bg-white p-4 shadow-sm ${hoverable ? "transition-shadow hover:shadow-md" : ""} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

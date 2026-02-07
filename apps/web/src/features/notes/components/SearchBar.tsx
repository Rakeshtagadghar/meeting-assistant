"use client";

import { useState, useEffect, useRef } from "react";
import { Input } from "@ainotes/ui";

export interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

const DEBOUNCE_MS = 300;

export function SearchBar({ value, onChange }: SearchBarProps) {
  const [localValue, setLocalValue] = useState(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      onChange(newValue);
    }, DEBOUNCE_MS);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return (
    <Input
      type="search"
      placeholder="Search notes..."
      value={localValue}
      onChange={handleChange}
      aria-label="Search notes"
    />
  );
}

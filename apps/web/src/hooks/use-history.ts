"use client";

import { useReducer, useCallback } from "react";

interface HistoryState<T> {
  past: T[];
  present: T;
  future: T[];
}

type HistoryAction<T> =
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "SET"; newPresent: T }
  | { type: "REPLACE"; newPresent: T }
  | { type: "SNAPSHOT" }
  | { type: "RESET"; newPresent: T };

const historyReducer = <T>(
  state: HistoryState<T>,
  action: HistoryAction<T>,
): HistoryState<T> => {
  const { past, present, future } = state;

  switch (action.type) {
    case "UNDO": {
      if (past.length === 0) return state;
      const previous = past[past.length - 1]!;
      const newPast = past.slice(0, past.length - 1);
      return {
        past: newPast,
        present: previous,
        future: [present, ...future],
      };
    }
    case "REDO": {
      if (future.length === 0) return state;
      const next = future[0]!;
      const newFuture = future.slice(1);
      return {
        past: [...past, present],
        present: next,
        future: newFuture,
      };
    }
    case "SET": {
      if (action.newPresent === present) return state;
      return {
        past: [...past, present],
        present: action.newPresent,
        future: [],
      };
    }
    case "REPLACE": {
      return {
        past,
        present: action.newPresent,
        future: [], // We keep the future? Or clear it? Typically modifying present in a way that is "continuing" might clear future or not.
        // If I type "a", undo, then type "b", I should clear future.
        // If I type "a" (replace), "b" (replace), future matches "a"? No.
        // If I simply correct a typo without checkpointing, maybe I don't want to clear future?
        // But usually any divergence clears future.
        // Let's clear future on REPLACE too if it's considered a change.
      };
    }
    case "SNAPSHOT": {
      // Push current present to past.
      // If present equals last past, don't push?
      if (past.length > 0 && past[past.length - 1] === present) return state;
      return {
        past: [...past, present],
        present,
        future,
      };
    }
    case "RESET": {
      return {
        past: [],
        present: action.newPresent,
        future: [],
      };
    }
    default:
      return state;
  }
};

export function useHistory<T>(initialPresent: T) {
  const [state, dispatch] = useReducer(historyReducer<T>, {
    past: [],
    present: initialPresent,
    future: [],
  });

  const canUndo = state.past.length > 0;
  const canRedo = state.future.length > 0;

  const undo = useCallback(() => dispatch({ type: "UNDO" }), []);
  const redo = useCallback(() => dispatch({ type: "REDO" }), []);
  const set = useCallback(
    (newPresent: T) => dispatch({ type: "SET", newPresent }),
    [],
  );
  const replace = useCallback(
    (newPresent: T) => dispatch({ type: "REPLACE", newPresent }),
    [],
  );
  const snapshot = useCallback(() => dispatch({ type: "SNAPSHOT" }), []);
  const reset = useCallback(
    (newPresent: T) => dispatch({ type: "RESET", newPresent }),
    [],
  );

  // Keyboard support for Undo (Ctrl+Z) / Redo (Ctrl+Shift+Z or Ctrl+Y)
  // Note: Only attach if elementRef is focused? Or globally?
  // Usually better to attach to the specific element via onKeyDown.
  // But for this hook, we'll expose a handler helper or let consumer handle it.
  // Let's expose a ready-to-use onKeyDown handler.

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Check for Ctrl (or Meta for Mac)
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "z" && !e.shiftKey) {
          e.preventDefault();
          undo();
        } else if ((e.key === "z" && e.shiftKey) || e.key === "y") {
          e.preventDefault();
          redo();
        }
      }
    },
    [undo, redo],
  );

  return {
    state: state.present,
    set,
    replace,
    snapshot,
    undo,
    redo,
    reset,
    canUndo,
    canRedo,
    handleKeyDown,
  };
}

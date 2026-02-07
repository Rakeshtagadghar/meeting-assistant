"use client";

import { useState, useEffect } from "react";
import { Spinner, Card, Badge } from "@ainotes/ui";
import type { Note, AISummary } from "@ainotes/core";
import type { GetSharedNoteResponse } from "@ainotes/api";

export interface SharedNoteViewProps {
  token: string;
}

export function SharedNoteView({ token }: SharedNoteViewProps) {
  const [note, setNote] = useState<Note | null>(null);
  const [summaries, setSummaries] = useState<AISummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchSharedNote() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/shared/${token}`);

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error("Shared note not found");
          }
          if (response.status === 403) {
            throw new Error("You do not have access to this note");
          }
          throw new Error(`Failed to load shared note: ${response.statusText}`);
        }

        const data = (await response.json()) as GetSharedNoteResponse;

        if (!cancelled) {
          setNote(data.noteReadOnly);
          setSummaries(data.summaries);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "An unexpected error occurred",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchSharedNote();

    return () => {
      cancelled = true;
    };
  }, [token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <Card>
          <p className="text-red-600" role="alert">
            {error}
          </p>
        </Card>
      </div>
    );
  }

  if (!note) {
    return null;
  }

  return (
    <div className="mx-auto max-w-3xl p-8">
      <Card>
        <h1 className="text-2xl font-bold">{note.title}</h1>

        <div className="mt-2 flex gap-2">
          <Badge variant="info">{note.type}</Badge>
          {note.tags.map((tag) => (
            <Badge key={tag}>{tag}</Badge>
          ))}
        </div>

        <div
          className="mt-6 whitespace-pre-wrap text-gray-800"
          data-testid="note-content"
        >
          {note.contentPlain}
        </div>

        {summaries.length > 0 && (
          <div className="mt-8 space-y-4">
            <h2 className="text-lg font-semibold">Summaries</h2>
            {summaries.map((summary) => (
              <Card key={summary.id}>
                <Badge variant="info">{summary.kind}</Badge>
                <div className="mt-2 text-sm text-gray-700">
                  {"oneLiner" in summary.payload && (
                    <p>{summary.payload.oneLiner}</p>
                  )}
                  {"bullets" in summary.payload && (
                    <ul className="mt-1 list-inside list-disc">
                      {summary.payload.bullets.map((bullet, i) => (
                        <li key={i}>{bullet}</li>
                      ))}
                    </ul>
                  )}
                  {"items" in summary.payload && (
                    <ul className="mt-1 list-inside list-disc">
                      {summary.payload.items.map((item, i) => (
                        <li key={i}>{item.text}</li>
                      ))}
                    </ul>
                  )}
                  {"decisions" in summary.payload && (
                    <ul className="mt-1 list-inside list-disc">
                      {summary.payload.decisions.map((d, i) => (
                        <li key={i}>{d}</li>
                      ))}
                    </ul>
                  )}
                  {"risks" in summary.payload && (
                    <ul className="mt-1 list-inside list-disc">
                      {summary.payload.risks.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  )}
                  {"keyPoints" in summary.payload && (
                    <ul className="mt-1 list-inside list-disc">
                      {summary.payload.keyPoints.map((kp, i) => (
                        <li key={i}>{kp}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

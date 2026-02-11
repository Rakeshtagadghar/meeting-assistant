"use client";

import { useState, useCallback } from "react";
import type { KeyboardEvent } from "react";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { Input } from "./Input";
import { Badge } from "./Badge";

export interface ConsentFormData {
  consentConfirmed: boolean;
  consentText: string;
  meetingTitle: string;
  participants: string[];
}

export interface ConsentModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (data: ConsentFormData) => void;
  productName?: string;
  isLoading?: boolean;
}

const DEFAULT_PRODUCT_NAME = "AINotes";

export function ConsentModal({
  open,
  onClose,
  onConfirm,
  productName = DEFAULT_PRODUCT_NAME,
  isLoading = false,
}: ConsentModalProps) {
  const [consentChecked, setConsentChecked] = useState(false);
  const [meetingTitle, setMeetingTitle] = useState("");
  const [participants, setParticipants] = useState<string[]>([]);
  const [participantInput, setParticipantInput] = useState("");
  const [copied, setCopied] = useState(false);

  const consentMessage = `Hi all — I'm using ${productName} to transcribe and summarize this meeting for notes/action items. Please let me know if anyone objects.`;

  const handleCopyConsent = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(consentMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may fail in some environments
    }
  }, [consentMessage]);

  const handleAddParticipant = useCallback(() => {
    const trimmed = participantInput.trim();
    if (trimmed && !participants.includes(trimmed)) {
      setParticipants((prev) => [...prev, trimmed]);
      setParticipantInput("");
    }
  }, [participantInput, participants]);

  const handleRemoveParticipant = useCallback((name: string) => {
    setParticipants((prev) => prev.filter((p) => p !== name));
  }, []);

  const handleParticipantKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleAddParticipant();
      }
    },
    [handleAddParticipant],
  );

  const handleConfirm = useCallback(() => {
    if (!consentChecked) return;
    onConfirm({
      consentConfirmed: true,
      consentText: consentMessage,
      meetingTitle,
      participants,
    });
  }, [consentChecked, consentMessage, meetingTitle, participants, onConfirm]);

  const handleClose = useCallback(() => {
    setConsentChecked(false);
    setMeetingTitle("");
    setParticipants([]);
    setParticipantInput("");
    setCopied(false);
    onClose();
  }, [onClose]);

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Start Transcription"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={handleConfirm}
            disabled={!consentChecked || isLoading}
            isLoading={isLoading}
          >
            Start transcription
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Compliance banner */}
        <div className="flex items-start gap-2 rounded-md border-l-4 border-amber-500 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
          <svg
            className="mt-0.5 h-4 w-4 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>
            Always get consent when transcribing others.{" "}
            <a href="/privacy" className="underline hover:text-amber-900">
              Learn more
            </a>
          </span>
        </div>

        {/* Required consent checkbox */}
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={consentChecked}
            onChange={(e) => setConsentChecked(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-indigo-600"
            data-testid="consent-checkbox"
          />
          <span className="text-sm text-gray-700">
            I have informed participants and have consent to transcribe this
            meeting.
          </span>
        </label>

        {/* Copy consent message */}
        <button
          type="button"
          onClick={handleCopyConsent}
          className="flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-left text-sm text-gray-600 transition-colors hover:bg-gray-50"
          data-testid="copy-consent-btn"
        >
          <svg
            className="h-4 w-4 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
            />
          </svg>
          <span>
            {copied ? "Copied!" : "Copy consent message to clipboard"}
          </span>
        </button>

        {/* Meeting title (optional) */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Meeting title{" "}
            <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <Input
            value={meetingTitle}
            onChange={(e) => setMeetingTitle(e.target.value)}
            placeholder="e.g. Sprint Planning"
            data-testid="meeting-title-input"
          />
        </div>

        {/* Participants (optional, chips) */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Participants{" "}
            <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <div className="flex gap-2">
            <Input
              value={participantInput}
              onChange={(e) => setParticipantInput(e.target.value)}
              onKeyDown={handleParticipantKeyDown}
              placeholder="Name or email, press Enter to add"
              data-testid="participant-input"
            />
            <Button
              variant="secondary"
              onClick={handleAddParticipant}
              disabled={!participantInput.trim()}
              className="shrink-0"
            >
              Add
            </Button>
          </div>
          {participants.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {participants.map((p) => (
                <Badge
                  key={p}
                  variant="info"
                  removable
                  onRemove={() => handleRemoveParticipant(p)}
                >
                  {p}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

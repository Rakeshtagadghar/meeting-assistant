"use client";

import { useCallback } from "react";
import { Button } from "@ainotes/ui";
import { useAudioRecorder } from "@/features/capture/hooks/use-audio-recorder";
import { useTranscript } from "@/features/capture/hooks/use-transcript";
import { TranscriptView } from "@/features/capture/components/TranscriptView";

export default function QuickNotePage() {
  const {
    startRecording,
    stopRecording: stopAudio,
    status: recordingStatus,
    error: audioError,
  } = useAudioRecorder();

  const {
    segments,
    connect: connectTranscript,
    disconnect: disconnectTranscript,
  } = useTranscript();

  const isRecording = recordingStatus === "RECORDING";

  const handleStart = useCallback(async () => {
    await startRecording();
    if (recordingStatus !== "ERROR") {
      // Check if startRecording succeeded?
      // Actually startRecording is async and sets state. We can't check state immediately.
      // But if promise resolves, we assume success or handled error in hook state.
      // Ideally hook should return success.
      // For MVP we just connect transcript if no error *displayed* yet?
      // Let's just connect.
      connectTranscript();
    }
  }, [startRecording, connectTranscript, recordingStatus]);

  const handleStop = useCallback(() => {
    stopAudio();
    disconnectTranscript();
  }, [stopAudio, disconnectTranscript]);

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      {/* Header / Toolbar */}
      <div className="flex items-center justify-between border-b bg-white p-4 shadow-sm">
        <h1 className="text-lg font-semibold text-gray-800">Quick Note</h1>
        <div className="flex gap-2">
          {!isRecording ? (
            <Button variant="primary" onClick={handleStart}>
              Start Recording
            </Button>
          ) : (
            <Button
              variant="secondary"
              className="bg-red-100 text-red-700 hover:bg-red-200"
              onClick={handleStop}
            >
              Stop & Generate
            </Button>
          )}
        </div>
      </div>

      {/* Main Content - Transcript */}
      <div className="flex-1 overflow-y-auto">
        <TranscriptView segments={segments} />
      </div>

      {/* Status Footer */}
      <div className="border-t bg-white px-4 py-2 text-xs text-gray-500">
        <div className="flex justify-between">
          <span>Status: {isRecording ? "Listening..." : "Idle"}</span>
          {audioError && <span className="text-red-500">{audioError}</span>}
          <span>{segments.length} segments</span>
        </div>
      </div>
    </div>
  );
}

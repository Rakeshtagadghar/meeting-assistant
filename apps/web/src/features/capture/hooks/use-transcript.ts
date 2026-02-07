import { useState, useCallback, useEffect, useRef } from "react";
import type { ISODateString } from "@ainotes/core";

export interface TranscriptSegment {
  id: string;
  text: string;
  speaker: string;
  timestamp: ISODateString;
  isFinal: boolean;
}

interface UseTranscriptReturn {
  segments: TranscriptSegment[];
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
}

// Mock data generator
const MOCK_PHRASES = [
  "Hello everyone, let's start the meeting.",
  "Today we are discussing the Q3 roadmap.",
  "I think we should focus on performance improvements.",
  "Agreed, the mobile app is a bit sluggish.",
  "What about the new AI features?",
  "We need to scope that out carefully.",
  "Let's assign action items for next week.",
];

export function useTranscript(): UseTranscriptReturn {
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    setIsConnected(true);
    setSegments([]); // Clear previous on new start? Or keep history? clearing for now.

    // Simulate incoming chunks
    let counter = 0;
    intervalRef.current = setInterval(() => {
      const phrase = MOCK_PHRASES[counter % MOCK_PHRASES.length] ?? "";
      const newSegment: TranscriptSegment = {
        id: crypto.randomUUID(),
        text: phrase,
        speaker: counter % 2 === 0 ? "You" : "Speaker B",
        timestamp: new Date().toISOString() as ISODateString,
        isFinal: true,
      };

      setSegments((prev) => [...prev, newSegment]);
      counter++;
    }, 2000); // New segment every 2s
  }, []);

  const disconnect = useCallback(() => {
    setIsConnected(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    segments,
    isConnected,
    connect,
    disconnect,
  };
}

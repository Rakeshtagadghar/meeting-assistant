export type CaptureAudioSource = "microphone" | "systemAudio" | "tabAudio";

export type SpeakerRole = "SALES" | "CLIENT" | "UNKNOWN" | "MIXED";

export interface TranscriptProsody {
  energy: number | null;
  pauseRatio: number | null;
  voicedMs: number | null;
  snrDb: number | null;
}

export interface TranscriptChunk {
  id: string;
  sequence: number;
  tStartMs: number;
  tEndMs: number;
  speaker: string | null;
  speakerRole: SpeakerRole;
  audioSource: CaptureAudioSource;
  text: string;
  confidence: number | null;
  prosody: TranscriptProsody;
  isFinal: boolean;
}

# iOS Native Scaffold Notes

This folder is reserved for the bare React Native iOS project.

## Required Configuration

1. Add microphone usage description:
   - `NSMicrophoneUsageDescription`
2. Configure `AVAudioSession`:
   - category: `PlayAndRecord`
   - mode: `VoiceChat`
   - options: `AllowBluetooth`, `DefaultToSpeaker`
3. MVP policy:
   - foreground capture only
   - no background audio mode enabled by default

## Integration Target

Bridge native PCM frames (`16kHz`, mono, `pcm_s16le`) into
`MobileMicrophoneService`.

# Android Native Scaffold Notes

This folder is reserved for the bare React Native Android project.

## Required Permissions

- `android.permission.RECORD_AUDIO`

## Optional Later-Phase Permissions

- `android.permission.FOREGROUND_SERVICE`

## MVP Policy

- Foreground capture only.
- No background streaming service by default.

## Integration Target

Bridge native PCM frames (`16kHz`, mono, `pcm_s16le`) into
`MobileMicrophoneService`.

# Golden Minutes Browser Extension — Privacy Policy

**Last updated:** 2026-02-19

## Overview

The Golden Minutes browser extension ("Extension") detects meeting tabs in your browser and, with your explicit consent, captures microphone audio for real-time transcription via the Golden Minutes platform. This policy describes what data we collect, how we use it, and your choices.

## Data We Collect

### With Your Explicit Consent Only

- **Microphone audio**: When you click "Start Recording", the Extension captures audio from your microphone. Audio is sent in real time to our transcription API and is **not stored locally**. Audio is processed server-side for transcription only and is not retained after processing.

### Stored Locally on Your Device

- **Extension settings**: Your preferences (prompt mode, cooldown, platform toggles, blocked sites). Stored in `chrome.storage.local`.
- **Authentication token**: A short-lived token from your Golden Minutes account. Stored in `chrome.storage.local`.
- **Meeting session hashes**: Non-reversible SHA-256 hashes of meeting URLs (with salt) used to prevent duplicate prompts. Retained for a configurable period (default: 7 days). These hashes cannot be used to reconstruct the original URL.
- **Cooldown timestamps**: When you were last prompted, to enforce cooldown periods.

### What We Do NOT Collect

- Chat messages or meeting content (other than audio you explicitly consent to record)
- Participant names or lists
- Meeting titles
- Browsing history outside of meeting platform URLs
- Any data when the extension is idle or when you have not signed in

## How We Use Data

- **Audio**: Sent to our secure transcription API (`/api/asr/elevenlabs/transcribe`) for speech-to-text conversion. Transcripts are associated with your Golden Minutes account and viewable on the Golden Minutes website.
- **Settings**: Used locally to configure extension behavior. Never sent to any server.
- **Session hashes**: Used locally to prevent re-prompting for the same meeting within the cooldown period.

## Network Requests

The Extension makes **no network requests by default**. Network requests occur only when:

1. You click "Start Recording" — audio chunks are sent to the Golden Minutes transcription API.
2. You sign in — a one-time token exchange with the Golden Minutes web application.

## Permissions

| Permission      | Purpose                                                                     |
| --------------- | --------------------------------------------------------------------------- |
| `storage`       | Save your preferences and authentication locally                            |
| `notifications` | Show meeting detection prompts as system notifications                      |
| `tabs`          | Detect when you navigate to a meeting page                                  |
| `offscreen`     | Capture microphone audio in an offscreen document (required by Manifest V3) |

**Host permissions** (meeting platform URLs) are used solely for meeting page detection and in-page overlay display.

## Your Choices

- **Sign in required**: No features work without authentication.
- **Toggle detection on/off**: Disable all meeting detection from the popup or settings.
- **Per-platform control**: Enable or disable detection for specific platforms (Google Meet, Teams, Zoom, Webex).
- **Block specific sites**: Add sites to your block list to never be prompted.
- **Snooze**: Temporarily suppress prompts for a configurable duration.
- **Clear all data**: One-click button in Settings to remove all locally stored data.
- **Uninstall**: Removing the extension deletes all local data.

## Data Retention

- Local settings and hashes: Configurable retention (1–30 days, default 7).
- Transcripts on Golden Minutes: Subject to the Golden Minutes main privacy policy.
- Audio: Not retained after transcription processing.

## Third Parties

Audio is processed by ElevenLabs speech-to-text API through our server. No data is shared with other third parties.

## Changes

We may update this policy. Changes will be noted in the extension update notes and reflected in the "Last updated" date above.

## Contact

For privacy inquiries, contact us at privacy@goldenminutes.co.uk.

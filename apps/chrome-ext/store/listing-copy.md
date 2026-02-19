# Chrome Web Store / Edge Add-ons Listing

## Extension Name
Golden Minutes

## Short Description (132 chars max)
Detects meetings in your browser, records audio with consent, and transcribes via Golden Minutes. Privacy-first, no auto-recording.

## Detailed Description

Golden Minutes automatically detects when you join a meeting on Google Meet, Microsoft Teams, Zoom, or Webex. With your explicit consent, it captures microphone audio and transcribes your meeting in real time.

**Key Features:**

- Automatic meeting detection for Google Meet, Teams, Zoom, and Webex
- One-click recording with explicit consent — nothing happens without your permission
- Real-time transcription powered by advanced speech-to-text AI
- View your transcripts on the Golden Minutes website
- Customisable prompts: system notifications or in-page overlay
- Per-platform controls: enable or disable detection for each platform
- Block specific sites from ever prompting
- Snooze and cooldown controls to avoid repeated prompts
- Privacy-first: no data collected when idle, no audio stored locally

**How It Works:**

1. Sign in with your Golden Minutes account
2. Join a meeting — the extension detects it automatically
3. Click "Start Recording" when prompted (or from the popup)
4. Your microphone audio is transcribed in real time
5. View your transcript on the Golden Minutes website

**Privacy Commitment:**

- Sign-in required to use any features
- No recording without explicit user action
- No browsing data collected outside meeting platforms
- All settings stored locally on your device
- Audio is processed for transcription only, never stored

**Permissions Explained:**

- Storage: Save your preferences locally
- Notifications: Show meeting detection prompts
- Tabs: Detect meeting pages
- Host permissions: Only for supported meeting platforms

Works with Chrome and Microsoft Edge.

## Category
Productivity

## Language
English (UK)

## Permission Justifications

### storage
Required to persist user preferences (prompt mode, blocked sites, platform toggles) and authentication state locally in the browser. No data is synced externally.

### notifications
Required to display meeting detection prompts as system notifications, allowing users to choose whether to start recording. Users can switch to in-page overlay mode in settings.

### tabs
Required to detect when the user navigates to a supported meeting platform (Google Meet, Teams, Zoom, Webex) by monitoring tab URL changes. No browsing history is collected or stored.

### offscreen
Required by Chrome Manifest V3 to capture microphone audio. The offscreen document requests microphone access only when the user explicitly clicks "Start Recording".

### Host Permissions
Limited to meeting platform URLs (meet.google.com, teams.microsoft.com, *.zoom.us, *.webex.com). Used for meeting page detection and optional in-page overlay display. No content is read from these pages.

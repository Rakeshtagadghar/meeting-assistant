# Mobile App Scaffold (`apps/mobile-rn`)

This folder is the monorepo anchor for the bare React Native app.

## Current Scope

- Mobile realtime transport contract and client skeleton.
- Transport adapters:
  - native `WebSocket` (`ws://`, `wss://`)
  - HTTP relay socket (`http://`, `https://`, or `/api/...`) for environments
    where websocket backend is not yet available.
- Mobile analysis toggle gating + cadence helpers.
- Shared protocol/types imports from workspace packages.
- Microphone -> PCM packetization -> realtime client service wiring.
- VAD speech gating (min-speech + silence finalize + silence dropping) for mobile capture.
- Rolling prosody snapshots with quality gating attached to outgoing audio packets.
- Session runtime + presenter layer for transcript and live-analysis views.
- App-level screen parity presenter scaffold for:
  - `landing`
  - `notes`
  - `meeting`
  - `chat`
  - `settings`
- Auth route scaffold for:
  - `auth/sign-in`
  - `auth/callback`
  - protected-route guard behavior in app presenter
- Auth/session bootstrap helpers:
  - `MobileAuthClient` for `NextAuth` session/sign-in/sign-out endpoints
  - `MobileAuthBootstrap` to connect app presenter auth state to backend session status
- Native platform placeholder folders (`ios/`, `android/`) with required config templates.
- Server relay endpoint in web app: `POST /api/mobile/realtime` (event-protocol envelope in, server events out).

## Next Work

1. Initialize native projects in place:
   - generate Xcode/Gradle projects under existing `ios/` and `android/`.
2. Implement native recorder bridge modules that emit PCM frames to `MobileMicrophoneService`.
3. Add foreground-only MVP screens:
   - Transcript
   - Live Analysis
4. Connect auth/session bootstrapping to existing backend APIs.
5. Add production websocket gateway (HTTP relay is currently the fallback bridge).

## Production Endpoint

- App name: `Golden Minutes`
- Prod host: `https://www.goldenminutes.co.uk/`
- Mobile realtime relay URL: `https://www.goldenminutes.co.uk/api/mobile/realtime`

## Presenter Usage

`MobileSessionPresenter` is the UI binding layer for MVP transcript/live-analysis
screens. It keeps transcript always visible and hides analysis cards when
`liveAnalysisEnabled=false`.

```ts
import {
  createMockMobileSessionRuntime,
  MobileSessionPresenter,
} from "@ainotes/mobile-rn";

const runtime = createMockMobileSessionRuntime({
  url: "https://www.goldenminutes.co.uk/api/mobile/realtime",
  meetingId: "meeting-123",
});
const presenter = new MobileSessionPresenter({ runtime });
const unsubscribe = presenter.subscribe((view) => {
  console.log(view.transcriptItems, view.analysis);
});
```

## Auth Bootstrap Usage

```ts
import {
  MobileAppPresenter,
  MobileAuthBootstrap,
  MobileAuthClient,
  MobileSessionPresenter,
} from "@ainotes/mobile-rn";

const authClient = new MobileAuthClient({
  baseUrl: "https://www.goldenminutes.co.uk",
});

const appPresenter = new MobileAppPresenter({
  sessionPresenter: new MobileSessionPresenter({ runtime }),
});

const auth = new MobileAuthBootstrap({
  presenter: appPresenter,
  authClient,
});

await auth.restoreSessionOnAppStart();
const signInUrl = auth.startSignIn();
// Open signInUrl in in-app browser/webview.
```

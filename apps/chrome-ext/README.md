# Golden Minutes Chrome Extension

Browser extension that detects meeting tabs, captures audio with consent, and transcribes via Golden Minutes.

## Development

### Prerequisites

- Node.js >= 20.9.0
- pnpm 9.x
- Chrome or Edge browser

### Setup

```bash
# From the monorepo root
pnpm install

# Build the extension
pnpm -C apps/chrome-ext build

# Watch mode (auto-rebuild on changes)
pnpm -C apps/chrome-ext dev
```

### Load in Chrome

1. Navigate to `chrome://extensions/`
2. Enable "Developer mode" (top right toggle)
3. Click "Load unpacked"
4. Select the `apps/chrome-ext/dist` directory
5. The Golden Minutes icon should appear in your toolbar

### Load in Edge

1. Navigate to `edge://extensions/`
2. Enable "Developer mode" (left sidebar toggle)
3. Click "Load unpacked"
4. Select the `apps/chrome-ext/dist` directory

### Testing

```bash
pnpm -C apps/chrome-ext test        # run tests
pnpm -C apps/chrome-ext test:watch  # watch mode
```

### Linting & Type Checking

```bash
pnpm -C apps/chrome-ext lint
pnpm -C apps/chrome-ext typecheck
```

### Build for Store

```bash
pnpm -C apps/chrome-ext build
pnpm -C apps/chrome-ext zip
# Produces golden-minutes-chrome.zip ready for upload
```

## Architecture

```
src/
  background/     Service worker: tab tracking, meeting detection, recording management
  offscreen/      Offscreen document: microphone capture + ASR API integration
  content/        Content script: in-page overlay prompt (Shadow DOM isolated)
  popup/          Popup UI: status, quick actions, recording controls
  options/        Options page: full settings management
  shared/         Types, URL classifier, cooldown logic, storage, auth, brand tokens
```

### Key Design Decisions

- **Manifest V3** with service worker (no persistent background page)
- **Offscreen document** for microphone capture (MV3 requirement)
- **Shadow DOM** for content script overlay (CSP-safe style isolation)
- **Standalone Tailwind CSS** for popup/options (no shared package dependency)
- **Plain CSS** for content overlay (avoids Tailwind injection on third-party pages)
- **All state persisted** to `chrome.storage.local` (handles service worker suspension)

### Meeting Detection Flow

```
Tab URL change → debounce (1.5s) → URL classifier → platform match?
  → Check: auth? platform enabled? denylist? cooldown?
  → Show notification or overlay prompt
  → User clicks "Start" → offscreen doc → mic capture → ASR API
  → Transcript viewable on Golden Minutes website
```

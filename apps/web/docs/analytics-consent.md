# Google Analytics & consent

## What’s in place

### Env

- **`NEXT_PUBLIC_GA_MEASUREMENT_ID`** – GA4 measurement ID (e.g. `G-GZKPHMMECP`).
- Set in root `.env` and `apps/web/.env` so the Next.js app (and any build that reads them) can use it.

### Next.js web app

1. **GoogleAnalytics** (`src/components/GoogleAnalytics.tsx`)
   - Loads gtag.js with `next/script` and `afterInteractive`.
   - Uses **Consent Mode**: default `analytics_storage: 'denied'` so no analytics cookies/data until consent.
   - After consent: `gtag('consent', 'update', { analytics_storage: 'granted' })` and `gtag('config', id)`.
   - Listens for custom event `ainotes-consent-update` and re-checks `localStorage` on load so existing consent is applied.

2. **Cookie banner** (`src/features/marketing/components/CookieBanner.tsx`)
   - On **Accept**: sets `localStorage.setItem('ainotes-consent', 'true')` and dispatches `ainotes-consent-update`.
   - GoogleAnalytics reacts to that event and grants analytics.

3. **Layout**
   - Root layout renders `<GoogleAnalytics />` so every page gets the script and consent logic.

Result: no GA cookies or full tracking until the user accepts; then GA runs for that origin (web or desktop webview).

### Tauri desktop app

- The desktop app loads the **same** Next.js app:
  - **Dev**: `devUrl: http://localhost:3000`
  - **Prod**: `frontendDist: https://meeting-assistant-web.vercel.app`
- So the same GA + consent flow runs inside the Tauri webview:
  - Same cookie banner, same `ainotes-consent` in `localStorage` for that origin.
  - No extra code in the Tauri (Rust) side; consent and GA are entirely in the web app.
- If the user has already accepted on the website (same origin), consent is reused in the desktop webview.

## Optional next steps

- **Decline**: If you add “Decline” or “Manage preferences”, call `gtag('consent', 'update', { analytics_storage: 'denied' })` and clear or update `ainotes-consent` in `localStorage` so GA stays off.
- **Cookie policy**: Keep `/cookies` in sync with the fact that analytics only run after opt-in (already stated there).
- **GA4**: In the GA4 property, confirm the measurement ID and that data is received after consent.

/* eslint-disable no-console */

interface ShowPromptPayload {
  mode: "overlay";
  platform: string;
  ts: number;
}

let overlayContainer: HTMLElement | null = null;

chrome.runtime.onMessage.addListener(
  (
    message: { type: string; payload?: ShowPromptPayload },
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void,
  ) => {
    if (message.type === "SHOW_PROMPT" && message.payload) {
      showOverlay(message.payload);
      sendResponse({ ok: true });
    }
  },
);

function showOverlay(payload: ShowPromptPayload): void {
  if (overlayContainer) {
    overlayContainer.remove();
  }

  overlayContainer = document.createElement("div");
  overlayContainer.id = "gm-overlay-root";
  const shadow = overlayContainer.attachShadow({ mode: "closed" });

  const style = document.createElement("style");
  style.textContent = getOverlayStyles();
  shadow.appendChild(style);

  const wrapper = document.createElement("div");
  wrapper.className = "gm-overlay";
  wrapper.setAttribute("role", "dialog");
  wrapper.setAttribute("aria-label", "Golden Minutes meeting prompt");
  wrapper.innerHTML = buildOverlayHTML(payload.platform);
  shadow.appendChild(wrapper);

  document.body.appendChild(overlayContainer);

  requestAnimationFrame(() => {
    wrapper.classList.add("gm-overlay--visible");
  });

  setupOverlayHandlers(shadow, wrapper);
  setupAutoDismiss(wrapper);
}

function buildOverlayHTML(platform: string): string {
  const platformLabels: Record<string, string> = {
    google_meet: "Google Meet",
    ms_teams: "Microsoft Teams",
    zoom_web: "Zoom",
    webex: "Webex",
    unknown: "Meeting",
  };
  const label = platformLabels[platform] ?? "Meeting";

  return `
    <div class="gm-accent-bar"></div>
    <div class="gm-content">
      <div class="gm-header">
        <div class="gm-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="#d4a843" stroke-width="2"/>
            <path d="M12 6v6l4 2" stroke="#d4a843" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </div>
        <div>
          <h2 class="gm-title">${label} detected</h2>
          <p class="gm-subtitle">Start Golden Minutes recording?</p>
        </div>
        <button class="gm-close" data-action="dismiss" aria-label="Close" tabindex="0">&times;</button>
      </div>
      <div class="gm-actions">
        <button class="gm-btn gm-btn--primary" data-action="start" tabindex="0">
          Start Recording
        </button>
        <button class="gm-btn gm-btn--secondary" data-action="snooze" tabindex="0">
          Not now
        </button>
        <button class="gm-btn gm-btn--text" data-action="deny_site" tabindex="0">
          Disable for this site
        </button>
      </div>
      <p class="gm-footnote">No recording happens until you confirm.</p>
      <div class="gm-progress"><div class="gm-progress-bar"></div></div>
    </div>
  `;
}

function setupOverlayHandlers(shadow: ShadowRoot, wrapper: HTMLElement): void {
  shadow.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const action = target.dataset["action"];
    if (!action) return;

    const currentUrl = window.location.href;
    const tabId = -1; // Will be resolved by background

    chrome.runtime.sendMessage({
      type: "USER_DECISION",
      payload: {
        decision: action,
        tabId,
        url: currentUrl,
        ts: Date.now(),
      },
    });

    dismissOverlay(wrapper);
  });
}

function setupAutoDismiss(wrapper: HTMLElement): void {
  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  if (!reducedMotion) {
    setTimeout(() => {
      dismissOverlay(wrapper);
    }, 15000);
  }
}

function dismissOverlay(wrapper: HTMLElement): void {
  wrapper.classList.remove("gm-overlay--visible");
  wrapper.classList.add("gm-overlay--hidden");
  setTimeout(() => {
    overlayContainer?.remove();
    overlayContainer = null;
  }, 300);
}

function getOverlayStyles(): string {
  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  return `
    :host {
      all: initial;
      position: fixed;
      top: 16px;
      right: 16px;
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    .gm-overlay {
      max-width: 360px;
      border-radius: 16px;
      background: rgba(255, 255, 255, 0.88);
      backdrop-filter: blur(16px) saturate(180%);
      -webkit-backdrop-filter: blur(16px) saturate(180%);
      box-shadow: 0 8px 32px rgba(102, 126, 234, 0.18), 0 2px 8px rgba(0, 0, 0, 0.08);
      overflow: hidden;
      transform: translateX(120%);
      opacity: 0;
      transition: ${reducedMotion ? "none" : "transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease"};
    }

    .gm-overlay--visible {
      transform: translateX(0);
      opacity: 1;
    }

    .gm-overlay--hidden {
      transform: translateX(120%);
      opacity: 0;
    }

    .gm-accent-bar {
      height: 3px;
      background: linear-gradient(135deg, #667eea, #764ba2);
    }

    .gm-content {
      padding: 16px;
    }

    .gm-header {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      margin-bottom: 16px;
    }

    .gm-icon {
      flex-shrink: 0;
      width: 40px;
      height: 40px;
      border-radius: 10px;
      background: linear-gradient(135deg, rgba(212, 168, 67, 0.12), rgba(212, 168, 67, 0.06));
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .gm-title {
      margin: 0;
      font-size: 15px;
      font-weight: 600;
      color: #1a1a2e;
      line-height: 1.3;
    }

    .gm-subtitle {
      margin: 2px 0 0;
      font-size: 13px;
      color: #64748b;
      line-height: 1.3;
    }

    .gm-close {
      margin-left: auto;
      flex-shrink: 0;
      width: 28px;
      height: 28px;
      border: none;
      background: transparent;
      color: #94a3b8;
      font-size: 18px;
      cursor: pointer;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: ${reducedMotion ? "none" : "background 0.15s, color 0.15s"};
    }

    .gm-close:hover {
      background: rgba(0, 0, 0, 0.06);
      color: #475569;
    }

    .gm-actions {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 12px;
    }

    .gm-btn {
      border: none;
      border-radius: 10px;
      padding: 10px 16px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: ${reducedMotion ? "none" : "all 0.2s ease"};
      font-family: inherit;
    }

    .gm-btn:focus-visible {
      outline: 2px solid #667eea;
      outline-offset: 2px;
    }

    .gm-btn--primary {
      background: linear-gradient(135deg, #d4a843, #c49a3a);
      color: white;
      font-weight: 600;
      box-shadow: 0 2px 8px rgba(212, 168, 67, 0.3);
    }

    .gm-btn--primary:hover {
      box-shadow: 0 4px 16px rgba(212, 168, 67, 0.45);
      transform: translateY(-1px);
    }

    .gm-btn--secondary {
      background: rgba(0, 0, 0, 0.04);
      color: #475569;
    }

    .gm-btn--secondary:hover {
      background: rgba(0, 0, 0, 0.08);
    }

    .gm-btn--text {
      background: transparent;
      color: #94a3b8;
      font-size: 12px;
      padding: 6px 16px;
    }

    .gm-btn--text:hover {
      color: #64748b;
    }

    .gm-footnote {
      margin: 0;
      font-size: 11px;
      color: #94a3b8;
      text-align: center;
    }

    .gm-progress {
      margin-top: 12px;
      height: 2px;
      background: rgba(0, 0, 0, 0.06);
      border-radius: 1px;
      overflow: hidden;
    }

    .gm-progress-bar {
      height: 100%;
      background: linear-gradient(135deg, #667eea, #764ba2);
      border-radius: 1px;
      animation: ${reducedMotion ? "none" : "gm-progress 15s linear forwards"};
    }

    @keyframes gm-progress {
      from { width: 100%; }
      to { width: 0%; }
    }

    @media (prefers-color-scheme: dark) {
      .gm-overlay {
        background: rgba(30, 30, 46, 0.92);
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.2);
      }
      .gm-title { color: #f1f5f9; }
      .gm-subtitle { color: #94a3b8; }
      .gm-close { color: #64748b; }
      .gm-close:hover { background: rgba(255, 255, 255, 0.08); color: #94a3b8; }
      .gm-btn--secondary { background: rgba(255, 255, 255, 0.06); color: #cbd5e1; }
      .gm-btn--secondary:hover { background: rgba(255, 255, 255, 0.1); }
      .gm-btn--text { color: #64748b; }
      .gm-btn--text:hover { color: #94a3b8; }
      .gm-footnote { color: #64748b; }
      .gm-progress { background: rgba(255, 255, 255, 0.06); }
    }
  `;
}

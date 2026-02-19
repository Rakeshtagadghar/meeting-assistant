import { DEBOUNCE_MS } from "@/shared/constants";

type TabUpdateHandler = (tabId: number, url: string) => void;

const debounceTimers = new Map<number, ReturnType<typeof setTimeout>>();

export function startTabTracking(onTabUpdate: TabUpdateHandler): void {
  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.url) {
      debouncedUpdate(tabId, changeInfo.url, onTabUpdate);
    }
  });

  chrome.tabs.onActivated.addListener(async (activeInfo) => {
    try {
      const tab = await chrome.tabs.get(activeInfo.tabId);
      if (tab.url) {
        debouncedUpdate(activeInfo.tabId, tab.url, onTabUpdate);
      }
    } catch {
      // Tab may have been closed
    }
  });

  chrome.tabs.onRemoved.addListener((tabId) => {
    const timer = debounceTimers.get(tabId);
    if (timer) {
      clearTimeout(timer);
      debounceTimers.delete(tabId);
    }
  });
}

function debouncedUpdate(
  tabId: number,
  url: string,
  handler: TabUpdateHandler,
): void {
  const existing = debounceTimers.get(tabId);
  if (existing) {
    clearTimeout(existing);
  }

  debounceTimers.set(
    tabId,
    setTimeout(() => {
      debounceTimers.delete(tabId);
      handler(tabId, url);
    }, DEBOUNCE_MS),
  );
}

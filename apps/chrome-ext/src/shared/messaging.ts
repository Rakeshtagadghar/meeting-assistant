import type { ExtensionMessage } from "./types";

export function sendMessage(message: ExtensionMessage): Promise<void> {
  return chrome.runtime.sendMessage(message);
}

export function sendTabMessage(
  tabId: number,
  message: ExtensionMessage,
): Promise<void> {
  return chrome.tabs.sendMessage(tabId, message);
}

export function onMessage(
  handler: (
    message: ExtensionMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void,
  ) => void | boolean,
): void {
  chrome.runtime.onMessage.addListener(handler);
}

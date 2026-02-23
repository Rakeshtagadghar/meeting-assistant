import type { MeetingPlatform } from "@/shared/types";
import { PLATFORM_LABELS } from "@/shared/constants";

const NOTIFICATION_ID_PREFIX = "gm_meeting_";

export interface NotificationCallbacks {
  onStart: (tabId: number, url: string) => void;
  onSnooze: (tabId: number, url: string) => void;
  onDenySite: (tabId: number, url: string) => void;
}

let callbacks: NotificationCallbacks | null = null;
const notificationData = new Map<string, { tabId: number; url: string }>();

export function initNotifications(cb: NotificationCallbacks): void {
  callbacks = cb;

  chrome.notifications.onButtonClicked.addListener(
    (notificationId, buttonIndex) => {
      const data = notificationData.get(notificationId);
      if (!data || !callbacks) return;

      if (buttonIndex === 0) {
        callbacks.onStart(data.tabId, data.url);
      } else if (buttonIndex === 1) {
        callbacks.onSnooze(data.tabId, data.url);
      }

      chrome.notifications.clear(notificationId);
      notificationData.delete(notificationId);
    },
  );

  chrome.notifications.onClosed.addListener((notificationId) => {
    notificationData.delete(notificationId);
  });
}

export function showMeetingNotification(
  tabId: number,
  url: string,
  platform: MeetingPlatform,
): void {
  const notificationId = `${NOTIFICATION_ID_PREFIX}${tabId}`;
  const platformLabel = PLATFORM_LABELS[platform];

  notificationData.set(notificationId, { tabId, url });

  chrome.notifications.create(notificationId, {
    type: "basic",
    iconUrl: chrome.runtime.getURL("icons/128.png"),
    title: "Meeting Detected",
    message: `${platformLabel} meeting detected. Start Golden Minutes?`,
    buttons: [{ title: "Start Recording" }, { title: "Not Now" }],
    priority: 2,
    requireInteraction: true,
  });
}

export function clearMeetingNotification(tabId: number): void {
  const notificationId = `${NOTIFICATION_ID_PREFIX}${tabId}`;
  chrome.notifications.clear(notificationId);
  notificationData.delete(notificationId);
}

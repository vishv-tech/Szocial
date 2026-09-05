import type {
  NotificationRecipientType,
  SzocialNotification
} from "@/types";
import {
  createTimestamp,
  normalizeTimestamp,
  timestampToMilliseconds
} from "@/lib/date-time";

type NotificationInput = Omit<
  SzocialNotification,
  "id" | "isRead" | "createdAt"
>;

type CreateNotificationOptions = {
  allowDuplicate?: boolean;
};

function createNotificationId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `notification-${crypto.randomUUID()}`;
  }
  return `notification-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function notificationEntityId(notification: NotificationInput | SzocialNotification) {
  return (
    notification.entityId ??
    notification.postId ??
    notification.businessId ??
    notification.chatId ??
    ""
  );
}

export function getNotificationStorageKey(
  recipientType: NotificationRecipientType,
  recipientId: string
) {
  return `szocial_notifications_${recipientType}_${recipientId}`;
}

export function loadNotifications(
  recipientType: NotificationRecipientType,
  recipientId: string
): SzocialNotification[] {
  if (typeof window === "undefined" || !recipientId) return [];
  const value = window.localStorage.getItem(
    getNotificationStorageKey(recipientType, recipientId)
  );
  if (!value) return [];

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    const migrationTimestamp = createTimestamp();
    const notifications = (parsed as SzocialNotification[])
      .map((notification) => ({
        ...notification,
        createdAt: normalizeTimestamp(notification.createdAt, {
          migrationNow: migrationTimestamp
        })
      }))
      .sort(
        (left, right) =>
          timestampToMilliseconds(right.createdAt) -
          timestampToMilliseconds(left.createdAt)
      );
    if (JSON.stringify(notifications) !== JSON.stringify(parsed)) {
      saveNotifications(recipientType, recipientId, notifications);
    }
    return notifications;
  } catch {
    return [];
  }
}

export function saveNotifications(
  recipientType: NotificationRecipientType,
  recipientId: string,
  notifications: SzocialNotification[]
) {
  if (typeof window === "undefined" || !recipientId) return;
  window.localStorage.setItem(
    getNotificationStorageKey(recipientType, recipientId),
    JSON.stringify(notifications)
  );
}

export function createNotification(
  input: NotificationInput,
  options: CreateNotificationOptions = {}
) {
  if (!input.recipientId || input.senderId === input.recipientId) return null;

  const notifications = loadNotifications(input.recipientType, input.recipientId);
  if (!options.allowDuplicate) {
    const entityId = notificationEntityId(input);
    const duplicate = notifications.some(
      (item) =>
        item.recipientId === input.recipientId &&
        item.senderId === input.senderId &&
        item.type === input.type &&
        notificationEntityId(item) === entityId
    );
    if (duplicate) return null;
  }

  const notification: SzocialNotification = {
    ...input,
    id: createNotificationId(),
    isRead: false,
    createdAt: createTimestamp()
  };
  saveNotifications(input.recipientType, input.recipientId, [
    notification,
    ...notifications
  ]);
  return notification;
}

export function markNotificationRead(
  notificationId: string,
  recipientType: NotificationRecipientType,
  recipientId: string
) {
  const notifications = loadNotifications(recipientType, recipientId).map((item) =>
    item.id === notificationId ? { ...item, isRead: true } : item
  );
  saveNotifications(recipientType, recipientId, notifications);
  return notifications;
}

export function markAllNotificationsRead(
  recipientType: NotificationRecipientType,
  recipientId: string
) {
  const notifications = loadNotifications(recipientType, recipientId).map((item) => ({
    ...item,
    isRead: true
  }));
  saveNotifications(recipientType, recipientId, notifications);
  return notifications;
}

export function getUnreadNotificationCount(
  recipientType: NotificationRecipientType,
  recipientId: string
) {
  return loadNotifications(recipientType, recipientId).filter((item) => !item.isRead)
    .length;
}

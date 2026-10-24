import type { Chat, ChatMessage } from "@/types";
import { timestampToMilliseconds } from "@/lib/date-time";

export function orderedMessages(messages: ChatMessage[]) {
  return [...new Map(messages.map(message => [message.id, message])).values()]
    .sort((a, b) => timestampToMilliseconds(a.createdAt) - timestampToMilliseconds(b.createdAt) || a.id.localeCompare(b.id));
}

export function isPairBlocked(chats: Chat[], participantIds: string[]) {
  return chats.some(chat => chat.status === "Blocked" &&
    participantIds.filter(id => chat.participantIds.includes(id)).length >= 2);
}

export function canMessage(chats: Chat[], chat: Chat | undefined, senderId: string | null) {
  return Boolean(chat && senderId && chat.participantIds.includes(senderId) &&
    chat.status === "Active" && !isPairBlocked(chats, chat.participantIds));
}

export function unreadMessages(chat: Chat, participantId: string | null) {
  if (!participantId || !chat.participantIds.includes(participantId)) return 0;
  if(chat.historyLoaded!==undefined)return chat.unread;
  const readAt = timestampToMilliseconds(chat.readAtByParticipant?.[participantId]);
  return chat.messages.filter(message => message.senderId !== participantId && message.kind !== "system" &&
    timestampToMilliseconds(message.createdAt) > readAt).length;
}

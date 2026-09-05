"use client";

import { BadgeCheck } from "lucide-react";
import { useAppStore } from "@/components/AppStoreProvider";
import { RelativeTime } from "@/components/RelativeTime";
import { getOtherChatParticipant } from "@/lib/chat-participants";
import { timestampToMilliseconds } from "@/lib/date-time";
import { createInitialsAvatar } from "@/lib/user-photo";
import type { Chat } from "@/types";
import { asArray, cn } from "@/lib/utils";

type ChatListProps = {
  chats: Chat[];
  activeChatId: string | null;
  onSelect: (chatId: string) => void;
};

export function ChatList({ chats, activeChatId, onSelect }: ChatListProps) {
  const { currentBusinessOwner, state } = useAppStore();
  const currentParticipantId =
    currentBusinessOwner?.id ?? state.currentUserId;
  const participantContext = {
    residents: state.residents,
    businesses: state.businesses,
    businessOwners: state.businessOwners,
    posts: state.posts
  };

  return (
    <div className="space-y-2">
      {asArray(chats)
        .filter((chat) => chat.status !== "Left")
        .sort(
          (left, right) =>
            timestampToMilliseconds(right.lastMessageAt) -
            timestampToMilliseconds(left.lastMessageAt)
        )
        .map((chat) => {
          const participant = getOtherChatParticipant(
            chat,
            currentParticipantId,
            participantContext
          );
          const participantPhoto =
            participant.profilePhoto || createInitialsAvatar(participant.name);

          return (
            <button
              className={cn(
                "flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition",
                activeChatId === chat.id
                  ? "border-szocial-teal bg-szocial-tealSoft"
                  : "border-slate-100 bg-white hover:bg-szocial-mist"
              )}
              key={chat.id}
              onClick={() => onSelect(chat.id)}
              type="button"
            >
              <img alt={participant.name} className="h-12 w-12 rounded-2xl object-cover" src={participantPhoto} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate font-semibold text-szocial-ink">{participant.name}</h3>
                  {chat.type === "Business" ? (
                    <BadgeCheck className="h-4 w-4 shrink-0 text-szocial-teal" />
                  ) : null}
                </div>
                <p className="truncate text-sm text-szocial-muted">
                  {asArray(chat.messages).at(-1)?.text ?? "No messages yet"}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="rounded-full bg-szocial-orangeSoft px-2 py-0.5 text-[11px] font-bold text-szocial-orange">
                    {chat.type}
                  </span>
                  <span className="text-[11px] text-szocial-muted">
                    {participant.location || chat.location}
                  </span>
                  <RelativeTime
                    className="ml-auto text-[11px] text-szocial-muted"
                    timestamp={
                      chat.lastMessageAt ??
                      asArray(chat.messages).at(-1)?.createdAt
                    }
                  />
                </div>
              </div>
              {chat.unread ? (
                <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-szocial-orange px-2 text-xs font-bold text-white">
                  {chat.unread}
                </span>
              ) : null}
            </button>
          );
        })}
    </div>
  );
}

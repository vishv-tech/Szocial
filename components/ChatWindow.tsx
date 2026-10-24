"use client";

import { useEffect, useRef, useState } from "react";
import {
  Flag,
  MapPin,
  Send,
  ShieldCheck,
  ShieldOff,
  UsersRound
} from "lucide-react";
import { Button } from "@/components/Button";
import { RelativeTime } from "@/components/RelativeTime";
import { ReportModal } from "@/components/ReportModal";
import { useAppStore } from "@/components/AppStoreProvider";
import { useToast } from "@/components/ToastProvider";
import type { Chat } from "@/types";
import {
  getChatParticipant,
  getOtherChatParticipant,
  isMessageFromCurrentUser
} from "@/lib/chat-participants";
import { canMessage, orderedMessages } from "@/lib/chat-rules";
import { createInitialsAvatar } from "@/lib/user-photo";
import { asArray, cn } from "@/lib/utils";

type ChatWindowProps = {
  chat: Chat | null;
};

function getLocationErrorMessage(error: GeolocationPositionError) {
  if (error.code === error.PERMISSION_DENIED) {
    return "Location permission was denied. Enable location access to share your location.";
  }
  if (error.code === error.POSITION_UNAVAILABLE) {
    return "Your current location could not be determined.";
  }
  if (error.code === error.TIMEOUT) {
    return "Location request timed out. Please try again.";
  }
  return "Unable to share your location right now.";
}

export function ChatWindow({ chat }: ChatWindowProps) {
  const {
    blockChat,
    loadOlderMessages,
    markChatRead,
    currentBusinessOwner,
    sendChatMessage,
    state
  } = useAppStore();
  const { notify } = useToast();
  const sendingRef=useRef(false);
  const [sending,setSending]=useState(false);
  const [message, setMessage] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [isSharingLocation, setIsSharingLocation] = useState(false);
  const locationRequestActive = useRef(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (chat?.id) markChatRead(chat.id);
  }, [chat?.id, chat?.lastMessageAt, markChatRead]);

  useEffect(() => {
    setMessage("");
    setReportOpen(false);
  }, [chat?.id]);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "nearest" });
  }, [chat?.id, chat?.messages.length]);

  if (!chat || !(chat.participantIds ?? []).includes(currentBusinessOwner?.id ?? state.currentUserId ?? "")) {
    return (
      <div className="flex min-h-[520px] items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white p-6 text-center shadow-soft">
        <div>
          <UsersRound className="mx-auto h-10 w-10 text-szocial-teal" />
          <h2 className="mt-4 text-xl font-bold text-szocial-ink">Select a chat</h2>
          <p className="mt-2 text-szocial-muted">
            Neighbour, business, and group conversations appear here.
          </p>
        </div>
      </div>
    );
  }

  const currentParticipantId =
    currentBusinessOwner?.id ?? state.currentUserId;
  const participantContext = {
    residents: state.residents,
    businesses: state.businesses,
    businessOwners: state.businessOwners,
    posts: state.posts
  };
  const otherParticipant = getOtherChatParticipant(
    chat,
    currentParticipantId,
    participantContext
  );
  const otherParticipantPhoto =
    otherParticipant.profilePhoto || createInitialsAvatar(otherParticipant.name);
  const isBlocked = chat.status === "Blocked";
  const blockedByCurrentParticipant =
    isBlocked &&
    Boolean(currentParticipantId) &&
    (chat.blockedByIds??[chat.blockedById]).includes(currentParticipantId!);
  const canManageBlock =
    Boolean(currentParticipantId) &&
    asArray(chat.participantIds).includes(currentParticipantId ?? "");
  const canSendMessages = canMessage(state.chats, chat, currentParticipantId);
  const sendMessage = async () => {
    if(sendingRef.current)return;
    sendingRef.current=true;setSending(true);
    try {if (await sendChatMessage(chat.id, message)) setMessage("");}
    finally{sendingRef.current=false;setSending(false);}
  };

  const shareCurrentLocation = () => {
    if (
      locationRequestActive.current ||
      !canSendMessages ||
      !currentParticipantId
    ) {
      return;
    }

    if (!navigator.geolocation) {
      notify({
        title: "Location unavailable",
        description: "Location sharing is not supported in this browser.",
        variant: "warning"
      });
      return;
    }

    locationRequestActive.current = true;
    setIsSharingLocation(true);

    const finishRequest = () => {
      locationRequestActive.current = false;
      setIsSharingLocation(false);
    };

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        const query = encodeURIComponent(`${latitude},${longitude}`);
        const mapsUrl =
          `https://www.google.com/maps/search/?api=1&query=${query}`;

        const shared = await sendChatMessage(chat.id, {
          text: "Shared a location",
          kind: "location",
          latitude,
          longitude,
          mapsUrl,
          locationLabel: "Shared location"
        });
        finishRequest();
        notify(
          shared
            ? {
                title: "Location shared",
                description: "Only share your location with people you trust."
              }
            : {
                title: "Location not shared",
                description: "Unable to share your location right now.",
                variant: "warning"
              }
        );
      },
      (error) => {
        finishRequest();
        notify({
          title: "Location not shared",
          description: getLocationErrorMessage(error),
          variant: "warning"
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 30000
      }
    );
  };

  return (
    <section className="min-w-0 overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-soft">
      <header className="flex items-center gap-3 border-b border-slate-100 p-4">
        <img alt={otherParticipant.name} className="h-12 w-12 rounded-2xl object-cover" src={otherParticipantPhoto} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-bold text-szocial-ink">{otherParticipant.name}</h2>
          <p className="truncate text-sm text-szocial-muted">
            {otherParticipant.location || chat.location} - {chat.status}
          </p>
        </div>
        <Button aria-label="Report conversation" onClick={() => setReportOpen(true)} size="sm" variant="ghost">
          <Flag className="h-4 w-4" />
        </Button>
        {canManageBlock ? (
          <Button
            onClick={() => {
              if (
                blockedByCurrentParticipant ||
                window.confirm(`Block messaging with ${otherParticipant.name}?`)
              ) {
                blockChat(chat.id);
              }
            }}
            size="sm"
            variant="outline"
          >
            {blockedByCurrentParticipant ? (
              <ShieldCheck className="h-4 w-4" />
            ) : (
              <ShieldOff className="h-4 w-4" />
            )}
            {blockedByCurrentParticipant ? "Unblock" : "Block"}
          </Button>
        ) : null}
      </header>

      <div className="max-h-[520px] min-h-[420px] space-y-3 overflow-y-auto bg-szocial-mist p-4">
        {chat.historyHasMore ? <Button variant="outline" onClick={()=>loadOlderMessages(chat.id)}>Load earlier messages</Button> : null}
        {orderedMessages(asArray(chat.messages)).map((item) => {
          const mine = isMessageFromCurrentUser(item, currentParticipantId);
          const sender = getChatParticipant(
            chat,
            item.senderId,
            participantContext
          );
          const senderPhoto = sender?.profilePhoto;
          const mapsUrl =
            item.kind === "location" &&
            item.mapsUrl?.startsWith("https://www.google.com/maps/")
              ? item.mapsUrl
              : null;
          return (
            <div
              className={cn(
                "flex items-end gap-2",
                mine ? "flex-row-reverse justify-start" : "justify-start"
              )}
              key={item.id}
            >
              {item.kind !== "system" && senderPhoto ? (
                <img
                  alt=""
                  className="h-8 w-8 rounded-xl object-cover"
                  src={senderPhoto}
                />
              ) : null}
              <div
                className={cn(
                  "max-w-[82%] break-words rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm",
                  item.kind === "system"
                    ? "bg-white text-szocial-muted"
                    : mine
                      ? "bg-szocial-teal text-white"
                      : "bg-white text-szocial-ink"
                )}
              >
                {mapsUrl ? (
                  <div>
                    <p className="flex items-center gap-2 font-semibold">
                      <MapPin className="h-4 w-4" />
                      {item.locationLabel || "Shared a location"}
                    </p>
                    <a
                      className={cn(
                        "mt-2 inline-flex rounded-xl px-3 py-1.5 font-semibold underline-offset-2 hover:underline",
                        mine
                          ? "bg-white/15 text-white"
                          : "bg-szocial-tealSoft text-szocial-teal"
                      )}
                      href={mapsUrl}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      Open in Google Maps
                    </a>
                  </div>
                ) : (
                  <p>{item.text}</p>
                )}
                <p className={cn("mt-1 text-[11px]", mine ? "text-white/70" : "text-szocial-muted")}>
                  <RelativeTime timestamp={item.createdAt} />
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
        {isBlocked || !canSendMessages ? (
          <div className="rounded-2xl bg-white p-4 text-center text-sm font-semibold text-szocial-muted">
            {blockedByCurrentParticipant
              ? "You blocked this chat. Select Unblock above to continue messaging."
              : "This chat is currently blocked. Messaging is unavailable."}
          </div>
        ) : null}
      </div>

      <footer className="border-t border-slate-100 p-4">
        <div className="flex flex-wrap gap-2 pb-3">
          <Button
            disabled={!canSendMessages || isSharingLocation}
            onClick={shareCurrentLocation}
            size="sm"
            variant="outline"
          >
            <MapPin className="h-4 w-4" />
            {isSharingLocation ? "Getting location..." : "Share Location"}
          </Button>
        </div>
        <div className="flex gap-2">
          <input
            className="min-w-0 flex-1 rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-szocial-teal"
            disabled={!canSendMessages}
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={event => { if (event.key === "Enter" && !event.nativeEvent.isComposing && message.trim() && canSendMessages) { event.preventDefault(); sendMessage(); } }}
            placeholder="Type a message..."
            value={message}
          />
          <Button
            disabled={sending || !canSendMessages || !message.trim()}
            onClick={sendMessage}
          >
            <Send className="h-4 w-4" />
            Send
          </Button>
        </div>
      </footer>
      <ReportModal
        itemId={chat.id}
        itemLabel={otherParticipant.name}
        itemType="Chat"
        onClose={() => setReportOpen(false)}
        open={reportOpen}
      />
    </section>
  );
}

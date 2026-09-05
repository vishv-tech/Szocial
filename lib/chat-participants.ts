import type {
  Business,
  BusinessOwner,
  Chat,
  ChatMessage,
  ChatParticipant,
  LocalPost,
  ResidentUser
} from "@/types";

export type ChatParticipantContext = {
  residents?: ResidentUser[];
  businesses?: Business[];
  businessOwners?: BusinessOwner[];
  posts?: LocalPost[];
};

const UNKNOWN_PARTICIPANT: ChatParticipant = {
  id: "",
  participantType: "resident",
  name: "Unknown participant"
};

function locationLabel(location: ResidentUser["location"]) {
  return [location.area, location.city].filter(Boolean).join(", ");
}

export function getChatParticipant(
  chat: Pick<Chat, "businessId" | "participants">,
  participantId: string,
  context: ChatParticipantContext
): ChatParticipant | null {
  const resident = context.residents?.find((item) => item.id === participantId);
  if (resident) {
    return {
      id: resident.id,
      participantType: "resident",
      name: resident.name,
      profilePhoto: resident.profilePhoto || resident.avatar,
      location: locationLabel(resident.location)
    };
  }

  const owner = context.businessOwners?.find((item) => item.id === participantId);
  const business = context.businesses?.find(
    (item) => item.ownerId === participantId || item.id === chat.businessId
  );
  if (owner || business?.ownerId === participantId) {
    return {
      id: participantId,
      participantType: "business",
      name: business?.name || owner?.ownerName || "Business",
      profilePhoto: business?.logo,
      location: business ? locationLabel(business.location) : undefined
    };
  }

  const snapshot = chat.participants?.find((item) => item.id === participantId);
  return snapshot ? { ...snapshot } : null;
}

export function getOtherChatParticipant(
  chat: Chat,
  currentParticipantId: string | null | undefined,
  context: ChatParticipantContext
): ChatParticipant {
  if (
    !currentParticipantId ||
    !chat.participantIds.includes(currentParticipantId)
  ) {
    return UNKNOWN_PARTICIPANT;
  }

  const otherId = chat.participantIds.find((id) => id !== currentParticipantId);
  if (otherId) {
    return getChatParticipant(chat, otherId, context) ?? {
      ...UNKNOWN_PARTICIPANT,
      id: otherId
    };
  }

  const snapshot = chat.participants?.find(
    (item) => item.id !== currentParticipantId
  );
  return snapshot ? { ...snapshot } : UNKNOWN_PARTICIPANT;
}

export function isMessageFromCurrentUser(
  message: ChatMessage,
  currentParticipantId: string | null | undefined
) {
  return Boolean(currentParticipantId && message.senderId === currentParticipantId);
}

export function sameChatParticipantSet(chat: Chat, participantIds: string[]) {
  const existing = [...new Set(chat.participantIds)].sort();
  const requested = [...new Set(participantIds)].sort();
  return (
    existing.length === requested.length &&
    existing.every((participantId, index) => participantId === requested[index])
  );
}

export function buildChatParticipants(
  participantIds: string[],
  context: ChatParticipantContext,
  chat?: Pick<Chat, "businessId" | "participants">
) {
  const source = chat ?? { participants: [] };
  return [...new Set(participantIds)]
    .map((participantId) => getChatParticipant(source, participantId, context))
    .filter((participant): participant is ChatParticipant => Boolean(participant));
}

export function normalizeChatParticipants(
  chat: Chat,
  context: ChatParticipantContext
): Chat {
  const participantIds = new Set(chat.participantIds);

  chat.participants?.forEach((participant) => participantIds.add(participant.id));

  chat.messages.forEach((message) => {
    const isKnownParticipant =
      context.residents?.some((resident) => resident.id === message.senderId) ||
      context.businessOwners?.some((owner) => owner.id === message.senderId);
    if (isKnownParticipant) {
      participantIds.add(message.senderId);
    }
  });

  if (chat.businessId) {
    const business = context.businesses?.find(
      (item) => item.id === chat.businessId
    );
    if (business?.ownerId) {
      participantIds.add(business.ownerId);
    }
  }

  if (chat.postId) {
    const post = context.posts?.find((item) => item.id === chat.postId);
    if (post?.authorId) {
      participantIds.add(post.authorId);
    }
  }

  const normalizedIds = [...participantIds].filter(Boolean);
  const resolvedParticipants = buildChatParticipants(
    normalizedIds,
    context,
    chat
  );
  const unresolvedSnapshots =
    chat.participants?.filter(
      (snapshot) =>
        normalizedIds.includes(snapshot.id) &&
        !resolvedParticipants.some((participant) => participant.id === snapshot.id)
    ) ?? [];

  return {
    ...chat,
    participantIds: normalizedIds,
    participants: [...resolvedParticipants, ...unresolvedSnapshots]
  };
}

import type { Chat, LocalPost, LocationInfo } from "@/types";
import { getCoordinates, getNearbyScore, getLocationText } from "@/lib/nearby-ranking";
import { timestampToMilliseconds } from "@/lib/date-time";

export type FeedSort = "nearby" | "newest" | "oldest" | "farthest";

export function discoveryPosts(posts: LocalPost[], viewerId: string, chats: Chat[] = [], includeSolved = false) {
  const blocked = new Set(chats.filter(chat => chat.status === "Blocked" && chat.participantIds.includes(viewerId))
    .flatMap(chat => chat.participantIds.filter(id => id !== viewerId)));
  return posts.filter(post => (post.status === "Active" || (includeSolved && post.status === "Solved")) &&
    !(post.type === "help" && post.authorId === viewerId) &&
    !blocked.has(post.authorId) &&
    (post.visibility !== "Private after approval" || post.authorId === viewerId || post.acceptedUserIds.includes(viewerId)));
}

export function queryPosts(posts: LocalPost[], query: string, sort: FeedSort, location: LocationInfo) {
  const search = query.trim().toLocaleLowerCase();
  const hasLocation = Boolean(getCoordinates(location) || location.area || location.city);
  return posts.filter(post => !search ||
    [post.title, post.description, post.category, post.landmark, getLocationText(post.location)]
      .join(" ").toLocaleLowerCase().includes(search))
    .map(post => ({ post, score: hasLocation ? getNearbyScore(location, post.location) : Infinity,
      measured: Boolean(getCoordinates(location) && getCoordinates(post.location)),
      time: timestampToMilliseconds(post.createdAt) }))
    .sort((a, b) => {
      // Unknown distances and timestamps always follow known values in either direction.
      if (sort === "nearby" || sort === "farthest") {
        if (a.measured !== b.measured) return a.measured ? -1 : 1;
        const knownA = Number.isFinite(a.score), knownB = Number.isFinite(b.score);
        if (knownA !== knownB) return knownA ? -1 : 1;
        if (knownA && a.score !== b.score) return (sort === "farthest" && a.measured ? -1 : 1) * (a.score - b.score);
      }
      if (Boolean(a.time) !== Boolean(b.time)) return a.time ? -1 : 1;
      return (sort === "oldest" ? a.time - b.time : b.time - a.time) || a.post.id.localeCompare(b.post.id);
    }).map(item => item.post);
}

export function editPost(post: LocalPost, changes: Partial<LocalPost>, updatedAt: string): LocalPost {
  return { ...post, ...changes, id: post.id, authorId: post.authorId, createdAt: post.createdAt, updatedAt };
}

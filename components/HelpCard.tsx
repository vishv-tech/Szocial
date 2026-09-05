"use client";

import type { LocalPost } from "@/types";
import { PostCard } from "@/components/PostCard";

type HelpCardProps = {
  request: LocalPost;
};

export function HelpCard({ request }: HelpCardProps) {
  return <PostCard post={request} />;
}

"use client";

import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  Bookmark,
  ExternalLink,
  MapPinned,
  MessageCircle,
  Navigation,
  Phone,
  Share2,
  Star
} from "lucide-react";
import { Button } from "@/components/Button";
import { RelativeTime } from "@/components/RelativeTime";
import { useAppStore } from "@/components/AppStoreProvider";
import { useToast } from "@/components/ToastProvider";
import type { Business } from "@/types";
import { asArray } from "@/lib/utils";

type BusinessCardProps = {
  business: Business;
};

export function BusinessCard({ business }: BusinessCardProps) {
  const router = useRouter();
  const { startBusinessChat, toggleSaveBusiness } = useAppStore();
  const { notify } = useToast();
  const locationArea = business.location?.area ?? "Nearby";

  const shareBusiness = async () => {
    await navigator.clipboard?.writeText(`${window.location.origin}/businesses/${business.id}`);
    notify({ title: "Business link copied" });
  };

  return (
    <article className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-soft">
      <div className="relative h-52 overflow-hidden">
        <img
          alt={business.name}
          className="h-full w-full object-cover transition duration-500 hover:scale-105"
          src={business.coverImage}
        />
        <div className="absolute left-4 top-4 flex flex-wrap gap-2">
          {business.featured ? (
            <span className="rounded-full bg-szocial-orange px-3 py-1 text-xs font-bold text-white">
              Featured
            </span>
          ) : null}
          <span className="rounded-full bg-szocial-teal px-3 py-1 text-xs font-bold text-white">
            {business.openStatus}
          </span>
        </div>
      </div>
      <div className="p-5">
        <div className="flex items-start gap-3">
          <img
            alt={`${business.name} logo`}
            className="h-14 w-14 rounded-2xl border-4 border-white object-cover shadow-soft"
            src={business.logo}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold text-szocial-ink">{business.name}</h2>
              {business.verified ? <BadgeCheck className="h-5 w-5 text-szocial-teal" /> : null}
            </div>
            <p className="mt-1 text-sm text-szocial-muted">
              {business.category} - {locationArea}
            </p>
            <p className="mt-1 text-xs text-szocial-muted">
              Listed <RelativeTime timestamp={business.createdAt} />
            </p>
          </div>
          <span className="flex items-center gap-1 rounded-full bg-szocial-orangeSoft px-3 py-1 text-sm font-bold text-szocial-orange">
            <Star className="h-4 w-4 fill-current" />
            {business.rating || "New"}
          </span>
        </div>
        <p className="mt-4 leading-7 text-szocial-muted">{business.about}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {asArray(business.tags).slice(0, 3).map((tag) => (
            <span className="rounded-full bg-szocial-mist px-3 py-1 text-xs font-semibold text-szocial-muted" key={tag}>
              {tag}
            </span>
          ))}
        </div>
        {asArray(business.offers)[0] ? (
          <p className="mt-4 rounded-2xl bg-szocial-tealSoft px-4 py-3 text-sm font-semibold text-szocial-teal">
            {asArray(business.offers)[0]}
          </p>
        ) : null}
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Button href={`/businesses/${business.id}`} variant="primary">
            <ExternalLink className="h-4 w-4" />
            View
          </Button>
          <Button onClick={() => toggleSaveBusiness(business.id)} variant="outline">
            <Bookmark className="h-4 w-4" />
            Save
          </Button>
          <Button
            onClick={() => {
              const chatId = startBusinessChat(business.id);
              router.push(`/chats?chatId=${chatId}`);
            }}
            variant="outline"
          >
            <MessageCircle className="h-4 w-4" />
            Chat
          </Button>
          <Button
            onClick={() => notify({ title: `Calling ${business.phone}` })}
            variant="outline"
          >
            <Phone className="h-4 w-4" />
            Call
          </Button>
          <Button
            onClick={() =>
              business.mapsLink
                ? window.open(business.mapsLink, "_blank")
                : notify({ title: "Directions opened", description: "Mock map for this listing." })
            }
            variant="outline"
          >
            <Navigation className="h-4 w-4" />
            Directions
          </Button>
          <Button onClick={shareBusiness} variant="outline">
            <Share2 className="h-4 w-4" />
            Share
          </Button>
        </div>
        {business.listedByResidents ? (
          <p className="mt-4 flex items-center gap-2 rounded-2xl bg-szocial-mist px-4 py-3 text-sm font-semibold text-szocial-teal">
            <MapPinned className="h-4 w-4" />
            Listed by local residents
          </p>
        ) : null}
      </div>
    </article>
  );
}

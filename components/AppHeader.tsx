"use client";

import Link from "next/link";
import { Bell, Building2, MessageCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import { RelativeTime } from "@/components/RelativeTime";
import { useAppStore } from "@/components/AppStoreProvider";
import { getUserDisplayPhoto } from "@/lib/user-photo";
import { asArray, cn } from "@/lib/utils";
import { useState } from "react";

type AppHeaderProps = {
  compact?: boolean;
};

export function AppHeader({ compact = false }: AppHeaderProps) {
  const {
    currentUser,
    markResidentNotificationsRead,
    residentNotifications,
    residentUnreadCount,
    state
  } = useAppStore();
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-40 border-b border-slate-100 bg-white/95 backdrop-blur",
          compact ? "shadow-sm" : ""
        )}
      >
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link className="flex min-w-0 items-center gap-2" href="/">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-szocial-orange text-white shadow-sm">
              <MessageCircle className="h-5 w-5" />
            </span>
            <span className="truncate text-xl font-bold tracking-normal text-szocial-ink">
              Szocial
            </span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium text-szocial-muted md:flex">
            <Link className="transition hover:text-szocial-teal" href="/home">
              Home
            </Link>
            <Link className="transition hover:text-szocial-teal" href="/explore">
              Explore
            </Link>
            <Link className="transition hover:text-szocial-teal" href="/businesses">
              Businesses
            </Link>
            <Link className="transition hover:text-szocial-teal" href="/help">
              Help
            </Link>
          </nav>
          <div className="flex shrink-0 items-center gap-2">
            {compact ? (
              <button
                aria-label="Open notifications"
                className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-slate-100 bg-white text-szocial-ink shadow-sm transition hover:border-szocial-orange"
                onClick={() => {
                  setNotificationsOpen(true);
                  markResidentNotificationsRead();
                }}
                type="button"
              >
                <Bell className="h-5 w-5" />
                {residentUnreadCount ? (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-szocial-orange px-1 text-[10px] font-bold text-white">
                    {residentUnreadCount > 9 ? "9+" : residentUnreadCount}
                  </span>
                ) : null}
              </button>
            ) : null}
            <Button className="hidden sm:inline-flex" href="/business/signup" variant="outline">
              <Building2 className="h-4 w-4" />
              List Business
            </Button>
            <Button href={compact ? "/profile" : "/signup"} variant={compact ? "secondary" : "primary"}>
              {compact ? (
                <img
                  alt=""
                  className="h-5 w-5 rounded-full object-cover"
                  src={getUserDisplayPhoto(currentUser)}
                />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {compact ? currentUser.name.split(" ")[0] : "Join"}
            </Button>
          </div>
        </div>
      </header>
      <Modal
        description="Interest requests, comments, and messages sent to this account."
        onClose={() => setNotificationsOpen(false)}
        open={notificationsOpen}
        title="Notifications"
      >
        <div className="space-y-3">
          {asArray(residentNotifications).map((item) => {
            const sender = asArray(state.residents).find(
              (resident) => resident.id === item.senderId
            );
            return (
              <article className="flex gap-3 rounded-2xl bg-szocial-mist p-4" key={item.id}>
                <img
                  alt=""
                  className="h-10 w-10 rounded-xl object-cover"
                  src={getUserDisplayPhoto(
                    sender ?? {
                      name: item.senderName,
                      profilePhoto: item.senderPhoto
                    }
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-semibold text-szocial-ink">{item.title}</h3>
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-szocial-teal">
                      {item.type.replace("_", " ")}
                    </span>
                  </div>
                  <p className="mt-1 text-sm leading-6 text-szocial-muted">{item.message}</p>
                  <RelativeTime
                    className="mt-1 block text-xs text-szocial-muted"
                    timestamp={item.createdAt}
                  />
                </div>
              </article>
            );
          })}
          {!residentNotifications.length ? (
            <article className="rounded-2xl bg-szocial-mist p-4 text-sm text-szocial-muted">
              No notifications for this account yet.
            </article>
          ) : null}
        </div>
      </Modal>
    </>
  );
}

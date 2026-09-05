"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BriefcaseBusiness,
  CirclePlus,
  Compass,
  HandHeart,
  Home,
  MessageCircle,
  ScrollText,
  UserRound
} from "lucide-react";
import { cn } from "@/lib/utils";

const userItems = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/post", label: "Post", icon: CirclePlus },
  { href: "/help", label: "Help", icon: HandHeart },
  { href: "/chats", label: "Chats", icon: MessageCircle },
  { href: "/my-posts", label: "My Posts", icon: ScrollText },
  { href: "/profile", label: "Profile", icon: UserRound },
  { href: "/businesses", label: "Businesses", icon: BriefcaseBusiness }
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-24 hidden h-[calc(100vh-7rem)] w-64 shrink-0 rounded-3xl border border-slate-100 bg-white p-3 shadow-soft lg:block">
      <div className="space-y-1">
        {userItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              className={cn(
                "flex min-h-12 items-center gap-3 rounded-2xl px-4 text-sm font-semibold transition",
                active
                  ? "bg-szocial-orangeSoft text-szocial-orange"
                  : "text-szocial-muted hover:bg-szocial-mist hover:text-szocial-ink"
              )}
              href={item.href}
              key={item.href}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </aside>
  );
}

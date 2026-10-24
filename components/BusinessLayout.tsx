"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import {
  BarChart3,
  Bell,
  CreditCard,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  Megaphone,
  Store
} from "lucide-react";
import { Button } from "@/components/Button";
import { useAppStore } from "@/components/AppStoreProvider";
import { cn } from "@/lib/utils";

const businessNav = [
  { href: "/business/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/business/profile", label: "Business Profile", icon: Store },
  { href: "/business/messages", label: "Messages", icon: MessageCircle },
  { href: "/business/offers", label: "Offers", icon: Megaphone },
  { href: "/business/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/business/pricing", label: "Plan", icon: CreditCard }
];

export function BusinessLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    businessUnreadCount,
    currentBusiness,
    logoutBusiness,
    markBusinessNotificationsRead
  } = useAppStore();

  return (
    <main className="min-h-screen bg-szocial-mist">
      <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link className="flex items-center gap-2" href="/business/dashboard">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-szocial-teal text-white">
              <Store className="h-5 w-5" />
            </span>
            <span className="font-bold text-szocial-ink">
              {currentBusiness?.name ?? "Szocial Business"}
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => {
                markBusinessNotificationsRead();
                router.push("/business/dashboard");
              }}
              variant="outline"
            >
              <Bell className="h-4 w-4" />
              Activity{businessUnreadCount ? ` (${businessUnreadCount})` : ""}
            </Button>
            <Button
              onClick={async () => {
                await logoutBusiness();
                router.push("/");
              }}
              variant="outline"
            >
              <LogOut className="h-4 w-4" />
              Exit
            </Button>
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <aside className="sticky top-24 hidden h-fit w-64 shrink-0 rounded-3xl border border-slate-100 bg-white p-3 shadow-soft lg:block">
          {businessNav.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                className={cn(
                  "flex min-h-12 items-center gap-3 rounded-2xl px-4 text-sm font-semibold transition",
                  active
                    ? "bg-szocial-tealSoft text-szocial-teal"
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
        </aside>
        <section className="min-w-0 flex-1">{children}</section>
      </div>
    </main>
  );
}

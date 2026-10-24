"use client";
import {ResourcePaging} from "@/components/ResourcePaging";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import {
  Building2,
  FileText,
  Flag,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  UsersRound
} from "lucide-react";
import { Button } from "@/components/Button";
import { cn } from "@/lib/utils";

const adminNavigation = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: UsersRound },
  { href: "/admin/businesses", label: "Businesses", icon: Building2 },
  { href: "/admin/posts", label: "Posts", icon: FileText },
  { href: "/admin/reports", label: "Reports", icon: Flag }
];

export function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const currentSection =
    adminNavigation.find((item) =>
      item.href === "/admin"
        ? pathname === item.href
        : pathname.startsWith(item.href)
    )?.label ?? "Admin";

  const logout = async () => {
    try {
      await fetch("/api/admin/logout", { method: "POST" });
    } finally {
      router.replace("/admin/login");
      router.refresh();
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
        <div className="mx-auto flex h-[72px] max-w-[1500px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link className="flex items-center gap-3" href="/admin">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-szocial-orange text-white">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <span>
              <span className="block font-bold text-white">Szocial Admin</span>
              <span className="block text-xs text-slate-400">{currentSection}</span>
            </span>
          </Link>
          <Button onClick={logout} variant="light">
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </header>

      <nav className="border-b border-slate-800 bg-slate-900 px-4 py-3 lg:hidden">
        <div className="mx-auto flex max-w-[1500px] gap-2 overflow-x-auto">
          {adminNavigation.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === "/admin"
                ? pathname === item.href
                : pathname.startsWith(item.href);
            return (
              <Link
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold",
                  active
                    ? "bg-szocial-orange text-white"
                    : "bg-slate-800 text-slate-300"
                )}
                href={item.href}
                key={item.href}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="mx-auto flex max-w-[1500px] gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <aside className="sticky top-24 hidden h-fit w-64 shrink-0 rounded-3xl border border-slate-800 bg-slate-900 p-3 lg:block">
          <div className="space-y-1">
            {adminNavigation.map((item) => {
              const Icon = item.icon;
              const active =
                item.href === "/admin"
                  ? pathname === item.href
                  : pathname.startsWith(item.href);
              return (
                <Link
                  className={cn(
                    "flex min-h-12 items-center gap-3 rounded-2xl px-4 text-sm font-semibold transition",
                    active
                      ? "bg-szocial-orange text-white"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
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
        <section className="min-w-0 flex-1">{children}<ResourcePaging/></section>
      </div>
    </main>
  );
}

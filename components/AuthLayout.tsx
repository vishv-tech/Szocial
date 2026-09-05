import Link from "next/link";
import type { ReactNode } from "react";
import { MessageCircle } from "lucide-react";

type AuthLayoutProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
};

export function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  return (
    <main className="min-h-screen bg-szocial-mist">
      <div className="mx-auto grid min-h-screen max-w-6xl px-4 py-6 lg:grid-cols-[0.95fr_1.05fr] lg:gap-10 lg:px-8">
        <section className="hidden flex-col justify-between rounded-3xl bg-szocial-ink p-8 text-white lg:flex">
          <Link className="flex items-center gap-2 text-xl font-bold" href="/">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-szocial-orange">
              <MessageCircle className="h-5 w-5" />
            </span>
            Szocial
          </Link>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-orange-200">
              Local-first community
            </p>
            <h1 className="mt-4 text-5xl font-bold tracking-normal">
              Discover people, places, and help around your neighbourhood.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-white/75">
              Join plans, ask for help, chat safely, and discover new local businesses
              without leaving your area.
            </p>
          </div>
          <p className="text-sm text-white/60">
            Demo resident: vishv@szocial.local / demo123
          </p>
        </section>
        <section className="flex min-h-screen items-center justify-center py-8">
          <div className="w-full max-w-md rounded-3xl border border-slate-100 bg-white p-6 shadow-soft">
            <Link className="mb-8 flex items-center gap-2 lg:hidden" href="/">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-szocial-orange text-white">
                <MessageCircle className="h-5 w-5" />
              </span>
              <span className="text-xl font-bold text-szocial-ink">Szocial</span>
            </Link>
            <h1 className="text-3xl font-bold tracking-normal text-szocial-ink">{title}</h1>
            <p className="mt-2 leading-6 text-szocial-muted">{subtitle}</p>
            <div className="mt-6">{children}</div>
          </div>
        </section>
      </div>
    </main>
  );
}

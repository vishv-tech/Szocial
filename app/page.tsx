import Link from "next/link";
import {
  BadgeCheck,
  Building2,
  Coffee,
  Compass,
  Film,
  Gamepad2,
  HandHeart,
  MapPin,
  MessageCircle,
  Mountain,
  ShieldCheck,
  Sparkles,
  Trophy,
  UsersRound
} from "lucide-react";
import { Button } from "@/components/Button";

const howItWorks = [
  ["Post plans", "Start cricket, cafe, movie, study, or walk plans nearby.", Trophy],
  ["Join activities", "Tap interest and let the host accept you into the plan.", UsersRound],
  ["Chat safely", "Move from interest to private or group chats.", MessageCircle],
  ["Discover businesses", "Find new cafes, gyms, stores, salons, and services.", Building2],
  ["Ask or offer help", "Post local needs or respond when neighbours need support.", HandHeart]
];

const useCases = [
  ["Sports partner", Trophy],
  ["Movie buddy", Film],
  ["Hiking group", Mountain],
  ["Cafe meetup", Coffee],
  ["Tutor at home", Sparkles],
  ["Local plumber", HandHeart],
  ["New cafe discovery", Compass],
  ["Gym partner", UsersRound],
  ["Weekend drive", MapPin],
  ["Study group", Gamepad2]
];

const safety = [
  "Verified profiles",
  "Location-based community",
  "Report/block option",
  "Public place recommendation",
  "No exact live location shown publicly",
  "User controls contact preference"
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-white">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/20 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link className="flex items-center gap-2" href="/">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-szocial-orange text-white">
              <MessageCircle className="h-5 w-5" />
            </span>
            <span className="text-xl font-bold text-szocial-ink">Szocial</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-semibold text-szocial-muted lg:flex">
            <Link href="/">Home</Link>
            <a href="#how">How It Works</a>
            <a href="#safety">Safety</a>
            <a href="#business">For Business</a>
            <Link href="/login">Login</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Button className="hidden sm:inline-flex" href="/signup" variant="outline">
              Join as Resident
            </Button>
            <Button href="/business/signup">List Your Business</Button>
          </div>
        </div>
      </header>

      <section
        className="relative overflow-hidden bg-cover bg-center px-4 pb-16 pt-28 text-white sm:px-6 lg:px-8"
        style={{
          backgroundImage:
            "linear-gradient(90deg, rgba(23,32,42,0.94), rgba(15,118,110,0.70), rgba(249,115,22,0.35)), url('https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1800&q=80')"
        }}
      >
        <div className="mx-auto grid min-h-[78vh] max-w-7xl items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/15 px-4 py-2 text-sm font-semibold backdrop-blur">
              <MapPin className="h-4 w-4" />
              Hyperlocal plans, help, chats, and businesses
            </div>
            <h1 className="mt-6 max-w-4xl text-5xl font-bold tracking-normal sm:text-6xl lg:text-7xl">
              Discover people, places, and help around your neighbourhood.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/85 sm:text-xl">
              Post plans, find nearby people, explore new local spots, and ask for
              help from your own locality.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button href="/signup" size="lg">
                Join as Resident
              </Button>
              <Button href="/business/signup" size="lg" variant="secondary">
                List Your Business
              </Button>
              <Button href="/home" size="lg" variant="light">
                Explore Demo
              </Button>
            </div>
          </div>
          <div className="mx-auto w-full max-w-sm rounded-[2rem] border border-white/25 bg-white p-3 text-szocial-ink shadow-2xl">
            <div className="rounded-[1.6rem] bg-szocial-mist p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-szocial-orange">New to Bandra</p>
                  <h2 className="text-xl font-bold">Local preview</h2>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-szocial-teal">
                  Demo
                </span>
              </div>
              <PhonePreviewCard
                badge="Fun"
                text="7 PM cricket at Five Gardens, anyone up?"
                title="Need 2 people for cricket"
              />
              <PhonePreviewCard
                badge="Help"
                text="Need maths teacher for Class 8 near Bandra East."
                title="Tutor request"
              />
              <div className="mt-3 overflow-hidden rounded-3xl bg-white shadow-sm">
                <img
                  alt="The Mocha House"
                  className="h-28 w-full object-cover"
                  src="https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=900&q=80"
                />
                <div className="p-4">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold">The Mocha House</h3>
                    <BadgeCheck className="h-4 w-4 text-szocial-teal" />
                  </div>
                  <p className="mt-1 text-sm text-szocial-muted">
                    New cafe opened in Bandra East.
                  </p>
                  <p className="mt-2 rounded-xl bg-szocial-tealSoft px-3 py-2 text-xs font-bold text-szocial-teal">
                    10% off on first visit
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-szocial-mist px-4 py-16 sm:px-6 lg:px-8" id="how">
        <div className="mx-auto max-w-7xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-szocial-teal">
            How it works
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-normal text-szocial-ink sm:text-4xl">
            From local intent to local connection.
          </h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            {howItWorks.map(([title, description, Icon]) => (
              <article className="rounded-3xl bg-white p-5 shadow-soft" key={title as string}>
                <Icon className="h-7 w-7 text-szocial-orange" />
                <h3 className="mt-4 font-bold text-szocial-ink">{title as string}</h3>
                <p className="mt-2 text-sm leading-6 text-szocial-muted">{description as string}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-3xl font-bold tracking-normal text-szocial-ink">Use cases</h2>
          <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-5">
            {useCases.map(([label, Icon]) => (
              <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm" key={label as string}>
                <Icon className="h-5 w-5 text-szocial-teal" />
                <p className="mt-3 text-sm font-bold text-szocial-ink">{label as string}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-szocial-mist px-4 py-16 sm:px-6 lg:px-8" id="safety">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <ShieldCheck className="h-10 w-10 text-szocial-teal" />
            <h2 className="mt-4 text-3xl font-bold tracking-normal text-szocial-ink">
              Safety is built into the product language.
            </h2>
            <p className="mt-3 leading-7 text-szocial-muted">
              Szocial nudges residents toward general-area discovery, safer meetups,
              and clear reporting controls.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {safety.map((item) => (
              <div className="rounded-2xl bg-white p-4 font-semibold text-szocial-ink shadow-sm" key={item}>
                <ShieldCheck className="mb-3 h-5 w-5 text-szocial-orange" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 lg:px-8" id="business">
        <div className="mx-auto max-w-7xl rounded-3xl bg-szocial-ink p-8 text-white shadow-soft lg:p-12">
          <Building2 className="h-10 w-10 text-orange-200" />
          <h2 className="mt-5 text-3xl font-bold tracking-normal">
            Are you a local business owner?
          </h2>
          <p className="mt-3 max-w-2xl leading-7 text-white/75">
            List your shop and reach nearby customers through paid local discovery,
            offers, chats, and mock analytics.
          </p>
          <Button className="mt-6" href="/business/signup" size="lg">
            List Your Business
          </Button>
        </div>
      </section>

      <footer className="border-t border-slate-100 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 text-sm text-szocial-muted sm:flex-row sm:items-center sm:justify-between">
          <p className="font-bold text-szocial-ink">Szocial</p>
          <div className="flex flex-wrap gap-4">
            {["About", "Safety", "Help", "Business", "Terms", "Privacy"].map((item) => (
              <a href="#how" key={item}>
                {item}
              </a>
            ))}
          </div>
        </div>
      </footer>
    </main>
  );
}

function PhonePreviewCard({
  badge,
  title,
  text
}: {
  badge: string;
  title: string;
  text: string;
}) {
  return (
    <article className="mt-3 rounded-3xl bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-bold text-szocial-ink">{title}</h3>
        <span className="rounded-full bg-szocial-orangeSoft px-3 py-1 text-xs font-bold text-szocial-orange">
          {badge}
        </span>
      </div>
      <p className="mt-2 text-sm leading-6 text-szocial-muted">{text}</p>
      <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-szocial-teal">
        <UsersRound className="h-4 w-4" />
        Interested neighbours nearby
      </div>
    </article>
  );
}

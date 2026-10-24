"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeCheck,
  CheckCircle2,
  CirclePlus,
  Camera,
  Flag,
  HeartHandshake,
  MapPin,
  PartyPopper,
  Pencil,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  UserCheck,
  UsersRound
} from "lucide-react";
import { BusinessCard } from "@/components/BusinessCard";
import { EntityImages } from "@/components/EntityImages";
import { exportLegacyOwnPosts } from "@/lib/resident-auth";
import { Button } from "@/components/Button";
import { CategoryTabs } from "@/components/CategoryTabs";
import { ChatList } from "@/components/ChatList";
import { ChatWindow } from "@/components/ChatWindow";
import { EmptyState } from "@/components/EmptyState";
import { HelpCard } from "@/components/HelpCard";
import { LocationChip } from "@/components/LocationChip";
import { LocationModal } from "@/components/LocationModal";
import { Modal } from "@/components/Modal";
import { PostCard } from "@/components/PostCard";
import { ProfileImageCropper } from "@/components/ProfileImageCropper";
import { ReportModal } from "@/components/ReportModal";
import { RelativeTime } from "@/components/RelativeTime";
import { ResidentShell } from "@/components/ResidentShell";
import { SearchBar } from "@/components/SearchBar";
import { StatCard } from "@/components/StatCard";
import { useAppStore } from "@/components/AppStoreProvider";
import { useToast } from "@/components/ToastProvider";
import type { LocalPost, LocationInfo, ResidentUser } from "@/types";
import { type FeedSort } from "@/lib/feed";
import { useFeedLocation } from "@/components/useFeedLocation";
import { api } from "@/lib/client-api";
import { useServerFeed, useFeedPreference } from "@/components/useServerFeed";
import { FeedPaging } from "@/components/FeedPaging";
import { FeedSortControl } from "@/components/FeedSortControl";
import { getLocationName } from "@/lib/location";
import { sortByNearbyRelevance } from "@/lib/nearby-ranking";
import { timestampToMilliseconds } from "@/lib/date-time";
import { loadImageFromFile, validateProfileImageFile } from "@/lib/image-crop";
import { getUserDisplayPhoto } from "@/lib/user-photo";
import { asArray } from "@/lib/utils";

const postTabs = ["All", "Fun", "Help", "Nearby"] as const;
const helpTabs = ["Need Help", "Urgent", "Solved"] as const;
const myPostTabs = ["Active posts", "Completed posts"] as const;
const exploreCategories = [
  "All",
  "Sports",
  "Food",
  "Movies",
  "Adventure",
  "Study",
  "Help",
  "Nearby"
] as const;
const businessCategories = [
  "All",
  "Cafe",
  "Restaurant",
  "Store",
  "Medical",
  "Salon",
  "Gym",
  "Classes"
] as const;
const genders = ["Prefer not to say", "Male", "Female", "Other"] as const;

function textMatch(text: string, query: string) {
  return text.toLowerCase().includes(query.trim().toLowerCase());
}


type LegacyPostOwnerFields = LocalPost & {
  creatorId?: string;
  userId?: string;
  ownerId?: string;
  createdById?: string;
};

function getPostOwnerId(post: LocalPost) {
  const legacyPost = post as LegacyPostOwnerFields;
  return legacyPost.authorId ?? legacyPost.creatorId ?? legacyPost.userId ?? legacyPost.ownerId ?? legacyPost.createdById;
}

function isCurrentUserPost(post: LocalPost, userId: string) {
  return getPostOwnerId(post) === userId;
}

function hasPostStatus(post: LocalPost, statuses: readonly string[]) {
  return statuses.includes(post.status);
}

function isPublishedActivePost(post: LocalPost) {
  return hasPostStatus(post, ["Active", "Open"]);
}

function isCompletedPost(post: LocalPost) {
  return hasPostStatus(post, ["Completed", "Closed", "Solved"]);
}

function newestFirst<T extends { createdAt?: string }>(items: T[]) {
  return [...items].sort(
    (left, right) =>
      timestampToMilliseconds(right.createdAt) -
      timestampToMilliseconds(left.createdAt)
  );
}

function HomeRightPanel() {
  const { state } = useAppStore();
  const businesses = sortByNearbyRelevance(
    newestFirst(
      asArray(state.businesses).filter((business) => business.status === "Live")
    ),
    state.location,
    (business) => business
  );

  return (
    <>
      <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-soft">
        <h3 className="font-bold text-szocial-ink">New near you</h3>
        <div className="mt-4 space-y-3">
          {businesses
            .slice(0, 3)
            .map((business) => (
              <Link className="flex items-center gap-3 rounded-2xl bg-szocial-mist p-3" href={`/businesses/${business.id}`} key={business.id}>
                <img alt={business.name} className="h-12 w-12 rounded-xl object-cover" src={business.logo} />
                <div className="min-w-0">
                  <p className="truncate font-semibold text-szocial-ink">{business.name}</p>
                  <p className="text-sm text-szocial-muted">{business.category}</p>
                  <RelativeTime
                    className="block text-xs text-szocial-muted"
                    timestamp={business.createdAt}
                  />
                </div>
              </Link>
            ))}
        </div>
      </div>
      <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-soft">
        <ShieldCheck className="h-6 w-6 text-szocial-teal" />
        <h3 className="mt-3 font-bold text-szocial-ink">Neighbourhood safety</h3>
        <p className="mt-2 text-sm leading-6 text-szocial-muted">
          Meet in public places, avoid sharing exact live location, and report anything
          that feels unsafe.
        </p>
      </div>
    </>
  );
}

export function HomeScreen() {
  useFeedLocation();
  const { currentUser, locationLabel } = useAppStore();
  const [query, setQuery] = useFeedPreference<string>("home-query", "");
  const [sort, setSort] = useFeedPreference<FeedSort>("home-sort","nearby");
  const [tab, setTab] = useFeedPreference<(typeof postTabs)[number]>("home-tab","All");
  const [locationOpen, setLocationOpen] = useState(false);

  const feed = useServerFeed(query,sort,'All',tab==='Fun'?'fun':tab==='Help'?'help':undefined);
  const posts = feed.posts;

  return (
    <ResidentShell rightPanel={<HomeRightPanel />}>
      <div className="space-y-5">
        <section className="rounded-3xl bg-white p-5 shadow-soft">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-szocial-orange">Good evening</p>
              <h1 className="mt-1 text-3xl font-bold tracking-normal text-szocial-ink">
                {(currentUser.name || "Resident").split(" ")[0]}
              </h1>
            </div>
            <LocationChip location={locationLabel} onClick={() => setLocationOpen(true)} />
          </div>
          <div className="mt-5">
            <SearchBar
              onChange={setQuery}
              placeholder="Search keywords or locations..."
              value={query}
            />
          </div>
          <FeedSortControl value={sort} onChange={setSort} />
          <CategoryTabs className="mt-5" onChange={setTab} tabs={[...postTabs]} value={tab} />
        </section>
        {posts.length ? (
          <div className="space-y-5">
            {asArray(posts).map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        ) : !feed.loading && !feed.error ? (
          <EmptyState
            action={<Button href="/post">Create a post</Button>}
            description="Try another search or start a new local plan."
            icon={<Search className="h-6 w-6" />}
            title="No local posts found"
          />
        ) : null}
        <FeedPaging {...feed} />
      </div>
      <LocationModal onClose={() => setLocationOpen(false)} open={locationOpen} />
    </ResidentShell>
  );
}

export function ExploreScreen() {
  useFeedLocation();
  const { state, currentUser, locationLabel } = useAppStore();
  const [query, setQuery] = useFeedPreference<string>("explore-query", "");
  const [sort, setSort] = useFeedPreference<FeedSort>("explore-sort","nearby");
  const [category, setCategory] = useFeedPreference<(typeof exploreCategories)[number]>("explore-category","All");

  const feed = useServerFeed(query,sort,category);
  const featuredPosts = feed.posts;

  return (
    <ResidentShell>
      <div className="space-y-6">
        <section className="rounded-3xl bg-white p-5 shadow-soft">
          <p className="text-sm font-semibold text-szocial-orange">Explore</p>
          <h1 className="mt-1 text-3xl font-bold tracking-normal text-szocial-ink">
            Everything local around {locationLabel}
          </h1>
          <div className="mt-5">
            <SearchBar onChange={setQuery} placeholder="Search keywords or locations..." value={query} />
          </div>
          <FeedSortControl value={sort} onChange={setSort} />
          <CategoryTabs className="mt-5" onChange={setCategory} tabs={[...exploreCategories]} value={category} />
        </section>

        <section>
          <h2 className="mb-4 text-xl font-bold text-szocial-ink">Local posts</h2>
          <div className="space-y-5">
            {asArray(featuredPosts).map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        </section>

        {!featuredPosts.length && !feed.loading && !feed.error ? <EmptyState title="No posts found" description="Try another location or keyword." icon={<Search className="h-6 w-6" />} /> : null}
        {!query.trim() ? <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-soft">
          <h2 className="text-xl font-bold text-szocial-ink">Recommended neighbours</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {asArray(state.residents).filter(resident => resident.id !== currentUser.id && resident.status === "Active" &&
              !state.chats.some(chat => chat.status === "Blocked" && chat.participantIds.includes(currentUser.id) && chat.participantIds.includes(resident.id)))
              .slice(0, 3).map(resident => <div className="flex items-center gap-3 rounded-2xl bg-szocial-mist p-3" key={resident.id}>
                <img alt={resident.name} className="h-11 w-11 rounded-xl object-cover" src={getUserDisplayPhoto(resident)} />
                <div className="min-w-0 flex-1"><p className="truncate font-semibold text-szocial-ink">{resident.name}</p><p className="text-sm text-szocial-muted">{resident.location.area}</p></div>
                {resident.verified ? <BadgeCheck className="h-5 w-5 text-szocial-teal" /> : null}
              </div>)}
          </div>
        </section> : null}
        <FeedPaging {...feed} />
      </div>
    </ResidentShell>
  );
}

export function CreatePostScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { state, hydrated, createPost } = useAppStore();
  const { notify } = useToast();
  const initialMode = searchParams.get("type") === "help" ? "help" : null;
  const [mode, setMode] = useState<"fun" | "help" | null>(initialMode);
  const [activity, setActivity] = useState("Cricket");
  const [helpCategory, setHelpCategory] = useState("Tutor");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [location, setLocation] = useState<LocationInfo>(state.location);
  const [landmark, setLandmark] = useState(state.location.landmark ?? "");
  const [neededPeople, setNeededPeople] = useState("2");
  const [genderPreference, setGenderPreference] = useState<LocalPost["genderPreference"]>("Any");
  const [ageGroup, setAgeGroup] = useState<LocalPost["ageGroup"]>("Any");
  const [visibility, setVisibility] = useState<LocalPost["visibility"]>("Public");
  const [urgency, setUrgency] = useState<"Normal" | "Urgent">("Normal");
  const [budget, setBudget] = useState("");
  const [contactPreference, setContactPreference] = useState<LocalPost["contactPreference"]>("Chat only");

  useEffect(() => {
    if (!hydrated) return;
    setLocation(state.location);
    setLandmark(state.location.landmark ?? "");
  }, [hydrated, state.location]);

  const baseInput = {
    title,
    description,
    location,
    landmark,
    contactPreference
  };

  const buildInput = () =>
    mode === "fun"
      ? {
          ...baseInput,
          type: "fun" as const,
          category: activity,
          date,
          time,
          neededPeople: Number(neededPeople || 1),
          genderPreference,
          ageGroup,
          visibility
        }
      : {
          ...baseInput,
          type: "help" as const,
          category: helpCategory,
          urgency,
          budget
        };

  const validate = () => {
    if (!mode || !title || !location.area) return false;
    if (mode === "fun" && (!date || !time || !activity)) return false;
    if (mode === "help" && (!helpCategory || !description)) return false;
    return true;
  };

  const [postImages,setPostImages]=useState<File[]>([]);
  const [posting,setPosting]=useState(false);
  const postLock=useRef(false);
  const submit = async () => {
    if(postLock.current)return;
    if (!validate()) {
      notify({ title: "Please fill the required fields", variant: "warning" });
      return;
    }
    postLock.current=true;setPosting(true);
    try{if (!await createPost(buildInput(),postImages)) return;}finally{postLock.current=false;setPosting(false);}
    router.push(mode === "help" ? "/help" : "/home");
  };

  return (
    <ResidentShell>
      <div className="space-y-5">
        <section className="rounded-3xl bg-white p-5 shadow-soft">
          <h1 className="text-3xl font-bold tracking-normal text-szocial-ink">Create a local post</h1>
          <p className="mt-2 text-szocial-muted">
            Share a plan for fun or ask neighbours for local help.
          </p>
        </section>
        <div className="grid gap-4 md:grid-cols-2">
          {[
            {
              id: "fun" as const,
              title: "Post for Fun",
              description: "Sports, movies, drives, hiking, cafes, walks, study groups.",
              icon: PartyPopper
            },
            {
              id: "help" as const,
              title: "Post for Help",
              description: "Tutors, repairs, lost and found, recommendations, urgent needs.",
              icon: HeartHandshake
            }
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                className={`rounded-3xl border p-6 text-left shadow-soft transition ${
                  mode === item.id
                    ? "border-szocial-orange bg-szocial-orangeSoft"
                    : "border-slate-100 bg-white hover:-translate-y-0.5"
                }`}
                key={item.id}
                onClick={() => setMode(item.id)}
                type="button"
              >
                <Icon className="h-8 w-8 text-szocial-orange" />
                <h2 className="mt-4 text-xl font-bold text-szocial-ink">{item.title}</h2>
                <p className="mt-2 leading-6 text-szocial-muted">{item.description}</p>
              </button>
            );
          })}
        </div>
        {mode ? (
          <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-soft">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-sm font-semibold text-szocial-ink">
                  {mode === "fun" ? "Activity type" : "Help category"} *
                </span>
                <select
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-szocial-teal"
                  onChange={(event) =>
                    mode === "fun" ? setActivity(event.target.value) : setHelpCategory(event.target.value)
                  }
                  value={mode === "fun" ? activity : helpCategory}
                >
                  {(mode === "fun"
                    ? [
                        "Cricket",
                        "Football",
                        "Badminton",
                        "Movie",
                        "Drive",
                        "Hiking",
                        "Cafe",
                        "Walking",
                        "Gym",
                        "Study",
                        "Startup meetup",
                        "Gaming",
                        "Other"
                      ]
                    : [
                        "Tutor",
                        "Maid",
                        "Electrician",
                        "Plumber",
                        "Medical help",
                        "Lost and found",
                        "Local recommendation",
                        "Emergency help",
                        "Delivery help",
                        "Elderly help",
                        "Pet help",
                        "Other"
                      ]).map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-szocial-ink">Title *</span>
                <input
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-szocial-teal"
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder={mode === "fun" ? "Need 2 people for cricket today" : "Need maths teacher for Class 8"}
                  value={title}
                />
              </label>
              <label className="block md:col-span-2">
                <span className="text-sm font-semibold text-szocial-ink">
                  Description {mode === "help" ? "*" : ""}
                </span>
                <textarea
                  className="mt-2 min-h-28 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-szocial-teal"
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Add useful details, safety context, and meeting info."
                  value={description}
                />
              </label>
              {mode === "fun" ? (
                <>
                  <label className="block">
                    <span className="text-sm font-semibold text-szocial-ink">Date *</span>
                    <input className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-szocial-teal" onChange={(event) => setDate(event.target.value)} type="date" value={date} />
                  </label>
                  <label className="block">
                    <span className="text-sm font-semibold text-szocial-ink">Time *</span>
                    <input className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-szocial-teal" onChange={(event) => setTime(event.target.value)} type="time" value={time} />
                  </label>
                  <label className="block">
                    <span className="text-sm font-semibold text-szocial-ink">People needed</span>
                    <input className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-szocial-teal" onChange={(event) => setNeededPeople(event.target.value)} type="number" value={neededPeople} />
                  </label>
                  <label className="block">
                    <span className="text-sm font-semibold text-szocial-ink">Gender preference</span>
                    <select className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-szocial-teal" onChange={(event) => setGenderPreference(event.target.value as LocalPost["genderPreference"])} value={genderPreference}>
                      {["Any", "Male", "Female", "Mixed group"].map((item) => <option key={item}>{item}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-sm font-semibold text-szocial-ink">Age group</span>
                    <select className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-szocial-teal" onChange={(event) => setAgeGroup(event.target.value as LocalPost["ageGroup"])} value={ageGroup}>
                      {["Any", "13-17", "18-24", "25-35", "35+"].map((item) => <option key={item}>{item}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-sm font-semibold text-szocial-ink">Visibility</span>
                    <select className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-szocial-teal" onChange={(event) => setVisibility(event.target.value as LocalPost["visibility"])} value={visibility}>
                      {["Public", "Nearby only", "Private after approval"].map((item) => <option key={item}>{item}</option>)}
                    </select>
                  </label>
                </>
              ) : (
                <>
                  <label className="block">
                    <span className="text-sm font-semibold text-szocial-ink">Urgency</span>
                    <select className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-szocial-teal" onChange={(event) => setUrgency(event.target.value as "Normal" | "Urgent")} value={urgency}>
                      <option>Normal</option>
                      <option>Urgent</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-sm font-semibold text-szocial-ink">Budget optional</span>
                    <input className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-szocial-teal" onChange={(event) => setBudget(event.target.value)} placeholder="Rs. 300/hour or Negotiable" value={budget} />
                  </label>
                </>
              )}
              <label className="block">
                <span className="text-sm font-semibold text-szocial-ink">Area *</span>
                <input className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-szocial-teal" onChange={(event) => setLocation({ ...location, area: event.target.value, latitude: null, longitude: null, source: "manual" })} value={location.area} />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-szocial-ink">Landmark</span>
                <input className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-szocial-teal" onChange={(event) => setLandmark(event.target.value)} value={landmark} />
              </label>
              <label className="block md:col-span-2">
                <span className="text-sm font-semibold text-szocial-ink">Contact preference</span>
                <select className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-szocial-teal" onChange={(event) => setContactPreference(event.target.value as LocalPost["contactPreference"])} value={contactPreference}>
                  <option>Chat only</option>
                  <option>Call after approval</option>
                </select>
              </label>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <label>Post images (up to 6)<input aria-label="Post images" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={event=>{const files=Array.from(event.currentTarget.files??[]);if(files.length>6||files.some(f=>f.size>5*1024*1024)){notify({title:"Choose up to 6 images under 5 MB each",variant:"warning"});return;}setPostImages(files);}}/></label>
              <Button disabled={posting} onClick={submit}>
                <CirclePlus className="h-4 w-4" />
                {mode === "help" ? "Post Help Request" : "Post Now"}
              </Button>
              <Button onClick={() => router.push("/home")} variant="ghost">
                Cancel
              </Button>

            </div>
          </section>
        ) : null}
      </div>
    </ResidentShell>
  );
}

export function HelpScreen() {
  useFeedLocation();
  const { state, locationLabel } = useAppStore();
  const [query, setQuery] = useFeedPreference<string>("help-query", "");
  const [tab, setTab] = useFeedPreference<(typeof helpTabs)[number]>("help-tab","Need Help");
  const feed = useServerFeed(query,'nearby',tab==='Urgent'?'Urgent':'All','help',tab==='Solved'?'Solved':'Active');
  const helpPosts = feed.posts;

  return (
    <ResidentShell>
      <div className="space-y-5">
        <section className="rounded-3xl bg-white p-5 shadow-soft">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-normal text-szocial-ink">
                {getLocationName(state.location) ? `Help around ${locationLabel}` : "Help near you"}
              </h1>
              <p className="mt-2 text-szocial-muted">Requests and urgent local support.</p>
            </div>
            <Button href="/post?type=help">
              <HeartHandshake className="h-4 w-4" />
              Post for Help
            </Button>
          </div>
          <div className="mt-5">
            <SearchBar onChange={setQuery} placeholder="Search help requests..." value={query} />
          </div>
          <CategoryTabs className="mt-5" onChange={setTab} tabs={[...helpTabs]} value={tab} />
        </section>
          <div className="space-y-5">
            {asArray(helpPosts).map((post) => (
              <HelpCard key={post.id} request={post} />
            ))}
            {!helpPosts.length && !feed.loading && !feed.error ? (
              <EmptyState
                action={<Button href="/post?type=help">Post for Help</Button>}
                description="Try another filter or create the first local help request."
                icon={<HeartHandshake className="h-6 w-6" />}
                title="No help requests found"
              />
            ) : null}
          </div>
        <FeedPaging {...feed} />
      </div>
    </ResidentShell>
  );
}

export function ChatsScreen() {
  const searchParams = useSearchParams();
  const { state } = useAppStore();
  const chats = useMemo(
    () =>
      asArray(state.chats)
        .filter((chat) =>
          Boolean(state.currentUserId) && asArray(chat.participantIds).includes(state.currentUserId ?? "")
        )
        .sort(
          (left, right) =>
            timestampToMilliseconds(right.lastMessageAt) -
            timestampToMilliseconds(left.lastMessageAt)
        ),
    [state.currentUserId, state.chats]
  );
  const requestedChatId = searchParams.get("chatId");
  const initial =
    chats.find((chat) => chat.id === requestedChatId)?.id ?? chats[0]?.id ?? null;
  const [activeChatId, setActiveChatId] = useState<string | null>(initial);
  const activeChat = chats.find((chat) => chat.id === activeChatId) ?? null;

  useEffect(() => {
    if (requestedChatId && chats.some(chat => chat.id === requestedChatId)) setActiveChatId(requestedChatId);
  }, [requestedChatId, chats]);

  useEffect(() => {
    if (!activeChatId || !chats.some((chat) => chat.id === activeChatId)) {
      setActiveChatId(chats[0]?.id ?? null);
    }
  }, [activeChatId, chats]);

  return (
    <ResidentShell>
      <div className="space-y-5">
        <section className="rounded-3xl bg-white p-5 shadow-soft">
          <h1 className="text-3xl font-bold tracking-normal text-szocial-ink">Chats</h1>
          <p className="mt-2 text-szocial-muted">
            Active chats, event groups, business chats, and help request conversations.
          </p>
        </section>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
          <section className="rounded-3xl border border-slate-100 bg-white p-3 shadow-soft">
            <ChatList activeChatId={activeChatId} chats={chats} onSelect={setActiveChatId} />
          </section>
          <ChatWindow chat={activeChat} />
        </div>
      </div>
    </ResidentShell>
  );
}

export function MyPostsScreen() {
  const router=useRouter();
  const { state, currentUser, deletePost, closePost, updatePost, acceptInterestedUser, rejectInterestedUser } = useAppStore();
  const [tab, setTab] = useState<(typeof myPostTabs)[number]>("Active posts");
  const [interestedPost, setInterestedPost] = useState<LocalPost | null>(null);
  const [interestedPeople,setInterestedPeople]=useState<Array<{id:string;name:string;profilePhoto?:string;location:{area?:string;city?:string}}>>([]),[peopleError,setPeopleError]=useState(''),[peopleLoading,setPeopleLoading]=useState(false);
  const openInterested=async(post:LocalPost)=>{setInterestedPost(post);setInterestedPeople([]);setPeopleError('');setPeopleLoading(true);try{const people=[];for(let offset=0;offset<post.interestedUserIds.length;offset+=100){const response=await api<{people:typeof interestedPeople}>('/api/people?ids='+encodeURIComponent(post.interestedUserIds.slice(offset,offset+100).join(',')));people.push(...response.people);}setInterestedPeople(people);}catch{setPeopleError('Could not load interested people. Reopen to retry.');}finally{setPeopleLoading(false);}};
  const ownPosts = newestFirst(
    asArray(state.posts).filter((post) => isCurrentUserPost(post, currentUser.id))
  );
  const posts =
    tab === "Active posts"
      ? ownPosts.filter(post=>isPublishedActivePost(post)||post.status==='Draft')
      : ownPosts.filter(isCompletedPost);

  return (
    <ResidentShell>
      <div className="space-y-5">
        <section className="rounded-3xl bg-white p-5 shadow-soft">
          <h1 className="text-3xl font-bold tracking-normal text-szocial-ink">My posts</h1>
          <p className="mt-2 text-szocial-muted">Manage your active and completed posts.</p>
          <CategoryTabs className="mt-5" onChange={setTab} tabs={[...myPostTabs]} value={tab} />
        </section>
        <div className="space-y-4">
          {asArray(posts).map((post) => (
            <article className="rounded-3xl border border-slate-100 bg-white p-5 shadow-soft" key={post.id}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <span className="rounded-full bg-szocial-orangeSoft px-3 py-1 text-xs font-bold text-szocial-orange">
                    {post.type} - {post.status}
                  </span>
                  <h2 className="mt-3 text-xl font-bold text-szocial-ink">{post.title}</h2>
                  <p className="mt-1 text-sm text-szocial-muted">
                    {post.location.area} - {post.date ?? "Flexible"} {post.time ?? ""}
                  </p>
                  <RelativeTime
                    className="mt-1 block text-xs text-szocial-muted"
                    timestamp={post.createdAt}
                  />
                  <p className="mt-2 text-sm text-szocial-muted">
                    {asArray(post.interestedUserIds).length} interested - {asArray(post.comments).length} comments
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:w-[440px]">
                  <Button onClick={() => deletePost(post.id)} variant="outline">
                    <Trash2 className="h-4 w-4" />
                    Delete Post
                  </Button>
                  <Button onClick={() => closePost(post.id)} variant="outline">
                    <CheckCircle2 className="h-4 w-4" />
                    Close Post
                  </Button>
                  <Button onClick={() => openInterested(post)} variant="secondary">
                    <UsersRound className="h-4 w-4" />
                    Interested
                  </Button>
                </div>
              </div>
              <EntityImages label="Post images" scope="post" entityId={post.id} paths={post.imagePaths??[]} urls={post.images??[]} onSave={async paths=>Boolean(await updatePost(post.id,{images:paths}))}/>
              {post.status==='Draft'?<Button onClick={()=>updatePost(post.id,{status:'Active'})}>Publish draft</Button>:null}
            </article>
          ))}
        </div>
        {!posts.length ? (
          <EmptyState
            action={<Button href="/post">Create a post</Button>}
            description="There is nothing in this tab yet."
            icon={<CirclePlus className="h-6 w-6" />}
            title="No posts here"
          />
        ) : null}
      </div>
      <Modal
        onClose={() => setInterestedPost(null)}
        open={Boolean(interestedPost)}
        title="Interested people"
      >
        <div className="space-y-3">
          {peopleLoading?<p role="status">Loading interested people…</p>:null}{peopleError?<p role="status">{peopleError}</p>:null}
          {interestedPeople.map((user) => {
            if (!user) return null;
            return (
              <div className="flex items-center gap-3 rounded-2xl bg-szocial-mist p-3" key={user.id}>
                <img alt={user.name} className="h-12 w-12 rounded-xl object-cover" src={getUserDisplayPhoto(user)} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-szocial-ink">{user.name}</p>
                  <p className="text-sm text-szocial-muted">{user.location.area}</p>
                </div>
                <Button onClick={async () => {if(!interestedPost)return;const id=await acceptInterestedUser(interestedPost.id,user.id);if(id)router.push(`/chats?chatId=${id}`);}} size="sm">
                  Accept
                </Button>
                <Button onClick={() => interestedPost && rejectInterestedUser(interestedPost.id, user.id)} size="sm" variant="outline">
                  Reject
                </Button>
              </div>
            );
          })}
          {!asArray(interestedPost?.interestedUserIds).length ? (
            <p className="text-sm text-szocial-muted">No one has shown interest yet.</p>
          ) : null}
        </div>
      </Modal>
    </ResidentShell>
  );
}

export function ProfileScreen() {
  const router = useRouter();
  const { state, pages, currentUser, locationLabel, updateResidentProfile, updatePrivacy, submitVerification, logoutResident } = useAppStore();
  const { notify } = useToast();
  const [editOpen, setEditOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [profile, setProfile] = useState({
    name: currentUser.name,
    bio: currentUser.bio,
    age: String(currentUser.age ?? ""),
    gender: currentUser.gender ?? "Prefer not to say",
    profilePhoto: currentUser.profilePhoto ?? "",
    profilePhotoName: currentUser.profilePhotoName ?? ""
  });
  const [privacy, setPrivacy] = useState(currentUser.privacy);
  const [pendingPhoto, setPendingPhoto] = useState<{
    fileName: string;
    src: string;
  } | null>(null);
  const myPosts = asArray(state.posts).filter((post) => isCurrentUserPost(post, currentUser.id));
  const joined = asArray(state.posts).filter((post) =>
    asArray(post.interestedUserIds).includes(currentUser.id)
  );

  const photoSelection=useRef(0);
  const selectProfilePhoto = async (file?: File) => {
    const selection=++photoSelection.current;
    if (!file) return;

    const validationMessage = validateProfileImageFile(file);
    if (validationMessage) {
      notify({ title: validationMessage, variant: "warning" });
      return;
    }

    try {
      const src = await loadImageFromFile(file);
      if(selection!==photoSelection.current)return;
      setPendingPhoto({ fileName: file.name, src });
    } catch {
      notify({ title: "Could not load this image. Try another photo.", variant: "warning" });
    }
  };

  return (
    <ResidentShell>
      <div className="space-y-5">
        <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-soft">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <img alt={currentUser.name} className="h-24 w-24 rounded-3xl object-cover" src={getUserDisplayPhoto(currentUser)} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-3xl font-bold tracking-normal text-szocial-ink">
                  {currentUser.name}
                </h1>
                {currentUser.verified ? <BadgeCheck className="h-6 w-6 text-szocial-teal" /> : null}
              </div>
              <p className="mt-2 flex items-center gap-2 text-szocial-muted">
                <MapPin className="h-4 w-4" />
                {locationLabel}
              </p>
              <p className="mt-3 leading-7 text-szocial-muted">{currentUser.bio}</p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <StatCard label="My posts" value={String(pages.posts?.total??myPosts.length)} />
            <StatCard label="Joined" value={String(pages.joined?.total??joined.length)} />
            <StatCard label="Rating" value="4.8" />
          </div>
        </section>
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Button disabled={!currentUser.id} onClick={() => {setProfile({name:currentUser.name,bio:currentUser.bio,age:String(currentUser.age??''),gender:currentUser.gender??'Prefer not to say',profilePhoto:currentUser.profilePhoto??'',profilePhotoName:currentUser.profilePhotoName??''});setEditOpen(true);}} variant="outline">
            <Pencil className="h-4 w-4" />
            Edit Profile
          </Button>
          <Button onClick={() => setLocationOpen(true)} variant="outline">
            <MapPin className="h-4 w-4" />
            Change Location
          </Button>
          <Button variant="outline" onClick={()=>{try{const posts=exportLegacyOwnPosts(currentUser.email);const url=URL.createObjectURL(new Blob([JSON.stringify(posts,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='szocial-legacy-posts.json';link.click();URL.revokeObjectURL(url);}catch(e){notify({title:'Export unavailable',description:e instanceof Error?e.message:'Could not export',variant:'warning'});}}}>Export old posts</Button>
          <Button onClick={submitVerification} variant="outline">
            <UserCheck className="h-4 w-4" />
            Verify Account
          </Button>
          <Button disabled={!currentUser.id} onClick={() => {setPrivacy(currentUser.privacy);setPrivacyOpen(true);}} variant="outline">
            <Settings className="h-4 w-4" />
            Privacy Settings
          </Button>
          <Button
            onClick={async () => {
              if(await logoutResident()) router.push("/");
            }}
            variant="secondary"
          >
            Logout
          </Button>
        </section>
      </div>
      <Modal onClose={() => setEditOpen(false)} open={editOpen} title="Edit profile">
        <div className="space-y-3">
          <label className="flex items-center gap-4 rounded-2xl border border-dashed border-slate-200 p-4">
            <img
              alt="Profile photo preview"
              className="h-16 w-16 rounded-2xl object-cover"
              src={getUserDisplayPhoto({
                name: profile.name,
                profilePhoto: profile.profilePhoto,
                avatar: currentUser.avatar
              })}
            />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 text-sm font-semibold text-szocial-ink">
                <Camera className="h-4 w-4" />
                Change Photo
              </span>
              <span className="mt-1 block truncate text-xs text-szocial-muted">
                {profile.profilePhotoName || "Choose an image under 2MB"}
              </span>
              <input
                accept="image/jpeg,image/png,image/webp"
                className="mt-2 block w-full text-xs text-szocial-muted"
                onChange={(event) => {
                  void selectProfilePhoto(event.currentTarget.files?.[0]);
                  event.currentTarget.value = "";
                }}
                type="file"
              />
            </span>
          </label>
          <Button variant="outline" onClick={()=>setProfile({...profile,profilePhoto:"",profilePhotoName:""})}>Remove photo</Button>
          <input className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-szocial-teal" onChange={(event) => setProfile({ ...profile, name: event.target.value })} value={profile.name} />
          <textarea className="min-h-24 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-szocial-teal" onChange={(event) => setProfile({ ...profile, bio: event.target.value })} value={profile.bio} />
          <div className="grid gap-3 sm:grid-cols-2">
            <input className="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-szocial-teal" onChange={(event) => setProfile({ ...profile, age: event.target.value })} placeholder="Age" type="number" value={profile.age} />
            <select className="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-szocial-teal" onChange={(event) => setProfile({ ...profile, gender: event.target.value as (typeof genders)[number] })} value={profile.gender}>
              {genders.map((item) => <option key={item}>{item}</option>)}
            </select>
          </div>
          <Button
            className="w-full"
            onClick={async () => {
              if(await updateResidentProfile({
                name: profile.name,
                bio: profile.bio,
                age: profile.age ? Number(profile.age) : undefined,
                gender: profile.gender as ResidentUser["gender"],
                profilePhoto: profile.profilePhoto || "",
                profilePhotoName: profile.profilePhotoName || undefined,
                updatedAt: new Date().toISOString()
              })) setEditOpen(false);
            }}
          >
            Save profile
          </Button>
        </div>
      </Modal>
      <ProfileImageCropper
        fileName={pendingPhoto?.fileName ?? ""}
        imageSrc={pendingPhoto?.src ?? ""}
        onCancel={() => setPendingPhoto(null)}
        onError={(message) => notify({ title: message, variant: "warning" })}
        onUsePhoto={async (croppedPhoto) => {
          if (!pendingPhoto) return;
          const nextPhoto = {
            profilePhoto: croppedPhoto,
            profilePhotoName: pendingPhoto.fileName
          };
          setProfile((current) => ({
            ...current,
            ...nextPhoto
          }));

          setPendingPhoto(null);
        }}
        open={Boolean(pendingPhoto)}
      />
      <Modal onClose={() => setPrivacyOpen(false)} open={privacyOpen} title="Privacy settings">
        <div className="space-y-3">
          {[
            ["showAge", "Show age publicly"],
            ["showExactArea", "Show exact area"],
            ["allowDirectMessages", "Allow direct messages"]
          ].map(([key, label]) => (
            <label className="flex items-center justify-between rounded-2xl bg-szocial-mist p-4" key={key}>
              <span className="font-semibold text-szocial-ink">{label}</span>
              <input
                checked={privacy[key as keyof typeof privacy]}
                className="h-5 w-5 accent-szocial-teal"
                onChange={(event) => setPrivacy({ ...privacy, [key]: event.target.checked })}
                type="checkbox"
              />
            </label>
          ))}
          <Button
            className="w-full"
            onClick={async () => {
              if(await updatePrivacy(privacy)) setPrivacyOpen(false);
            }}
          >
            Save settings
          </Button>
        </div>
      </Modal>
      <LocationModal onClose={() => setLocationOpen(false)} open={locationOpen} />
    </ResidentShell>
  );
}

export function BusinessesScreen() {
  const { state,setBusinessFilters } = useAppStore();
  const [query, setQuery] = useFeedPreference<string>("business-query", "");
  const [category, setCategory] = useFeedPreference<(typeof businessCategories)[number]>("business-category","All");
  useEffect(()=>{setBusinessFilters(query,category);},[query,category,setBusinessFilters]);
  const locationName = getLocationName(state.location);
  const businesses = sortByNearbyRelevance(
    newestFirst(
      asArray(state.businesses).filter((business) => {
        const matchesCategory = category === "All" || business.category === category;
        const matchesQuery = textMatch(`${business.name} ${business.about} ${business.category}`, query);
        return business.status === "Live" && matchesCategory && matchesQuery;
      })
    ),
    state.location,
    (business) => business
  );

  return (
    <ResidentShell>
      <div className="space-y-5">
        <section className="rounded-3xl bg-white p-5 shadow-soft">
          <p className="text-sm font-semibold text-szocial-orange">Fresh local openings and trusted spots near you.</p>
          <h1 className="mt-1 text-3xl font-bold tracking-normal text-szocial-ink">
            {locationName ? `New in ${locationName}` : "Discover local businesses"}
          </h1>
          <div className="mt-5">
            <SearchBar onChange={setQuery} placeholder="Search businesses..." value={query} />
          </div>
          <CategoryTabs className="mt-5" onChange={setCategory} tabs={[...businessCategories]} value={category} />
        </section>
        <div className="grid gap-5 lg:grid-cols-2">
          {asArray(businesses).map((business) => (
            <BusinessCard business={business} key={business.id} />
          ))}
          {!businesses.length ? (
            <div className="lg:col-span-2">
              <EmptyState
                description="No live businesses match this search or category."
                icon={<Search className="h-6 w-6" />}
                title="No businesses found"
              />
            </div>
          ) : null}
        </div>
      </div>
    </ResidentShell>
  );
}

export function BusinessDetailScreen({ businessId }: { businessId: string }) {
  const router = useRouter();
  const { state, startBusinessChat, toggleSaveBusiness } = useAppStore();
  const { notify } = useToast();
  const [reportOpen, setReportOpen] = useState(false);
  const business = asArray(state.businesses).find((item) => item.id === businessId);
  const similar = sortByNearbyRelevance(
    newestFirst(
      asArray(state.businesses).filter(
        (item) => item.id !== businessId && item.category === business?.category
      )
    ),
    state.location,
    (item) => item
  ).slice(0, 2);

  if (!business) {
    return (
      <ResidentShell>
        <EmptyState
          action={<Button href="/businesses">Back to businesses</Button>}
          description="This local listing does not exist in mock data."
          title="Business not found"
        />
      </ResidentShell>
    );
  }

  return (
    <ResidentShell>
      <div className="space-y-5">
        <section className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-soft">
          <div className="grid gap-2 md:grid-cols-[1.2fr_0.8fr]">
            <img alt={business.name} className="h-80 w-full object-cover" src={business.coverImage} />
            <div className="grid grid-cols-2 gap-2 p-2 md:grid-cols-1">
              {(asArray(business.gallery).length ? asArray(business.gallery) : [business.coverImage, business.logo]).slice(0, 2).map((image) => (
                <img alt={business.name} className="h-full min-h-36 w-full rounded-2xl object-cover" key={image} src={image} />
              ))}
            </div>
          </div>
          <div className="p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-3xl font-bold tracking-normal text-szocial-ink">
                    {business.name}
                  </h1>
                  {business.verified ? <BadgeCheck className="h-6 w-6 text-szocial-teal" /> : null}
                </div>
                <p className="mt-2 text-szocial-muted">
                  {business.category} - {business.address} - {business.openStatus}
                </p>
                <p className="mt-1 text-xs text-szocial-muted">
                  Listed <RelativeTime timestamp={business.createdAt} />
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => notify({ title: `Calling ${business.phone}` })}>
                  Call Now
                </Button>
                <Button
                  onClick={() =>
                    business.mapsLink
                      ? window.open(business.mapsLink, "_blank")
                      : notify({ title: "Directions opened" })
                  }
                  variant="outline"
                >
                  Get Directions
                </Button>
                <Button
                  onClick={() => {
                    const chatId = startBusinessChat(business.id);
                    router.push(`/chats?chatId=${chatId}`);
                  }}
                  variant="outline"
                >
                  Chat
                </Button>
              </div>
            </div>
            <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_320px]">
              <div className="space-y-5">
                <section>
                  <h2 className="text-xl font-bold text-szocial-ink">About us</h2>
                  <p className="mt-2 leading-7 text-szocial-muted">{business.about}</p>
                </section>
                <section>
                  <h2 className="text-xl font-bold text-szocial-ink">Services/products</h2>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {asArray(business.services).map((item) => (
                      <span className="rounded-full bg-szocial-mist px-3 py-1 text-sm font-semibold text-szocial-muted" key={item}>
                        {item}
                      </span>
                    ))}
                  </div>
                </section>
                <section>
                  <h2 className="text-xl font-bold text-szocial-ink">Reviews</h2>
                  <p className="mt-2 text-szocial-muted">
                    {business.rating} rating from {business.reviews} mock reviews.
                  </p>
                </section>
              </div>
              <aside className="space-y-3 rounded-3xl bg-szocial-mist p-4">
                <p className="font-bold text-szocial-ink">Offers</p>
                {asArray(business.offers).map((offer) => (
                  <div className="rounded-2xl bg-white p-3" key={offer}>
                    <p className="text-sm font-semibold text-szocial-teal">{offer}</p>
                    <RelativeTime
                      className="mt-1 block text-xs text-szocial-muted"
                      timestamp={business.offerCreatedAt?.[offer]}
                    />
                  </div>
                ))}
                <p className="text-sm text-szocial-muted">Opening hours: {business.hours}</p>
                <Button className="w-full" onClick={() => toggleSaveBusiness(business.id)} variant="outline">
                  Save
                </Button>
                <Button className="w-full" onClick={() => navigator.clipboard?.writeText(window.location.href)} variant="outline">
                  Share
                </Button>
                <Button className="w-full" onClick={() => setReportOpen(true)} variant="outline">
                  <Flag className="h-4 w-4" />
                  Report Business
                </Button>
              </aside>
            </div>
          </div>
        </section>
        {similar.length ? (
          <section>
            <h2 className="mb-4 text-xl font-bold text-szocial-ink">Similar nearby businesses</h2>
            <div className="grid gap-5 lg:grid-cols-2">
              {asArray(similar).map((item) => (
                <BusinessCard business={item} key={item.id} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
      <ReportModal
        itemId={business.id}
        itemLabel={business.name}
        itemType="Business"
        onClose={() => setReportOpen(false)}
        open={reportOpen}
        reasons={["Fake listing", "Wrong location", "Spam", "Unsafe", "Closed permanently", "Other"]}
      />
    </ResidentShell>
  );
}

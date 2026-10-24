"use client";

import { memo,useEffect,useRef,useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  CheckCircle2,
  Flag,
  HandHeart,
  MapPin,
  MessageCircle,
  PartyPopper,
  Send,
  Share2,
  ShieldCheck,
  UsersRound
} from "lucide-react";
import { Button } from "@/components/Button";
import { RelativeTime } from "@/components/RelativeTime";
import { ReportModal } from "@/components/ReportModal";
import { useFeedRuntime } from "@/components/AppStoreProvider";
import { useToast } from "@/components/ToastProvider";
import type { LocalPost } from "@/types";
import { formatUserLocation } from "@/lib/location";
import { getUserDisplayPhoto } from "@/lib/user-photo";
import { asArray, cn } from "@/lib/utils";

type PostCardProps = {
  post: LocalPost;
};

export const PostCard=memo(function PostCard({ post }: PostCardProps) {
  const router = useRouter();
  const {residents,actorId,location,run}=useFeedRuntime();
  const state={residents,location},currentUser={id:actorId};
  const addComment=(id:string,text:string)=>run('comment',{id,text});
  const startPostChat=async(postId:string)=>(await run('start_chat',{postId}))?.id??'';
  const { notify } = useToast();
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const author = post.author??
    asArray(state.residents).find((user) => user.id === post.authorId) ??
    {name:'Unavailable resident',verified:false};
  const postLocation = post.location ?? state.location;
  const isHelp = post.type === "help";
  const authoritative=asArray(post.interestedUserIds).includes(currentUser.id);
  const [interested,setInterested]=useState(authoritative),[pending,setPending]=useState(false);const lock=useRef(false);
  useEffect(()=>{if(!lock.current)setInterested(authoritative);},[authoritative]);
  const toggleInterest=async(id:string)=>{if(lock.current)return;lock.current=true;setPending(true);const old=interested;setInterested(!old);try{if(!await run('interest',{id}))setInterested(old);}finally{lock.current=false;setPending(false);}};
  const Icon = isHelp ? HandHeart : PartyPopper;

  const sharePost = async () => {
    const link = `${window.location.origin}/home?post=${post.id}`;
    await navigator.clipboard?.writeText(link);
    notify({ title: "Post link copied" });
  };

  return (
    <article className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-soft">
      <div className="p-5">
        {post.images?.length?<div className="flex gap-2 overflow-x-auto">{post.images.map(image=><img loading="lazy" decoding="async" key={image} alt={post.title} src={image} className="h-40 rounded-xl object-cover"/>)}</div>:null}
        <div className="flex items-start gap-3">
          <img loading="lazy" decoding="async"
            alt={author.name}
            className="h-12 w-12 rounded-2xl object-cover"
            src={getUserDisplayPhoto(author)}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-bold text-szocial-ink">{author.name}</h2>
              {author.verified ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-szocial-tealSoft px-2 py-1 text-xs font-semibold text-szocial-teal">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Verified Resident
                </span>
              ) : null}
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-szocial-muted">
              <MapPin className="h-3.5 w-3.5" />
              {formatUserLocation(postLocation, "Location not set")} -
              <RelativeTime timestamp={post.createdAt} />
            </p>
          </div>
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-xs font-bold",
              isHelp
                ? post.urgency === "Urgent"
                  ? "bg-red-50 text-red-600"
                  : "bg-szocial-tealSoft text-szocial-teal"
                : "bg-szocial-orangeSoft text-szocial-orange"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {isHelp ? post.urgency : post.category}
          </span>
        </div>

        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-szocial-orange">
            {isHelp ? post.category : `${post.category} Partner`}
          </p>
          <h3 className="mt-2 text-2xl font-bold tracking-normal text-szocial-ink">
            {post.title}
          </h3>
          <p className="mt-3 leading-7 text-szocial-muted">{post.description}</p>
        </div>

        <div className="mt-5 rounded-2xl border border-slate-100 bg-orange-50/40 p-4">
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <div className="flex items-center gap-3">
              <Icon className="h-5 w-5 text-szocial-orange" />
              <span className="text-szocial-muted">{isHelp ? "Category" : "Activity"}</span>
              <span className="ml-auto font-semibold text-szocial-ink">{post.category}</span>
            </div>
            <div className="flex items-center gap-3">
              <CalendarDays className="h-5 w-5 text-szocial-orange" />
              <span className="text-szocial-muted">{isHelp ? "Needed by" : "Time"}</span>
              <span className="ml-auto font-semibold text-szocial-ink">
                {post.time ?? post.date ?? "Flexible"}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <UsersRound className="h-5 w-5 text-szocial-orange" />
              <span className="text-szocial-muted">{isHelp ? "Contact" : "Looking for"}</span>
              <span className="ml-auto font-semibold text-szocial-ink">
                {isHelp ? post.contactPreference : `${post.neededPeople ?? 1} people`}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-szocial-teal" />
              <span className="text-szocial-muted">Status</span>
              <span className="ml-auto font-semibold text-szocial-ink">{post.status}</span>
            </div>
          </div>
          {isHelp && post.budget ? (
            <p className="mt-3 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-szocial-teal">
              Budget: {post.budget}
            </p>
          ) : null}
        </div>

        {!isHelp ? (
          <div className="mt-4 rounded-2xl bg-szocial-tealSoft px-4 py-3 text-sm leading-6 text-szocial-teal">
            For safety, meet in public places and inform someone you trust.
          </div>
        ) : null}

        <div className="mt-5 grid grid-cols-4 gap-2 text-xs text-szocial-muted">
          <button
            className="flex min-h-11 flex-col items-center justify-center rounded-xl transition hover:bg-szocial-mist"
            onClick={() => setCommentsOpen((value) => !value)}
            type="button"
          >
            <MessageCircle className="h-5 w-5" />
            Comment
          </button>
          <button
            className="flex min-h-11 flex-col items-center justify-center rounded-xl transition hover:bg-szocial-mist"
            onClick={async () => {
              const chatId = await startPostChat(post.id);
              if (chatId) router.push(`/chats?chatId=${chatId}`);
            }}
            type="button"
          >
            <Send className="h-5 w-5" />
            Chat
          </button>
          <button
            className="flex min-h-11 flex-col items-center justify-center rounded-xl transition hover:bg-szocial-mist"
            onClick={sharePost}
            type="button"
          >
            <Share2 className="h-5 w-5" />
            Share
          </button>
          <button
            className="flex min-h-11 flex-col items-center justify-center rounded-xl transition hover:bg-szocial-mist"
            onClick={() => setReportOpen(true)}
            type="button"
          >
            <Flag className="h-5 w-5" />
            Report
          </button>
        </div>

        <Button
          className="mt-4 w-full"
          disabled={pending}
          onClick={() => toggleInterest(post.id)}
          variant={interested ? "secondary" : "primary"}
        >
          <UsersRound className="h-4 w-4" />
          {interested ? "Interest Sent" : isHelp ? "I Can Help" : "I'm Available"}
        </Button>

        {commentsOpen ? (
          <div className="mt-5 rounded-2xl bg-szocial-mist p-4">
            <div className="space-y-3">
              {asArray(post.comments).map((item) => {
                const commenter =
                  asArray(post.people??state.residents).find((resident) => resident.id === item.userId) ??
                  {name:'Unavailable resident'};
                return (
                  <div className="flex gap-3 rounded-xl bg-white p-3" key={item.id}>
                    <img loading="lazy" decoding="async"
                      alt={commenter.name}
                      className="h-9 w-9 rounded-xl object-cover"
                      src={getUserDisplayPhoto(commenter)}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-szocial-ink">
                        {commenter.name}
                      </p>
                      <p className="mt-1 text-sm text-szocial-muted">{item.text}</p>
                      <RelativeTime
                        className="mt-1 block text-xs text-szocial-muted"
                        timestamp={item.createdAt}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex gap-2">
              <input
                className="min-w-0 flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-szocial-teal"
                onChange={(event) => setComment(event.target.value)}
                placeholder="Write a comment..."
                value={comment}
              />
              <Button
                onClick={async () => {
                  if(await addComment(post.id, comment)) setComment("");
                }}
              >
                Send
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <ReportModal
        itemId={post.id}
        itemLabel={post.title}
        itemType="Post"
        onClose={() => setReportOpen(false)}
        open={reportOpen}
      />
    </article>
  );
});

"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  BadgeCheck,
  BarChart3,
  Camera,
  CheckCircle2,
  CreditCard,
  ImagePlus,
  Megaphone,
  MessageCircle,
  PauseCircle,
  Rocket,
  Store,
  Upload,
  XCircle
} from "lucide-react";
import { BusinessCard } from "@/components/BusinessCard";
import { BusinessLayout } from "@/components/BusinessLayout";
import { Button } from "@/components/Button";
import { ChatList } from "@/components/ChatList";
import { ChatWindow } from "@/components/ChatWindow";
import { EmptyState } from "@/components/EmptyState";
import { Modal } from "@/components/Modal";
import { RelativeTime } from "@/components/RelativeTime";
import { StatCard } from "@/components/StatCard";
import { useAppStore } from "@/components/AppStoreProvider";
import { useToast } from "@/components/ToastProvider";
import type { BusinessCategory, PaymentPlan } from "@/types";
import { getOtherChatParticipant } from "@/lib/chat-participants";
import { timestampToMilliseconds } from "@/lib/date-time";
import { asArray } from "@/lib/utils";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

const categories: BusinessCategory[] = [
  "Cafe",
  "Restaurant",
  "Salon",
  "Medical",
  "Store",
  "Gym",
  "Classes",
  "Other"
];
const priceRanges = ["Budget", "Mid-range", "Premium"] as const;

function Field({
  label,
  value,
  onChange,
  required,
  placeholder,
  type = "text"
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-szocial-ink">
        {label}
        {required ? <span className="text-szocial-orange"> *</span> : null}
      </span>
      <input
        className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-szocial-teal"
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type={type}
        value={value}
      />
    </label>
  );
}

function loadRazorpayScript() {
  return new Promise<boolean>((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function BusinessPricingScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    state,
    currentBusinessOwner,
    completeBusinessPayment,
    failBusinessPayment
  } = useAppStore();
  const { notify } = useToast();
  const purchaseKeys = useRef(new Map<string,string>());
  const openingCheckout = useRef(false);
  const [busyPlan, setBusyPlan] = useState<string | null>(null);
  const message = searchParams.get("message");
  const plans = asArray(state.paymentPlans);

  const startPayment = async (plan: PaymentPlan) => {
    if (!currentBusinessOwner) {
      notify({ title: "Create or login to a business account first", variant: "warning" });
      router.push("/business/signup");
      return;
    }

    if(openingCheckout.current)return;
    openingCheckout.current=true;
    setBusyPlan(plan.id);
    try {
      const response = await fetch("/api/razorpay/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: plan.id,
          businessId: currentBusinessOwner.businessId,
          idempotencyKey: purchaseKeys.current.get(plan.id) ?? (()=>{const key=crypto.randomUUID();purchaseKeys.current.set(plan.id,key);return key;})()
        })
      });
      const order = await response.json();

      if(!response.ok)throw new Error(order.error??'Could not create payment order');
      const loaded = await loadRazorpayScript();
      if (!loaded || !window.Razorpay) throw new Error('Checkout could not load. Please try again.');

      const checkout = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: "Szocial",
        description: plan.name,
        order_id: order.orderId,
        handler: async (paymentResponse: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          const verify = await fetch("/api/razorpay/verify-payment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...paymentResponse,
              planId: plan.id,
              businessOwnerId: currentBusinessOwner.id
            })
          });
          const result = await verify.json();
          if (result.success) {
            await completeBusinessPayment(plan, paymentResponse.razorpay_payment_id, Boolean(result.mock));
            router.push("/business/setup");
          } else {
            failBusinessPayment(plan);
            router.push("/business/payment-failed");
          }
        },
        modal: {
          ondismiss: () => {
            failBusinessPayment(plan);
            router.push("/business/payment-failed");
          }
        },
        prefill: {
          name: currentBusinessOwner.ownerName,
          email: currentBusinessOwner.email
        },
        theme: {
          color: "#F97316"
        }
      });
      checkout.open();
    } catch(error) {
      notify({ title: "Payment unavailable", description: error instanceof Error?error.message:'Please try again.', variant: "warning" });
    } finally {
      openingCheckout.current=false;
      setBusyPlan(null);
    }
  };

  return (
    <BusinessLayout>
      <div className="space-y-6">
        <section className="rounded-3xl bg-white p-6 shadow-soft">
          <p className="text-sm font-semibold text-szocial-orange">Choose Listing Plan</p>
          <h1 className="mt-1 text-3xl font-bold tracking-normal text-szocial-ink">
            Paid local discovery for serious businesses.
          </h1>
          <p className="mt-2 max-w-2xl leading-7 text-szocial-muted">
            Pick a plan, complete secure Razorpay checkout, then setup
            your listing and appear in New in Location.
          </p>
          {message ? (
            <p className="mt-4 rounded-2xl bg-szocial-orangeSoft px-4 py-3 text-sm font-semibold text-szocial-orange">
              {message}
            </p>
          ) : null}
        </section>
        <div className="grid gap-5 lg:grid-cols-3">
          {plans.length ? plans.map((plan) => (
            <article
              className={`rounded-3xl border bg-white p-6 shadow-soft ${
                plan.highlight ? "border-szocial-orange" : "border-slate-100"
              }`}
              key={plan.id}
            >
              {plan.highlight ? (
                <span className="rounded-full bg-szocial-orange px-3 py-1 text-xs font-bold text-white">
                  Most popular
                </span>
              ) : null}
              <h2 className="mt-4 text-2xl font-bold text-szocial-ink">{plan.name}</h2>
              <p className="mt-2 text-szocial-muted">{plan.description}</p>
              <p className="mt-5 text-4xl font-bold text-szocial-ink">
                Rs. {plan.price}
                <span className="text-base font-semibold text-szocial-muted">/month</span>
              </p>
              <div className="mt-5 space-y-3">
                {asArray(plan.features).map((feature) => (
                  <p className="flex items-start gap-2 text-sm leading-6 text-szocial-muted" key={feature}>
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-szocial-teal" />
                    {feature}
                  </p>
                ))}
              </div>
              <Button className="mt-6 w-full" disabled={busyPlan === plan.id} onClick={() => startPayment(plan)}>
                <CreditCard className="h-4 w-4" />
                Pay Rs. {plan.price} and Continue
              </Button>
            </article>
          )) : (
            <div className="lg:col-span-3">
              <EmptyState
                description="No listing plans are available in mock data right now."
                icon={<CreditCard className="h-6 w-6" />}
                title="No pricing plans"
              />
            </div>
          )}
        </div>
      </div>

    </BusinessLayout>
  );
}

export function BusinessPaymentSuccessScreen() {
  const router = useRouter();
  const { currentBusiness } = useAppStore();
  const payment = currentBusiness?.payment;

  return (
    <BusinessLayout>
      <div className="mx-auto max-w-xl rounded-3xl border border-slate-100 bg-white p-8 text-center shadow-soft">
        <CheckCircle2 className="mx-auto h-14 w-14 text-szocial-teal" />
        <h1 className="mt-5 text-3xl font-bold tracking-normal text-szocial-ink">
          Payment successful
        </h1>
        <p className="mt-2 text-szocial-muted">
          You can now setup your business listing.
        </p>
        <div className="mt-6 rounded-2xl bg-szocial-mist p-4 text-left text-sm leading-6 text-szocial-muted">
          <p>Plan: {payment?.planName ?? "Selected plan"}</p>
          <p>Amount paid: Rs. {payment?.amountPaid ?? "Mock"}</p>
          <p>Payment ID: {payment?.paymentId ?? "mock"}</p>
        </div>
        <Button className="mt-6 w-full" onClick={() => router.push("/business/setup")}>
          Continue to Business Setup
        </Button>
      </div>
    </BusinessLayout>
  );
}

export function BusinessPaymentFailedScreen() {
  const router = useRouter();
  const [supportOpen, setSupportOpen] = useState(false);

  return (
    <BusinessLayout>
      <div className="mx-auto max-w-xl rounded-3xl border border-slate-100 bg-white p-8 text-center shadow-soft">
        <XCircle className="mx-auto h-14 w-14 text-red-500" />
        <h1 className="mt-5 text-3xl font-bold tracking-normal text-szocial-ink">
          Payment failed or was cancelled
        </h1>
        <p className="mt-2 text-szocial-muted">No listing payment was captured.</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Button onClick={() => router.push("/business/pricing")}>Try Again</Button>
          <Button onClick={() => setSupportOpen(true)} variant="outline">
            Contact Support
          </Button>
        </div>
      </div>
      <Modal onClose={() => setSupportOpen(false)} open={supportOpen} title="Mock support">
        <p className="text-sm leading-6 text-szocial-muted">
          Support placeholder opened. Real support can later connect to email, chat,
          or a ticketing system.
        </p>
        <Button className="mt-5 w-full" href="mailto:support@szocial.local">
          Email support
        </Button>
      </Modal>
    </BusinessLayout>
  );
}

function BusinessProfileForm({ mode }: { mode: "setup" | "profile" }) {
  const router = useRouter();
  const {
    currentBusiness,
    currentBusinessOwner,
    hydrated,
    updateBusinessProfile,
    publishBusiness,
    getBusinessNextRoute
  } = useAppStore();
  const { notify } = useToast();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [form, setForm] = useState({
    name: currentBusiness?.name ?? "",
    category: currentBusiness?.category ?? "Cafe",
    address: currentBusiness?.address ?? "",
    city: currentBusiness?.location.city ?? "",
    area: currentBusiness?.location.area ?? "",
    landmark: currentBusiness?.location.landmark ?? "",
    mapsLink: currentBusiness?.mapsLink ?? "",
    hours: currentBusiness?.hours ?? "",
    phone: currentBusiness?.phone ?? "",
    whatsapp: currentBusiness?.whatsapp ?? "",
    about: currentBusiness?.about ?? "",
    services: asArray(currentBusiness?.services).join(", "),
    offers: asArray(currentBusiness?.offers).join(", "),
    priceRange: currentBusiness?.priceRange ?? "Mid-range",
    tags: asArray(currentBusiness?.tags).join(", "),
    logoName: "No file selected",
    coverName: "No file selected",
    photosName: "No file selected"
  });

  useEffect(() => {
    if (mode !== "setup") return;
    if (!hydrated) return;
    if (!currentBusinessOwner) {
      notify({
        title: "Please choose a listing plan to continue.",
        variant: "warning"
      });
      router.replace("/business/pricing?message=Please choose a listing plan to continue.");
      return;
    }
    if (currentBusinessOwner.paymentStatus !== "paid") {
      notify({
        title: "Please choose a listing plan to continue.",
        variant: "warning"
      });
      router.replace("/business/pricing?message=Please choose a listing plan to continue.");
    }
  }, [currentBusinessOwner, hydrated, mode, notify, router]);

  const save = async () => {
    if (!form.name || !form.category || !form.address || !form.phone || !form.about) {
      notify({ title: "Fill all required listing details", variant: "warning" });
      return false;
    }
    return await updateBusinessProfile({
      name: form.name,
      category: form.category as BusinessCategory,
      address: form.address,
      location: {
        city: form.city,
        area: form.area,
        landmark: form.landmark
      },
      phone: form.phone,
      whatsapp: form.whatsapp,
      mapsLink: form.mapsLink,
      hours: form.hours,
      about: form.about,
      services: form.services.split(",").map((item) => item.trim()).filter(Boolean),
      offers: form.offers.split(",").map((item) => item.trim()).filter(Boolean),
      tags: form.tags.split(",").map((item) => item.trim()).filter(Boolean),
      priceRange: form.priceRange as "Budget" | "Mid-range" | "Premium"
    });
  };

  return (
    <>
      <section className="rounded-3xl bg-white p-6 shadow-soft">
        <h1 className="text-3xl font-bold tracking-normal text-szocial-ink">
          {mode === "setup" ? "Setup business profile" : "Business profile"}
        </h1>
        <p className="mt-2 text-szocial-muted">
          Add public listing details, images, services, offers, and contact info.
        </p>
      </section>
      <section className="mt-5 rounded-3xl border border-slate-100 bg-white p-5 shadow-soft">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Shop/business name" onChange={(value) => setForm({ ...form, name: value })} required value={form.name} />
          <label className="block">
            <span className="text-sm font-semibold text-szocial-ink">Business category *</span>
            <select className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-szocial-teal" onChange={(event) => setForm({ ...form, category: event.target.value as BusinessCategory })} value={form.category}>
              {categories.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <Field label="Address" onChange={(value) => setForm({ ...form, address: value })} required value={form.address} />
          <Field label="City" onChange={(value) => setForm({ ...form, city: value })} required value={form.city} />
          <Field label="Area" onChange={(value) => setForm({ ...form, area: value })} required value={form.area} />
          <Field label="Landmark" onChange={(value) => setForm({ ...form, landmark: value })} value={form.landmark} />
          <Field label="Google Maps link" onChange={(value) => setForm({ ...form, mapsLink: value })} value={form.mapsLink} />
          <Field label="Opening hours" onChange={(value) => setForm({ ...form, hours: value })} required value={form.hours} />
          <Field label="Phone number" onChange={(value) => setForm({ ...form, phone: value })} required value={form.phone} />
          <Field label="WhatsApp number" onChange={(value) => setForm({ ...form, whatsapp: value })} value={form.whatsapp} />
          <label className="block md:col-span-2">
            <span className="text-sm font-semibold text-szocial-ink">About us *</span>
            <textarea className="mt-2 min-h-28 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-szocial-teal" onChange={(event) => setForm({ ...form, about: event.target.value })} value={form.about} />
          </label>
          <Field label="Products/services" onChange={(value) => setForm({ ...form, services: value })} placeholder="Coffee, snacks, delivery" value={form.services} />
          <Field label="Offers/discounts" onChange={(value) => setForm({ ...form, offers: value })} placeholder="10% off first visit" value={form.offers} />
          <label className="block">
            <span className="text-sm font-semibold text-szocial-ink">Price range</span>
            <select className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-szocial-teal" onChange={(event) => setForm({ ...form, priceRange: event.target.value as (typeof priceRanges)[number] })} value={form.priceRange}>
              {priceRanges.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <Field label="Business tags" onChange={(value) => setForm({ ...form, tags: value })} placeholder="Coffee, New nearby" value={form.tags} />
          {[
            ["Logo upload placeholder", "logoName"],
            ["Cover image upload placeholder", "coverName"],
            ["Multiple shop images placeholder", "photosName"]
          ].map(([label, key]) => (
            <label className="rounded-2xl border border-dashed border-slate-200 p-4" key={key}>
              <span className="flex items-center gap-2 text-sm font-semibold text-szocial-ink">
                <Upload className="h-4 w-4" />
                {label}
              </span>
              <input
                className="mt-2 block w-full text-sm text-szocial-muted"
                multiple={key === "photosName"}
                onChange={(event) =>
                  setForm({
                    ...form,
                    [key]: event.target.files?.[0]?.name ?? "No file selected"
                  })
                }
                type="file"
              />
              <span className="mt-2 block text-xs text-szocial-muted">
                {form[key as "logoName" | "coverName" | "photosName"]}
              </span>
            </label>
          ))}
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Button
            onClick={async () => {
              if (await save()) setPreviewOpen(true);
            }}
            variant="outline"
          >
            Preview Listing
          </Button>
          <Button
            onClick={async () => {
              if (!await save()) return;
              if (await publishBusiness()) router.push("/business/dashboard");
              else router.push("/business/pricing?message=Complete payment to make your listing live.");
            }}
          >
            Make Live
          </Button>
          <Button
            onClick={async () => {
              if(await save()) notify({ title: "Business draft saved" });
            }}
            variant="outline"
          >
            Save Draft
          </Button>
        </div>
      </section>
      <Modal onClose={() => setPreviewOpen(false)} open={previewOpen} title="Listing preview">
        {currentBusiness ? <BusinessCard business={{ ...currentBusiness, status: "Live" }} /> : null}
        <Button className="mt-5 w-full" onClick={() => router.push(getBusinessNextRoute())}>
          Continue
        </Button>
      </Modal>
    </>
  );
}

export function BusinessSetupScreen() {
  return (
    <BusinessLayout>
      <BusinessProfileForm mode="setup" />
    </BusinessLayout>
  );
}

export function BusinessProfileScreen() {
  return (
    <BusinessLayout>
      <BusinessProfileForm mode="profile" />
    </BusinessLayout>
  );
}

export function BusinessDashboardScreen() {
  const router = useRouter();
  const {
    businessNotifications,
    businessUnreadCount,
    currentBusiness,
    markBusinessNotificationsRead,
    setCurrentBusinessStatus,
    cancelBusinessPlan,
    state
  } = useAppStore();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  if (!currentBusiness) {
    return (
      <BusinessLayout>
        <div className="rounded-3xl bg-white p-6 shadow-soft">
          <h1 className="text-2xl font-bold text-szocial-ink">No business selected</h1>
          <Button className="mt-4" href="/business/login">Login</Button>
        </div>
      </BusinessLayout>
    );
  }

  const payment = currentBusiness.payment;
  const rows = asArray(state.paymentHistory).filter((row) => row.businessId === currentBusiness.id);
  const businessChats = asArray(state.chats)
    .filter((chat) => chat.businessId === currentBusiness.id)
    .sort(
      (left, right) =>
        timestampToMilliseconds(right.lastMessageAt) -
        timestampToMilliseconds(left.lastMessageAt)
    );

  return (
    <BusinessLayout>
      <div className="space-y-5">
        <section className="rounded-3xl bg-white p-6 shadow-soft">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-szocial-orange">Profile status: {currentBusiness.status}</p>
              <h1 className="mt-1 text-3xl font-bold tracking-normal text-szocial-ink">
                {currentBusiness.name} dashboard
              </h1>
              <p className="mt-2 text-szocial-muted">Manage listing, chats, offers, analytics, and subscription.</p>
              <p className="mt-1 text-xs text-szocial-muted">
                Listed <RelativeTime timestamp={currentBusiness.createdAt} />
              </p>
            </div>
            <Button href={`/businesses/${currentBusiness.id}`} variant="outline">
              Preview listing
            </Button>
          </div>
        </section>
        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
          <StatCard icon={<BarChart3 className="h-5 w-5" />} label="Total views" value={String(currentBusiness.views)} />
          <StatCard icon={<Store className="h-5 w-5" />} label="Total saves" value={String(currentBusiness.saves)} />
          <StatCard icon={<MessageCircle className="h-5 w-5" />} label="Messages" value={String(currentBusiness.messages)} />
          <StatCard icon={<BadgeCheck className="h-5 w-5" />} label="Reviews" value={String(currentBusiness.reviews)} />
          <StatCard icon={<Megaphone className="h-5 w-5" />} label="Active offers" value={String(asArray(currentBusiness.offers).length)} />
        </div>
        <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-soft">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-szocial-ink">Recent activity</h2>
              <p className="mt-1 text-sm text-szocial-muted">
                Messages and requests sent to this business account.
              </p>
            </div>
            {businessUnreadCount ? (
              <Button onClick={markBusinessNotificationsRead} size="sm" variant="outline">
                Mark all read ({businessUnreadCount})
              </Button>
            ) : null}
          </div>
          <div className="mt-4 space-y-3">
            {businessNotifications.slice(0, 5).map((item) => (
              <article className="rounded-2xl bg-szocial-mist p-4" key={item.id}>
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-szocial-ink">{item.title}</p>
                  {!item.isRead ? (
                    <span className="h-2.5 w-2.5 rounded-full bg-szocial-orange" />
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-szocial-muted">{item.message}</p>
                <RelativeTime
                  className="mt-1 block text-xs text-szocial-muted"
                  timestamp={item.createdAt}
                />
              </article>
            ))}
            {!businessNotifications.length ? (
              <p className="rounded-2xl bg-szocial-mist p-4 text-sm text-szocial-muted">
                No activity for this business account yet.
              </p>
            ) : null}
          </div>
        </section>
        <section className="grid gap-5 lg:grid-cols-[1fr_360px]">
          <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-soft">
            <h2 className="text-xl font-bold text-szocial-ink">Recent messages</h2>
            <div className="mt-4 space-y-3">
              {businessChats.map((chat) => {
                const participant = getOtherChatParticipant(
                  chat,
                  currentBusiness.ownerId,
                  {
                    residents: state.residents,
                    businesses: state.businesses,
                    businessOwners: state.businessOwners,
                    posts: state.posts
                  }
                );
                return (
                  <div className="rounded-2xl bg-szocial-mist p-4" key={chat.id}>
                    <p className="font-semibold text-szocial-ink">{participant.name}</p>
                    <p className="mt-1 text-sm text-szocial-muted">{asArray(chat.messages).at(-1)?.text}</p>
                    <RelativeTime
                      className="mt-1 block text-xs text-szocial-muted"
                      timestamp={
                        chat.lastMessageAt ??
                        asArray(chat.messages).at(-1)?.createdAt
                      }
                    />
                  </div>
                );
              })}
              {!businessChats.length ? (
                <p className="rounded-2xl bg-szocial-mist p-4 text-sm text-szocial-muted">
                  No business messages yet.
                </p>
              ) : null}
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <Button onClick={() => router.push("/business/profile")} variant="outline">Edit Business Info</Button>
              <Button onClick={() => router.push("/business/offers")} variant="outline">Add Offer</Button>
              <Button onClick={() => router.push("/business/messages")} variant="outline">Reply to Chats</Button>
              <Button onClick={() => setCurrentBusinessStatus("Paused")} variant="outline">
                <PauseCircle className="h-4 w-4" />
                Pause Listing
              </Button>
              <Button onClick={() => setPromoteOpen(true)} variant="outline">
                <Rocket className="h-4 w-4" />
                Promote Locally
              </Button>
              <Button onClick={() => router.push("/business/profile")} variant="outline">
                <ImagePlus className="h-4 w-4" />
                Upload Photos
              </Button>
            </div>
          </div>
          <aside className="rounded-3xl border border-slate-100 bg-white p-5 shadow-soft">
            <CreditCard className="h-7 w-7 text-szocial-teal" />
            <h2 className="mt-3 text-xl font-bold text-szocial-ink">Subscription</h2>
            <div className="mt-4 space-y-3 text-sm text-szocial-muted">
              <p>Current plan: <strong>{payment?.planName ?? "No plan"}</strong></p>
              <p>Payment status: <strong>{payment?.status ?? "unpaid"}</strong></p>
              <p>Renewal date: <strong>{payment?.renewalDate ?? "Not set"}</strong></p>
              <p>Listing status: <strong>{currentBusiness.status}</strong></p>
            </div>
            <div className="mt-5 space-y-2">
              <Button className="w-full" onClick={() => router.push("/business/pricing")}>Upgrade Plan</Button>
              <Button className="w-full" onClick={() => setHistoryOpen(true)} variant="outline">View Payment History</Button>
              <Button className="w-full" onClick={() => setCancelOpen(true)} variant="outline">Cancel Plan</Button>
            </div>
          </aside>
        </section>
      </div>
      <Modal onClose={() => setHistoryOpen(false)} open={historyOpen} title="Payment history">
        <div className="space-y-3">
          {asArray(rows).map((row) => (
            <div className="grid gap-2 rounded-2xl bg-szocial-mist p-4 text-sm sm:grid-cols-4" key={row.id}>
              <span>{row.date}</span>
              <span>{row.planName}</span>
              <span>Rs. {row.amount}</span>
              <span>{row.status} - {row.paymentId}</span>
            </div>
          ))}
          {!rows.length ? (
            <p className="rounded-2xl bg-szocial-mist p-4 text-sm text-szocial-muted">
              No payment history yet.
            </p>
          ) : null}
        </div>
      </Modal>
      <Modal onClose={() => setPromoteOpen(false)} open={promoteOpen} title="Promote locally">
        <div className="grid gap-3">
          {["Basic local boost", "Featured in New in Location", "Top category placement"].map((plan) => (
            <button className="rounded-2xl border border-slate-100 p-4 text-left font-semibold text-szocial-ink transition hover:border-szocial-orange" key={plan} onClick={() => setPromoteOpen(false)} type="button">
              {plan}
              <span className="mt-1 block text-sm font-normal text-szocial-muted">Mock promotion selected. No payment captured.</span>
            </button>
          ))}
        </div>
      </Modal>
      <Modal onClose={() => setCancelOpen(false)} open={cancelOpen} title="Cancel subscription">
        <p className="text-sm leading-6 text-szocial-muted">This mock action pauses your listing and marks the plan cancelled.</p>
        <Button className="mt-5 w-full" onClick={() => { cancelBusinessPlan(); setCancelOpen(false); }} variant="secondary">
          Confirm cancel
        </Button>
      </Modal>
    </BusinessLayout>
  );
}

export function BusinessMessagesScreen() {
  const { state, currentBusiness } = useAppStore();
  const chats = asArray(state.chats)
    .filter((chat) => chat.businessId === currentBusiness?.id)
    .sort(
      (left, right) =>
        timestampToMilliseconds(right.lastMessageAt) -
        timestampToMilliseconds(left.lastMessageAt)
    );
  const [activeChatId, setActiveChatId] = useState(chats[0]?.id ?? null);
  const activeChat = chats.find((chat) => chat.id === activeChatId) ?? null;

  return (
    <BusinessLayout>
      <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
        <section className="rounded-3xl border border-slate-100 bg-white p-3 shadow-soft">
          <ChatList activeChatId={activeChatId} chats={chats} onSelect={setActiveChatId} />
        </section>
        <ChatWindow chat={activeChat} />
      </div>
    </BusinessLayout>
  );
}

export function BusinessOffersScreen() {
  const { currentBusiness, addBusinessOffer } = useAppStore();
  const [offer, setOffer] = useState("");

  return (
    <BusinessLayout>
      <section className="rounded-3xl bg-white p-6 shadow-soft">
        <h1 className="text-3xl font-bold tracking-normal text-szocial-ink">Offers</h1>
        <p className="mt-2 text-szocial-muted">Add discounts that appear on your listing.</p>
        <div className="mt-5 flex gap-2">
          <input className="min-w-0 flex-1 rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-szocial-teal" onChange={(event) => setOffer(event.target.value)} placeholder="10% off on first visit" value={offer} />
          <Button onClick={() => { addBusinessOffer(offer); setOffer(""); }}>Add Offer</Button>
        </div>
        <div className="mt-5 space-y-3">
          {asArray(currentBusiness?.offers).map((item) => (
            <div className="rounded-2xl bg-szocial-mist p-4" key={item}>
              <p className="font-semibold text-szocial-ink">{item}</p>
              <RelativeTime
                className="mt-1 block text-xs text-szocial-muted"
                timestamp={currentBusiness?.offerCreatedAt?.[item]}
              />
            </div>
          ))}
          {!asArray(currentBusiness?.offers).length ? (
            <p className="rounded-2xl bg-szocial-mist p-4 text-sm text-szocial-muted">
              No offers added yet.
            </p>
          ) : null}
        </div>
      </section>
    </BusinessLayout>
  );
}

export function BusinessAnalyticsScreen() {
  const { currentBusiness } = useAppStore();

  return (
    <BusinessLayout>
      <div className="space-y-5">
        <section className="rounded-3xl bg-white p-6 shadow-soft">
          <h1 className="text-3xl font-bold tracking-normal text-szocial-ink">Analytics</h1>
          <p className="mt-2 text-szocial-muted">Mock performance overview for your local listing.</p>
        </section>
        <div className="grid gap-4 md:grid-cols-4">
          <StatCard icon={<BarChart3 className="h-5 w-5" />} label="Views this month" value={String(currentBusiness?.views ?? 0)} />
          <StatCard icon={<Store className="h-5 w-5" />} label="Saves" value={String(currentBusiness?.saves ?? 0)} />
          <StatCard icon={<MessageCircle className="h-5 w-5" />} label="Messages" value={String(currentBusiness?.messages ?? 0)} />
          <StatCard icon={<Camera className="h-5 w-5" />} label="Photo taps" value="146" />
        </div>
        <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-soft">
          <h2 className="text-xl font-bold text-szocial-ink">Local category placement</h2>
          <div className="mt-4 h-48 rounded-3xl bg-[linear-gradient(135deg,#E6FFFA,#FFF1E7)] p-5">
            <p className="text-sm font-semibold text-szocial-muted">Mock chart</p>
            <p className="mt-14 text-center text-3xl font-bold text-szocial-ink">
              Top 12% in local discovery
            </p>
          </div>
        </section>
      </div>
    </BusinessLayout>
  );
}

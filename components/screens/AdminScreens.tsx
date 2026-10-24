"use client";

import type { ReactNode } from "react";
import { PaymentLedger } from "@/components/PaymentLedger";
import { useMemo, useState } from "react";
import {
  BadgeCheck,
  Ban,
  Building2,
  CheckCircle2,
  CreditCard,
  Eye,
  FileText,
  Flag,
  MapPin,
  ShieldCheck,
  Star,
  Store,
  UsersRound,
  XCircle
} from "lucide-react";
import { Button } from "@/components/Button";
import { RelativeTime } from "@/components/RelativeTime";
import { Modal } from "@/components/Modal";
import { useAppStore } from "@/components/AppStoreProvider";
import type { Business, LocalPost, Report, ResidentUser } from "@/types";
import { asArray } from "@/lib/utils";

function locationLabel(location: { area?: string; city?: string }) {
  return [location.area, location.city].filter(Boolean).join(", ") || "Location unavailable";
}

function confirmAction(message: string, action: () => void) {
  if (window.confirm(message)) action();
}

function PageHeader({
  eyebrow,
  title,
  description
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
      <p className="text-sm font-semibold text-szocial-orange">{eyebrow}</p>
      <h1 className="mt-1 text-3xl font-bold text-white">{title}</h1>
      <p className="mt-2 max-w-3xl text-slate-400">{description}</p>
    </section>
  );
}

function MetricCard({
  icon,
  label,
  value
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <article className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 text-szocial-orange">
        {icon}
      </span>
      <p className="mt-4 text-sm text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-white">{value}</p>
    </article>
  );
}

function AdminPanel({
  title,
  children
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
      <h2 className="mb-4 text-xl font-bold text-white">{title}</h2>
      {children}
    </section>
  );
}

function EmptyAdminState({ message }: { message: string }) {
  return (
    <p className="rounded-2xl border border-dashed border-slate-700 p-4 text-sm text-slate-400">
      {message}
    </p>
  );
}

function StatusPill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex rounded-full bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-200">
      {children}
    </span>
  );
}

export function AdminDashboardScreen() {
  const { state } = useAppStore();
  const residents = asArray(state.residents);
  const businesses = asArray(state.businesses);
  const posts = asArray(state.posts);
  const reports = asArray(state.reports);
  const openReports = reports.filter((report) => report.status === "Open");
  const pendingBusinesses = businesses.filter((business) =>
    ["Draft", "Pending Approval"].includes(business.status)
  );
  const revenue = asArray(state.paymentHistory)
    .filter((row) => row.status === "paid")
    .reduce((total, row) => total + row.amount, 0);

  const locationActivity = useMemo(() => {
    const counts = new Map<string, number>();
    posts.forEach((post) => {
      const label = locationLabel(post.location);
      counts.set(label, (counts.get(label) ?? 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [posts]);

  return (
    <div className="space-y-6">
      <PageHeader
        description="Review platform activity, moderation queues, approvals, and subscription health."
        eyebrow="Platform operations"
        title="Admin dashboard"
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={<UsersRound className="h-5 w-5" />} label="Total residents" value={String(residents.length)} />
        <MetricCard icon={<Building2 className="h-5 w-5" />} label="Total businesses" value={String(businesses.length)} />
        <MetricCard icon={<FileText className="h-5 w-5" />} label="Total posts" value={String(posts.length)} />
        <MetricCard icon={<Flag className="h-5 w-5" />} label="Active reports" value={String(openReports.length)} />
        <MetricCard icon={<Flag className="h-5 w-5" />} label="Reported posts" value={String(posts.filter((post) => post.reports > 0).length)} />
        <MetricCard icon={<Ban className="h-5 w-5" />} label="Reported users" value={String(residents.filter((user) => user.reports > 0).length)} />
        <MetricCard icon={<Store className="h-5 w-5" />} label="Pending approvals" value={String(pendingBusinesses.length)} />
        <MetricCard icon={<CreditCard className="h-5 w-5" />} label="Mock revenue" value={`Rs. ${revenue}`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <AdminPanel title="Recent reports">
          <div className="space-y-3">
            {openReports.slice(0, 5).map((report) => (
              <article className="rounded-2xl bg-slate-800 p-4" key={report.id}>
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-white">{report.itemLabel}</p>
                  <StatusPill>{report.itemType}</StatusPill>
                </div>
                <p className="mt-1 text-sm text-slate-400">{report.reason}</p>
                <RelativeTime
                  className="mt-1 block text-xs text-slate-500"
                  timestamp={report.createdAt}
                />
              </article>
            ))}
            {!openReports.length ? <EmptyAdminState message="No open reports." /> : null}
          </div>
        </AdminPanel>

        <AdminPanel title="Pending business approvals">
          <div className="space-y-3">
            {pendingBusinesses.slice(0, 5).map((business) => (
              <article className="rounded-2xl bg-slate-800 p-4" key={business.id}>
                <p className="font-semibold text-white">{business.name}</p>
                <p className="mt-1 text-sm text-slate-400">
                  {business.category} | {locationLabel(business.location)} | {business.status}
                </p>
              </article>
            ))}
            {!pendingBusinesses.length ? <EmptyAdminState message="No pending businesses." /> : null}
          </div>
        </AdminPanel>

        <AdminPanel title="Recent users">
          <div className="space-y-3">
            {residents.slice(0, 5).map((user) => (
              <article className="flex items-center justify-between gap-3 rounded-2xl bg-slate-800 p-4" key={user.id}>
                <div>
                  <p className="font-semibold text-white">{user.name}</p>
                  <p className="mt-1 text-sm text-slate-400">
                    {locationLabel(user.location)} | Joined {user.joinedDate}
                  </p>
                </div>
                <StatusPill>{user.status}</StatusPill>
              </article>
            ))}
            {!residents.length ? <EmptyAdminState message="No resident accounts." /> : null}
          </div>
        </AdminPanel>

        <AdminPanel title="Location-wise activity">
          <div className="space-y-3">
            {locationActivity.map(([location, count]) => (
              <div className="flex items-center justify-between rounded-2xl bg-slate-800 p-4" key={location}>
                <span className="flex items-center gap-2 text-slate-200">
                  <MapPin className="h-4 w-4 text-szocial-orange" />
                  {location}
                </span>
                <strong className="text-white">{count} posts</strong>
              </div>
            ))}
            {!locationActivity.length ? <EmptyAdminState message="No location activity." /> : null}
          </div>
        </AdminPanel>
      </div>

      <AdminPanel title="Platform activity overview">
        <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <p className="rounded-2xl bg-slate-800 p-4 text-slate-300">
            Active residents: <strong className="text-white">{residents.filter((user) => user.status === "Active").length}</strong>
          </p>
          <p className="rounded-2xl bg-slate-800 p-4 text-slate-300">
            Live businesses: <strong className="text-white">{businesses.filter((business) => business.status === "Live").length}</strong>
          </p>
          <p className="rounded-2xl bg-slate-800 p-4 text-slate-300">
            Active posts: <strong className="text-white">{posts.filter((post) => post.status === "Active").length}</strong>
          </p>
          <p className="rounded-2xl bg-slate-800 p-4 text-slate-300">
            Paid listings: <strong className="text-white">{businesses.filter((business) => business.payment?.status === "paid").length}</strong>
          </p>
        </div>
      </AdminPanel>
    </div>
  );
}

export function AdminUsersScreen() {
  const { state, setUserStatus, verifyUser } = useAppStore();
  const [selectedUser, setSelectedUser] = useState<ResidentUser | null>(null);
  const residents = asArray(state.residents);

  return (
    <div className="space-y-6">
      <PageHeader
        description="Review resident identity, verification, reports, and account status without entering resident sessions."
        eyebrow="Moderation"
        title="Users"
      />
      <AdminPanel title="Resident accounts">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="text-slate-400">
              <tr>
                {["Name", "Email/mobile", "Location", "Verified", "Status", "Reports", "Joined", "Actions"].map((label) => (
                  <th className="p-3" key={label}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {residents.map((user) => (
                <tr className="border-t border-slate-800" key={user.id}>
                  <td className="p-3 font-semibold text-white">{user.name}</td>
                  <td className="p-3 text-slate-300">{user.email}{user.mobile ? ` / ${user.mobile}` : ""}</td>
                  <td className="p-3 text-slate-300">{locationLabel(user.location)}</td>
                  <td className="p-3"><StatusPill>{user.verified ? "Verified" : "Pending"}</StatusPill></td>
                  <td className="p-3"><StatusPill>{user.status}</StatusPill></td>
                  <td className="p-3 text-slate-300">{user.reports}</td>
                  <td className="p-3 text-slate-300">{user.joinedDate}</td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={() => setSelectedUser(user)} size="sm" variant="light">
                        <Eye className="h-4 w-4" /> View
                      </Button>
                      {!user.verified ? (
                        <Button onClick={() => verifyUser(user.id)} size="sm" variant="outline">
                          <ShieldCheck className="h-4 w-4" /> Verify
                        </Button>
                      ) : null}
                      <Button
                        onClick={() =>
                          confirmAction(
                            `${user.status === "Banned" ? "Unban" : "Ban"} ${user.name}?`,
                            () => setUserStatus(user.id, user.status === "Banned" ? "Active" : "Banned")
                          )
                        }
                        size="sm"
                        variant="outline"
                      >
                        <Ban className="h-4 w-4" />
                        {user.status === "Banned" ? "Unban" : "Ban"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!residents.length ? <EmptyAdminState message="No resident accounts." /> : null}
        </div>
      </AdminPanel>
      <Modal onClose={() => setSelectedUser(null)} open={Boolean(selectedUser)} title="Resident details">
        {selectedUser ? (
          <div className="space-y-3 rounded-2xl bg-szocial-mist p-4 text-sm text-szocial-muted">
            <p><strong className="text-szocial-ink">Name:</strong> {selectedUser.name}</p>
            <p><strong className="text-szocial-ink">Email:</strong> {selectedUser.email}</p>
            <p><strong className="text-szocial-ink">Mobile:</strong> {selectedUser.mobile ?? "Not provided"}</p>
            <p><strong className="text-szocial-ink">Location:</strong> {locationLabel(selectedUser.location)}</p>
            <p><strong className="text-szocial-ink">Bio:</strong> {selectedUser.bio}</p>
            <p><strong className="text-szocial-ink">Status:</strong> {selectedUser.status}</p>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

export function AdminBusinessesScreen() {
  const {
    state,
    featureBusiness,
    setBusinessAdminStatus,
    verifyBusiness
  } = useAppStore();
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const businesses = asArray(state.businesses);

  return (
    <div className="space-y-6">
      <PageHeader
        description="Approve, verify, feature, pause, or remove listings without entering owner sessions."
        eyebrow="Moderation"
        title="Businesses"
      />
      <AdminPanel title="Business listings">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px] text-left text-sm">
            <thead className="text-slate-400">
              <tr>
                {["Business", "Owner", "Category", "Location", "Status", "Verified", "Payment", "Plan", "Views", "Actions"].map((label) => (
                  <th className="p-3" key={label}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {businesses.map((business) => {
                const owner = asArray(state.businessOwners).find((item) => item.id === business.ownerId);
                return (
                  <tr className="border-t border-slate-800" key={business.id}>
                    <td className="p-3 font-semibold text-white">{business.name}</td>
                    <td className="p-3 text-slate-300">{owner?.ownerName ?? "Unknown"}</td>
                    <td className="p-3 text-slate-300">{business.category}</td>
                    <td className="p-3 text-slate-300">{locationLabel(business.location)}</td>
                    <td className="p-3"><StatusPill>{business.status}</StatusPill></td>
                    <td className="p-3">{business.verified ? "Yes" : "No"}</td>
                    <td className="p-3">{business.payment?.status ?? owner?.paymentStatus ?? "unpaid"}</td>
                    <td className="p-3">{business.payment?.planName ?? "No plan"}</td>
                    <td className="p-3">{business.views}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-2">
                        <Button onClick={() => setSelectedBusiness(business)} size="sm" variant="light">
                          <CreditCard className="h-4 w-4" /> Details
                        </Button>
                        <Button onClick={() => setBusinessAdminStatus(business.id, "Live")} size="sm" variant="outline">
                          <CheckCircle2 className="h-4 w-4" /> Approve
                        </Button>
                        {!business.verified ? (
                          <Button onClick={() => verifyBusiness(business.id)} size="sm" variant="outline">
                            <BadgeCheck className="h-4 w-4" /> Verify
                          </Button>
                        ) : null}
                        <Button onClick={() => featureBusiness(business.id)} size="sm" variant="outline">
                          <Star className="h-4 w-4" /> {business.featured ? "Unfeature" : "Feature"}
                        </Button>
                        <Button
                          onClick={() => confirmAction(`Pause ${business.name}?`, () => setBusinessAdminStatus(business.id, "Paused"))}
                          size="sm"
                          variant="outline"
                        >
                          Pause
                        </Button>
                        <Button
                          onClick={() => confirmAction(`Remove ${business.name}?`, () => setBusinessAdminStatus(business.id, "Removed"))}
                          size="sm"
                          variant="outline"
                        >
                          <XCircle className="h-4 w-4" /> Remove
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!businesses.length ? <EmptyAdminState message="No business listings." /> : null}
        </div>
      </AdminPanel>
      <PaymentLedger />
      <Modal onClose={() => setSelectedBusiness(null)} open={Boolean(selectedBusiness)} title="Business details">
        {selectedBusiness ? (
          <div className="space-y-3 rounded-2xl bg-szocial-mist p-4 text-sm text-szocial-muted">
            <p><strong className="text-szocial-ink">Business:</strong> {selectedBusiness.name}</p>
            <p><strong className="text-szocial-ink">Address:</strong> {selectedBusiness.address}</p>
            <p><strong className="text-szocial-ink">Status:</strong> {selectedBusiness.status}</p>
            <p><strong className="text-szocial-ink">Plan:</strong> {selectedBusiness.payment?.planName ?? "No plan"}</p>
            <p><strong className="text-szocial-ink">Payment:</strong> {selectedBusiness.payment?.status ?? "unpaid"}</p>
            <p><strong className="text-szocial-ink">Payment ID:</strong> {selectedBusiness.payment?.paymentId ?? "-"}</p>
            <p><strong className="text-szocial-ink">Amount:</strong> Rs. {selectedBusiness.payment?.amountPaid ?? 0}</p>
            <p><strong className="text-szocial-ink">Renewal:</strong> {selectedBusiness.payment?.renewalDate ?? "-"}</p>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

export function AdminPostsScreen() {
  const { state, removePostAdmin, updatePost } = useAppStore();
  const [selectedPost, setSelectedPost] = useState<LocalPost | null>(null);
  const posts = asArray(state.posts);

  return (
    <div className="space-y-6">
      <PageHeader
        description="Moderate Fun and Help content without exposing resident interaction controls."
        eyebrow="Content moderation"
        title="Posts"
      />
      <AdminPanel title="Platform posts">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="text-slate-400">
              <tr>
                {["Title", "Type", "Created by", "Location", "Status", "Reports", "Created", "Actions"].map((label) => (
                  <th className="p-3" key={label}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => {
                const author = asArray(state.residents).find((user) => user.id === post.authorId);
                return (
                  <tr className="border-t border-slate-800" key={post.id}>
                    <td className="p-3 font-semibold text-white">{post.title}</td>
                    <td className="p-3 capitalize text-slate-300">{post.type}</td>
                    <td className="p-3 text-slate-300">{author?.name ?? "Unknown"}</td>
                    <td className="p-3 text-slate-300">{locationLabel(post.location)}</td>
                    <td className="p-3"><StatusPill>{post.status}</StatusPill></td>
                    <td className="p-3">{post.reports}</td>
                    <td className="p-3 text-slate-300">
                      <RelativeTime timestamp={post.createdAt} />
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-2">
                        <Button onClick={() => setSelectedPost(post)} size="sm" variant="light">
                          <Eye className="h-4 w-4" /> View
                        </Button>
                        <Button onClick={() => updatePost(post.id, { status: "Completed" })} size="sm" variant="outline">
                          <CheckCircle2 className="h-4 w-4" /> Close
                        </Button>
                        {post.status === "Removed" ? (
                          <Button onClick={() => updatePost(post.id, { status: "Active" })} size="sm" variant="outline">
                            Restore
                          </Button>
                        ) : (
                          <Button
                            onClick={() => confirmAction(`Remove "${post.title}"?`, () => removePostAdmin(post.id))}
                            size="sm"
                            variant="outline"
                          >
                            <XCircle className="h-4 w-4" /> Remove
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!posts.length ? <EmptyAdminState message="No posts available." /> : null}
        </div>
      </AdminPanel>
      <Modal onClose={() => setSelectedPost(null)} open={Boolean(selectedPost)} title="Post details">
        {selectedPost ? (
          <div className="space-y-3 rounded-2xl bg-szocial-mist p-4 text-sm text-szocial-muted">
            <p className="text-lg font-bold text-szocial-ink">{selectedPost.title}</p>
            <p>{selectedPost.description}</p>
            <p><strong className="text-szocial-ink">Type:</strong> {selectedPost.type}</p>
            <p><strong className="text-szocial-ink">Location:</strong> {locationLabel(selectedPost.location)}</p>
            <p><strong className="text-szocial-ink">Status:</strong> {selectedPost.status}</p>
            <p><strong className="text-szocial-ink">Reports:</strong> {selectedPost.reports}</p>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

export function AdminReportsScreen() {
  const {
    state,
    removePostAdmin,
    resolveReport,
    setBusinessAdminStatus,
    setUserStatus
  } = useAppStore();
  const reports = asArray(state.reports);

  const removeReportedItem = (report: Report) => {
    if (report.itemType === "Post") removePostAdmin(report.itemId);
    if (report.itemType === "Business") setBusinessAdminStatus(report.itemId, "Removed");
    if (report.itemType === "User") setUserStatus(report.itemId, "Banned");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        description="Review resident-submitted reports and take targeted moderation action."
        eyebrow="Safety queue"
        title="Reports"
      />
      <AdminPanel title="Reported content">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead className="text-slate-400">
              <tr>
                {["Type", "Reported item", "Reason", "Reported by", "Date", "Status", "Actions"].map((label) => (
                  <th className="p-3" key={label}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => {
                const reporter = asArray(state.residents).find((user) => user.id === report.reportedBy);
                const removable = ["Post", "Business", "User"].includes(report.itemType);
                return (
                  <tr className="border-t border-slate-800" key={report.id}>
                    <td className="p-3"><StatusPill>{report.itemType}</StatusPill></td>
                    <td className="p-3 font-semibold text-white">{report.itemLabel}</td>
                    <td className="p-3 text-slate-300">{report.reason}</td>
                    <td className="p-3 text-slate-300">{reporter?.name ?? "Unknown"}</td>
                    <td className="p-3 text-slate-300">
                      <RelativeTime timestamp={report.createdAt} />
                    </td>
                    <td className="p-3"><StatusPill>{report.status}</StatusPill></td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-2">
                        {report.status === "Open" ? (
                          <>
                            <Button
                              onClick={() =>
                                confirmAction(
                                  `Resolve report for "${report.itemLabel}"?`,
                                  () => resolveReport(report.id)
                                )
                              }
                              size="sm"
                              variant="light"
                            >
                              <CheckCircle2 className="h-4 w-4" /> Resolve
                            </Button>
                            <Button
                              onClick={() =>
                                confirmAction(
                                  `Dismiss report for "${report.itemLabel}"?`,
                                  () => resolveReport(report.id)
                                )
                              }
                              size="sm"
                              variant="outline"
                            >
                              Dismiss
                            </Button>
                          </>
                        ) : null}
                        {removable ? (
                          <Button
                            onClick={() =>
                              confirmAction(
                                `Take moderation action on "${report.itemLabel}"?`,
                                () => removeReportedItem(report)
                              )
                            }
                            size="sm"
                            variant="outline"
                          >
                            <XCircle className="h-4 w-4" /> Remove item
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!reports.length ? <EmptyAdminState message="No reports available." /> : null}
        </div>
      </AdminPanel>
    </div>
  );
}

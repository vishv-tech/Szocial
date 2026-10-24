import type { FeedSort } from "@/lib/feed";

export function FeedSortControl({ value, onChange }: { value: FeedSort; onChange: (value: FeedSort) => void }) {
  return <label className="mt-4 flex items-center gap-3 text-sm font-semibold text-szocial-ink">
    Sort posts
    <select className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2" value={value} onChange={event => onChange(event.target.value as FeedSort)}>
      <option value="nearby">Nearby — Default</option>
      <option value="newest">Newest First</option>
      <option value="oldest">Oldest First</option>
      <option value="farthest">Farthest First</option>
    </select>
  </label>;
}

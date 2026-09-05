import { Search } from "lucide-react";

type SearchBarProps = {
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
};

export function SearchBar({
  placeholder = "Search your neighbourhood",
  value,
  onChange
}: SearchBarProps) {
  return (
    <label className="relative block">
      <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-szocial-muted" />
      <input
        className="h-[52px] w-full rounded-2xl border border-slate-100 bg-white pl-12 pr-4 text-szocial-ink shadow-soft outline-none transition placeholder:text-slate-400 focus:border-szocial-teal"
        onChange={(event) => onChange?.(event.target.value)}
        placeholder={placeholder}
        type="search"
        value={value}
      />
    </label>
  );
}

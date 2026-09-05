"use client";

import { cn } from "@/lib/utils";

type CategoryTabsProps<T extends string> = {
  tabs: T[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
};

export function CategoryTabs<T extends string>({
  tabs,
  value,
  onChange,
  className
}: CategoryTabsProps<T>) {
  return (
    <div
      className={cn(
        "flex gap-2 overflow-x-auto rounded-2xl bg-white p-1 shadow-sm",
        className
      )}
    >
      {tabs.map((tab) => (
        <button
          className={cn(
            "min-h-10 shrink-0 rounded-xl px-4 text-sm font-semibold transition",
            value === tab
              ? "bg-szocial-teal text-white shadow-sm"
              : "text-szocial-muted hover:bg-szocial-mist hover:text-szocial-ink"
          )}
          key={tab}
          onClick={() => onChange(tab)}
          type="button"
        >
          {tab}
        </button>
      ))}
    </div>
  );
}

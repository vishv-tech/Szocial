import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type StatCardProps = {
  label: string;
  value: string;
  icon?: ReactNode;
  className?: string;
};

export function StatCard({ label, value, icon, className }: StatCardProps) {
  return (
    <article className={cn("rounded-2xl border border-slate-100 bg-white p-5 shadow-soft", className)}>
      {icon ? (
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-szocial-orangeSoft text-szocial-orange">
          {icon}
        </div>
      ) : null}
      <p className="text-3xl font-bold tracking-normal text-szocial-ink">{value}</p>
      <p className="mt-1 text-sm text-szocial-muted">{label}</p>
    </article>
  );
}

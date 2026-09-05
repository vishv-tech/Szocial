import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  title: string;
  description: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ title, description, icon, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center shadow-soft",
        className
      )}
    >
      {icon ? (
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-szocial-tealSoft text-szocial-teal">
          {icon}
        </div>
      ) : null}
      <h2 className="mt-4 text-lg font-semibold text-szocial-ink">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-szocial-muted">
        {description}
      </p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

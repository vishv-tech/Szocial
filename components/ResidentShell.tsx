import type { ReactNode } from "react";
import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { SidebarNav } from "@/components/SidebarNav";

type ResidentShellProps = {
  children: ReactNode;
  rightPanel?: ReactNode;
};

export function ResidentShell({ children, rightPanel }: ResidentShellProps) {
  return (
    <main className="min-h-screen bg-szocial-mist pb-24 lg:pb-8">
      <AppHeader compact />
      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <SidebarNav />
        <section className="min-w-0 flex-1">{children}</section>
        {rightPanel ? (
          <aside className="sticky top-24 hidden h-fit w-80 shrink-0 space-y-4 xl:block">
            {rightPanel}
          </aside>
        ) : null}
      </div>
      <BottomNav />
    </main>
  );
}

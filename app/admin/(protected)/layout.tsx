import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AdminLayout } from "@/components/AdminLayout";
import { getAdminSession } from "@/lib/admin-auth";

export default async function ProtectedAdminLayout({
  children
}: {
  children: ReactNode;
}) {
  if (!(await getAdminSession())) redirect("/admin/login");
  return <AdminLayout>{children}</AdminLayout>;
}

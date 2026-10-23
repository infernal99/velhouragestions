import type { Metadata } from "next";
import { requireContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { NotificationsList } from "./notifications-list";
import type { AppNotification } from "@/types/database";

export const metadata: Metadata = { title: "Notificaciones" };

export default async function NotificationsPage() {
  const ctx = await requireContext();
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", ctx.userId)
    .eq("company_id", ctx.company.id)
    .order("created_at", { ascending: false })
    .limit(200)
    .returns<AppNotification[]>();

  return (
    <>
      <PageHeader title="Notificaciones" description="Asignaciones, comentarios, cambios y vencimientos que te afectan." />
      <NotificationsList items={data ?? []} />
    </>
  );
}

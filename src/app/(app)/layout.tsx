import { requireContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { AppProvider } from "@/components/app-provider";
import { BrandStyle } from "@/components/shell/brand-style";
import { Sidebar } from "@/components/shell/sidebar";
import { MobileNav } from "@/components/shell/mobile-nav";
import { SearchCommand } from "@/components/shell/search-command";
import { NotificationBell } from "@/components/shell/notification-bell";
import { UserMenu } from "@/components/shell/user-menu";
import { QuickCreate } from "@/components/shell/quick-create";
import { TimerChip } from "@/components/time/timer-chip";
import { getRunningEntry } from "@/lib/queries/time";
import { CreateDialogsProvider } from "@/components/create/create-dialogs";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireContext();
  const supabase = await createClient();
  const running = await getRunningEntry(ctx.userId);
  const { count: unread } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", ctx.userId)
    .eq("company_id", ctx.company.id)
    .is("read_at", null);

  return (
    <AppProvider
      value={{
        userId: ctx.userId,
        userName: ctx.profile.full_name || ctx.profile.email,
        company: {
          id: ctx.company.id,
          name: ctx.company.name,
          logoUrl: ctx.company.logo_url,
          currency: ctx.company.currency,
          projectTypes: ctx.company.project_types,
          defaultTaxRate: Number(ctx.company.default_tax_rate),
          statusLabels: ctx.company.project_status_labels ?? {},
        },
        permissions: ctx.permissions,
        team: ctx.team,
        companies: ctx.companies,
      }}
    >
      <BrandStyle color={ctx.company.primary_color} />
      <CreateDialogsProvider>
        <div className="min-h-svh bg-background">
          <Sidebar />
          <div className="flex min-h-svh flex-col lg:pl-60">
            <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur-md sm:px-5">
              <MobileNav />
              <div className="flex flex-1 items-center">
                <SearchCommand />
              </div>
              <TimerChip running={running} />
              <QuickCreate />
              <NotificationBell initialUnread={unread ?? 0} />
              <UserMenu avatarUrl={ctx.profile.avatar_url} email={ctx.profile.email} />
            </header>
            <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
          </div>
        </div>
      </CreateDialogsProvider>
    </AppProvider>
  );
}

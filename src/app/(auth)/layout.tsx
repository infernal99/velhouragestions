import { LayoutGrid } from "lucide-react";

// Before sign-in the company isn't known yet (its data is behind RLS), so
// this uses the deployment-level name from NEXT_PUBLIC_APP_NAME.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "Panel de gestión";
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-surface px-4 py-10">
      <div className="mb-8 flex items-center gap-2.5">
        <div className="grid size-8 place-items-center rounded-lg bg-brand text-brand-foreground shadow-sm">
          <LayoutGrid className="size-4" />
        </div>
        <span className="text-[15px] font-semibold tracking-tight">{appName}</span>
      </div>
      <div className="w-full max-w-sm rounded-2xl border bg-card p-6 shadow-sm sm:p-7">{children}</div>
      <p className="mt-6 text-xs text-muted-foreground">Acceso privado para miembros del equipo.</p>
    </div>
  );
}

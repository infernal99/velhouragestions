import { isSupabaseConfigured } from "@/lib/env";
import { redirect } from "next/navigation";

// Shown instead of crashing when the Supabase environment variables are
// missing — the app never pretends to be connected.
export default function SetupPendingPage() {
  if (isSupabaseConfigured) redirect("/");
  return (
    <div className="flex min-h-svh items-center justify-center bg-surface px-4">
      <div className="max-w-lg rounded-2xl border bg-card p-6 shadow-sm">
        <h1 className="text-lg font-semibold">Falta conectar la base de datos</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          La aplicación necesita un proyecto de Supabase. Define estas variables en <code>.env.local</code> (o en
          Vercel) y reinicia el servidor:
        </p>
        <pre className="mt-4 overflow-x-auto rounded-lg bg-muted p-3 text-xs">
          {`NEXT_PUBLIC_SUPABASE_URL=https://<proyecto>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...`}
        </pre>
        <p className="mt-4 text-sm text-muted-foreground">
          Después aplica las migraciones de <code>supabase/migrations</code>. Los pasos completos están en el README.
        </p>
      </div>
    </div>
  );
}

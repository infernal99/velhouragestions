import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getUserId } from "@/lib/auth/context";
import { Button } from "@/components/ui/button";
import { AcceptInvitationButton } from "./accept-button";

export const metadata: Metadata = { title: "Invitación" };

const statusMessages: Record<string, string> = {
  revoked: "Esta invitación ha sido revocada.",
  accepted: "Esta invitación ya se ha utilizado.",
  expired: "Esta invitación ha caducado. Pide una nueva al administrador.",
};

export default async function InvitationPage({ params }: PageProps<"/invitacion/[token]">) {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("invitation_preview", { p_token: token });
  const preview = (data as { company_name: string; email: string; status: string }[] | null)?.[0];
  const userId = await getUserId();
  const next = `/invitacion/${token}`;

  return (
    <div className="flex min-h-svh items-center justify-center bg-surface px-4">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-6 text-center shadow-sm">
        {!preview ? (
          <>
            <h1 className="text-lg font-semibold">Invitación no válida</h1>
            <p className="mt-2 text-sm text-muted-foreground">Revisa que el enlace esté completo.</p>
          </>
        ) : preview.status !== "pending" ? (
          <>
            <h1 className="text-lg font-semibold">{preview.company_name}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{statusMessages[preview.status]}</p>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">Te han invitado a unirte a</p>
            <h1 className="mt-1 text-xl font-semibold">{preview.company_name}</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Invitación para <strong className="text-foreground">{preview.email}</strong>
            </p>
            <div className="mt-6 grid gap-2">
              {userId ? (
                <AcceptInvitationButton token={token} />
              ) : (
                <>
                  <Button
                    render={<Link href={`/login?next=${encodeURIComponent(next)}`} />}
                    nativeButton={false}
                    size="lg"
                  >
                    Ya tengo cuenta
                  </Button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

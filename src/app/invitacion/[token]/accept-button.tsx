"use client";

import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { runAction } from "@/components/forms/use-action-form";
import { acceptInvitation } from "@/lib/actions/auth";

export function AcceptInvitationButton({ token }: { token: string }) {
  const [pending, start] = useTransition();
  return (
    <Button size="lg" disabled={pending} onClick={() => start(async () => void (await runAction(acceptInvitation(token))))}>
      {pending ? <Loader2 className="animate-spin" /> : null}
      Aceptar invitación
    </Button>
  );
}

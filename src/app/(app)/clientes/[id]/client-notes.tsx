"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { runAction } from "@/components/forms/use-action-form";
import { updateClientNotes } from "@/lib/actions/clients";

export function ClientNotes({ clientId, initial }: { clientId: string; initial: string }) {
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [pending, start] = useTransition();
  const dirty = value !== saved;

  return (
    <div className="flex flex-col gap-2">
      <Textarea value={value} onChange={(e) => setValue(e.target.value)} rows={5} placeholder="Notas visibles solo para el equipo…" />
      {dirty ? (
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setValue(saved)} disabled={pending}>
            Descartar
          </Button>
          <Button
            size="sm"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await runAction(updateClientNotes(clientId, value));
                if (res.ok) setSaved(value);
              })
            }
          >
            {pending ? <Loader2 className="animate-spin" /> : null}
            Guardar notas
          </Button>
        </div>
      ) : null}
    </div>
  );
}

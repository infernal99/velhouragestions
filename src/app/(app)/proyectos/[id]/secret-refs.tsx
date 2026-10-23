"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/shared/form-dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { TextField } from "@/components/forms/fields";
import { runAction, useActionForm, useResetOnOpen } from "@/components/forms/use-action-form";
import { addSecretReference, deleteSecretReference } from "@/lib/actions/projects";
import { secretReferenceSchema } from "@/lib/validation/projects";
import type { SecretReference } from "@/types/database";

/**
 * Credentials never live in this app. Each row only records where the
 * secret is kept (an item in 1Password, Bitwarden, Vault…).
 */
export function SecretRefs({ projectId, items, canManage }: { projectId: string; items: SecretReference[]; canManage: boolean }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const defaults = () => ({ project_id: projectId, label: "", vault_provider: "1Password", vault_reference: "", notes: "" });
  const { form, onSubmit, pending } = useActionForm({
    schema: secretReferenceSchema,
    defaultValues: defaults(),
    action: addSecretReference,
    onSuccess: () => {
      setOpen(false);
      router.refresh();
    },
  });
  useResetOnOpen(open, form, defaults);

  const isLink = (v: string) => /^https?:\/\//i.test(v);

  return (
    <div className="flex flex-col gap-3">
      <p className="flex items-start gap-2 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
        <ShieldCheck className="mt-px size-3.5 shrink-0" />
        Aquí no se guardan contraseñas ni claves. Registra solo dónde está cada acceso en vuestro gestor de contraseñas.
      </p>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin accesos registrados.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {items.map((s) => (
            <li key={s.id} className="group flex items-start gap-2.5 rounded-md border px-2.5 py-2">
              <KeyRound className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{s.label}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {s.vault_provider} ·{" "}
                  {isLink(s.vault_reference) ? (
                    <a href={s.vault_reference} target="_blank" rel="noreferrer noopener" className="hover:underline">
                      abrir en el gestor
                    </a>
                  ) : (
                    <code>{s.vault_reference}</code>
                  )}
                </p>
                {s.notes ? <p className="mt-0.5 text-xs text-muted-foreground">{s.notes}</p> : null}
              </div>
              {canManage ? (
                <ConfirmDialog
                  title="¿Quitar esta referencia?"
                  description="Solo se borra la referencia; el secreto sigue en el gestor de contraseñas."
                  confirmLabel="Quitar"
                  onConfirm={async () => {
                    const res = await runAction(deleteSecretReference(s.id, projectId));
                    if (res.ok) router.refresh();
                  }}
                  trigger={(o) => (
                    <button type="button" onClick={o} aria-label="Quitar" className="text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive">
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {canManage ? (
        <Button size="sm" variant="ghost" className="self-start" onClick={() => setOpen(true)}>
          <Plus /> Añadir referencia
        </Button>
      ) : null}
      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title="Referencia a un acceso"
        description="Por ejemplo: «op://Clientes/Hosting ACME» o el enlace al elemento del gestor."
        onSubmit={onSubmit}
        pending={pending}
        size="sm"
        submitLabel="Guardar referencia"
      >
        <TextField form={form} name="label" label="Qué es" placeholder="Panel de hosting, WordPress admin…" required />
        <TextField form={form} name="vault_provider" label="Gestor" placeholder="1Password, Bitwarden…" required />
        <TextField
          form={form}
          name="vault_reference"
          label="Referencia o enlace al elemento"
          placeholder="op://Vault/Elemento"
          required
          autoComplete="off"
        />
        <TextField form={form} name="notes" label="Notas (sin datos sensibles)" />
      </FormDialog>
    </div>
  );
}

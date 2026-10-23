"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Mail, MoreHorizontal, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/shared/user-avatar";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { FormDialog } from "@/components/shared/form-dialog";
import { Panel } from "@/components/shared/info-list";
import { SelectField, TextField } from "@/components/forms/fields";
import { runAction, useActionForm, useResetOnOpen } from "@/components/forms/use-action-form";
import { useApp } from "@/components/app-provider";
import { inviteMember, removeMember, revokeInvitation, updateMember } from "@/lib/actions/team";
import { inviteSchema } from "@/lib/validation/settings";
import { formatDate } from "@/lib/format";
import type { Invitation, Membership } from "@/types/database";

export type MemberRow = Membership & {
  profile: { id: string; full_name: string; email: string; avatar_url: string | null; job_title: string | null; phone: string | null };
  load: { open: number; overdue: number; today: number };
};

export function TeamView({ members, invitations }: { members: MemberRow[]; invitations: Invitation[] }) {
  const router = useRouter();
  const { userId, permissions } = useApp();
  const [inviting, setInviting] = useState(false);
  const [createdLink, setCreatedLink] = useState<{ link: string; emailSent: boolean } | null>(null);

  const defaults = () => ({ email: "", role: "member" as const });
  const { form, onSubmit, pending } = useActionForm({
    schema: inviteSchema,
    defaultValues: defaults(),
    action: inviteMember,
    onSuccess: (data) => {
      setCreatedLink(data);
      router.refresh();
    },
  });
  useResetOnOpen(inviting, form, defaults);

  const update = async (m: MemberRow, patch: Partial<Pick<Membership, "role" | "can_view_finances" | "can_manage_clients">>) => {
    const res = await runAction(
      updateMember({
        user_id: m.user_id,
        role: patch.role ?? m.role,
        can_view_finances: patch.can_view_finances ?? m.can_view_finances,
        can_manage_clients: patch.can_manage_clients ?? m.can_manage_clients,
      }),
    );
    if (res.ok) router.refresh();
  };

  return (
    <div className="flex flex-col gap-5">
      <Panel
        title={`Miembros (${members.length})`}
        action={
          permissions.canManageTeam ? (
            <Button size="sm" onClick={() => setInviting(true)}>
              <UserPlus /> Invitar
            </Button>
          ) : null
        }
        bodyClassName="p-0"
      >
        <ul className="divide-y">
          {members.map((m) => {
            const isMe = m.user_id === userId;
            return (
              <li key={m.user_id} className="flex flex-col gap-3 px-4 py-4 lg:flex-row lg:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <UserAvatar name={m.profile.full_name || m.profile.email} src={m.profile.avatar_url} size="lg" />
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-medium">
                      {m.profile.full_name || m.profile.email}
                      {isMe ? <span className="text-xs font-normal text-muted-foreground">(tú)</span> : null}
                      {m.role === "admin" ? (
                        <StatusBadge tone="brand" dot={false}>
                          <ShieldCheck className="size-3" /> Administrador
                        </StatusBadge>
                      ) : (
                        <StatusBadge tone="muted" dot={false}>
                          Miembro
                        </StatusBadge>
                      )}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {[m.profile.job_title, m.profile.email].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-5 text-sm">
                  <div className="text-center">
                    <p className="font-semibold tabular">{m.load.open}</p>
                    <p className="text-[11px] text-muted-foreground">abiertas</p>
                  </div>
                  <div className="text-center">
                    <p className="font-semibold tabular">{m.load.today}</p>
                    <p className="text-[11px] text-muted-foreground">para hoy</p>
                  </div>
                  <div className="text-center">
                    <p className={`font-semibold tabular ${m.load.overdue ? "text-destructive" : ""}`}>{m.load.overdue}</p>
                    <p className="text-[11px] text-muted-foreground">vencidas</p>
                  </div>
                </div>
                {permissions.canManageTeam && m.role === "member" ? (
                  <div className="flex flex-col gap-1.5 text-sm lg:w-56">
                    <label className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Acceso a finanzas</span>
                      <Switch checked={m.can_view_finances} onCheckedChange={(v) => void update(m, { can_view_finances: Boolean(v) })} />
                    </label>
                    <label className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Poder eliminar clientes</span>
                      <Switch checked={m.can_manage_clients} onCheckedChange={(v) => void update(m, { can_manage_clients: Boolean(v) })} />
                    </label>
                  </div>
                ) : (
                  <div className="hidden lg:block lg:w-56" />
                )}
                {permissions.canManageTeam || isMe ? (
                  <ConfirmDialog
                    title={isMe ? "¿Salir de la empresa?" : `¿Quitar a ${m.profile.full_name || m.profile.email}?`}
                    description={
                      isMe
                        ? "Perderás el acceso a todos sus datos."
                        : "Perderá el acceso a la empresa. Sus tareas y proyectos se conservan y podrás reasignarlos."
                    }
                    confirmLabel={isMe ? "Salir" : "Quitar"}
                    onConfirm={async () => {
                      const res = await runAction(removeMember(m.user_id));
                      if (res.ok) router.refresh();
                    }}
                    trigger={(openRemove) => (
                      <DropdownMenu>
                        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Opciones" />}>
                          <MoreHorizontal />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          {permissions.canManageTeam ? (
                            <DropdownMenuItem onClick={() => void update(m, { role: m.role === "admin" ? "member" : "admin" })}>
                              <ShieldCheck /> {m.role === "admin" ? "Cambiar a miembro" : "Hacer administrador"}
                            </DropdownMenuItem>
                          ) : null}
                          <DropdownMenuItem render={<a href={`mailto:${m.profile.email}`} />}>
                            <Mail /> Escribir correo
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="destructive" onClick={openRemove}>
                            <Trash2 /> {isMe ? "Salir de la empresa" : "Quitar de la empresa"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      </Panel>

      {permissions.canManageTeam && invitations.length ? (
        <Panel title="Invitaciones pendientes" bodyClassName="p-0">
          <ul className="divide-y">
            {invitations.map((inv) => (
              <li key={inv.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <Mail className="size-4 text-muted-foreground" />
                <span className="flex-1 truncate">{inv.email}</span>
                <span className="text-xs text-muted-foreground">
                  {inv.role === "admin" ? "Administrador" : "Miembro"} · caduca {formatDate(inv.expires_at)}
                </span>
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={async () => {
                    const res = await runAction(revokeInvitation(inv.id));
                    if (res.ok) router.refresh();
                  }}
                >
                  Revocar
                </Button>
              </li>
            ))}
          </ul>
          <p className="border-t px-4 py-2 text-xs text-muted-foreground">
            Por seguridad, el enlace solo se muestra al crear la invitación. Si se ha perdido, revócala y crea otra.
          </p>
        </Panel>
      ) : null}

      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <div className="rounded-xl border bg-card p-4">
          <p className="mb-1 flex items-center gap-1.5 font-medium">
            <ShieldCheck className="size-4 text-brand" /> Administrador
          </p>
          <p className="text-muted-foreground">
            Configuración de la empresa, gestión de usuarios y permisos, acceso a todos los proyectos, clientes y finanzas, y gestión de
            presupuestos y gastos.
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="mb-1 font-medium">Miembro</p>
          <p className="text-muted-foreground">
            Ve y edita todo el trabajo compartido: proyectos, clientes, tareas, calendario y documentos. Las finanzas solo si un
            administrador se lo concede, y no accede a los ajustes de la empresa.
          </p>
        </div>
      </div>

      <FormDialog
        open={inviting}
        onOpenChange={(o) => {
          setInviting(o);
          if (!o) setCreatedLink(null);
        }}
        title="Invitar a la empresa"
        description="La persona deberá registrarse o iniciar sesión con este mismo correo."
        onSubmit={createdLink ? (e) => { e?.preventDefault(); setInviting(false); setCreatedLink(null); } : onSubmit}
        pending={pending}
        submitLabel={createdLink ? "Hecho" : "Crear invitación"}
        size="sm"
      >
        {createdLink ? (
          <div className="flex flex-col gap-3">
            <p className="flex items-center gap-2 text-sm">
              <Check className="size-4 text-emerald-600" />
              {createdLink.emailSent ? "Hemos enviado un correo con la invitación." : "Invitación creada. Comparte este enlace (caduca en 7 días):"}
            </p>
            <div className="flex gap-2">
              <code className="min-w-0 flex-1 truncate rounded-md bg-muted px-2 py-1.5 text-xs">{createdLink.link}</code>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={async () => {
                  await navigator.clipboard.writeText(createdLink.link);
                  toast.success("Enlace copiado");
                }}
              >
                <Copy /> Copiar
              </Button>
            </div>
            {!createdLink.emailSent ? (
              <p className="text-xs text-muted-foreground">
                El envío automático por correo requiere configurar <code>SUPABASE_SERVICE_ROLE_KEY</code> en el servidor.
              </p>
            ) : null}
          </div>
        ) : (
          <>
            <TextField form={form} name="email" label="Correo electrónico" type="email" required autoFocus />
            <SelectField
              form={form}
              name="role"
              label="Rol"
              options={[
                { value: "member", label: "Miembro" },
                { value: "admin", label: "Administrador" },
              ]}
            />
          </>
        )}
      </FormDialog>
    </div>
  );
}

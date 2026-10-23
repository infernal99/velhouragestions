"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Panel } from "@/components/shared/info-list";
import { runAction } from "@/components/forms/use-action-form";
import { savePreferences } from "@/lib/actions/settings";
import type { CompanyPreferences, NotificationKind } from "@/types/database";

const KINDS: { value: NotificationKind; label: string; hint: string }[] = [
  { value: "task_assigned", label: "Tareas asignadas", hint: "Cuando alguien te asigna una tarea." },
  { value: "assignee_changed", label: "Cambios de responsable", hint: "Cuando pasas a ser responsable de una tarea o proyecto." },
  { value: "comment", label: "Comentarios nuevos", hint: "En tareas, proyectos y clientes en los que participas." },
  { value: "project_updated", label: "Proyectos modificados", hint: "Cambios de estado o de fecha de entrega." },
  { value: "due_soon", label: "Próximos vencimientos", hint: "Tareas que vencen hoy o mañana (aviso diario)." },
  { value: "payment_due", label: "Pagos próximos a vencer", hint: "Cobros pendientes que vencen en 3 días (solo con acceso a finanzas)." },
];

export function PreferencesForm({ preferences }: { preferences: CompanyPreferences }) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Record<NotificationKind, boolean>>(
    Object.fromEntries(KINDS.map((k) => [k.value, preferences.notifications?.[k.value] ?? true])) as Record<NotificationKind, boolean>,
  );
  const [seeAllClients, setSeeAllClients] = useState(preferences.privacy?.members_see_all_clients ?? false);
  const [saving, setSaving] = useState(false);

  return (
    <div className="flex flex-col gap-5">
      <Panel title="Notificaciones dentro de la aplicación">
        <ul className="flex flex-col gap-4">
          {KINDS.map((k) => (
            <li key={k.value} className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium">{k.label}</p>
                <p className="text-xs text-muted-foreground">{k.hint}</p>
              </div>
              <Switch checked={notifications[k.value]} onCheckedChange={(v) => setNotifications((n) => ({ ...n, [k.value]: Boolean(v) }))} />
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-muted-foreground">
          No se envían correos automáticos: todas las notificaciones son internas. El aviso diario de vencimientos se ejecuta en la base
          de datos (pg_cron).
        </p>
      </Panel>
      <Panel title="Privacidad">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Los miembros ven todos los clientes</p>
            <p className="text-xs text-muted-foreground">
              Desactivado: cada miembro solo ve los clientes de los que es responsable, que ha creado o con los que trabaja en un proyecto.
              Las finanzas siguen restringidas igualmente.
            </p>
          </div>
          <Switch checked={seeAllClients} onCheckedChange={(v) => setSeeAllClients(Boolean(v))} />
        </div>
      </Panel>
      <div className="flex justify-end">
        <Button
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            const res = await runAction(savePreferences({ notifications, privacy: { members_see_all_clients: seeAllClients } }));
            setSaving(false);
            if (res.ok) router.refresh();
          }}
        >
          {saving ? <Loader2 className="animate-spin" /> : null}
          Guardar preferencias
        </Button>
      </div>
    </div>
  );
}

import type {
  CrmStage,
  EventCategory,
  FileCategory,
  InteractionKind,
  LinkKind,
  PaymentMethod,
  Priority,
  ProjectStatus,
  QuoteStatus,
  ReceivableStatus,
  TaskStatus,
  WebRequestKind,
  WebRequestStatus,
  WebType,
} from "@/types/database";

// Spanish labels for every enum, plus the tone each one renders with.
export type Tone = "neutral" | "info" | "brand" | "success" | "warning" | "danger" | "muted";

export interface Option<T extends string> {
  value: T;
  label: string;
  tone?: Tone;
}

function toMap<T extends string>(options: Option<T>[]) {
  return Object.fromEntries(options.map((o) => [o.value, o])) as Record<T, Option<T>>;
}

export const projectStatusOptions: Option<ProjectStatus>[] = [
  { value: "pendiente", label: "Pendiente", tone: "muted" },
  { value: "planificado", label: "Planificado", tone: "info" },
  { value: "en_desarrollo", label: "En desarrollo", tone: "brand" },
  { value: "revision", label: "Revisión", tone: "warning" },
  { value: "entregado", label: "Entregado", tone: "success" },
  { value: "pausado", label: "Pausado", tone: "neutral" },
  { value: "cancelado", label: "Cancelado", tone: "danger" },
];
export const projectStatusMap = toMap(projectStatusOptions);

/** Status labels with the company's custom names (Ajustes → Proyectos). */
export function projectStatusMapWith(custom?: Partial<Record<ProjectStatus, string>> | null) {
  return toMap(projectStatusOptions.map((o) => ({ ...o, label: custom?.[o.value]?.trim() || o.label })));
}
export const ACTIVE_PROJECT_STATUSES: ProjectStatus[] = ["pendiente", "planificado", "en_desarrollo", "revision"];

export const projectTypeLabels: Record<string, string> = {
  web: "Web",
  aplicacion: "Aplicación",
  mantenimiento: "Mantenimiento",
  diseno: "Diseño",
  marketing: "Marketing",
  otro: "Otro",
};
export function projectTypeLabel(type: string) {
  return projectTypeLabels[type] ?? type.charAt(0).toUpperCase() + type.slice(1);
}

export const priorityOptions: Option<Priority>[] = [
  { value: "baja", label: "Baja", tone: "muted" },
  { value: "media", label: "Media", tone: "info" },
  { value: "alta", label: "Alta", tone: "warning" },
  { value: "urgente", label: "Urgente", tone: "danger" },
];
export const priorityMap = toMap(priorityOptions);
export const PRIORITY_RANK: Record<Priority, number> = { urgente: 0, alta: 1, media: 2, baja: 3 };

export const taskStatusOptions: Option<TaskStatus>[] = [
  { value: "pendiente", label: "Pendiente", tone: "muted" },
  { value: "en_progreso", label: "En progreso", tone: "brand" },
  { value: "revision", label: "En revisión", tone: "warning" },
  { value: "bloqueada", label: "Bloqueada", tone: "danger" },
  { value: "completada", label: "Completada", tone: "success" },
];
export const taskStatusMap = toMap(taskStatusOptions);

export const crmStageOptions: Option<CrmStage>[] = [
  { value: "nuevo", label: "Nuevo contacto", tone: "muted" },
  { value: "contactado", label: "Contactado", tone: "info" },
  { value: "reunion", label: "Reunión", tone: "info" },
  { value: "propuesta", label: "Propuesta enviada", tone: "brand" },
  { value: "negociacion", label: "Negociación", tone: "warning" },
  { value: "ganado", label: "Ganado", tone: "success" },
  { value: "perdido", label: "Perdido", tone: "danger" },
];
export const crmStageMap = toMap(crmStageOptions);

export const interactionKindOptions: Option<InteractionKind>[] = [
  { value: "llamada", label: "Llamada" },
  { value: "reunion", label: "Reunión" },
  { value: "mensaje", label: "Mensaje" },
  { value: "email", label: "Correo" },
  { value: "acuerdo", label: "Acuerdo" },
  { value: "nota", label: "Nota" },
];
export const interactionKindMap = toMap(interactionKindOptions);

export const webTypeOptions: Option<WebType>[] = [
  { value: "landing", label: "Landing page" },
  { value: "tienda", label: "Tienda online" },
  { value: "corporativa", label: "Web corporativa" },
  { value: "portfolio", label: "Portfolio" },
  { value: "otra", label: "Otra" },
];
export const webTypeMap = toMap(webTypeOptions);

export const webRequestKindOptions: Option<WebRequestKind>[] = [
  { value: "cambio", label: "Cambio solicitado" },
  { value: "problema", label: "Problema" },
];
export const webRequestKindMap = toMap(webRequestKindOptions);

export const webRequestStatusOptions: Option<WebRequestStatus>[] = [
  { value: "abierto", label: "Abierto", tone: "warning" },
  { value: "en_curso", label: "En curso", tone: "brand" },
  { value: "resuelto", label: "Resuelto", tone: "success" },
  { value: "descartado", label: "Descartado", tone: "muted" },
];
export const webRequestStatusMap = toMap(webRequestStatusOptions);

export const linkKindOptions: Option<LinkKind>[] = [
  { value: "github", label: "GitHub" },
  { value: "vercel", label: "Vercel" },
  { value: "dominio", label: "Dominio" },
  { value: "staging", label: "Web de prueba" },
  { value: "produccion", label: "Producción" },
  { value: "documentacion", label: "Documentación" },
  { value: "diseno", label: "Diseño" },
  { value: "otro", label: "Otro" },
];
export const linkKindMap = toMap(linkKindOptions);

export const eventCategoryOptions: (Option<EventCategory> & { color: string })[] = [
  { value: "reunion", label: "Reunión con cliente", color: "#6366f1" },
  { value: "entrega", label: "Fecha de entrega", color: "#dc2626" },
  { value: "tarea", label: "Tarea programada", color: "#0ea5e9" },
  { value: "llamada", label: "Llamada comercial", color: "#16a34a" },
  { value: "revision", label: "Revisión de proyecto", color: "#f59e0b" },
  { value: "renovacion", label: "Renovación", color: "#a855f7" },
  { value: "recordatorio", label: "Recordatorio interno", color: "#64748b" },
  { value: "otro", label: "Otro", color: "#78716c" },
];
export const eventCategoryMap = toMap(eventCategoryOptions) as Record<
  EventCategory,
  Option<EventCategory> & { color: string }
>;

export const quoteStatusOptions: Option<QuoteStatus>[] = [
  { value: "borrador", label: "Borrador", tone: "muted" },
  { value: "enviado", label: "Enviado", tone: "info" },
  { value: "aceptado", label: "Aceptado", tone: "success" },
  { value: "rechazado", label: "Rechazado", tone: "danger" },
  { value: "caducado", label: "Caducado", tone: "neutral" },
];
export const quoteStatusMap = toMap(quoteStatusOptions);

export const receivableStatusOptions: Option<ReceivableStatus>[] = [
  { value: "pendiente", label: "Pendiente", tone: "info" },
  { value: "parcial", label: "Parcial", tone: "warning" },
  { value: "pagado", label: "Pagado", tone: "success" },
  { value: "vencido", label: "Vencido", tone: "danger" },
];
export const receivableStatusMap = toMap(receivableStatusOptions);

export const paymentMethodOptions: Option<PaymentMethod>[] = [
  { value: "transferencia", label: "Transferencia" },
  { value: "tarjeta", label: "Tarjeta" },
  { value: "efectivo", label: "Efectivo" },
  { value: "bizum", label: "Bizum" },
  { value: "paypal", label: "PayPal" },
  { value: "stripe", label: "Stripe" },
  { value: "domiciliacion", label: "Domiciliación" },
  { value: "otro", label: "Otro" },
];
export const paymentMethodMap = toMap(paymentMethodOptions);

export const fileCategoryOptions: Option<FileCategory>[] = [
  { value: "briefing", label: "Briefing" },
  { value: "diseno", label: "Diseño y referencias" },
  { value: "contrato", label: "Contrato" },
  { value: "presupuesto", label: "Presupuesto" },
  { value: "tecnico", label: "Documentación técnica" },
  { value: "imagen", label: "Imágenes" },
  { value: "recurso_cliente", label: "Recurso del cliente" },
  { value: "justificante", label: "Justificante de gasto" },
  { value: "otro", label: "Otro" },
];
export const fileCategoryMap = toMap(fileCategoryOptions);

export const activityActionLabels: Record<string, string> = {
  created: "ha creado",
  updated: "ha actualizado",
  deleted: "ha eliminado",
  archived: "ha archivado",
  restored: "ha restaurado",
  status_changed: "ha cambiado el estado de",
};

export const entityTypeLabels: Record<string, string> = {
  project: "el proyecto",
  client: "el cliente",
  task: "la tarea",
  event: "el evento",
  file: "el archivo",
  comment: "un comentario en",
  quote: "el presupuesto",
  receivable: "el cobro",
  payment: "un pago",
  expense: "el gasto",
};

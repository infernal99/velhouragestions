// Row shapes for the tables in supabase/migrations. Kept by hand (the
// project has no generated types yet); once the Supabase project exists,
// `npm run db:types` can generate the full Database type to replace these.

export type MemberRole = "admin" | "member";
export type CrmStage = "nuevo" | "contactado" | "reunion" | "propuesta" | "negociacion" | "ganado" | "perdido";
export type InteractionKind = "llamada" | "reunion" | "mensaje" | "email" | "acuerdo" | "nota";
export type ProjectStatus =
  | "pendiente"
  | "planificado"
  | "en_desarrollo"
  | "revision"
  | "entregado"
  | "pausado"
  | "cancelado";
export type Priority = "baja" | "media" | "alta" | "urgente";
export type WebType = "landing" | "tienda" | "corporativa" | "portfolio" | "otra";
export type WebRequestKind = "cambio" | "problema";
export type WebRequestStatus = "abierto" | "en_curso" | "resuelto" | "descartado";
export type LinkKind = "github" | "vercel" | "dominio" | "staging" | "produccion" | "documentacion" | "diseno" | "otro";
export type TaskStatus = "pendiente" | "en_progreso" | "revision" | "bloqueada" | "completada";
export type EventCategory =
  | "reunion"
  | "entrega"
  | "tarea"
  | "llamada"
  | "revision"
  | "renovacion"
  | "recordatorio"
  | "otro";
export type QuoteStatus = "borrador" | "enviado" | "aceptado" | "rechazado" | "caducado";
export type PaymentMethod =
  | "transferencia"
  | "tarjeta"
  | "efectivo"
  | "bizum"
  | "paypal"
  | "stripe"
  | "domiciliacion"
  | "otro";
export type ReceivableStatus = "pendiente" | "parcial" | "pagado" | "vencido";
export type FileCategory =
  | "briefing"
  | "diseno"
  | "contrato"
  | "presupuesto"
  | "tecnico"
  | "imagen"
  | "recurso_cliente"
  | "justificante"
  | "otro";

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  job_title: string | null;
  phone: string | null;
  active_company_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CompanyPreferences {
  notifications?: Partial<Record<NotificationKind, boolean>>;
  privacy?: {
    /** enforced in private.can_access_client */
    members_see_all_clients?: boolean;
  };
}

export interface Company {
  id: string;
  name: string;
  logo_url: string | null;
  primary_color: string;
  currency: string;
  locale: string;
  date_format: string;
  timezone: string;
  legal_name: string | null;
  tax_id: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  country: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  quote_prefix: string;
  next_quote_number: number;
  default_tax_rate: number;
  project_types: string[];
  project_status_labels: Partial<Record<ProjectStatus, string>>;
  preferences: CompanyPreferences;
  created_at: string;
  updated_at: string;
}

export interface Membership {
  company_id: string;
  user_id: string;
  role: MemberRole;
  can_view_finances: boolean;
  can_manage_clients: boolean;
  created_at: string;
}

export interface Invitation {
  id: string;
  company_id: string;
  email: string;
  role: MemberRole;
  invited_by: string | null;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export interface Client {
  id: string;
  company_id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  legal_name: string | null;
  tax_id: string | null;
  address: string | null;
  website: string | null;
  sector: string | null;
  stage: CrmStage;
  source: string | null;
  owner_id: string | null;
  notes: string | null;
  next_action: string | null;
  next_action_date: string | null;
  estimated_value: number | null;
  archived_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientInteraction {
  id: string;
  company_id: string;
  client_id: string;
  kind: InteractionKind;
  summary: string;
  occurred_at: string;
  created_by: string | null;
  created_at: string;
}

export interface Project {
  id: string;
  company_id: string;
  client_id: string | null;
  name: string;
  description: string | null;
  type: string;
  status: ProjectStatus;
  priority: Priority;
  start_date: string | null;
  due_date: string | null;
  budget: number | null;
  owner_id: string | null;
  progress: number;
  archived_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectLink {
  id: string;
  project_id: string;
  kind: LinkKind;
  label: string;
  url: string;
  created_at: string;
}

export interface WebStage {
  id: string;
  company_id: string;
  name: string;
  position: number;
  color: string;
}

export interface WebDetails {
  project_id: string;
  web_type: WebType;
  stage_id: string | null;
  dev_url: string | null;
  production_url: string | null;
  repository_url: string | null;
  domain: string | null;
  hosting_provider: string | null;
  domain_renewal_date: string | null;
  requirements: string | null;
  updated_at: string;
}

export interface WebRequest {
  id: string;
  project_id: string;
  kind: WebRequestKind;
  title: string;
  description: string | null;
  priority: Priority;
  status: WebRequestStatus;
  assignee_id: string | null;
  requested_by_client: boolean;
  resolved_at: string | null;
  created_by: string | null;
  created_at: string;
}

export interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
  position: number;
}

export interface SecretReference {
  id: string;
  project_id: string;
  label: string;
  vault_provider: string;
  vault_reference: string;
  notes: string | null;
  created_at: string;
}

export interface Task {
  id: string;
  company_id: string;
  project_id: string | null;
  parent_id: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  due_date: string | null;
  assignee_id: string | null;
  labels: string[];
  position: number;
  completed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Comment {
  id: string;
  company_id: string;
  project_id: string | null;
  task_id: string | null;
  client_id: string | null;
  body: string;
  author_id: string | null;
  edited_at: string | null;
  created_at: string;
}

export interface CalendarEvent {
  id: string;
  company_id: string;
  title: string;
  description: string | null;
  category: EventCategory;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  location: string | null;
  project_id: string | null;
  client_id: string | null;
  task_id: string | null;
  color: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Quote {
  id: string;
  company_id: string;
  number: string;
  client_id: string | null;
  project_id: string | null;
  title: string;
  status: QuoteStatus;
  issue_date: string;
  valid_until: string | null;
  notes: string | null;
  terms: string | null;
  subtotal: number;
  discount_total: number;
  tax_total: number;
  total: number;
  sent_at: string | null;
  accepted_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuoteLine {
  id: string;
  quote_id: string;
  position: number;
  description: string;
  quantity: number;
  unit_price: number;
  discount_pct: number;
  tax_pct: number;
  line_subtotal: number;
}

export interface Receivable {
  id: string;
  company_id: string;
  client_id: string | null;
  project_id: string | null;
  quote_id: string | null;
  concept: string;
  amount: number;
  issue_date: string;
  due_date: string | null;
  reference: string | null;
  notes: string | null;
  amount_paid: number;
  created_at: string;
}

export interface ReceivableWithStatus extends Receivable {
  amount_pending: number;
  status: ReceivableStatus;
}

export interface Payment {
  id: string;
  company_id: string;
  receivable_id: string;
  amount: number;
  paid_at: string;
  method: PaymentMethod;
  reference: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface ExpenseCategory {
  id: string;
  company_id: string;
  name: string;
  color: string;
}

export interface Expense {
  id: string;
  company_id: string;
  concept: string;
  category_id: string | null;
  amount: number;
  tax_amount: number;
  expense_date: string;
  supplier: string | null;
  project_id: string | null;
  receipt_file_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface FileRecord {
  id: string;
  company_id: string;
  client_id: string | null;
  project_id: string | null;
  task_id: string | null;
  category: FileCategory;
  name: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number;
  is_finance: boolean;
  uploaded_by: string | null;
  created_at: string;
}

export type NotificationKind =
  | "task_assigned"
  | "assignee_changed"
  | "comment"
  | "project_updated"
  | "due_soon"
  | "payment_due";

export interface AppNotification {
  id: string;
  company_id: string;
  user_id: string;
  actor_id: string | null;
  kind: NotificationKind;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export interface ActivityEntry {
  id: number;
  company_id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  entity_label: string | null;
  project_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

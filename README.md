# Plataforma de gestión empresarial

Herramienta interna para gestionar la empresa: clientes (CRM), proyectos, webs en desarrollo, tareas, calendario,
presupuestos, cobros, gastos, documentos, equipo y ajustes. El nombre de la empresa, el logotipo y los colores **no
están en el código**: se configuran en **Ajustes** y se guardan en la base de datos.

## Stack

| Capa | Tecnología |
| --- | --- |
| Framework | Next.js 16 (App Router, Server Components, Server Actions), React 19, TypeScript |
| UI | Tailwind CSS 4, shadcn/ui (Base UI), lucide-react, next-themes (claro/oscuro) |
| Formularios | React Hook Form + Zod (el mismo esquema valida en cliente y en servidor) |
| Datos | Supabase: PostgreSQL + RLS, Auth, Storage, Realtime (campana de notificaciones) |
| Gráficos / calendario | Recharts, FullCalendar |
| Kanban | dnd-kit |
| Pruebas | Vitest + PGlite (Postgres en memoria para probar migraciones y RLS) |

## Arquitectura

```
Navegador ──► proxy.ts (refresca sesión, redirige a /login)
          ──► Server Components (lecturas con el cliente Supabase del usuario → RLS)
          ──► Server Actions (src/lib/actions/*) ──► actionContext(): sesión + empresa + permisos
                                                      validación Zod ──► Supabase (RLS otra vez)
Base de datos: RLS en todas las tablas + triggers (progreso, totales, numeración, notificaciones, actividad)
```

Principios:

- **Multiempresa desde el inicio.** Toda tabla de negocio lleva `company_id`; el acceso pasa siempre por `memberships`.
  Un usuario puede pertenecer a varias empresas y cambiar entre ellas sin mezclar datos.
- **Permisos en tres capas:** la UI oculta lo que no procede, cada Server Action comprueba la capacidad
  (`actionContext("finances")`…) y **RLS** en PostgreSQL es la autoridad final. Ocultar un botón nunca es la seguridad.
- **Una sola fuente de verdad.** El progreso del proyecto lo calcula un trigger a partir de las tareas; los totales del
  presupuesto, un trigger a partir de las líneas; lo cobrado, un trigger a partir de los pagos. El calendario muestra las
  tareas y entregas desde sus tablas, sin copiarlas como eventos (no hay duplicados).
- **La clave `service_role` nunca llega al navegador.** Solo se usa (opcionalmente) en `src/lib/supabase/admin.ts`, marcado
  `server-only`, para enviar invitaciones por correo.
- **Sin datos inventados.** Todas las cifras salen de la base de datos; los estados vacíos lo dicen claramente.

### Estructura

```
src/
  app/(auth)/          login, registro, recuperar contraseña
  app/(app)/           aplicación (sidebar + barra superior)
    page.tsx           dashboard
    clientes/ proyectos/ webs/ tareas/ calendario/ documentos/
    finanzas/          resumen, presupuestos, cobros, gastos (requiere acceso a finanzas)
    equipo/ actividad/ notificaciones/ ajustes/ perfil/
  app/imprimir/        versión imprimible / PDF de presupuestos
  app/api/exportar/    exportaciones CSV
  lib/actions/         Server Actions (mutaciones)
  lib/validation/      esquemas Zod
  lib/auth/context.ts  sesión, empresa activa, permisos
  components/          UI compartida, formularios, tablero Kanban, etc.
supabase/migrations/   esquema versionado (SQL)
tests/db/              pruebas de permisos y reglas contra las migraciones reales
```

## Base de datos

Migraciones en `supabase/migrations` (orden por fecha):

| Migración | Contenido |
| --- | --- |
| `core_tenancy` | `profiles`, `companies`, `memberships`, `invitations`; helpers RLS en el esquema `private`; RPC `create_company`, `accept_invitation`, `invitation_preview` |
| `crm_and_projects` | `clients`, `client_interactions`, `projects`, `project_members`, `project_links`, `web_stages`, `web_details`, `web_requests`, `web_checklist_items`, `secret_references` |
| `tasks_calendar_comments` | `tasks` (+ subtareas por `parent_id`), `task_collaborators`, `task_checklist_items`, `comments`, `events`, `event_attendees` |
| `finance` | `quotes`, `quote_lines`, `receivables`, `payments`, `expense_categories`, `expenses`, vista `receivables_with_status`, RPC `convert_quote_to_project` |
| `files_notifications_activity` | `files` + buckets de Storage, `notifications`, `activity_log`, `global_search`, recordatorios diarios |
| `finance_stats` | `finance_summary`, `finance_monthly`, `project_profitability` |
| `quote_lines_rpc` | `replace_quote_lines` (guardado atómico de líneas) |
| `invoices_and_time` | factura PDF adjunta a cada cobro (`receivables.invoice_file_id`, categoría de archivo `factura`) y fichaje de horas (`time_entries`, `time_summary`) |
| `privacy_options` | opción «los miembros ven todos los clientes»; recordatorios que respetan las preferencias |

Reglas importantes que impone la base de datos:

- Claves foráneas + triggers que impiden referenciar datos de **otra empresa** (cliente, proyecto, responsable…).
- Una empresa siempre conserva al menos un administrador.
- Presupuesto ≠ ingreso: los presupuestos están en su propia tabla. La *facturación registrada* son los `receivables`;
  los *cobros reales* son `payments`. Un pago pertenece a un único cobro, la suma de pagos no puede superar el importe
  (con bloqueo de fila contra pagos concurrentes) y la misma referencia de pago no puede registrarse dos veces.
- Las líneas de un presupuesto aceptado, rechazado o caducado quedan congeladas; la conversión a proyecto es idempotente.
- Las credenciales **no se guardan**: `secret_references` solo apunta al elemento del gestor de contraseñas
  (1Password, Bitwarden…), y el servidor rechaza valores que parecen claves o contraseñas.
- `activity_log` y `notifications` solo los escriben triggers (no se pueden falsificar desde el cliente).

## Roles y permisos

| | Administrador | Miembro |
| --- | --- | --- |
| Ajustes de la empresa, miembros e invitaciones | ✅ | ❌ |
| Proyectos, clientes, tareas, calendario, comentarios y actividad | Todo | Todo: espacio compartido, todos ven y editan lo mismo |
| Finanzas (presupuestos, cobros, gastos, estadísticas) | ✅ | Solo si un administrador le concede «acceso a finanzas» |
| Eliminar proyectos, cobros, pagos, gastos | ✅ | ❌ (los clientes solo con el permiso «eliminar clientes») |
| Documentos | Todos | Todos (los justificantes de gasto solo con acceso a finanzas) |

La búsqueda global, las notificaciones, el historial de actividad y las exportaciones CSV se ejecutan con la sesión del
usuario, así que RLS filtra automáticamente lo que no puede ver.

## Puesta en marcha

### 1. Crear el proyecto de Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com) (región UE recomendada).
2. **Aplica las migraciones** (no necesita Docker):

   ```bash
   npx supabase db push --db-url "postgresql://postgres.<ref>:<CONTRASEÑA>@aws-0-<region>.pooler.supabase.com:5432/postgres"
   ```

   (La cadena está en *Project Settings → Database → Connection string*.) Alternativa: pegar los archivos de
   `supabase/migrations` en orden en el *SQL Editor*.
3. **Recordatorios diarios:** activa la extensión `pg_cron` (*Database → Extensions*) **antes** de aplicar las migraciones
   para que se programe sola; si la activas después, ejecuta:
   `select cron.schedule('velhoura-due-reminders', '0 7 * * *', 'select public.generate_due_reminders()');`
4. **Auth → URL Configuration:** *Site URL* = tu dominio; añade `https://tu-dominio/auth/callback` y
   `http://localhost:3000/auth/callback` a *Redirect URLs*.
5. **Registro cerrado.** Nadie puede crearse una cuenta: la base de datos solo admite correos de la lista `allowed_emails` (un
   trigger en `auth.users`), aunque alguien llame directamente a la API de Supabase. No hay pantalla de registro.

### 2. Variables de entorno

Copia `.env.example` a `.env.local` y rellénalo. En Vercel, añade las mismas variables en *Settings → Environment
Variables*. `SUPABASE_SERVICE_ROLE_KEY` es opcional y **solo de servidor**.

Si faltan las variables de Supabase la app muestra una pantalla «Falta conectar la base de datos» en lugar de fingir que
funciona.

### 3. Desarrollo

```bash
npm install
npm run dev
```

Las cuentas se crean a mano (el registro está cerrado):

```bash
npm run user:create -- ian@empresa.com "Ian" "UnaContraseñaLarga123" admin   # primer administrador (crea la empresa)
npm run user:create -- oriol@empresa.com "Oriol" "OtraContraseña456" member   # miembro (o admin)
```

Necesita `DATABASE_URL` en `.env.local`. El mismo comando sirve para restablecer la contraseña de alguien. Las invitaciones de
**Equipo** solo sirven para unir a la empresa a alguien que ya tiene cuenta.

### 4. Datos de demostración (solo desarrollo)

```bash
ALLOW_DEMO_SEED=true node --env-file=.env.local scripts/seed-demo.mjs tu-correo@ejemplo.com
```

Crea una empresa aparte llamada «[DEMO] Agencia de ejemplo» con datos ficticios. Nunca toca la empresa real y se niega
a ejecutarse en producción.

## Calidad

```bash
npm run typecheck   # tipos
npm run lint        # ESLint
npm test            # Vitest: validaciones, formatos, CSV y pruebas de RLS/permisos contra las migraciones
npm run build       # compilación de producción
npm run check       # todo lo anterior
```

Las pruebas de `tests/db` levantan PostgreSQL en memoria (PGlite) con un *stub* mínimo de Supabase, aplican **las
migraciones reales** y comprueban, entre otras cosas, que un miembro no ve proyectos ajenos ni finanzas, que no puede
ascenderse a administrador, que no se pueden mezclar datos entre empresas, que los pagos parciales no se cuentan dos
veces y que la búsqueda global respeta los permisos.

## Integraciones preparadas (no conectadas)

- **Google Calendar:** la tabla `events` tiene `external_provider` / `external_id` con restricción única para una futura
  sincronización bidireccional sin duplicados. No hay OAuth implementado todavía; la interfaz lo indica.
- **Correo de invitaciones:** funciona con `SUPABASE_SERVICE_ROLE_KEY`; sin ella, la invitación se crea y se comparte el
  enlace manualmente. No se envía ningún correo a clientes de forma automática.
- **PDF de presupuestos:** vista imprimible (`/imprimir/presupuesto/[id]`) para «Guardar como PDF» desde el navegador.
  Es un **presupuesto informativo, no una factura**: la facturación con validez legal (numeración fiscal, Verifactu/
  TicketBAI, etc.) no está implementada.
- **Tipos generados de Supabase:** `npm run db:types` (requiere el CLI autenticado) genera los tipos completos; ahora se
  usan tipos escritos a mano en `src/types/database.ts`.

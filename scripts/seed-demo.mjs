#!/usr/bin/env node
// Demo data for a DEVELOPMENT project only.
//
//   ALLOW_DEMO_SEED=true node --env-file=.env.local scripts/seed-demo.mjs admin@ejemplo.test
//
// Creates a separate company called "[DEMO] Agencia de ejemplo" owned by the
// given (existing) user and fills it with fictitious clients, projects, tasks,
// events, a quote, receivables, payments and expenses. Real companies are never
// touched, and every demo record lives in that demo company only, so deleting
// it (Ajustes is not needed: `delete from companies where name like '[DEMO]%'`)
// removes all of it.

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.argv[2];

function abort(msg) {
  console.error(`✖ ${msg}`);
  process.exit(1);
}

if (process.env.ALLOW_DEMO_SEED !== "true") abort("Define ALLOW_DEMO_SEED=true (solo en un proyecto de desarrollo).");
if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") abort("No se permite en producción.");
if (!url || !serviceKey) abort("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
if (!email) abort("Uso: node scripts/seed-demo.mjs <correo-de-un-usuario-existente>");

const db = createClient(url, serviceKey, { auth: { persistSession: false } });

const must = async (promise, what) => {
  const { data, error } = await promise;
  if (error) abort(`${what}: ${error.message}`);
  return data;
};

const day = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};

const { data: profile } = await db.from("profiles").select("id").eq("email", email.toLowerCase()).maybeSingle();
if (!profile) abort(`No existe ningún usuario con el correo ${email}. Regístrate primero en la app.`);
const uid = profile.id;

const company = await must(
  db.from("companies").insert({ name: "[DEMO] Agencia de ejemplo", created_by: uid }).select("id").single(),
  "empresa",
);
const cid = company.id;
await must(db.from("memberships").insert({ company_id: cid, user_id: uid, role: "admin" }), "membresía");

const clients = await must(
  db
    .from("clients")
    .insert([
      { company_id: cid, name: "Panadería La Espiga (ficticio)", contact_name: "Laura Gómez", email: "laura@ejemplo.test", stage: "ganado", source: "Recomendación", owner_id: uid, created_by: uid, next_action: "Revisar fotos de producto", next_action_date: day(2), estimated_value: 2400 },
      { company_id: cid, name: "Clínica Dental Sonríe (ficticio)", contact_name: "Marcos Ruiz", email: "marcos@ejemplo.test", stage: "propuesta", source: "Web", owner_id: uid, created_by: uid, next_action: "Llamar para resolver dudas del presupuesto", next_action_date: day(-1), estimated_value: 3800 },
      { company_id: cid, name: "Estudio Arquitectura Norte (ficticio)", contact_name: "Ane Etxeberria", email: "ane@ejemplo.test", stage: "negociacion", source: "LinkedIn", owner_id: uid, created_by: uid, estimated_value: 6500 },
      { company_id: cid, name: "Gimnasio Fuerza (ficticio)", stage: "nuevo", source: "Evento", owner_id: uid, created_by: uid },
    ])
    .select("id, name"),
  "clientes",
);

const projects = await must(
  db
    .from("projects")
    .insert([
      { company_id: cid, client_id: clients[0].id, name: "Tienda online La Espiga", type: "web", status: "en_desarrollo", priority: "alta", start_date: day(-20), due_date: day(10), budget: 2400, owner_id: uid, created_by: uid, description: "Tienda con pedidos para recoger en tienda." },
      { company_id: cid, client_id: clients[2].id, name: "Web corporativa Arquitectura Norte", type: "web", status: "planificado", priority: "media", start_date: day(5), due_date: day(45), budget: 6500, owner_id: uid, created_by: uid },
      { company_id: cid, client_id: clients[0].id, name: "Mantenimiento mensual La Espiga", type: "mantenimiento", status: "en_desarrollo", priority: "baja", owner_id: uid, created_by: uid },
    ])
    .select("id, name"),
  "proyectos",
);

const { data: stages } = await db.from("web_stages").select("id, name").eq("company_id", cid).order("position");
await must(
  db.from("web_details").insert([
    { project_id: projects[0].id, web_type: "tienda", stage_id: stages?.[3]?.id, dev_url: "https://espiga-dev.example.com", repository_url: "https://github.com/ejemplo/espiga", domain: "laespiga.example", hosting_provider: "Vercel", requirements: "Catálogo de 40 productos, pago con tarjeta y Bizum, recogida en tienda." },
    { project_id: projects[1].id, web_type: "corporativa", stage_id: stages?.[2]?.id },
  ]),
  "fichas web",
);
await must(
  db.from("web_requests").insert([
    { project_id: projects[0].id, kind: "cambio", title: "Cambiar el color del botón de compra", priority: "media", status: "abierto", created_by: uid },
    { project_id: projects[0].id, kind: "problema", title: "El carrito no guarda la cantidad en móvil", priority: "alta", status: "en_curso", assignee_id: uid, requested_by_client: false, created_by: uid },
  ]),
  "solicitudes",
);

await must(
  db.from("tasks").insert([
    { company_id: cid, project_id: projects[0].id, title: "Maquetar ficha de producto", status: "completada", priority: "alta", assignee_id: uid, created_by: uid, due_date: day(-5) },
    { company_id: cid, project_id: projects[0].id, title: "Integrar pasarela de pago", status: "en_progreso", priority: "urgente", assignee_id: uid, created_by: uid, due_date: day(0), labels: ["backend"] },
    { company_id: cid, project_id: projects[0].id, title: "Textos legales y cookies", status: "pendiente", priority: "media", assignee_id: uid, created_by: uid, due_date: day(-2) },
    { company_id: cid, project_id: projects[1].id, title: "Moodboard y referencias", status: "pendiente", priority: "media", assignee_id: uid, created_by: uid, due_date: day(7), labels: ["diseño"] },
    { company_id: cid, title: "Preparar plantilla de presupuesto", status: "pendiente", priority: "baja", assignee_id: uid, created_by: uid },
  ]),
  "tareas",
);

const at = (offset, hour) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};
await must(
  db.from("events").insert([
    { company_id: cid, title: "Reunión de seguimiento La Espiga", category: "reunion", starts_at: at(1, 10), ends_at: at(1, 11), project_id: projects[0].id, client_id: clients[0].id, created_by: uid },
    { company_id: cid, title: "Llamada comercial Clínica Sonríe", category: "llamada", starts_at: at(2, 16), ends_at: at(2, 17), client_id: clients[1].id, created_by: uid },
    { company_id: cid, title: "Renovación dominio laespiga.example", category: "renovacion", starts_at: `${day(20)}T00:00:00Z`, ends_at: `${day(21)}T00:00:00Z`, all_day: true, created_by: uid },
  ]),
  "eventos",
);

const quote = await must(
  db.from("quotes").insert({ company_id: cid, client_id: clients[1].id, title: "Web y reservas online", status: "enviado", created_by: uid }).select("id").single(),
  "presupuesto",
);
await must(
  db.from("quote_lines").insert([
    { quote_id: quote.id, position: 1, description: "Diseño y desarrollo web (5 secciones)", quantity: 1, unit_price: 2800, tax_pct: 21 },
    { quote_id: quote.id, position: 2, description: "Sistema de reservas", quantity: 1, unit_price: 900, discount_pct: 10, tax_pct: 21 },
    { quote_id: quote.id, position: 3, description: "Hosting y mantenimiento (meses)", quantity: 12, unit_price: 25, tax_pct: 21 },
  ]),
  "líneas",
);

const receivables = await must(
  db
    .from("receivables")
    .insert([
      { company_id: cid, client_id: clients[0].id, project_id: projects[0].id, concept: "50% inicial tienda online", amount: 1200, issue_date: day(-20), due_date: day(-10), created_by: uid },
      { company_id: cid, client_id: clients[0].id, project_id: projects[0].id, concept: "50% a la entrega", amount: 1200, issue_date: day(-1), due_date: day(12), created_by: uid },
      { company_id: cid, client_id: clients[0].id, project_id: projects[2].id, concept: "Mantenimiento (mes anterior)", amount: 90, issue_date: day(-35), due_date: day(-5), created_by: uid },
    ])
    .select("id"),
  "cobros",
);
await must(
  db.from("payments").insert([
    { company_id: cid, receivable_id: receivables[0].id, amount: 1200, paid_at: day(-12), method: "transferencia", reference: "DEMO-TRF-001", created_by: uid },
    { company_id: cid, receivable_id: receivables[2].id, amount: 40, paid_at: day(-3), method: "bizum", reference: "DEMO-BZM-001", created_by: uid },
  ]),
  "pagos",
);

const { data: cats } = await db.from("expense_categories").select("id, name").eq("company_id", cid);
const cat = (n) => cats?.find((c) => c.name.startsWith(n))?.id ?? null;
await must(
  db.from("expenses").insert([
    { company_id: cid, concept: "Licencia de diseño (mensual)", category_id: cat("Software"), amount: 12.4, tax_amount: 2.6, expense_date: day(-8), supplier: "Proveedor de ejemplo", created_by: uid },
    { company_id: cid, concept: "Dominio laespiga.example", category_id: cat("Hosting"), amount: 9.9, tax_amount: 2.08, expense_date: day(-18), project_id: projects[0].id, created_by: uid },
    { company_id: cid, concept: "Campaña de anuncios", category_id: cat("Publicidad"), amount: 60, tax_amount: 12.6, expense_date: day(-25), created_by: uid },
  ]),
  "gastos",
);

await db.from("profiles").update({ active_company_id: cid }).eq("id", uid);
console.log(`✔ Empresa de demostración creada (${cid}). Cambia de empresa desde la barra lateral para volver a la real.`);

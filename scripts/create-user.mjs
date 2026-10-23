#!/usr/bin/env node
// Create (or reset the password of) an account. Registration is closed, so this
// is the only way to give someone access.
//
//   npm run user:create -- ian@velhoura.com "Ian Monfil" "ContraseñaSegura123" [admin|member] ["Nombre de empresa"]
//
// Needs DATABASE_URL in .env.local (Supabase → Connect → Session pooler). With
// role `member` (default) the person is added to the first company; `admin`
// as the first user creates the company if none exists.

import pg from "pg";

const [email, fullName, password, role = "member", companyName = "Velhoura"] = process.argv.slice(2);
const url = process.env.DATABASE_URL;

const abort = (m) => {
  console.error(`✖ ${m}`);
  process.exit(1);
};
if (!url) abort("Falta DATABASE_URL (añádela a .env.local y ejecuta con node --env-file=.env.local).");
if (!email || !fullName || !password) abort('Uso: npm run user:create -- <correo> "<Nombre>" <contraseña> [admin|member]');
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) abort("Correo no válido.");
if (password.length < 10) abort("La contraseña debe tener al menos 10 caracteres.");
if (!["admin", "member"].includes(role)) abort("El rol debe ser admin o member.");

const db = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await db.connect();
try {
  await db.query("begin");
  const e = email.toLowerCase();
  await db.query("insert into public.allowed_emails (email, note) values ($1, $2) on conflict do nothing", [e, fullName]);

  const existing = await db.query("select id from auth.users where email = $1", [e]);
  let userId;
  if (existing.rows.length) {
    userId = existing.rows[0].id;
    await db.query("update auth.users set encrypted_password = extensions.crypt($2, extensions.gen_salt('bf')), updated_at = now() where id = $1", [userId, password]);
    console.log("• La cuenta ya existía: contraseña actualizada.");
  } else {
    const res = await db.query(
      `with nu as (
         insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
           created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change, email_change_token_current,
           reauthentication_token, phone_change, phone_change_token)
         values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', $1::text,
           extensions.crypt($2::text, extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}',
           jsonb_build_object('full_name', $3::text), now(), now(), '', '', '', '', '', '', '', '')
         returning id, email)
       , ident as (
         insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
         select gen_random_uuid(), id, id::text, 'email', jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true), now(), now(), now() from nu)
       select id from nu`,
      [e, password, fullName],
    );
    userId = res.rows[0].id;
    console.log("• Cuenta creada.");
  }

  let company = (await db.query("select id, name from public.companies order by created_at limit 1")).rows[0];
  if (!company) {
    if (role !== "admin") throw new Error("Todavía no existe ninguna empresa: crea primero un administrador.");
    company = (await db.query("insert into public.companies (name, created_by) values ($1, $2) returning id, name", [companyName, userId])).rows[0];
    console.log(`• Empresa «${company.name}» creada.`);
  }
  await db.query(
    "insert into public.memberships (company_id, user_id, role) values ($1, $2, $3) on conflict (company_id, user_id) do update set role = excluded.role",
    [company.id, userId, role],
  );
  await db.query("update public.profiles set full_name = $2, active_company_id = $3 where id = $1", [userId, fullName, company.id]);
  await db.query("commit");
  console.log(`✔ ${e} puede entrar en «${company.name}» como ${role === "admin" ? "administrador" : "miembro"}.`);
} catch (err) {
  await db.query("rollback").catch(() => {});
  abort(err.message);
} finally {
  await db.end();
}

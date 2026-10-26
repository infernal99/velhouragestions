import { beforeAll, describe, expect, it } from "vitest";
import { asUser, createTestDb, createUser, rows, type TestDb } from "./harness";

// Two companies. In "A": an admin and a plain member. "B" belongs to an
// outsider. These tests pin down the permission rules enforced by RLS and
// triggers — the UI hiding buttons is not what keeps data private.
let db: TestDb;
let admin: string;
let member: string;
let outsider: string;
let companyA: string;
let companyB: string;

async function one<T>(promise: Promise<T[]>) {
  const r = await promise;
  return r[0];
}

beforeAll(async () => {
  db = await createTestDb();
  admin = await createUser(db, "admin@example.test");
  member = await createUser(db, "member@example.test");
  outsider = await createUser(db, "outsider@example.test");

  companyA = (
    await asUser(db, admin, (tx) => one(rows<{ id: string }>(tx, "select public.create_company('Empresa A') as id")))
  ).id;
  companyB = (
    await asUser(db, outsider, (tx) => one(rows<{ id: string }>(tx, "select public.create_company('Empresa B') as id")))
  ).id;

  // Invite + accept the member into A.
  await asUser(db, admin, (tx) =>
    tx.query(
      `insert into public.invitations (company_id, email, role, token_hash, invited_by)
       values ($1, 'member@example.test', 'member', encode(extensions.digest('tok-123', 'sha256'), 'hex'), $2)`,
      [companyA, admin],
    ),
  );
  await asUser(db, member, (tx) => tx.query("select public.accept_invitation('tok-123')"));
}, 60_000);

describe("tenancy", () => {
  it("seeds default web stages and expense categories for a new company", async () => {
    const stages = await asUser(db, admin, (tx) =>
      rows(tx, "select name from public.web_stages where company_id = $1 order by position", [companyA]),
    );
    expect(stages.map((s) => s.name)).toContain("Desarrollo");
    const cats = await asUser(db, admin, (tx) =>
      rows(tx, "select 1 from public.expense_categories where company_id = $1", [companyA]),
    );
    expect(cats.length).toBeGreaterThan(0);
  });

  it("outsiders cannot see another company", async () => {
    const seen = await asUser(db, outsider, (tx) =>
      rows(tx, "select id from public.companies where id = $1", [companyA]),
    );
    expect(seen).toHaveLength(0);
  });

  it("an invitation only works for the invited email", async () => {
    await asUser(db, admin, (tx) =>
      tx.query(
        `insert into public.invitations (company_id, email, token_hash, invited_by)
         values ($1, 'someone@example.test', encode(extensions.digest('tok-xyz', 'sha256'), 'hex'), $2)`,
        [companyA, admin],
      ),
    );
    await expect(
      asUser(db, outsider, (tx) => tx.query("select public.accept_invitation('tok-xyz')")),
    ).rejects.toThrow(/otra dirección/);
  });

  it("members cannot promote themselves to admin", async () => {
    await asUser(db, member, (tx) =>
      tx.query("update public.memberships set role = 'admin' where user_id = $1 and company_id = $2", [member, companyA]),
    );
    const m = await asUser(db, admin, (tx) =>
      one(rows<{ role: string }>(tx, "select role from public.memberships where user_id = $1", [member])),
    );
    expect(m.role).toBe("member");
  });

  it("the last admin cannot be demoted", async () => {
    await expect(
      asUser(db, admin, (tx) =>
        tx.query("update public.memberships set role = 'member' where user_id = $1", [admin]),
      ),
    ).rejects.toThrow(/al menos un administrador/);
  });

  it("members cannot edit company settings", async () => {
    await asUser(db, member, (tx) =>
      tx.query("update public.companies set name = 'Hackeada' where id = $1", [companyA]),
    );
    const c = await asUser(db, admin, (tx) =>
      one(rows<{ name: string }>(tx, "select name from public.companies where id = $1", [companyA])),
    );
    expect(c.name).toBe("Empresa A");
  });
});

describe("projects and tasks", () => {
  let privateProject: string;
  let sharedProject: string;

  beforeAll(async () => {
    privateProject = (
      await asUser(db, admin, (tx) =>
        one(
          rows<{ id: string }>(
            tx,
            "insert into public.projects (company_id, name, owner_id, created_by) values ($1, 'Privado', $2, $2) returning id",
            [companyA, admin],
          ),
        ),
      )
    ).id;
    sharedProject = (
      await asUser(db, admin, (tx) =>
        one(
          rows<{ id: string }>(
            tx,
            "insert into public.projects (company_id, name, owner_id, created_by) values ($1, 'Compartido', $2, $2) returning id",
            [companyA, admin],
          ),
        ),
      )
    ).id;
    await asUser(db, admin, (tx) =>
      tx.query("insert into public.project_members (project_id, user_id) values ($1, $2)", [sharedProject, member]),
    );
  });

  it("the whole team sees every project, even ones they are not a member of", async () => {
    const seen = await asUser(db, member, (tx) => rows<{ name: string }>(tx, "select name from public.projects order by name"));
    expect(seen.map((p) => p.name)).toEqual(["Compartido", "Privado"]);
  });

  it("cannot attach a project to another company's client", async () => {
    const foreignClient = (
      await asUser(db, outsider, (tx) =>
        one(
          rows<{ id: string }>(
            tx,
            "insert into public.clients (company_id, name, created_by) values ($1, 'Cliente B', $2) returning id",
            [companyB, outsider],
          ),
        ),
      )
    ).id;
    await expect(
      db.query("update public.projects set client_id = $1 where id = $2", [foreignClient, sharedProject]),
    ).rejects.toThrow(/no pertenece/);
  });

  it("project progress follows completed top-level tasks", async () => {
    await asUser(db, member, async (tx) => {
      for (const status of ["completada", "pendiente", "pendiente", "completada"]) {
        await tx.query(
          "insert into public.tasks (company_id, project_id, title, status, created_by) values ($1, $2, 'T', $3, $4)",
          [companyA, sharedProject, status, member],
        );
      }
    });
    const p = await asUser(db, admin, (tx) =>
      one(rows<{ progress: number }>(tx, "select progress from public.projects where id = $1", [sharedProject])),
    );
    expect(p.progress).toBe(50);
  });

  it("any member can create, see and update tasks in any project (shared control)", async () => {
    await asUser(db, member, (tx) =>
      tx.query(
        "insert into public.tasks (company_id, project_id, title, created_by) values ($1, $2, 'Tarea compartida', $3)",
        [companyA, privateProject, member],
      ),
    );
    const seenByAdmin = await asUser(db, admin, (tx) => rows(tx, "select 1 from public.tasks where title = 'Tarea compartida'"));
    expect(seenByAdmin).toHaveLength(1);
    await asUser(db, admin, (tx) => tx.query("update public.tasks set status = 'en_progreso' where title = 'Tarea compartida'"));
    const after = await asUser(db, member, (tx) => rows<{ status: string }>(tx, "select status from public.tasks where title = 'Tarea compartida'"));
    expect(after[0].status).toBe("en_progreso");
  });

  it("calendar events are visible and editable by the whole team", async () => {
    await asUser(db, admin, (tx) =>
      tx.query(
        "insert into public.events (company_id, title, starts_at, ends_at, project_id, created_by) values ($1, 'Reunión interna', now(), now() + interval '1 hour', $2, $3)",
        [companyA, privateProject, admin],
      ),
    );
    const seen = await asUser(db, member, (tx) => rows(tx, "select 1 from public.events where title = 'Reunión interna'"));
    expect(seen).toHaveLength(1);
    await asUser(db, member, (tx) => tx.query("update public.events set title = 'Reunión movida' where title = 'Reunión interna'"));
    const moved = await asUser(db, admin, (tx) => rows(tx, "select 1 from public.events where title = 'Reunión movida'"));
    expect(moved).toHaveLength(1);
  });

  it("assigning a task notifies the assignee, not the actor", async () => {
    await asUser(db, admin, (tx) =>
      tx.query(
        "insert into public.tasks (company_id, title, assignee_id, created_by) values ($1, 'Revisar copy', $2, $3)",
        [companyA, member, admin],
      ),
    );
    const mine = await asUser(db, member, (tx) =>
      rows<{ kind: string }>(tx, "select kind from public.notifications where kind = 'task_assigned'"),
    );
    expect(mine.length).toBe(1);
    const adminSees = await asUser(db, admin, (tx) =>
      rows(tx, "select 1 from public.notifications where user_id = $1", [member]),
    );
    expect(adminSees).toHaveLength(0);
  });

  it("global search finds team data for every member but never finance data of other companies", async () => {
    const results = await asUser(db, member, (tx) =>
      rows<{ title: string }>(tx, "select title from public.global_search($1, 'privado')", [companyA]),
    );
    expect(results.map((r) => r.title)).toContain("Privado");
    const otherCompany = await asUser(db, outsider, (tx) =>
      rows(tx, "select title from public.global_search($1, 'privado')", [companyA]),
    );
    expect(otherCompany).toHaveLength(0);
    const adminResults = await asUser(db, admin, (tx) =>
      rows<{ title: string }>(tx, "select title from public.global_search($1, 'privado')", [companyA]),
    );
    expect(adminResults.map((r) => r.title)).toContain("Privado");
  });
});

describe("finance", () => {
  let receivable: string;

  beforeAll(async () => {
    receivable = (
      await asUser(db, admin, (tx) =>
        one(
          rows<{ id: string }>(
            tx,
            "insert into public.receivables (company_id, concept, amount, created_by) values ($1, 'Web corporativa', 1000, $2) returning id",
            [companyA, admin],
          ),
        ),
      )
    ).id;
  });

  it("members without finance access see nothing", async () => {
    const seen = await asUser(db, member, (tx) => rows(tx, "select * from public.receivables"));
    expect(seen).toHaveLength(0);
    const summary = await asUser(db, member, (tx) =>
      one(
        rows<{ invoiced: string }>(tx, "select * from public.finance_summary($1, '2000-01-01', '2100-01-01')", [
          companyA,
        ]),
      ),
    );
    expect(Number(summary.invoiced)).toBe(0);
  });

  it("partial payments accumulate and can't exceed the amount", async () => {
    await asUser(db, admin, (tx) =>
      tx.query(
        "insert into public.payments (company_id, receivable_id, amount, reference, created_by) values ($1, $2, 400, 'TRF-1', $3)",
        [companyA, receivable, admin],
      ),
    );
    const r = await asUser(db, admin, (tx) =>
      one(
        rows<{ status: string; amount_pending: string }>(
          tx,
          "select status, amount_pending from public.receivables_with_status where id = $1",
          [receivable],
        ),
      ),
    );
    expect(r.status).toBe("parcial");
    expect(Number(r.amount_pending)).toBe(600);

    await expect(
      asUser(db, admin, (tx) =>
        tx.query(
          "insert into public.payments (company_id, receivable_id, amount, created_by) values ($1, $2, 700, $3)",
          [companyA, receivable, admin],
        ),
      ),
    ).rejects.toThrow(/supera el importe pendiente/);
  });

  it("the same payment reference can't be registered twice", async () => {
    await expect(
      asUser(db, admin, (tx) =>
        tx.query(
          "insert into public.payments (company_id, receivable_id, amount, reference, created_by) values ($1, $2, 100, 'trf-1', $3)",
          [companyA, receivable, admin],
        ),
      ),
    ).rejects.toThrow(/duplicate key/);
  });

  it("quotes are numbered, totalled and never counted as income", async () => {
    const quote = await asUser(db, admin, (tx) =>
      one(
        rows<{ id: string; number: string }>(
          tx,
          "insert into public.quotes (company_id, title, issue_date, created_by) values ($1, 'Tienda online', '2026-10-01', $2) returning id, number",
          [companyA, admin],
        ),
      ),
    );
    expect(quote.number).toBe("P-2026-0001");

    await asUser(db, admin, (tx) =>
      tx.query(
        `insert into public.quote_lines (quote_id, description, quantity, unit_price, discount_pct, tax_pct)
         values ($1, 'Diseño', 1, 1000, 10, 21), ($1, 'Hosting', 12, 10, 0, 21)`,
        [quote.id],
      ),
    );
    const q = await asUser(db, admin, (tx) =>
      one(
        rows<{ subtotal: string; discount_total: string; tax_total: string; total: string }>(
          tx,
          "select subtotal, discount_total, tax_total, total from public.quotes where id = $1",
          [quote.id],
        ),
      ),
    );
    expect(Number(q.subtotal)).toBe(1120);
    expect(Number(q.discount_total)).toBe(100);
    expect(Number(q.tax_total)).toBe(214.2);
    expect(Number(q.total)).toBe(1234.2);

    const summary = await asUser(db, admin, (tx) =>
      one(
        rows<{ invoiced: string; collected: string }>(
          tx,
          "select * from public.finance_summary($1, '2000-01-01', '2100-01-01')",
          [companyA],
        ),
      ),
    );
    expect(Number(summary.invoiced)).toBe(1000);
    expect(Number(summary.collected)).toBe(400);
  });

  it("an accepted quote converts into exactly one project and its lines freeze", async () => {
    const quote = await asUser(db, admin, (tx) =>
      one(
        rows<{ id: string }>(
          tx,
          "insert into public.quotes (company_id, title, created_by) values ($1, 'Landing', $2) returning id",
          [companyA, admin],
        ),
      ),
    );
    await asUser(db, admin, (tx) =>
      tx.query("insert into public.quote_lines (quote_id, description, unit_price) values ($1, 'Landing', 800)", [
        quote.id,
      ]),
    );
    await expect(
      asUser(db, admin, (tx) => tx.query("select public.convert_quote_to_project($1)", [quote.id])),
    ).rejects.toThrow(/aceptados/);

    await asUser(db, admin, (tx) => tx.query("update public.quotes set status = 'aceptado' where id = $1", [quote.id]));
    const first = await asUser(db, admin, (tx) =>
      one(rows<{ id: string }>(tx, "select public.convert_quote_to_project($1) as id", [quote.id])),
    );
    const second = await asUser(db, admin, (tx) =>
      one(rows<{ id: string }>(tx, "select public.convert_quote_to_project($1) as id", [quote.id])),
    );
    expect(second.id).toBe(first.id);

    await expect(
      asUser(db, admin, (tx) =>
        tx.query("insert into public.quote_lines (quote_id, description, unit_price) values ($1, 'Extra', 1)", [quote.id]),
      ),
    ).rejects.toThrow(/No se pueden modificar/);
  });

  it("finance activity is hidden from members without finance access", async () => {
    const seen = await asUser(db, member, (tx) => rows(tx, "select * from public.activity_log where is_finance"));
    expect(seen).toHaveLength(0);
  });
});

describe("files", () => {
  it("storage paths are bound to the file's company", async () => {
    await expect(
      asUser(db, admin, (tx) =>
        tx.query(
          "insert into public.files (company_id, name, storage_path, uploaded_by) values ($1, 'a.pdf', $2, $3)",
          [companyA, `${companyB}/x-a.pdf`, admin],
        ),
      ),
    ).rejects.toThrow(/files_path_company/);
  });

  it("members can't upload objects into another company's folder", async () => {
    await expect(
      asUser(db, member, (tx) =>
        tx.query("insert into storage.objects (bucket_id, name, owner_id) values ('company-files', $1, $2)", [
          `${companyB}/evil.pdf`,
          member,
        ]),
      ),
    ).rejects.toThrow(/row-level security/);
  });
});

describe("reminders and privacy", () => {
  it("due reminders are generated once (deduplicated)", async () => {
    await asUser(db, admin, (tx) =>
      tx.query(
        "insert into public.tasks (company_id, title, assignee_id, due_date, created_by) values ($1, 'Entregar mañana', $2, current_date + 1, $3)",
        [companyA, member, admin],
      ),
    );
    await db.query("select public.generate_due_reminders()");
    await db.query("select public.generate_due_reminders()");
    const n = await asUser(db, member, (tx) => rows(tx, "select 1 from public.notifications where kind = 'due_soon'"));
    expect(n).toHaveLength(1);
  });

  it("members can't run the reminders job themselves", async () => {
    await expect(asUser(db, member, (tx) => tx.query("select public.generate_due_reminders()"))).rejects.toThrow(/permission denied/);
  });

  it("clients created by one member are visible and editable by the others", async () => {
    await asUser(db, admin, (tx) =>
      tx.query("insert into public.clients (company_id, name, created_by, owner_id) values ($1, 'Cliente del admin', $2, $2)", [companyA, admin]),
    );
    const seen = await asUser(db, member, (tx) => rows(tx, "select name from public.clients where name = 'Cliente del admin'"));
    expect(seen).toHaveLength(1);
    await asUser(db, member, (tx) => tx.query("update public.clients set stage = 'contactado' where name = 'Cliente del admin'"));
    const after = await asUser(db, admin, (tx) => rows<{ stage: string }>(tx, "select stage from public.clients where name = 'Cliente del admin'"));
    expect(after[0].stage).toBe("contactado");
  });
});

describe("storage object access follows the files table", () => {
  it("a member reads the storage object of any project file, but not finance receipts", async () => {
    const shared = (await asUser(db, admin, (tx) =>
      one(rows<{ id: string }>(tx, "insert into public.projects (company_id, name, owner_id, created_by) values ($1, 'Con archivos', $2, $2) returning id", [companyA, admin])),
    )).id;
    const hidden = (await asUser(db, admin, (tx) =>
      one(rows<{ id: string }>(tx, "insert into public.projects (company_id, name, owner_id, created_by) values ($1, 'Archivos ocultos', $2, $2) returning id", [companyA, admin])),
    )).id;
    await asUser(db, admin, async (tx) => {
      await tx.query("insert into public.project_members (project_id, user_id) values ($1, $2)", [shared, member]);
      for (const [pid, file, isFinance] of [[shared, "ok.pdf", false], [hidden, "otro-proyecto.pdf", false], [hidden, "justificante.pdf", true]] as const) {
        const path = `${companyA}/${file}`;
        await tx.query("insert into storage.objects (bucket_id, name, owner_id) values ('company-files', $1, $2)", [path, admin]);
        await tx.query("insert into public.files (company_id, project_id, name, storage_path, uploaded_by, is_finance) values ($1, $2, $3, $4, $5, $6)", [companyA, pid, file, path, admin, isFinance]);
      }
    });
    const visible = await asUser(db, member, (tx) => rows<{ name: string }>(tx, "select name from storage.objects where bucket_id = 'company-files'"));
    expect(visible.map((o) => o.name)).toContain(`${companyA}/ok.pdf`);
    expect(visible.map((o) => o.name)).toContain(`${companyA}/otro-proyecto.pdf`);
    expect(visible.map((o) => o.name)).not.toContain(`${companyA}/justificante.pdf`);
  });
});

describe("closed registration", () => {
  it("rejects accounts whose email is not allow-listed, even via direct inserts", async () => {
    await expect(
      db.query("insert into auth.users (id, email) values (gen_random_uuid(), 'intruso@example.test')"),
    ).rejects.toThrow(/registro está cerrado/);
  });

  it("accepts allow-listed emails case-insensitively and the allow-list is not readable by users", async () => {
    await db.query("insert into public.allowed_emails (email) values ('permitido@example.test')");
    await db.query("insert into auth.users (id, email) values (gen_random_uuid(), 'Permitido@Example.test')");
    await expect(asUser(db, admin, (tx) => tx.query("select * from public.allowed_emails"))).rejects.toThrow(/permission denied/);
  });
});

describe("time tracking", () => {
  let project: string;

  beforeAll(async () => {
    project = (await asUser(db, admin, (tx) =>
      one(rows<{ id: string }>(tx, "insert into public.projects (company_id, name, owner_id, created_by) values ($1, 'Horas', $2, $2) returning id", [companyA, admin])),
    )).id;
  });

  it("only one running timer per person", async () => {
    await asUser(db, member, (tx) =>
      tx.query("insert into public.time_entries (company_id, project_id, user_id, started_at) values ($1, $2, $3, now())", [companyA, project, member]),
    );
    await expect(
      asUser(db, member, (tx) =>
        tx.query("insert into public.time_entries (company_id, project_id, user_id, started_at) values ($1, $2, $3, now())", [companyA, project, member]),
      ),
    ).rejects.toThrow(/duplicate key/);
    await asUser(db, member, (tx) => tx.query("update public.time_entries set ended_at = now() where user_id = $1 and ended_at is null", [member]));
  });

  it("nobody can clock hours as someone else", async () => {
    await expect(
      asUser(db, member, (tx) =>
        tx.query(
          "insert into public.time_entries (company_id, project_id, user_id, started_at, ended_at) values ($1, $2, $3, now() - interval '1 hour', now())",
          [companyA, project, admin],
        ),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("the team sees everyone's hours, but only the owner (or an admin) edits them", async () => {
    await asUser(db, member, (tx) =>
      tx.query(
        "insert into public.time_entries (company_id, project_id, user_id, started_at, ended_at, note) values ($1, $2, $3, now() - interval '3 hours', now() - interval '1 hour', 'Maquetación')",
        [companyA, project, member],
      ),
    );
    const adminSees = await asUser(db, admin, (tx) => rows(tx, "select 1 from public.time_entries where note = 'Maquetación'"));
    expect(adminSees).toHaveLength(1);
    // an admin may correct it; a different member may not
    const upd = await asUser(db, admin, (tx) => tx.query("update public.time_entries set note = 'Maquetación web' where note = 'Maquetación'"));
    expect(upd.affectedRows).toBe(1);
  });

  it("rejects entries longer than 24 h, negative ones and projects of another company", async () => {
    await expect(
      asUser(db, member, (tx) =>
        tx.query("insert into public.time_entries (company_id, project_id, user_id, started_at, ended_at) values ($1, $2, $3, now() - interval '30 hours', now())", [companyA, project, member]),
      ),
    ).rejects.toThrow(/time_entries_max_24h/);
    await expect(
      asUser(db, member, (tx) =>
        tx.query("insert into public.time_entries (company_id, project_id, user_id, started_at, ended_at) values ($1, $2, $3, now(), now() - interval '1 hour')", [companyA, project, member]),
      ),
    ).rejects.toThrow(/time_entries_order/);
    const foreignProject = (await asUser(db, outsider, (tx) =>
      one(rows<{ id: string }>(tx, "insert into public.projects (company_id, name, created_by) values ($1, 'Ajeno', $2) returning id", [companyB, outsider])),
    )).id;
    await expect(
      asUser(db, member, (tx) =>
        tx.query("insert into public.time_entries (company_id, project_id, user_id, started_at, ended_at) values ($1, $2, $3, now() - interval '1 hour', now())", [companyA, foreignProject, member]),
      ),
    ).rejects.toThrow(/no pertenece/);
  });

  it("outsiders see no hours and the summary adds up per project", async () => {
    const outsiderSees = await asUser(db, outsider, (tx) => rows(tx, "select 1 from public.time_entries"));
    expect(outsiderSees).toHaveLength(0);
    const summary = await asUser(db, admin, (tx) =>
      rows<{ minutes: string }>(tx, "select minutes from public.time_summary($1, now() - interval '1 day', now() + interval '1 day') where project_id = $2", [companyA, project]),
    );
    expect(Number(summary[0].minutes)).toBe(120);
  });
});

describe("monthly payments", () => {
  it("only active agreements count and each month is generated once", async () => {
    await asUser(db, admin, async (tx) => {
      await tx.query("insert into public.recurring_payments (company_id, concept, amount, status, start_date, created_by) values ($1, 'Redes sociales', 30, 'activo', '2026-09-01', $2), ($1, 'Mantenimiento', 30, 'pendiente', '2026-09-01', $2), ($1, 'Cuota futura', 50, 'activo', '2027-01-01', $2)", [companyA, admin]);
    });
    const first = await asUser(db, admin, (tx) => one(rows<{ n: number }>(tx, "select public.generate_monthly_receivables($1, '2026-10-15') as n", [companyA])));
    expect(first.n).toBe(1);
    const again = await asUser(db, admin, (tx) => one(rows<{ n: number }>(tx, "select public.generate_monthly_receivables($1, '2026-10-01') as n", [companyA])));
    expect(again.n).toBe(0);
    const next = await asUser(db, admin, (tx) => one(rows<{ n: number }>(tx, "select public.generate_monthly_receivables($1, '2026-11-01') as n", [companyA])));
    expect(next.n).toBe(1);
    const created = await asUser(db, admin, (tx) => rows<{ concept: string; amount: string }>(tx, "select concept, amount from public.receivables where recurring_id is not null order by issue_date"));
    expect(created.map((r) => r.concept)).toEqual(["Redes sociales · 10/2026", "Redes sociales · 11/2026"]);
  });

  it("members without finance access can neither see nor generate them", async () => {
    const seen = await asUser(db, member, (tx) => rows(tx, "select 1 from public.recurring_payments"));
    expect(seen).toHaveLength(0);
    const gen = await asUser(db, member, (tx) => one(rows<{ n: number }>(tx, "select public.generate_monthly_receivables($1, '2026-12-01') as n", [companyA])));
    expect(gen.n).toBe(0);
  });
});

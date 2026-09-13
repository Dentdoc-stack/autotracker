import "server-only";
import { PGlite } from "@electric-sql/pglite";
import { mkdir, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { addDays, pakistanDate, type Workspace } from "./domain";

const OWNER = "00000000-0000-4000-8000-000000000001";
const globals = globalThis as unknown as {
  officeDb?: Promise<PGlite>;
  officeQueue?: Promise<unknown>;
};
export function isLocalPreview() {
  return (
    process.env.APP_MODE === "demo" &&
    process.env.APP_ENV === "local" &&
    !process.env.VERCEL
  );
}
async function initialise() {
  await mkdir(path.join(process.cwd(), ".local"), { recursive: true });
  const db = new PGlite(path.join(process.cwd(), ".local", "postgres"));
  const exists = await db.query<{ present: string | null }>(
    "select to_regclass('public.memberships')::text as present",
  );
  if (!exists.rows[0].present) {
    await db.exec(
      `create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`,
    );
    await db.exec(
      await readFile(
        path.join(process.cwd(), "supabase/migrations/202609120001_core.sql"),
        "utf8",
      ),
    );
    await db.exec(
      `insert into auth.users values('${OWNER}'); insert into public.memberships values('${OWNER}','Local preview','owner',true);`,
    );
    await db.exec(
      `select set_config('request.jwt.claim.sub','${OWNER}',false); set role authenticated;`,
    );
    const command = async (action: string, p: Record<string, unknown>) =>
      (
        await db.query<{ result: Record<string, unknown> }>(
          "select apply_command($1,$2::jsonb) result",
          [action, JSON.stringify(p)],
        )
      ).rows[0].result;
    const today = pakistanDate(),
      tomorrow = addDays(today, 1);
    const names = [
      "Establishment",
      "Planning & Development",
      "Local Government",
      "Finance",
    ];
    const deps = [];
    for (const name of names)
      deps.push(await command("save_department", { name }));
    const samples = [
      [
        "Review the draft service policy",
        "Consolidate the proposed policy improvements and submit an update.",
        "Policy focal person",
        0,
        tomorrow,
      ],
      [
        "Prepare the departmental progress brief",
        "Prepare a concise summary of progress, constraints and next steps.",
        "Review team",
        1,
        addDays(today, 4),
      ],
      [
        "Follow up on district implementation",
        "Review implementation progress and identify outstanding actions.",
        "Department coordinator",
        2,
        addDays(today, 8),
      ],
    ];
    for (const [i, row] of samples.entries()) {
      const task = await command("save_task", {
        title: row[0],
        instruction: row[1],
        responsible: row[2],
        department_id: deps[Number(row[3])].id,
        instruction_date: today,
        deadline: row[4],
        deadline_kind: i === 0 ? "update" : "completion",
        source: "Synthetic preview record",
      });
      if (i < 2)
        await command("save_meeting", {
          task_id: task.id,
          title: i === 0 ? "Policy progress review" : "Department follow-up",
          type: "review",
          requested_date: i === 0 ? tomorrow : addDays(today, 4),
        });
    }
    const c = await command("save_contact", {
      name: "Office recipient (sample)",
      phone: "+19995550101",
      designation: "Preview only",
      consent_note: "Synthetic test contact — not a real recipient",
      enabled: true,
    });
    await command("save_subscription", { contact_id: c.id, scope: "office" });
    await db.exec("reset role");
  }
  await db.exec("reset role");
  const reminders = await db.query<{ present: string | null }>(
    "select to_regclass('public.daily_runs')::text as present",
  );
  if (!reminders.rows[0].present)
    await db.exec(
      await readFile(
        path.join(
          process.cwd(),
          "supabase/migrations/202609130001_reminders.sql",
        ),
        "utf8",
      ),
    );
  await db.exec(
    "create table if not exists public.local_migration_history(name text primary key)",
  );
  const later = (await readdir(path.join(process.cwd(), "supabase/migrations")))
    .filter((name) => name > "202609130001_reminders.sql")
    .sort();
  for (const name of later) {
    const applied = await db.query(
      "select name from public.local_migration_history where name=$1",
      [name],
    );
    if (!applied.rows.length)
      await db.transaction(async (tx) => {
        await tx.exec(
          await readFile(
            path.join(process.cwd(), "supabase/migrations", name),
            "utf8",
          ),
        );
        await tx.query(
          "insert into public.local_migration_history values($1)",
          [name],
        );
      });
  }
  return db;
}
export async function withLocalDatabase<T>(
  fn: (db: PGlite) => Promise<T>,
): Promise<T> {
  if (!isLocalPreview()) throw new Error("Local preview is disabled");
  globals.officeDb ??= initialise();
  const run = (globals.officeQueue ?? Promise.resolve())
    .catch(() => {})
    .then(async () => {
      const db = await globals.officeDb!;
      await db.exec(
        `reset role; select set_config('request.jwt.claim.sub','${OWNER}',false); set role authenticated;`,
      );
      try {
        return await fn(db);
      } finally {
        await db.exec("reset role");
      }
    });
  globals.officeQueue = run.catch(() => {});
  return run;
}
export async function localWorkspace() {
  return withLocalDatabase(async (db) => {
    const r = await db.query<{ data: Workspace }>(
      "select get_workspace() as data",
    );
    return {
      ...r.rows[0].data,
      mode: "demo" as const,
      settings: { messaging_mode: "mock", automatic_enabled: false },
    };
  });
}
export async function localCommand(action: string, p: Record<string, unknown>) {
  return withLocalDatabase(
    async (db) =>
      (
        await db.query("select apply_command($1,$2::jsonb) as result", [
          action,
          JSON.stringify(p),
        ])
      ).rows[0],
  );
}

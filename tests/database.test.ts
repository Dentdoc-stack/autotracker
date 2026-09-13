import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

let db: PGlite;
const owner = "00000000-0000-4000-8000-000000000001",
  editor = "00000000-0000-4000-8000-000000000002",
  viewer = "00000000-0000-4000-8000-000000000003";
async function asUser(id: string) {
  await db.exec(
    `reset role; select set_config('request.jwt.claim.sub','${id}',false); set role authenticated;`,
  );
}
async function command(action: string, payload: Record<string, unknown>) {
  return db.query<{ result: Record<string, unknown> }>(
    "select public.apply_command($1,$2::jsonb) as result",
    [action, JSON.stringify(payload)],
  );
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`,
  );
  await db.exec(
    readFileSync("supabase/migrations/202609120001_core.sql", "utf8"),
  );
  await db.exec(
    readFileSync("supabase/migrations/202609130001_reminders.sql", "utf8"),
  );
  await db.exec(
    readFileSync("supabase/migrations/202609130002_callbacks.sql", "utf8"),
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/202609130003_occurrence_dedup.sql",
      "utf8",
    ),
  );
  await db.exec(
    readFileSync("supabase/migrations/202609130004_admin.sql", "utf8"),
  );
  await db.exec(
    readFileSync("supabase/migrations/202609130005_consent.sql", "utf8"),
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/202609130006_twilio_message_sid.sql",
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/202609130007_richer_reminder_details.sql",
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/202609130008_resend_reminders.sql",
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/202609130009_resend_any_status.sql",
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/202609130010_manual_limit_switch.sql",
      "utf8",
    ),
  );
  await db.exec(
    `insert into auth.users values ('${owner}'),('${editor}'),('${viewer}'); insert into public.memberships(id,name,role) values ('${owner}','Owner','owner'),('${editor}','Editor','editor'),('${viewer}','Viewer','viewer');`,
  );
}, 60000);
afterAll(async () => {
  await db?.close();
});
describe.sequential("database enforced office workflow", () => {
  let department: string, task: string;
  it("calculates weekend meetings in Postgres", async () => {
    const result = await db.query<{ date: string }>(
      "select public.meeting_effective_date('2026-09-26')::text as date",
    );
    expect(result.rows[0].date).toBe("2026-09-28");
  });
  it("owner creates department; editor atomically creates task and initial meeting", async () => {
    await asUser(owner);
    const dep = await command("save_department", { name: "Establishment" });
    department = dep.rows[0].result.id as string;
    await asUser(editor);
    const created = await command("save_task", {
      title: "Policy update",
      instruction: "Revise policy",
      department_id: department,
      instruction_date: "2026-09-12",
      deadline: "2026-09-22",
      deadline_kind: "update",
      meeting: {
        title: "First review",
        requested_date: "2026-09-26",
        type: "review",
      },
    });
    task = created.rows[0].result.id as string;
    const meetings = await db.query<{ effective_date: string }>(
      "select effective_date::text from public.meetings where task_id=$1",
      [task],
    );
    expect(meetings.rows[0].effective_date).toBe("2026-09-28");
  });
  it("rejects direct status changes, even from editors", async () => {
    await expect(
      db.query("update public.tasks set status='completed' where id=$1", [
        task,
      ]),
    ).rejects.toThrow();
  });
  it("allows report but rejects editor confirmation", async () => {
    await command("transition_task", {
      id: task,
      action: "report_complete",
      note: "Draft ready",
      version: 1,
    });
    await expect(
      command("transition_task", {
        id: task,
        action: "confirm_complete",
        version: 2,
      }),
    ).rejects.toThrow(/owner/i);
  });
  it("owner confirms and stale writes are rejected", async () => {
    await asUser(owner);
    await command("transition_task", {
      id: task,
      action: "confirm_complete",
      version: 2,
      note: "Checked",
    });
    await expect(
      command("transition_task", {
        id: task,
        action: "reopen",
        version: 1,
        note: "Further changes",
      }),
    ).rejects.toThrow(/conflict/i);
  });
  it("editors can add recipients but cannot subscribe office-wide", async () => {
    await asUser(editor);
    const c = await command("save_contact", {
      name: "Officer",
      phone: "+19995550101",
      consent_note: "Consented during pilot",
      enabled: true,
    });
    const id = c.rows[0].result.id;
    await command("save_subscription", {
      contact_id: id,
      scope: "task",
      target_id: task,
    });
    await expect(
      command("save_subscription", { contact_id: id, scope: "office" }),
    ).rejects.toThrow(/owner/i);
    await expect(
      command("save_contact", {
        name: "Duplicate",
        phone: "+19995550101",
        consent_note: "Yes",
      }),
    ).rejects.toThrow();
  });
  it("viewers cannot write or read contact phone numbers", async () => {
    await asUser(viewer);
    await expect(
      command("save_department", { name: "Forbidden" }),
    ).rejects.toThrow();
    const c = await db.query("select * from public.contacts");
    expect(c.rows).toHaveLength(0);
  });
  it("inactive members lose reads with an existing identity", async () => {
    await db.exec(
      `reset role; update memberships set active=false where id='${editor}';`,
    );
    await asUser(editor);
    const t = await db.query("select * from public.tasks");
    expect(t.rows).toHaveLength(0);
    await expect(
      command("save_contact", { name: "Denied", phone: "+19995550102" }),
    ).rejects.toThrow();
  });
});
describe.sequential("durable reminder queue", () => {
  let contact: string;
  let expected: Record<string, string>;
  const due = "2026-09-22";
  it("builds relevant recipient digests from PostgreSQL", async () => {
    await asUser(owner);
    const ws = (
      await db.query<{
        data: { departments: { id: string }[]; contacts: { id: string }[] };
      }>("select get_workspace() data")
    ).rows[0].data;
    contact = ws.contacts[0].id;
    await command("save_subscription", {
      contact_id: contact,
      scope: "office",
    });
    await command("save_task", {
      title: "Reminder test",
      instruction: "Submit update",
      department_id: ws.departments[0].id,
      instruction_date: "2026-09-12",
      deadline: due,
    });
    const rows = (
      await db.query<{ data: { contact_id: string; body: string }[] }>(
        "select preview_reminders($1::date) data",
        [due],
      )
    ).rows[0].data;
    expect(rows.length).toBeGreaterThan(0);
    expected = Object.fromEntries(rows.map((r) => [r.contact_id, r.body]));
    expect(rows[0].body).toContain("Instruction: Submit update");
    expect(rows[0].body).toContain("Deadline: 22 Sep 2026");
  });
  it("requires exact preview, persists once and rejects duplicate occurrences", async () => {
    await expect(
      db.query(
        "select queue_manual_reminders($1::date,$2::uuid[],$3,$4::jsonb)",
        [due, [contact], "request-wrong-preview", "{}"],
      ),
    ).rejects.toThrow(/Conflict/);
    const send = async (key: string) =>
      (
        await db.query<{ count: number }>(
          "select queue_manual_reminders($1::date,$2::uuid[],$3,$4::jsonb) count",
          [due, [contact], key, JSON.stringify(expected)],
        )
      ).rows[0].count;
    expect(await send("request-correct-preview")).toBe(1);
    expect(await send("request-correct-preview")).toBe(0);
    expect(await send("request-new-click-same-items")).toBe(0);
    const rows = await db.query<{ state: string }>(
      "select state from notification_messages",
    );
    expect(rows.rows).toEqual([{ state: "mock" }]);
    await db.exec("reset role; update notification_messages set state='failed'");
    await asUser(owner);
    const resent = await db.query<{ id: string }>(
      "select resend_notification($1::uuid) id",
      [
        (
          await db.query<{ id: string }>(
            "select id from notification_messages limit 1",
          )
        ).rows[0].id,
      ],
    );
    expect(resent.rows[0].id).toBeTruthy();
    expect(
      (
        await db.query<{ count: number }>(
          "select count(*)::integer count from notification_messages",
        )
      ).rows[0].count,
    ).toBe(2);
  });
  it("does not allow app users to invoke automatic sender or alter sending settings", async () => {
    await expect(db.query("select schedule_daily_digest()")).rejects.toThrow();
    await expect(
      db.query("update app_settings set automatic_enabled=true"),
    ).rejects.toThrow();
  });
  it("a later task adds only a new event, without repeating previous reminders", async () => {
    const dep = (
      await db.query<{ id: string }>("select id from departments limit 1")
    ).rows[0].id;
    await command("save_task", {
      title: "Late addition",
      instruction: "New work after previous reminder",
      department_id: dep,
      instruction_date: "2026-09-12",
      deadline: due,
    });
    const previews = (
      await db.query<{
        data: { contact_id: string; items: { title: string }[] }[];
      }>("select preview_reminders($1::date) data", [due])
    ).rows[0].data;
    const preview = previews.find((p) => p.contact_id === contact)!;
    expect(preview.items.map((i) => i.title)).toEqual(["Late addition"]);
  });
  it("handles callbacks monotonically and never turns provider queued into a new send", async () => {
    await db.exec("reset role");
    const id = (
      await db.query<{ id: string }>(
        "select id from notification_messages limit 1",
      )
    ).rows[0].id;
    const sid = "MM" + "1".repeat(32);
    await db.exec("set role service_role");
    await db.query("select record_whatsapp_status($1,$2,$3,$4)", [
      id,
      sid,
      "queued",
      null,
    ]);
    expect(
      (
        await db.query<{ state: string }>(
          "select state from notification_messages where id=$1",
          [id],
        )
      ).rows[0].state,
    ).toBe("accepted");
    await db.query("select record_whatsapp_status($1,$2,$3,$4)", [
      id,
      sid,
      "delivered",
      null,
    ]);
    await db.query("select record_whatsapp_status($1,$2,$3,$4)", [
      id,
      sid,
      "sent",
      null,
    ]);
    expect(
      (
        await db.query<{ state: string }>(
          "select state from notification_messages where id=$1",
          [id],
        )
      ).rows[0].state,
    ).toBe("delivered");
    await db.query("select record_whatsapp_status($1,$2,$3,$4)", [
      id,
      sid,
      "delivered",
      null,
    ]);
    await db.exec("reset role");
    expect(
      (
        await db.query<{ count: number }>(
          "select count(*)::integer count from provider_events where message_id=$1",
          [id],
        )
      ).rows[0].count,
    ).toBe(3);

  });
});

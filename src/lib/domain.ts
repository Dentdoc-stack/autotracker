export type Role = "owner" | "editor" | "viewer";
export type TaskStatus =
  "open" | "in_progress" | "reported_complete" | "completed" | "cancelled";
export type Department = { id: string; name: string; active: boolean };
export type Task = {
  id: string;
  reference: string;
  title: string;
  instruction: string;
  department_id: string;
  instruction_date: string;
  responsible: string;
  source: string;
  status: TaskStatus;
  deadline: string | null;
  deadline_kind: string;
  version: number;
  reminder_revision: number;
  created_at: string;
  updated_at: string;
};
export type Meeting = {
  id: string;
  task_id: string;
  title: string;
  type: string;
  requested_date: string;
  effective_date: string;
  time: string;
  venue: string;
  state: string;
  actual_date: string | null;
  outcome: string;
  previous_meeting_id: string | null;
  version: number;
  reminder_revision: number;
  created_at: string;
};
export type Contact = {
  id: string;
  name: string;
  phone: string;
  designation: string;
  enabled: boolean;
  consent_at: string | null;
  consent_note: string;
  version: number;
  created_at: string;
};
export type Subscription = {
  id?: string;
  contact_id: string;
  scope: string;
  target_id: string | null;
};
export type Update = {
  id: string;
  task_id: string;
  note: string;
  kind: string;
  actor_name: string;
  created_at: string;
};
export type Audit = {
  id: string;
  entity_id: string;
  action: string;
  reason: string;
  actor_name: string;
  created_at: string;
  before?: unknown;
  after?: unknown;
};
export type Message = {
  id: string;
  contact_id: string;
  contact_name: string;
  body: string;
  state: string;
  due_date: string;
  created_at: string;
  item_keys: string[];
  error?: string;
};
export type Workspace = {
  departments: Department[];
  tasks: Task[];
  meetings: Meeting[];
  contacts: Contact[];
  subscriptions: Subscription[];
  updates: Update[];
  audit: Audit[];
  messages: Message[];
  member: { id: string; name: string; role: Role };
  mode: "demo" | "connected";
  settings?: { messaging_mode: string; automatic_enabled: boolean };
};

function parseDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Enter a valid date");
  const parsed = new Date(`${value}T00:00:00Z`);
  if (
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  )
    throw new Error("Enter a valid calendar date");
  return parsed;
}
function shift(value: string, days: number): string {
  const date = parseDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
export function addDays(value: string, days: number): string {
  if (!Number.isInteger(days) || days < 0 || days > 3650)
    throw new Error("Days must be a whole number between 0 and 3650");
  return shift(value, days);
}
export function meetingDate(value: string): string {
  const day = parseDate(value).getUTCDay();
  return shift(value, day === 6 ? 2 : day === 0 ? 1 : 0);
}
export function reminderDate(value: string): string {
  return shift(value, -1);
}
export function pakistanDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  return ["year", "month", "day"]
    .map((key) => parts.find((p) => p.type === key)!.value)
    .join("-");
}
export function dateLabel(value: string | null | undefined): string {
  return value
    ? new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }).format(parseDate(value))
    : "Not scheduled";
}
export function normalisePhone(value: string): string {
  const phone = value.replace(/[\s().-]/g, "");
  if (!/^\+[1-9]\d{7,14}$/.test(phone))
    throw new Error("Use an international number, for example +923001234567");
  return phone;
}
export function transitionTask(
  current: string,
  action: string,
  role: string,
): TaskStatus {
  if (!["owner", "editor"].includes(role))
    throw new Error("Editing permission required");
  if (
    ["confirm_complete", "return", "reopen", "cancel"].includes(action) &&
    role !== "owner"
  )
    throw new Error("Only the owner can perform this action");
  const transitions: Record<string, { from: string[]; to: TaskStatus }> = {
    start: { from: ["open"], to: "in_progress" },
    report_complete: { from: ["open", "in_progress"], to: "reported_complete" },
    confirm_complete: { from: ["reported_complete"], to: "completed" },
    return: { from: ["reported_complete"], to: "in_progress" },
    reopen: { from: ["completed", "cancelled"], to: "in_progress" },
    cancel: {
      from: ["open", "in_progress", "reported_complete"],
      to: "cancelled",
    },
  };
  const rule = transitions[action];
  if (!rule || !rule.from.includes(current))
    throw new Error("This action is not available for the current status");
  return rule.to;
}
export function csvCell(value: unknown): string {
  const s = String(value ?? "");
  return `"${(/^[\s]*[=+\-@\t\r]/.test(s) ? "'" : "") + s.replaceAll('"', '""')}"`;
}

type DigestTask = Omit<
  Pick<
    Task,
    | "id"
    | "reference"
    | "title"
    | "department_id"
    | "status"
    | "deadline"
    | "deadline_kind"
    | "reminder_revision"
  >,
  "status"
> & { status: string };
type DigestMeeting = Pick<
  Meeting,
  "id" | "task_id" | "title" | "effective_date" | "state" | "reminder_revision"
>;
type DigestContact = Pick<
  Contact,
  "id" | "name" | "phone" | "enabled" | "consent_at"
>;
export type DigestItem = {
  key: string;
  kind: "deadline" | "meeting";
  id: string;
  task_id: string;
  title: string;
  reference: string;
  department_id: string;
  label: string;
  revision: number;
};
export type Digest = {
  contact: DigestContact;
  items: DigestItem[];
  body: string;
};
export function buildDigests(
  data: {
    tasks: DigestTask[];
    meetings: DigestMeeting[];
    contacts: DigestContact[];
    subscriptions: Subscription[];
    departments?: Department[];
  },
  dueDate: string,
): Digest[] {
  parseDate(dueDate);
  const items: DigestItem[] = [];
  for (const task of data.tasks) {
    if (
      task.deadline === dueDate &&
      !["completed", "cancelled"].includes(task.status)
    )
      items.push({
        key: `deadline:${task.id}:${task.reminder_revision}:${dueDate}`,
        kind: "deadline",
        id: task.id,
        task_id: task.id,
        title: task.title,
        reference: task.reference,
        department_id: task.department_id,
        revision: task.reminder_revision,
        label:
          task.status === "reported_complete"
            ? "Completion awaiting confirmation"
            : task.deadline_kind === "update"
              ? "Update due"
              : "Completion due",
      });
  }
  for (const meeting of data.meetings) {
    const task = data.tasks.find((t) => t.id === meeting.task_id);
    if (
      task &&
      task.status !== "cancelled" &&
      meeting.effective_date === dueDate &&
      ["proposed", "confirmed"].includes(meeting.state)
    )
      items.push({
        key: `meeting:${meeting.id}:${meeting.reminder_revision}:${dueDate}`,
        kind: "meeting",
        id: meeting.id,
        task_id: task.id,
        title: meeting.title,
        reference: task.reference,
        department_id: task.department_id,
        revision: meeting.reminder_revision,
        label:
          meeting.state === "confirmed"
            ? "Meeting scheduled"
            : "Arrange meeting",
      });
  }
  return data.contacts
    .filter((c) => c.enabled && c.consent_at)
    .flatMap((contact) => {
      const subs = data.subscriptions.filter(
        (s) => s.contact_id === contact.id,
      );
      const relevant = items.filter((item) =>
        subs.some(
          (s) =>
            s.scope === "office" ||
            (s.scope === "task" && s.target_id === item.task_id) ||
            (s.scope === "meeting" &&
              item.kind === "meeting" &&
              s.target_id === item.id) ||
            (s.scope === "department" && s.target_id === item.department_id),
        ),
      );
      relevant.sort(
        (a, b) =>
          a.reference.localeCompare(b.reference) ||
          a.kind.localeCompare(b.kind),
      );
      if (!relevant.length) return [];
      const lines = relevant.map(
        (item) =>
          `${item.reference} · ${item.title}\n${data.departments?.find((d) => d.id === item.department_id)?.name ?? "Department"} — ${item.label}`,
      );
      return [
        {
          contact,
          items: relevant,
          body: `ACS(G) Office • Follow-ups\n${dateLabel(dueDate)}\n\n${lines.join("\n\n")}`,
        },
      ];
    });
}

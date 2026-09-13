"use client";
import Link from "next/link";
import InvitePanel from "./invite-panel";
import {
  useEffect,
  useRef,
  useState,
  useId,
  cloneElement,
  isValidElement,
  type ReactElement,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  LayoutDashboard,
  ListChecks,
  CalendarDays,
  Users,
  MessageSquare,
  Settings,
  Plus,
  Search,
  ArrowUpRight,
  ArrowLeft,
  X,
  Check,
  Clock3,
  ChevronRight,
  RefreshCw,
  Download,
  ShieldCheck,
  LogOut,
  BellRing,
  Pencil,
  Building2,
} from "lucide-react";
import {
  addDays,
  csvCell,
  dateLabel,
  meetingDate,
  pakistanDate,
  reminderDate,
  type Workspace,
  type Task,
  type Meeting,
  type Contact,
  type Digest,
} from "@/lib/domain";

type ModalState = {
  type:
    | "task"
    | "meeting"
    | "contact"
    | "subscription"
    | "department"
    | "transition"
    | "meetingTransition"
    | "update";
  task?: Task;
  meeting?: Meeting;
  contact?: Contact;
  action?: string;
};
const statusLabel: Record<string, string> = {
  open: "Open",
  in_progress: "In progress",
  reported_complete: "Awaiting confirmation",
  completed: "Completed",
  cancelled: "Cancelled",
  proposed: "To arrange",
  confirmed: "Confirmed",
  held: "Held",
  mock: "Test recorded",
  queued: "Queued",
  unknown: "Check delivery",
};
const nav = [
  ["dashboard", "Overview", LayoutDashboard],
  ["tasks", "Instructions", ListChecks],
  ["meetings", "Meetings", CalendarDays],
  ["contacts", "People", Users],
  ["reminders", "Reminders", MessageSquare],
  ["settings", "Settings", Settings],
] as const;
const isOpen = (t: Task) => !["completed", "cancelled"].includes(t.status);
function Badge({ value }: { value: string }) {
  return (
    <span className={`badge ${value}`}>{statusLabel[value] ?? value}</span>
  );
}
function Field({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const id = useId();
  return (
    <label className={`field ${wide ? "wide" : ""}`}>
      <span id={id}>{label}</span>
      {isValidElement(children)
        ? cloneElement(children as ReactElement<Record<string, unknown>>, {
            "aria-labelledby": id,
          })
        : children}
    </label>
  );
}
function Empty({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="empty">
      <ListChecks size={28} />
      <h3>{title}</h3>
      <p>{detail}</p>
    </div>
  );
}

export default function Tracker() {
  const [data, setData] = useState<Workspace | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [tab, setTab] = useState("dashboard"),
    [search, setSearch] = useState(""),
    [department, setDepartment] = useState(""),
    [status, setStatus] = useState(""),
    [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null),
    [modal, setModal] = useState<ModalState | null>(null),
    [busy, setBusy] = useState(false);
  const [dueDate, setDueDate] = useState(addDays(pakistanDate(), 1));
  const [digests, setDigests] = useState<Digest[]>([]);
  useEffect(() => {
    if (!data || data.member.role === "viewer") return;
    let cancelled = false;
    fetch(`/api/reminders?dueDate=${dueDate}`)
      .then((r) => r.json())
      .then((rows) => {
        if (!cancelled && Array.isArray(rows))
          setDigests(
            rows.map((row) => ({
              contact: {
                id: row.contact_id,
                name: row.contact_name,
                phone: row.phone,
                enabled: true,
                consent_at: "verified",
              },
              items: row.items,
              body: row.body,
            })),
          );
      })
      .catch(() => {
        if (!cancelled) setDigests([]);
      });
    return () => {
      cancelled = true;
    };
  }, [data, dueDate]);
  const today = pakistanDate(),
    tomorrow = addDays(today, 1);
  async function load() {
    try {
      const response = await fetch("/api/workspace", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setData(body);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load workspace");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    let cancelled = false;
    fetch("/api/workspace", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
        if (!cancelled) {
          setData(body);
          setError("");
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  async function run(action: string, payload: Record<string, unknown>) {
    const response = await fetch("/api/commands", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, payload }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    return body;
  }
  async function save(action: string, payload: Record<string, unknown>) {
    setBusy(true);
    try {
      await run(action, payload);
      await load();
      setModal(null);
      setNotice("Changes saved");
    } catch (e) {
      throw e;
    } finally {
      setBusy(false);
    }
  }
  const member = data?.member,
    editable = member?.role !== "viewer";
  function navigate(next: string) {
    setTab(next);
    setSelected(null);
    setSearch("");
    setStatus("");
    setDepartment("");
    setPage(1);
  }
  function exportCsv() {
    if (!data) return;
    const rows = [
      [
        "Reference",
        "Instruction",
        "Department",
        "Responsible",
        "Deadline",
        "Status",
      ],
      ...data.tasks.map((t) => [
        t.reference,
        t.title,
        data.departments.find((d) => d.id === t.department_id)?.name,
        t.responsible,
        t.deadline,
        t.status,
      ]),
    ];
    const url = URL.createObjectURL(
      new Blob(
        ["\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n")],
        { type: "text/csv;charset=utf-8" },
      ),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `acs-g-instructions-${today}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
  if (loading)
    return (
      <div className="loading">
        <div className="brand-seal">G</div>
        <p>Opening your workspace…</p>
      </div>
    );
  if (!data) return <Login error={error} onLogin={load} />;
  const tasks = data.tasks.filter(
    (t) =>
      (!search ||
        `${t.reference} ${t.title} ${t.instruction} ${t.responsible}`
          .toLowerCase()
          .includes(search.toLowerCase())) &&
      (!department || t.department_id === department) &&
      (!status || t.status === status),
  );
  const active = data.tasks.filter(isOpen),
    overdue = active.filter((t) => t.deadline && t.deadline < today),
    pending = active.filter((t) => t.status === "reported_complete");
  const upcoming = data.meetings
    .filter((m) => ["proposed", "confirmed"].includes(m.state))
    .sort((a, b) => a.effective_date.localeCompare(b.effective_date));
  const task = selected ? data.tasks.find((t) => t.id === selected) : undefined;
  const depName = (id: string) =>
    data.departments.find((d) => d.id === id)?.name ?? "Department";
  const taskName = (id: string) =>
    data.tasks.find((t) => t.id === id)?.title ?? "Instruction";
  function taskRows(list: Task[]) {
    return (
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Instruction</th>
              <th>Department</th>
              <th>Due date</th>
              <th>Status</th>
              <th>
                <span className="sr-only">Open</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {list.map((t) => (
              <tr
                key={t.id}
                onClick={() => {
                  setSelected(t.id);
                  setTab("tasks");
                }}
              >
                <td>
                  <button
                    className="row-title"
                    onClick={() => setSelected(t.id)}
                  >
                    {t.title}
                  </button>
                  <small>
                    {t.reference} <span>·</span>{" "}
                    {t.responsible || "Responsible person not assigned"}
                  </small>
                </td>
                <td>
                  <span className="department-label">
                    {depName(t.department_id)}
                  </span>
                </td>
                <td
                  className={
                    t.deadline && t.deadline < today && isOpen(t)
                      ? "overdue-text"
                      : ""
                  }
                >
                  {dateLabel(t.deadline)}
                  {t.deadline && t.deadline < today && isOpen(t) && (
                    <small>Overdue</small>
                  )}
                </td>
                <td>
                  <Badge value={t.status} />
                </td>
                <td>
                  <ChevronRight size={16} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!list.length && (
          <Empty
            title="No instructions here"
            detail="Add an instruction or adjust your filters."
          />
        )}
      </div>
    );
  }
  function meetingCard(m: Meeting) {
    return (
      <article className="meeting-card" key={m.id}>
        <div className="date-tile">
          <strong>{m.effective_date.slice(8)}</strong>
          <span>
            {new Date(`${m.effective_date}T00:00:00Z`).toLocaleString("en-GB", {
              month: "short",
              timeZone: "UTC",
            })}
          </span>
        </div>
        <div className="meeting-copy">
          <div className="inline">
            <h3>{m.title}</h3>
            <Badge value={m.state} />
          </div>
          <p>{taskName(m.task_id)}</p>
          <small>
            {m.time || "Time to be arranged"} ·{" "}
            {m.venue || "Venue to be arranged"}
          </small>
          {m.requested_date !== m.effective_date && (
            <div className="weekend-note">
              Weekend adjustment: {dateLabel(m.requested_date)} →{" "}
              {dateLabel(m.effective_date)}
            </div>
          )}
          <small className="reminder-line">
            <BellRing size={12} /> Reminder{" "}
            {dateLabel(reminderDate(m.effective_date))}, 9 AM
          </small>
          {m.outcome && <p className="outcome">{m.outcome}</p>}
        </div>
        {editable && (
          <div className="meeting-actions">
            {["proposed", "confirmed"].includes(m.state) ? (
              <>
                <button
                  className="icon-button"
                  aria-label={`Edit ${m.title}`}
                  onClick={() =>
                    setModal({
                      type: "meeting",
                      meeting: m,
                      task: data!.tasks.find((t) => t.id === m.task_id),
                    })
                  }
                >
                  <Pencil size={15} />
                </button>
                {m.state === "proposed" && (
                  <button
                    className="text-button"
                    onClick={() =>
                      setModal({
                        type: "meetingTransition",
                        meeting: m,
                        action: "confirmed",
                      })
                    }
                  >
                    Confirm
                  </button>
                )}
                <button
                  className="text-button"
                  onClick={() =>
                    setModal({
                      type: "meetingTransition",
                      meeting: m,
                      action: "held",
                    })
                  }
                >
                  Record outcome
                </button>
                <button
                  className="text-button muted"
                  onClick={() =>
                    setModal({
                      type: "meetingTransition",
                      meeting: m,
                      action: "cancelled",
                    })
                  }
                >
                  Cancel
                </button>
              </>
            ) : m.state === "held" ? (
              <button
                className="text-button"
                onClick={() =>
                  setModal({
                    type: "meeting",
                    task: data!.tasks.find((t) => t.id === m.task_id),
                    meeting: {
                      ...m,
                      id: "",
                      previous_meeting_id: m.id,
                      requested_date: m.actual_date || m.effective_date,
                      type: "followup",
                      title: "Follow-up meeting",
                    },
                  })
                }
              >
                Add follow-up
              </button>
            ) : null}
          </div>
        )}
      </article>
    );
  }
  return (
    <div className="app-layout">
      <aside className="sidebar">
        <Link className="brand" href="/">
          <div className="brand-seal">G</div>
          <div>
            <strong>ACS(G)</strong>
            <span>OFFICE WORKSPACE</span>
          </div>
        </Link>
        <div className="sidebar-rule" />
        <span className="nav-caption">WORKSPACE</span>
        <nav>
          {nav.map(([key, label, Icon]) => (
            <button
              key={key}
              className={tab === key ? "active" : ""}
              onClick={() => navigate(key)}
            >
              <Icon size={19} />
              <span>{label}</span>
              {key === "tasks" && <em>{active.length}</em>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <ShieldCheck size={19} />
          <div>
            <strong>Private office workspace</strong>
            <p>Instructions. Follow-ups. Accountability.</p>
          </div>
        </div>
        <div className="profile">
          <span className="avatar">{member!.name[0]}</span>
          <div>
            <strong>{member!.name}</strong>
            <small>
              {member!.role === "owner" ? "Workspace owner" : member!.role}
            </small>
          </div>
          {data.mode === "connected" && (
            <button
              className="icon-button"
              aria-label="Sign out"
              onClick={async () => {
                await fetch("/api/auth", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "logout" }),
                });
                location.reload();
              }}
            >
              <LogOut size={16} />
            </button>
          )}
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div className="breadcrumb">
            Office workspace <ChevronRight size={13} />
            <strong>{nav.find((n) => n[0] === tab)?.[1]}</strong>
          </div>
          <div className="topbar-right">
            <span>
              {dateLabel(today)} <span className="muted">· Pakistan time</span>
            </span>
            <button
              className="icon-button"
              aria-label="Refresh workspace"
              onClick={() => void load()}
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </header>
        {data.mode === "demo" && (
          <div className="preview-banner">
            <span>
              <span className="dot" /> Local preview · Sample records, saved on
              this computer
            </span>
            <span>No WhatsApp messages are sent</span>
          </div>
        )}
        <div className="content">
          {notice && (
            <div className="toast" role="status">
              <Check size={16} />
              {notice}
              <button
                className="icon-button"
                aria-label="Dismiss"
                onClick={() => setNotice("")}
              >
                <X size={14} />
              </button>
            </div>
          )}
          {error && <div className="error-box">{error}</div>}
          <div className="page-heading">
            <div>
              <span className="eyebrow">ACS(G) INSTRUCTIONS & FOLLOW-UPS</span>
              <h1>
                {task
                  ? task.reference
                  : tab === "dashboard"
                    ? "A clear view of what’s next."
                    : nav.find((n) => n[0] === tab)?.[1]}
              </h1>
              <p>
                {task
                  ? "Instruction details, progress and meeting history."
                  : tab === "dashboard"
                    ? "Keep instructions moving and prepare for the next review."
                    : tab === "tasks"
                      ? "Every instruction, deadline and department in one place."
                      : tab === "meetings"
                        ? "Arrange reviews, record outcomes and plan the next follow-up."
                        : tab === "contacts"
                          ? "Choose who needs to hear about each task or meeting."
                          : tab === "reminders"
                            ? "One concise message per person, with the items relevant to them."
                            : "Your workspace configuration and connection checklist."}
              </p>
            </div>
            {editable &&
              ["dashboard", "tasks", "meetings", "contacts"].includes(tab) && (
                <button
                  className="button primary"
                  onClick={() =>
                    setModal({
                      type:
                        tab === "meetings"
                          ? "meeting"
                          : tab === "contacts"
                            ? "contact"
                            : "task",
                    })
                  }
                >
                  <Plus size={17} />
                  {tab === "meetings"
                    ? "Add meeting"
                    : tab === "contacts"
                      ? "Add person"
                      : "Add instruction"}
                </button>
              )}
          </div>
          {tab === "dashboard" && (
            <>
              <section className="stats-grid">
                {[
                  [
                    active.length,
                    "Open instructions",
                    "Across all departments",
                  ],
                  [
                    upcoming.filter((m) => m.effective_date === tomorrow)
                      .length,
                    "Meetings tomorrow",
                    "Prepare the next review",
                  ],
                  [overdue.length, "Past deadline", "Needs a progress update"],
                  [
                    pending.length,
                    "Awaiting confirmation",
                    "Reported complete by staff",
                  ],
                ].map(([number, label, hint], i) => (
                  <button
                    key={String(label)}
                    className={`stat-card stat-${i}`}
                    onClick={() => {
                      navigate(i === 1 ? "meetings" : "tasks");
                      if (i === 3) setStatus("reported_complete");
                    }}
                  >
                    <span>{label}</span>
                    <strong>
                      {number}
                      <ArrowUpRight size={19} />
                    </strong>
                    <small>{hint}</small>
                  </button>
                ))}
              </section>
              <div className="overview-grid">
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Instructions to keep in view</h2>
                      <p>Pending work, ordered by its next deadline.</p>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => navigate("tasks")}
                    >
                      View all <ArrowUpRight size={14} />
                    </button>
                  </div>
                  {taskRows(
                    [...active]
                      .sort((a, b) =>
                        (a.deadline ?? "9999").localeCompare(
                          b.deadline ?? "9999",
                        ),
                      )
                      .slice(0, 5),
                  )}
                </section>
                <aside className="digest-panel">
                  <div className="digest-icon">
                    <BellRing size={23} />
                  </div>
                  <span className="eyebrow">THE NEXT REMINDER</span>
                  <h2>
                    Tomorrow’s work.
                    <br />
                    One clear message.
                  </h2>
                  <p>
                    At 9 AM Pakistan time, each subscribed person receives their
                    relevant deadlines and meetings for the following day.
                  </p>
                  <div className="digest-detail">
                    <Clock3 size={17} />
                    <span>Daily · 9:00 AM</span>
                  </div>
                  <div className="digest-detail">
                    <Users size={17} />
                    <span>
                      {
                        data.contacts.filter((c) => c.enabled && c.consent_at)
                          .length
                      }{" "}
                      enabled recipients
                    </span>
                  </div>
                  <div className="digest-footnote">
                    Weekend meetings move to Monday. Their reminder goes out on
                    Sunday.
                  </div>
                  <button
                    className="button light"
                    onClick={() => navigate("reminders")}
                  >
                    Preview reminders <ArrowUpRight size={15} />
                  </button>
                </aside>
              </div>
              <section className="panel agenda-panel">
                <div className="panel-heading">
                  <div>
                    <h2>Upcoming meetings</h2>
                    <p>Proposed and confirmed reviews.</p>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => navigate("meetings")}
                  >
                    Open agenda <ArrowUpRight size={14} />
                  </button>
                </div>
                {upcoming.slice(0, 3).map(meetingCard)}
                {!upcoming.length && (
                  <Empty
                    title="Your agenda is clear"
                    detail="Add a review or follow-up to an instruction."
                  />
                )}
              </section>
            </>
          )}
          {tab === "tasks" && !task && (
            <section className="panel">
              <div className="filter-bar">
                <label className="search-field">
                  <Search size={17} />
                  <input
                    aria-label="Search instructions"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Search instructions, people or references"
                  />
                </label>
                <select
                  aria-label="Filter department"
                  value={department}
                  onChange={(e) => {
                    setDepartment(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">All departments</option>
                  {data.departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Filter status"
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">All statuses</option>
                  {[
                    "open",
                    "in_progress",
                    "reported_complete",
                    "completed",
                    "cancelled",
                  ].map((s) => (
                    <option key={s} value={s}>
                      {statusLabel[s]}
                    </option>
                  ))}
                </select>
                {editable && (
                  <button
                    className="icon-button"
                    aria-label="Export instructions"
                    onClick={exportCsv}
                  >
                    <Download size={18} />
                  </button>
                )}
              </div>
              {taskRows(tasks.slice((page - 1) * 25, page * 25))}
              <div className="pagination">
                <span>{tasks.length} instructions</span>
                <div>
                  <button
                    disabled={page === 1}
                    onClick={() => setPage(page - 1)}
                  >
                    Previous
                  </button>
                  <span>Page {page}</span>
                  <button
                    disabled={page * 25 >= tasks.length}
                    onClick={() => setPage(page + 1)}
                  >
                    Next
                  </button>
                </div>
              </div>
            </section>
          )}
          {tab === "tasks" && task && (
            <>
              <button
                className="text-button back"
                onClick={() => setSelected(null)}
              >
                <ArrowLeft size={15} /> All instructions
              </button>
              <div className="detail-grid">
                <section className="panel detail-main">
                  <div className="inline">
                    <Badge value={task.status} />
                    <span className="department-label">
                      {depName(task.department_id)}
                    </span>
                  </div>
                  <h2>{task.title}</h2>
                  <p className="instruction-text">{task.instruction}</p>
                  <div className="facts">
                    <div>
                      <span>Instruction date</span>
                      <strong>{dateLabel(task.instruction_date)}</strong>
                    </div>
                    <div>
                      <span>
                        {task.deadline_kind === "update"
                          ? "Update due"
                          : "Completion deadline"}
                      </span>
                      <strong>{dateLabel(task.deadline)}</strong>
                    </div>
                    <div>
                      <span>Responsible person</span>
                      <strong>{task.responsible || "Not assigned"}</strong>
                    </div>
                    <div>
                      <span>Source</span>
                      <strong>{task.source || "Not recorded"}</strong>
                    </div>
                  </div>
                  {task.deadline && (
                    <div className="info-box">
                      <BellRing size={17} />
                      <span>
                        Reminder: {dateLabel(reminderDate(task.deadline))}, 9
                        AM. Task deadlines remain on the entered date.
                      </span>
                    </div>
                  )}
                  {editable && (
                    <div className="action-row">
                      {isOpen(task) && (
                        <>
                          <button
                            className="button secondary"
                            onClick={() => setModal({ type: "task", task })}
                          >
                            <Pencil size={15} /> Edit instruction
                          </button>
                          <button
                            className="button secondary"
                            onClick={() => setModal({ type: "update", task })}
                          >
                            Add update
                          </button>
                        </>
                      )}
                      {["open", "in_progress"].includes(task.status) && (
                        <button
                          className="button primary"
                          onClick={() =>
                            setModal({
                              type: "transition",
                              task,
                              action: "report_complete",
                            })
                          }
                        >
                          Report complete
                        </button>
                      )}
                      {member!.role === "owner" &&
                        task.status === "reported_complete" && (
                          <>
                            <button
                              className="button primary"
                              onClick={() =>
                                setModal({
                                  type: "transition",
                                  task,
                                  action: "confirm_complete",
                                })
                              }
                            >
                              Confirm completed
                            </button>
                            <button
                              className="button secondary"
                              onClick={() =>
                                setModal({
                                  type: "transition",
                                  task,
                                  action: "return",
                                })
                              }
                            >
                              Return for work
                            </button>
                          </>
                        )}
                      {member!.role === "owner" && !isOpen(task) && (
                        <button
                          className="button secondary"
                          onClick={() =>
                            setModal({
                              type: "transition",
                              task,
                              action: "reopen",
                            })
                          }
                        >
                          Reopen task
                        </button>
                      )}
                      {member!.role === "owner" && isOpen(task) && (
                        <button
                          className="text-button danger"
                          onClick={() =>
                            setModal({
                              type: "transition",
                              task,
                              action: "cancel",
                            })
                          }
                        >
                          Cancel task
                        </button>
                      )}
                    </div>
                  )}
                </section>
                <section className="panel detail-side">
                  <h2>Progress history</h2>
                  {data.updates
                    .filter((u) => u.task_id === task.id)
                    .map((u) => (
                      <div className="timeline-item" key={u.id}>
                        <span className="timeline-dot" />
                        <strong>{u.actor_name}</strong>
                        <small>
                          {new Date(u.created_at).toLocaleString("en-GB", {
                            timeZone: "Asia/Karachi",
                          })}
                        </small>
                        <p>{u.note}</p>
                      </div>
                    ))}
                  {!data.updates.some((u) => u.task_id === task.id) && (
                    <p className="muted">
                      No updates yet. Record the latest progress here.
                    </p>
                  )}
                </section>
              </div>
              <section className="panel agenda-panel">
                <div className="panel-heading">
                  <h2>Meetings & follow-ups</h2>
                  {editable && (
                    <button
                      className="text-button"
                      onClick={() => setModal({ type: "meeting", task })}
                    >
                      <Plus size={15} /> Add meeting
                    </button>
                  )}
                </div>
                {data.meetings
                  .filter((m) => m.task_id === task.id)
                  .map(meetingCard)}
                {!data.meetings.some((m) => m.task_id === task.id) && (
                  <Empty
                    title="No meetings linked yet"
                    detail="Schedule an initial review or a follow-up after a chosen number of days."
                  />
                )}
              </section>
              <section className="panel audit-panel">
                <h2>Change history</h2>
                {data.audit
                  .filter((a) => a.entity_id === task.id)
                  .map((a) => (
                    <div className="audit-row" key={a.id}>
                      <span>{a.action.replaceAll("_", " ")}</span>
                      <strong>{a.actor_name}</strong>
                      <span>{a.reason || "Record saved"}</span>
                      <small>
                        {new Date(a.created_at).toLocaleDateString("en-GB", {
                          timeZone: "Asia/Karachi",
                        })}
                      </small>
                    </div>
                  ))}
              </section>
            </>
          )}
          {tab === "meetings" && (
            <section className="panel agenda-panel">
              <div className="filter-bar">
                <CalendarDays size={19} />
                <strong>Meeting agenda</strong>
                <select
                  aria-label="Meeting status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="">All meetings</option>
                  {["proposed", "confirmed", "held", "cancelled"].map((s) => (
                    <option key={s} value={s}>
                      {statusLabel[s]}
                    </option>
                  ))}
                </select>
              </div>
              {data.meetings
                .filter((m) => !status || m.state === status)
                .map(meetingCard)}
              {!data.meetings.length && (
                <Empty
                  title="Plan your first meeting"
                  detail="Choose an instruction and a meeting date, or enter After X days."
                />
              )}
            </section>
          )}
          {tab === "contacts" && (
            <>
              <div className="info-box">
                <ShieldCheck size={19} />
                <span>
                  People receive reminders for their subscriptions. Adding a
                  recipient does not give them access to this workspace.
                </span>
              </div>
              <section className="panel">
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Person</th>
                        <th>WhatsApp number</th>
                        <th>Receives reminders for</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.contacts.map((c) => (
                        <tr key={c.id}>
                          <td>
                            <strong>{c.name}</strong>
                            <small>{c.designation || "Recipient"}</small>
                          </td>
                          <td>{c.phone}</td>
                          <td>
                            <div className="subscription-tags">
                              {data.subscriptions
                                .filter((s) => s.contact_id === c.id)
                                .map((s) => (
                                  <span key={s.id} className="subscription-tag">
                                    {s.scope === "office"
                                      ? "All office instructions"
                                      : s.scope === "department"
                                        ? depName(s.target_id!)
                                        : s.scope === "task"
                                          ? taskName(s.target_id!)
                                          : (data.meetings.find(
                                              (m) => m.id === s.target_id,
                                            )?.title ?? "Meeting")}
                                    {editable &&
                                      (s.scope !== "office" ||
                                        member!.role === "owner") && (
                                        <button
                                          aria-label="Remove subscription"
                                          onClick={async () => {
                                            if (
                                              !confirm(
                                                "Remove this reminder subscription?",
                                              )
                                            )
                                              return;
                                            try {
                                              await run("remove_subscription", {
                                                id: s.id,
                                              });
                                              await load();
                                            } catch (e) {
                                              setNotice(String(e));
                                            }
                                          }}
                                        >
                                          ×
                                        </button>
                                      )}
                                  </span>
                                ))}
                              {!data.subscriptions.some(
                                (s) => s.contact_id === c.id,
                              ) && (
                                <span className="muted">No subscriptions</span>
                              )}
                            </div>
                          </td>
                          <td>
                            <Badge
                              value={c.enabled ? "confirmed" : "cancelled"}
                            />
                          </td>
                          <td>
                            <div className="inline">
                              <button
                                className="text-button"
                                onClick={() =>
                                  setModal({ type: "subscription", contact: c })
                                }
                              >
                                Manage reminders
                              </button>
                              <button
                                className="icon-button"
                                aria-label={`Edit ${c.name}`}
                                onClick={() =>
                                  setModal({ type: "contact", contact: c })
                                }
                              >
                                <Pencil size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!data.contacts.length && (
                  <Empty
                    title="Add your reminder recipients"
                    detail="Record their consent, then subscribe them to the relevant tasks, meetings or departments."
                  />
                )}
              </section>
            </>
          )}
          {tab === "reminders" && (
            <>
              <div className="filter-bar panel">
                <Field label="Preview items due on">
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => {
                      if (e.target.value) setDueDate(e.target.value);
                    }}
                  />
                </Field>
                <div>
                  <strong>
                    Scheduled reminder: {dateLabel(reminderDate(dueDate))}, 9 AM
                  </strong>
                  <p className="muted">
                    {digests.length} recipient{digests.length === 1 ? "" : "s"}{" "}
                    with relevant items
                  </p>
                </div>
              </div>
              <div className="reminder-grid">
                {digests.map((d) => (
                  <section className="panel message-preview" key={d.contact.id}>
                    <div className="panel-heading">
                      <div>
                        <h2>{d.contact.name}</h2>
                        <p>
                          {d.items.length} relevant event
                          {d.items.length === 1 ? "" : "s"}
                        </p>
                      </div>
                      <MessageSquare size={21} />
                    </div>
                    <div className="message-bubble">
                      <pre>{d.body}</pre>
                      <small>Preview · Pakistan time</small>
                    </div>
                    <p className="message-note">
                      {data.mode === "demo"
                        ? "Test recording only. This does not send WhatsApp."
                        : "Sending requires configured, approved WhatsApp templates."}
                    </p>
                    {editable && (
                      <button
                        className="button secondary"
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          try {
                            const res = await fetch("/api/reminders", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                dueDate,
                                contactIds: [d.contact.id],
                                idempotencyKey: crypto.randomUUID(),
                                expected: { [d.contact.id]: d.body },
                              }),
                            });
                            const body = await res.json();
                            if (!res.ok) throw new Error(body.error);
                            setNotice(body.message);
                            await load();
                          } catch (e) {
                            setNotice(
                              e instanceof Error
                                ? e.message
                                : "Unable to record reminder",
                            );
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        {data.mode === "demo"
                          ? "Record test reminder"
                          : "Send reminder now"}{" "}
                        <ArrowUpRight size={15} />
                      </button>
                    )}
                  </section>
                ))}
              </div>
              {!digests.length && (
                <section className="panel">
                  <Empty
                    title="No reminders for this date"
                    detail="No pending items match an enabled recipient’s subscriptions. Nothing will be sent."
                  />
                </section>
              )}
              <section className="panel history-panel">
                <div className="panel-heading">
                  <h2>Reminder history</h2>
                  <span className="muted">Delivery is tracked per person</span>
                </div>
                {data.messages.length ? (
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Recipient</th>
                          <th>Items due</th>
                          <th>Status</th>
                          <th>Recorded</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.messages.map((m) => (
                          <tr key={m.id}>
                            <td>{m.contact_name}</td>
                            <td>{dateLabel(m.due_date)}</td>
                            <td>
                              <Badge value={m.state} />
                            </td>
                            <td>
                              {new Date(m.created_at).toLocaleString("en-GB", {
                                timeZone: "Asia/Karachi",
                              })}
                            </td>
                            <td>
                              {editable &&
                                !["queued", "sending"].includes(m.state) && (
                                  <button
                                    className="button secondary compact"
                                    disabled={busy}
                                    onClick={async () => {
                                      if (
                                        !window.confirm(
                                          `Resend this reminder to ${m.contact_name}?`,
                                        )
                                      )
                                        return;
                                      setBusy(true);
                                      try {
                                        const response = await fetch(
                                          "/api/reminders",
                                          {
                                            method: "POST",
                                            headers: {
                                              "Content-Type": "application/json",
                                            },
                                            body: JSON.stringify({
                                              resendId: m.id,
                                            }),
                                          },
                                        );
                                        const body = await response.json();
                                        if (!response.ok)
                                          throw new Error(body.error);
                                        setNotice(body.message);
                                        await load();
                                      } catch (e) {
                                        setNotice(
                                          e instanceof Error
                                            ? e.message
                                            : "Unable to resend reminder",
                                        );
                                      } finally {
                                        setBusy(false);
                                      }
                                    }}
                                  >
                                    <RefreshCw size={14} /> Resend
                                  </button>
                                )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <Empty
                    title="No messages recorded yet"
                    detail="Sent, failed and test reminders will appear here."
                  />
                )}
              </section>
            </>
          )}
          {tab === "settings" && (
            <div className="settings-grid">
              {member!.role === "owner" && (
                <InvitePanel demo={data.mode === "demo"} />
              )}
              <section className="panel settings-card">
                <h2>
                  <Building2 size={20} /> Departments
                </h2>
                <p>Keep department names consistent across instructions.</p>
                {data.departments.length ? (
                  data.departments.map((d) => (
                    <div className="settings-row" key={d.id}>
                      <span>{d.name}</span>
                      <Badge value={d.active ? "confirmed" : "cancelled"} />
                    </div>
                  ))
                ) : (
                  <p className="info-box">
                    Add an active department before creating an instruction.
                  </p>
                )}
                {member!.role === "owner" && (
                  <button
                    className="button secondary"
                    onClick={() => setModal({ type: "department" })}
                  >
                    <Plus size={16} /> Add department
                  </button>
                )}
              </section>
              <section className="panel settings-card">
                <h2>
                  <ShieldCheck size={20} /> Connections
                </h2>
                <div className="settings-row">
                  <span>Data storage</span>
                  <strong>
                    {data.mode === "demo"
                      ? "Local PostgreSQL"
                      : "Supabase connected"}
                  </strong>
                </div>
                <div className="settings-row">
                  <span>WhatsApp</span>
                  <Badge value={data.settings?.messaging_mode ?? "mock"} />
                </div>
                <div className="settings-row">
                  <span>Automatic reminders</span>
                  <strong>
                    {data.settings?.automatic_enabled ? "Enabled" : "Disabled"}
                  </strong>
                </div>
                <div className="settings-row">
                  <span>Timezone</span>
                  <strong>Asia/Karachi</strong>
                </div>
                <div className="settings-row">
                  <span>Daily reminder</span>
                  <strong>9:00 AM</strong>
                </div>
                <div className="settings-row">
                  <span>Weekend meetings</span>
                  <strong>Move to Monday</strong>
                </div>
                <div className="info-box">
                  Production messaging stays disabled until sender verification,
                  templates and delivery tests are complete. Follow the setup
                  guide in this project.
                </div>
              </section>
            </div>
          )}
          <footer className="footer">
            <span>ACS(G) Office · Instructions & meeting tracker</span>
            <span>
              <span className="dot" />{" "}
              {data.mode === "demo" ? "Local preview" : "Private workspace"} ·
              Asia/Karachi
            </span>
          </footer>
        </div>
      </main>
      {modal && (
        <Editor
          key={`${modal.type}-${modal.task?.id}-${modal.meeting?.id}`}
          modal={modal}
          data={data}
          busy={busy}
          onClose={() => setModal(null)}
          onSave={save}
        />
      )}
    </div>
  );
}

function Editor({
  modal,
  data,
  busy,
  onClose,
  onSave,
}: {
  modal: ModalState;
  data: Workspace;
  busy: boolean;
  onClose: () => void;
  onSave: (action: string, payload: Record<string, unknown>) => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    form = useRef<HTMLFormElement>(null);
  const [error, setError] = useState(""),
    [dateMode, setDateMode] = useState("specific");
  const today = pakistanDate(),
    m = modal.meeting,
    t = modal.task,
    c = modal.contact;
  const [base, setBase] = useState(
      m?.previous_meeting_id
        ? m.requested_date
        : (t?.instruction_date ?? today),
    ),
    [days, setDays] = useState("10"),
    [chosen, setChosen] = useState(
      m?.requested_date ?? t?.deadline ?? addDays(today, 10),
    );
  const [scope, setScope] = useState(modal.task ? "task" : "department"),
    [enabled, setEnabled] = useState(c?.enabled ?? true);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const date =
    dateMode === "relative"
      ? (() => {
          try {
            return addDays(base, Number(days));
          } catch {
            return "";
          }
        })()
      : chosen;
  const effective = date
    ? modal.type === "meeting"
      ? meetingDate(date)
      : date
    : "";
  const titles: Record<string, string> = {
    task: t ? "Edit instruction" : "Add instruction",
    meeting: m?.id
      ? "Edit meeting"
      : m?.previous_meeting_id
        ? "Add follow-up meeting"
        : "Add meeting",
    contact: c ? "Edit person" : "Add person",
    subscription: "Add reminder subscription",
    department: "Add department",
    transition:
      modal.action === "confirm_complete"
        ? "Confirm completed"
        : modal.action === "report_complete"
          ? "Report complete"
          : modal.action === "return"
            ? "Return for further work"
            : modal.action === "reopen"
              ? "Reopen instruction"
              : "Cancel instruction",
    meetingTransition:
      modal.action === "held"
        ? "Record meeting outcome"
        : modal.action === "confirmed"
          ? "Confirm meeting"
          : "Cancel meeting",
    update: "Add progress update",
  };
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const raw = Object.fromEntries(new FormData(event.currentTarget));
    const payload: Record<string, unknown> = { ...raw };
    let action = "";
    if (modal.type === "task") {
      action = "save_task";
      payload.id = t?.id;
      payload.version = t?.version;
      payload.deadline = date || null;
      if (dateMode === "relative") {
        payload.deadline_days = days;
        payload.deadline_base = base;
      }
    }
    if (modal.type === "meeting") {
      action = "save_meeting";
      payload.id = m?.id || undefined;
      payload.version = m?.version;
      payload.requested_date = date;
      payload.previous_meeting_id = m?.previous_meeting_id;
      if (dateMode === "relative") {
        payload.requested_date_days = days;
        payload.requested_date_base = base;
      }
    }
    if (modal.type === "contact") {
      action = "save_contact";
      payload.id = c?.id;
      payload.version = c?.version;
      payload.enabled = enabled;
      payload.new_consent = raw.new_consent === "on";
    }
    if (modal.type === "subscription") {
      action = "save_subscription";
      payload.contact_id = c?.id;
      payload.scope = scope;
      payload.target_id = scope === "office" ? null : raw.target_id;
    }
    if (modal.type === "department") action = "save_department";
    if (modal.type === "transition") {
      action = "transition_task";
      payload.id = t!.id;
      payload.version = t!.version;
      payload.action = modal.action;
      payload.cancel_meetings = raw.cancel_meetings === "on";
    }
    if (modal.type === "meetingTransition") {
      action = "transition_meeting";
      payload.id = m!.id;
      payload.version = m!.version;
      payload.state = modal.action;
    }
    if (modal.type === "update") {
      action = "add_update";
      payload.task_id = t!.id;
    }
    try {
      await onSave(action, payload);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save");
    }
  }
  const dateFields = (
    <>
      <div className="segmented wide">
        <button
          type="button"
          className={dateMode === "specific" ? "selected" : ""}
          onClick={() => setDateMode("specific")}
        >
          Choose a date
        </button>
        <button
          type="button"
          className={dateMode === "relative" ? "selected" : ""}
          onClick={() => setDateMode("relative")}
        >
          After a number of days
        </button>
      </div>
      {dateMode === "specific" ? (
        <Field
          label={
            modal.type === "meeting"
              ? "Requested meeting date"
              : "Deadline (optional)"
          }
          wide
        >
          <input
            type="date"
            required={modal.type === "meeting"}
            value={chosen}
            onChange={(e) => setChosen(e.target.value)}
          />
        </Field>
      ) : (
        <>
          <Field label="Count from">
            <input
              type="date"
              required
              value={base}
              onChange={(e) => setBase(e.target.value)}
            />
          </Field>
          <Field label="Calendar days after this date">
            <input
              type="number"
              min="0"
              max="3650"
              step="1"
              required
              value={days}
              onChange={(e) => setDays(e.target.value)}
            />
          </Field>
        </>
      )}
      {effective && (
        <div className="date-preview wide">
          <CalendarDays size={21} />
          <div>
            <strong>
              {modal.type === "meeting" ? "Meeting" : "Deadline"}:{" "}
              {dateLabel(effective)}
            </strong>
            <span>
              Reminder: {dateLabel(reminderDate(effective))}, 9 AM Pakistan time
            </span>
            {date !== effective && (
              <small>Falls on a weekend — moved to Monday.</small>
            )}
            {effective < today && (
              <small>
                This date is in the past. No automatic catch-up reminder will be
                sent.
              </small>
            )}
          </div>
        </div>
      )}
    </>
  );
  function close() {
    if (busy) return;
    if (
      form.current?.dataset.dirty === "true" &&
      !confirm("Discard your unsaved changes?")
    )
      return;
    onClose();
  }
  return (
    <dialog
      className="editor-dialog"
      ref={dialog}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
    >
      <div className="dialog-heading">
        <div>
          <span className="eyebrow">OFFICE WORKSPACE</span>
          <h2>{titles[modal.type]}</h2>
        </div>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={close}
        >
          <X size={21} />
        </button>
      </div>
      <form
        ref={form}
        onSubmit={submit}
        onChange={() => {
          if (form.current) form.current.dataset.dirty = "true";
        }}
      >
        <div className="form-grid">
          {modal.type === "task" && (
            <>
              <Field label="Instruction title" wide>
                <input
                  name="title"
                  required
                  maxLength={160}
                  defaultValue={t?.title}
                  placeholder="e.g. Improve the draft policy"
                  autoFocus
                />
              </Field>
              <Field label="What needs to be done?" wide>
                <textarea
                  name="instruction"
                  required
                  maxLength={5000}
                  rows={3}
                  defaultValue={t?.instruction}
                  placeholder="Record the instruction and expected outcome."
                />
              </Field>
              <Field label="Department">
                <select
                  name="department_id"
                  required
                  defaultValue={t?.department_id ?? ""}
                >
                  <option value="" disabled>
                    {data.departments.some((d) => d.active)
                      ? "Select department"
                      : "Add a department in Settings first"}
                  </option>
                  {data.departments
                    .filter((d) => d.active)
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                </select>
              </Field>
              <Field label="Responsible person">
                <input
                  name="responsible"
                  maxLength={200}
                  defaultValue={t?.responsible}
                  placeholder="Name or designation"
                />
              </Field>
              <Field label="Instruction date">
                <input
                  name="instruction_date"
                  type="date"
                  required
                  defaultValue={t?.instruction_date ?? today}
                />
              </Field>
              <Field label="Deadline purpose">
                <select
                  name="deadline_kind"
                  defaultValue={t?.deadline_kind ?? "update"}
                >
                  <option value="update">Progress update due</option>
                  <option value="completion">Completion deadline</option>
                </select>
              </Field>
              {dateFields}
              <Field label="Meeting / source reference" wide>
                <input
                  name="source"
                  maxLength={500}
                  defaultValue={t?.source}
                  placeholder="Optional source or meeting reference"
                />
              </Field>
              {t && (
                <Field label="Reason for changes" wide>
                  <textarea name="reason" required rows={2} maxLength={2000} />
                </Field>
              )}
            </>
          )}
          {modal.type === "meeting" && (
            <>
              <Field label="Related instruction" wide>
                <select
                  name="task_id"
                  required
                  defaultValue={t?.id ?? m?.task_id ?? ""}
                >
                  <option value="" disabled>
                    Select an instruction
                  </option>
                  {data.tasks
                    .filter((x) => x.status !== "cancelled")
                    .map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.reference} — {x.title}
                      </option>
                    ))}
                </select>
              </Field>
              <Field label="Meeting title" wide>
                <input
                  name="title"
                  required
                  maxLength={160}
                  defaultValue={m?.title}
                  placeholder="e.g. Policy progress review"
                />
              </Field>
              <Field label="Meeting type" wide>
                <select name="type" defaultValue={m?.type ?? "review"}>
                  <option value="initial">Initial meeting</option>
                  <option value="review">Review meeting</option>
                  <option value="followup">Follow-up meeting</option>
                </select>
              </Field>
              {dateFields}
              <Field label="Time (optional)">
                <input name="time" type="time" defaultValue={m?.time} />
              </Field>
              <Field label="Venue or meeting link">
                <input name="venue" maxLength={500} defaultValue={m?.venue} />
              </Field>
              {m?.id && (
                <Field label="Reason for changes" wide>
                  <textarea name="reason" required maxLength={2000} rows={2} />
                </Field>
              )}
              <div className="info-box wide">
                New meetings are proposed until confirmed. Saturdays and Sundays
                move to Monday.
              </div>
            </>
          )}
          {modal.type === "contact" && (
            <>
              <Field label="Full name" wide>
                <input
                  name="name"
                  required
                  maxLength={200}
                  defaultValue={c?.name}
                  autoFocus
                />
              </Field>
              <Field label="WhatsApp number" wide>
                <input
                  name="phone"
                  type="tel"
                  required
                  defaultValue={c?.phone}
                  placeholder="+923001234567"
                />
              </Field>
              <Field label="Designation / department" wide>
                <input
                  name="designation"
                  maxLength={200}
                  defaultValue={c?.designation}
                />
              </Field>
              <label className="checkbox-label wide">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                />{" "}
                Enable reminders for this person
              </label>
              <Field label="Consent record" wide>
                <textarea
                  name="consent_note"
                  required={enabled}
                  maxLength={1000}
                  rows={2}
                  defaultValue={c?.consent_note}
                  placeholder="When and how did this person agree to receive these reminders?"
                />
              </Field>
              {c && (
                <label className="checkbox-label wide">
                  <input name="new_consent" type="checkbox" /> Fresh consent
                  recorded (required if changing number)
                </label>
              )}
              <div className="info-box wide">
                After saving, choose Manage reminders to subscribe this person
                to tasks, meetings or departments.
              </div>
            </>
          )}
          {modal.type === "subscription" && (
            <>
              <div className="info-box wide">
                Choose what {c?.name} should receive. Overlapping subscriptions
                are combined into one message.
              </div>
              <Field label="Reminder scope" wide>
                <select
                  value={scope}
                  onChange={(e) => setScope(e.target.value)}
                >
                  <option value="department">A department</option>
                  <option value="task">An instruction and its meetings</option>
                  <option value="meeting">One meeting</option>
                  {data.member.role === "owner" && (
                    <option value="office">All office instructions</option>
                  )}
                </select>
              </Field>
              {scope !== "office" && (
                <Field label="Choose item" wide>
                  <select key={scope} name="target_id" required defaultValue="">
                    <option value="" disabled>
                      Select an item
                    </option>
                    {(scope === "department"
                      ? data.departments.map((d) => ({
                          id: d.id,
                          label: d.name,
                        }))
                      : scope === "task"
                        ? data.tasks.map((t) => ({ id: t.id, label: t.title }))
                        : data.meetings.map((m) => ({
                            id: m.id,
                            label: m.title,
                          }))
                    ).map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.label}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
            </>
          )}
          {modal.type === "department" && (
            <Field label="Department name" wide>
              <input name="name" required maxLength={160} autoFocus />
            </Field>
          )}
          {["transition", "update", "meetingTransition"].includes(
            modal.type,
          ) && (
            <>
              <Field
                label={
                  modal.type === "meetingTransition" && modal.action === "held"
                    ? "Meeting outcome"
                    : "Note / reason"
                }
                wide
              >
                <textarea
                  name="note"
                  required
                  maxLength={2000}
                  rows={4}
                  autoFocus
                  placeholder="Record a short update for the office."
                />
              </Field>
              {modal.type === "meetingTransition" &&
                modal.action === "held" && (
                  <Field label="Actual meeting date" wide>
                    <input
                      name="actual_date"
                      type="date"
                      required
                      defaultValue={m?.effective_date ?? today}
                    />
                  </Field>
                )}
              {modal.action === "confirm_complete" && (
                <>
                  <div className="info-box wide">
                    Confirm only after checking the reported work. Planned
                    meetings are kept unless you choose to cancel them below.
                  </div>
                  <label className="checkbox-label wide">
                    <input name="cancel_meetings" type="checkbox" /> Also cancel
                    the task’s outstanding meetings
                  </label>
                </>
              )}
            </>
          )}
        </div>
        {error && (
          <div className="error-box" role="alert">
            {error}
          </div>
        )}
        <div className="dialog-footer">
          <button
            type="button"
            className="button secondary"
            onClick={close}
            disabled={busy}
          >
            Cancel
          </button>
          <button className="button primary" type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save changes"}
            <Check size={16} />
          </button>
        </div>
      </form>
    </dialog>
  );
}

function Login({
  error,
  onLogin,
}: {
  error: string;
  onLogin: () => Promise<void>;
}) {
  const [message, setMessage] = useState(error),
    [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login", ...values }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      await onLogin();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to sign in");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-page">
      <div className="login-card">
        <div className="brand-seal">G</div>
        <span className="eyebrow">ACS(G) OFFICE WORKSPACE</span>
        <h1>Keep every instruction in view.</h1>
        <p>Sign in with your invited office account.</p>
        <form onSubmit={submit}>
          <Field label="Email">
            <input name="email" type="email" required autoComplete="email" />
          </Field>
          <Field label="Password">
            <input
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="current-password"
            />
          </Field>
          <button className="button primary" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
            <ArrowUpRight size={16} />
          </button>
        </form>
        {message && <div className="error-box">{message}</div>}
        <button
          className="text-button"
          onClick={async () => {
            const email = prompt("Enter your invited email address");
            if (!email) return;
            const response = await fetch("/api/auth", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "recover", email }),
            });
            const body = await response.json();
            setMessage(
              response.ok
                ? "If the address is eligible, a recovery email will arrive."
                : body.error,
            );
          }}
        >
          Forgot password?
        </button>
        <small>
          Private access · Contact the workspace owner for an invitation.
        </small>
      </div>
    </div>
  );
}

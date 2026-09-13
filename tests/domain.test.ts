import { describe, expect, it } from "vitest";
import {
  addDays,
  meetingDate,
  reminderDate,
  pakistanDate,
  buildDigests,
  normalisePhone,
  transitionTask,
  csvCell,
} from "../src/lib/domain";

describe("calendar rules", () => {
  it("adds calendar days without counting the instruction date as day one", () => {
    expect(addDays("2026-09-12", 10)).toBe("2026-09-22");
    expect(reminderDate("2026-09-22")).toBe("2026-09-21");
  });
  it.each([
    ["2026-09-26", "2026-09-28"],
    ["2026-09-27", "2026-09-28"],
    ["2026-09-25", "2026-09-25"],
  ])("rolls meeting %s to %s", (input, output) =>
    expect(meetingDate(input)).toBe(output),
  );
  it("handles leap years, years and zero days", () => {
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
    expect(addDays("2026-12-28", 10)).toBe("2027-01-07");
    expect(addDays("2026-09-12", 0)).toBe("2026-09-12");
  });
  it.each(["2026-02-30", "bad", "2026-13-01"])(
    "rejects invalid calendar date %s",
    (value) => expect(() => addDays(value, 1)).toThrow(),
  );
  it.each([-1, 1.5, 3651])("rejects invalid day count %s", (days) =>
    expect(() => addDays("2026-09-12", days)).toThrow(),
  );
  it("uses Pakistan local date independent of browser timezone", () =>
    expect(pakistanDate(new Date("2026-09-20T20:01:00Z"))).toBe("2026-09-21"));
});

describe("recipient-specific reminders", () => {
  const task = {
    id: "t1",
    reference: "ACS-000001",
    title: "Review policy",
    department_id: "d1",
    status: "reported_complete",
    deadline: "2026-09-22",
    deadline_kind: "update",
    reminder_revision: 1,
  };
  const task2 = {
    ...task,
    id: "t2",
    reference: "ACS-000002",
    department_id: "d2",
    title: "Review standards",
  };
  const contacts = [
    {
      id: "c1",
      name: "Office",
      phone: "+19995550101",
      enabled: true,
      consent_at: "2026-09-01T00:00:00Z",
    },
    {
      id: "c2",
      name: "Officer",
      phone: "+19995550102",
      enabled: true,
      consent_at: "2026-09-01T00:00:00Z",
    },
  ];
  const subscriptions = [
    { contact_id: "c1", scope: "office", target_id: null },
    { contact_id: "c2", scope: "task", target_id: "t1" },
    { contact_id: "c2", scope: "department", target_id: "d1" },
  ];
  it("sends each recipient relevant items once despite overlapping scopes", () => {
    const digests = buildDigests(
      { tasks: [task, task2], meetings: [], contacts, subscriptions },
      "2026-09-22",
    );
    expect(digests).toHaveLength(2);
    expect(digests[0].items).toHaveLength(2);
    expect(digests[1].items).toHaveLength(1);
    expect(digests[1].items[0].label).toContain("awaiting confirmation");
  });
  it("excludes completed deadlines and opted-out recipients but keeps a planned meeting", () => {
    const digests = buildDigests(
      {
        tasks: [{ ...task, status: "completed" }],
        meetings: [
          {
            id: "m1",
            task_id: "t1",
            title: "Policy review",
            effective_date: "2026-09-22",
            state: "proposed",
            reminder_revision: 1,
          },
        ],
        contacts: [contacts[0], { ...contacts[1], enabled: false }],
        subscriptions,
      },
      "2026-09-22",
    );
    expect(digests).toHaveLength(1);
    expect(digests[0].items).toHaveLength(1);
    expect(digests[0].items[0].kind).toBe("meeting");
  });
  it("does not emit empty messages", () =>
    expect(
      buildDigests(
        { tasks: [task], meetings: [], contacts, subscriptions },
        "2026-09-25",
      ),
    ).toEqual([]));
  it("normalises phone punctuation and rejects ambiguous local numbers", () => {
    expect(normalisePhone("+92 300-1234567")).toBe("+923001234567");
    expect(() => normalisePhone("03001234567")).toThrow();
  });
});

describe("protected transitions and export", () => {
  it("does not let an editor confirm completion", () =>
    expect(() =>
      transitionTask("reported_complete", "confirm_complete", "editor"),
    ).toThrow());
  it("allows staff reporting and owner confirmation", () => {
    expect(transitionTask("in_progress", "report_complete", "editor")).toBe(
      "reported_complete",
    );
    expect(
      transitionTask("reported_complete", "confirm_complete", "owner"),
    ).toBe("completed");
  });
  it("does not allow confirming an unreported task", () =>
    expect(() =>
      transitionTask("open", "confirm_complete", "owner"),
    ).toThrow());
  it("neutralises spreadsheet formulas", () =>
    expect(csvCell("=CMD()")).toBe('"\'=CMD()"'));
});

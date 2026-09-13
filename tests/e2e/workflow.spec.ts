import { test, expect } from "@playwright/test";
test("office workflow: create instruction, adjust weekend meeting and persist changes", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "A clear view of what’s next." }),
  ).toBeVisible({ timeout: 60000 });
  await expect(page.getByText("Local preview · Sample records")).toBeVisible();
  await page.screenshot({ path: "test-results/overview.png", fullPage: true });
  await page
    .getByRole("button", { name: "Add instruction", exact: true })
    .click();
  const title = `Policy review test ${Date.now()}`;
  await page.getByLabel("Instruction title").fill(title);
  await page
    .getByLabel("What needs to be done?")
    .fill("Improve the policy and present an update after ten days.");
  await page
    .getByLabel("Department", { exact: true })
    .selectOption({ label: "Establishment" });
  await page.getByLabel("Instruction date", { exact: true }).fill("2026-09-12");
  await page.getByRole("button", { name: "After a number of days" }).click();
  await page.getByLabel("Count from").fill("2026-09-12");
  await page.getByLabel("Calendar days after this date").fill("10");
  await expect(page.getByText(/Deadline: 22 Sept? 2026/)).toBeVisible();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page
    .getByRole("button", { name: "Instructions", exact: false })
    .first()
    .click();
  await page.getByLabel("Search instructions").fill(title);
  await page.getByRole("button", { name: title, exact: true }).click();
  await page.getByRole("button", { name: "Add meeting", exact: true }).click();
  await page.getByLabel("Meeting title").fill("Weekend follow-up");
  await page.getByLabel("Requested meeting date").fill("2026-09-26");
  await expect(page.getByText(/Meeting: 28 Sept? 2026/)).toBeVisible();
  await expect(
    page.getByText("Falls on a weekend — moved to Monday."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Meetings", exact: true }).click();
  await expect(
    page
      .getByRole("heading", { name: "Weekend follow-up", exact: true })
      .last(),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("button", { name: "Add meeting", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/mobile-agenda.png",
    fullPage: true,
  });
});

test("add consenting recipient, subscribe and record a mock reminder", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "A clear view of what’s next." }),
  ).toBeVisible({ timeout: 60000 });
  await page.getByRole("button", { name: "People", exact: true }).click();
  await page.getByRole("button", { name: "Add person", exact: true }).click();
  const name = `Preview contact ${Date.now()}`;
  await page.getByLabel("Full name", { exact: true }).fill(name);
  await page
    .getByLabel("WhatsApp number", { exact: true })
    .fill("+1999" + String(Date.now()).slice(-7));
  await page
    .getByLabel("Consent record", { exact: true })
    .fill(
      "Synthetic browser test recipient; no real messaging consent or number.",
    );
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  const row = page.getByRole("row").filter({ hasText: name });
  await row.getByRole("button", { name: "Manage reminders" }).click();
  await page
    .getByLabel("Reminder scope", { exact: true })
    .selectOption("office");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("button", { name: "Reminders", exact: true }).click();
  const card = page
    .locator(".message-preview")
    .filter({ has: page.getByRole("heading", { name, exact: true }) });
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Record test reminder" }).click();
  await expect(
    page.getByText("1 test reminder(s) recorded. No WhatsApp was sent."),
  ).toBeVisible();
  await expect(
    page.getByRole("row").filter({ hasText: name }).getByText("Test recorded"),
  ).toBeVisible();
});

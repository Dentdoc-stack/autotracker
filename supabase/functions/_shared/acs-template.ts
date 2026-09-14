export const TEMPLATE_BODY = 'ACS(G) Office — Follow-up reminder\nInstruction: {{1}}\nDepartment: {{2}}\nDue date: {{3}}\nAction required: {{4}}\nPlease coordinate the update or meeting with the office.';

type Item = {
  kind: string; reference: string; title: string; instruction: string;
  department_name: string; deadline: string; effective_date: string | null;
  time: string | null; venue: string | null; label: string;
};
const line = (value: string) => value.replace(/\s+/g, ' ').trim();
function dateLabel(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Invalid reminder date');
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new Error('Invalid reminder date');
  return new Intl.DateTimeFormat('en-GB', {day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(date);
}

// Map structured database records, never sample values or truncated preview text.
export function buildVariables(items: Item[]): string {
  if (!Array.isArray(items) || !items.length) throw new Error('Reminder has no items');
  const columns: string[][] = [[], [], [], []];
  items.forEach((item, index) => {
    const prefix = items.length > 1 ? `${index + 1}) ` : '';
    if (!item.instruction || !item.department_name || !['meeting','deadline'].includes(item.kind)) throw new Error('Incomplete reminder item');
    const date = item.kind === 'meeting' ? item.effective_date : item.deadline;
    if (!date) throw new Error('Missing reminder date');
    columns[0].push(prefix + line(`${item.reference} — ${item.title}: ${item.instruction}`));
    columns[1].push(prefix + line(item.department_name));
    columns[2].push(prefix + dateLabel(date) + (item.kind === 'meeting' && item.time ? ` at ${line(item.time)} PKT` : ''));
    columns[3].push(prefix + line(item.label + (item.kind === 'meeting' && item.venue ? ` — ${item.venue}` : '')));
  });
  const variables = Object.fromEntries(columns.map((values, index) => [String(index + 1), values.join(' | ')]));
  const rendered = TEMPLATE_BODY.replace(/\{\{([1-4])\}\}/g, (_, key: string) => variables[key]);
  // Conservative application limit. Never silently drop instructions or items.
  if (rendered.length > 1024) throw new Error('Reminder is too long for the ACS WhatsApp template (1024 characters). No text was sent or truncated; review the reminder in the tracker.');
  return JSON.stringify(variables);
}

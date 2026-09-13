import { z } from "zod";
import { apiError, checkRequest } from "@/lib/api";
import { isLocalPreview, withLocalDatabase } from "@/lib/local-db";
import { supabaseServer } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";
async function rpc(name: string, p: Record<string, unknown>) {
  if (isLocalPreview())
    return withLocalDatabase(async (db) => {
      if (name === "preview_reminders")
        return (
          await db.query<{ result: unknown }>(
            "select preview_reminders($1::date) result",
            [p.d as string],
          )
        ).rows[0].result;
      if (name === "resend_notification")
        return (
          await db.query<{ result: string }>(
            "select resend_notification($1::uuid) result",
            [p.message_id as string],
          )
        ).rows[0].result;
      return (
        await db.query<{ result: number }>(
          "select queue_manual_reminders($1::date,$2::uuid[],$3,$4::jsonb) result",
          [
            p.d as string,
            p.selected as string[],
            p.request_id as string,
            JSON.stringify(p.expected),
          ],
        )
      ).rows[0].result;
    });
  const db = await supabaseServer();
  const r = await db.rpc(name, p);
  if (r.error) throw new Error(r.error.message);
  return r.data;
}
export async function GET(request: Request) {
  try {
    checkRequest(request);
    const d = z
      .string()
      .date()
      .parse(new URL(request.url).searchParams.get("dueDate"));
    return Response.json(await rpc("preview_reminders", { d }), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(request: Request) {
  try {
    checkRequest(request, true);
    const body = await request.json();
    const resend = z.object({ resendId: z.string().uuid() }).safeParse(body);
    if (resend.success) {
      const messageId = await rpc("resend_notification", {
        message_id: resend.data.resendId,
      });
      return Response.json({
        messageId,
        message: "Reminder queued for resend.",
      });
    }
    const input = z
      .object({
        dueDate: z.string().date(),
        contactIds: z.array(z.string().uuid()).min(1).max(1000),
        idempotencyKey: z.string().uuid(),
        expected: z.record(z.string(), z.string().max(50000)),
      })
      .parse(body);
    const count = await rpc("queue_manual_reminders", {
      d: input.dueDate,
      selected: input.contactIds,
      request_id: input.idempotencyKey,
      expected: input.expected,
    });
    return Response.json({
      count,
      message: count
        ? isLocalPreview()
          ? `${count} test reminder(s) recorded. No WhatsApp was sent.`
          : `${count} reminder(s) prepared. Check history for their delivery status.`
        : "These reminders were already recorded; no duplicates created.",
    });
  } catch (e) {
    return apiError(e);
  }
}

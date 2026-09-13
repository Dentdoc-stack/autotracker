import { z } from "zod";
import { apiError, checkRequest, command } from "@/lib/api";
const input = z.object({
  action: z.enum([
    "save_department",
    "save_task",
    "transition_task",
    "add_update",
    "save_meeting",
    "transition_meeting",
    "save_contact",
    "save_subscription",
    "remove_subscription",
  ]),
  payload: z.record(z.string(), z.unknown()),
});
export async function POST(request: Request) {
  try {
    checkRequest(request, true);
    const raw = await request.text();
    if (raw.length > 20000) throw new Error("Request is too large");
    const data = input.parse(JSON.parse(raw));
    return Response.json(await command(data.action, data.payload));
  } catch (e) {
    return apiError(e);
  }
}

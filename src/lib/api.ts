import "server-only";
import { isLocalPreview, localWorkspace, localCommand } from "./local-db";
import { supabaseServer } from "./supabase/server";
import { type Workspace } from "./domain";
export function checkRequest(request: Request, mutation = false) {
  const url = new URL(request.url);
  if (
    isLocalPreview() &&
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
  )
    throw new Error("Local preview is available on this computer only");
  if (mutation) {
    const origin = request.headers.get("origin");
    const allowed = isLocalPreview()
      ? url.origin
      : process.env.APP_BASE_URL || url.origin;
    let originAllowed = origin === allowed;
    if (!originAllowed && origin && process.env.APP_ENV === "staging") {
      try {
        const received = new URL(origin);
        const configured = new URL(allowed);
        const loopback = new Set(["localhost", "127.0.0.1", "[::1]"]);
        originAllowed =
          received.protocol === configured.protocol &&
          received.port === configured.port &&
          loopback.has(received.hostname) &&
          loopback.has(configured.hostname);
      } catch {
        originAllowed = false;
      }
    }
    if (!origin || !originAllowed)
      throw new Error("Request origin not permitted");
    if (!request.headers.get("content-type")?.includes("application/json"))
      throw new Error("JSON request required");
    const len = Number(request.headers.get("content-length") ?? 0);
    if (len > 20000) throw new Error("Request is too large");
  }
}
export async function workspace(): Promise<Workspace> {
  if (isLocalPreview()) return localWorkspace();
  const db = await supabaseServer();
  const { data: auth, error } = await db.auth.getUser();
  if (error || !auth.user) throw new Error("Sign in to access the workspace");
  const result = await db.rpc("get_workspace");
  if (result.error) throw new Error(result.error.message);
  const settings = await db
    .from("app_settings")
    .select("messaging_mode,automatic_enabled")
    .single();
  if (settings.error) throw new Error(settings.error.message);
  return { ...result.data, settings: settings.data } as Workspace;
}
export async function command(
  action: string,
  payload: Record<string, unknown>,
) {
  if (isLocalPreview()) return localCommand(action, payload);
  const db = await supabaseServer();
  const { data: auth, error } = await db.auth.getUser();
  if (error || !auth.user) throw new Error("Sign in to access the workspace");
  const result = await db.rpc("apply_command", { action, p: payload });
  if (result.error) throw new Error(result.error.message);
  return result.data;
}
export function apiError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : "The request could not be completed";
  const status = /conflict/i.test(message)
    ? 409
    : /sign in/i.test(message)
      ? 401
      : /permission|owner|permitted|invitation/i.test(message)
        ? 403
        : 400;
  return Response.json({ error: message }, { status });
}

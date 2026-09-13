import { apiError, checkRequest } from "@/lib/api";
import { supabaseServer } from "@/lib/supabase/server";
import { z } from "zod";
export async function POST(request: Request) {
  try {
    checkRequest(request, true);
    const input = z
      .object({
        action: z.enum(["login", "logout", "recover", "password"]),
        email: z.string().email().optional(),
        password: z.string().min(8).max(128).optional(),
      })
      .parse(await request.json());
    const db = await supabaseServer();
    if (input.action === "logout") {
      await db.auth.signOut();
      return Response.json({ ok: true });
    }
    if (input.action === "recover") {
      if (!input.email) throw new Error("Enter your email");
      const r = await db.auth.resetPasswordForEmail(input.email, {
        redirectTo: `${process.env.APP_BASE_URL}/auth/callback?next=/reset-password`,
      });
      if (r.error) throw new Error(r.error.message);
      return Response.json({ ok: true });
    }
    if (input.action === "password") {
      if (!input.password) throw new Error("Enter a new password");
      const r = await db.auth.updateUser({ password: input.password });
      if (r.error) throw new Error(r.error.message);
      return Response.json({ ok: true });
    }
    if (!input.email || !input.password)
      throw new Error("Enter email and password");
    const r = await db.auth.signInWithPassword({
      email: input.email,
      password: input.password,
    });
    if (r.error) throw new Error("Email or password is incorrect");
    const member = await db
      .from("memberships")
      .select("id")
      .eq("id", r.data.user.id)
      .eq("active", true)
      .maybeSingle();
    if (!member.data) {
      await db.auth.signOut();
      throw new Error("An active office invitation is required");
    }
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}

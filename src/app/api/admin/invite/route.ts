import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { apiError, checkRequest, workspace } from "@/lib/api";
import { isLocalPreview } from "@/lib/local-db";
export async function POST(request: Request) {
  try {
    checkRequest(request, true);
    if (isLocalPreview())
      throw new Error(
        "Connect Supabase before inviting office accounts. The local preview uses one sample owner.",
      );
    const current = await workspace();
    if (current.member.role !== "owner")
      throw new Error("Only the owner can invite people");
    const p = z
      .object({
        name: z.string().trim().min(1).max(200),
        email: z.string().email(),
        role: z.enum(["editor", "viewer"]),
      })
      .parse(await request.json());
    const key = process.env.SUPABASE_ADMIN_KEY;
    if (!key)
      throw new Error(
        "Configure the server admin key before inviting accounts",
      );
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const invitation = await db.auth.admin.inviteUserByEmail(p.email, {
      redirectTo: `${process.env.APP_BASE_URL}/auth/callback?next=/reset-password`,
      data: { name: p.name },
    });
    if (invitation.error) throw new Error(invitation.error.message);
    const membership = await db.from("memberships").insert({
      id: invitation.data.user.id,
      name: p.name,
      role: p.role,
      active: true,
    });
    if (membership.error)
      throw new Error(
        "The email invitation was created, but workspace access was not saved. The account has no app access; ask the administrator to repair its membership.",
      );
    return Response.json({
      message:
        "Invitation sent. The person can set a password from their email.",
    });
  } catch (e) {
    return apiError(e);
  }
}

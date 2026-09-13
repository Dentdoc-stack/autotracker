import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next =
    url.searchParams.get("next") === "/reset-password"
      ? "/reset-password"
      : "/";
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  if (
    tokenHash &&
    (type === "invite" || type === "recovery" || type === "email")
  ) {
    const db = await supabaseServer();
    const { error } = await db.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error)
      return NextResponse.redirect(
        new URL(next, process.env.APP_BASE_URL || url.origin),
      );
  }
  if (code) {
    const db = await supabaseServer();
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (!error)
      return NextResponse.redirect(
        new URL(next, process.env.APP_BASE_URL || url.origin),
      );
  }
  return NextResponse.redirect(
    new URL("/?auth=expired", process.env.APP_BASE_URL || url.origin),
  );
}

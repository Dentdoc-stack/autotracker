import { createClient } from "@supabase/supabase-js";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key = process.env.SUPABASE_ADMIN_KEY,
  email = process.env.OWNER_EMAIL;
if (!url || !key || !email)
  throw new Error(
    "Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_ADMIN_KEY and OWNER_EMAIL in your private environment file.",
  );
const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const existing = await db
  .from("memberships")
  .select("id")
  .eq("role", "owner")
  .eq("active", true);
if (existing.error)
  throw new Error(
    "Apply the database migrations before bootstrapping the owner.",
  );
if (existing.data.length)
  throw new Error("An active owner already exists. No changes made.");
let user;
for (let page = 1; page <= 100; page++) {
  const result = await db.auth.admin.listUsers({ page, perPage: 100 });
  if (result.error) throw result.error;
  user = result.data.users.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase(),
  );
  if (user || result.data.users.length < 100) break;
}
if (!user)
  throw new Error(
    "First create or invite your owner account in Supabase Authentication > Users.",
  );
const saved = await db
  .from("memberships")
  .insert({
    id: user.id,
    name: process.env.OWNER_NAME || "Workspace owner",
    role: "owner",
    active: true,
  });
if (saved.error) throw saved.error;
console.log(
  "Owner membership created. Sign in using your Supabase account credentials.",
);

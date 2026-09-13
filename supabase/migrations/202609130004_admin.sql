-- Privileged invitations run on the server after verifying the caller is the owner.
grant select,insert,update on public.memberships to service_role;
revoke create on schema public from public,anon,authenticated;

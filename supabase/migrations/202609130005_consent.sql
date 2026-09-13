create function public.protect_contact_consent() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if new.enabled and (not old.enabled or new.phone<>old.phone) and (new.consent_at is null or new.consent_at is not distinct from old.consent_at) then
   raise exception 'Fresh consent is required before re-enabling this recipient';
 end if;
 return new;
end $$;
create trigger require_fresh_contact_consent before update on public.contacts for each row execute function public.protect_contact_consent();

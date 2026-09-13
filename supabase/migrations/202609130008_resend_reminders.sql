create or replace function public.resend_notification(message_id uuid) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare old public.notification_messages; candidate record; mode text; new_id uuid;
begin
 if coalesce(public.current_office_role(),'') not in ('owner','editor') then raise exception 'Editing permission required'; end if;
 select * into old from public.notification_messages where id=message_id for update;
 if not found then raise exception 'Reminder not found'; end if;
 if old.state not in ('failed','unknown') then raise exception 'Only failed or unknown reminders can be resent'; end if;
 select * into candidate from public.digest_candidates(old.due_date,null,old.id) where contact_id=old.contact_id;
 if not found then raise exception 'Recipient or reminder is no longer eligible'; end if;
 if candidate.contact_version is distinct from old.contact_version or candidate.phone is distinct from old.phone_snapshot or candidate.body is distinct from old.body then
   raise exception 'Reminder content changed. Preview the current reminder before resending';
 end if;
 select messaging_mode into mode from public.app_settings;
 insert into public.notification_messages(contact_id,contact_name,body,state,due_date,item_keys,logical_key,request_key,requested_by,contact_version,phone_snapshot)
 values(candidate.contact_id,candidate.contact_name,candidate.body,case when mode='mock' then 'mock' else 'queued' end,old.due_date,candidate.item_keys,
   old.logical_key||':resend:'||gen_random_uuid()::text,'resend:'||old.id||':'||gen_random_uuid()::text,auth.uid(),candidate.contact_version,candidate.phone)
 returning id into new_id;
 return new_id;
end $$;
revoke all on function public.resend_notification(uuid) from public,anon,authenticated;
grant execute on function public.resend_notification(uuid) to authenticated;

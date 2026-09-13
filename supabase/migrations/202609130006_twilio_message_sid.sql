create or replace function public.record_whatsapp_status(message_id uuid,sid text,new_state text,provider_error text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare n public.notification_messages; mapped text; old_rank integer; new_rank integer;
begin
 select * into n from public.notification_messages where id=message_id for update;
 if not found then raise exception 'Message not found'; end if;
 if n.provider_sid is not null and n.provider_sid<>sid then raise exception 'Provider message mismatch'; end if;
 if sid is null or sid !~ '^(SM|MM)[0-9a-fA-F]{32}$' then raise exception 'Invalid provider message ID'; end if;
 mapped:=case when new_state='undelivered' then 'failed' when new_state='queued' then 'accepted' else new_state end;
 if mapped not in ('queued','accepted','sent','delivered','read','failed') then return; end if;
 insert into public.provider_events(message_id,provider_sid,state,error) values(message_id,sid,mapped,provider_error) on conflict do nothing;
 if not found then return; end if;
 old_rank:=case n.state when 'accepted' then 1 when 'sent' then 2 when 'delivered' then 3 when 'read' then 4 else 0 end;
 new_rank:=case mapped when 'accepted' then 1 when 'sent' then 2 when 'delivered' then 3 when 'read' then 4 else 0 end;
 if new_rank>=old_rank or (mapped='failed' and old_rank<3) then
   update public.notification_messages set provider_sid=sid,state=mapped,error=provider_error,lease_until=null where id=message_id;
 else update public.notification_messages set provider_sid=sid where id=message_id; end if;
end $$;
revoke all on function public.record_whatsapp_status(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.record_whatsapp_status(uuid,text,text,text) to service_role;

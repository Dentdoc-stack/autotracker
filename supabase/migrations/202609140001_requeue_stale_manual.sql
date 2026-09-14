create or replace function public.queue_manual_reminders(d date,selected uuid[],request_id text,expected jsonb) returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare c record; n integer:=0; mode text; phase text; uid uuid:=auth.uid(); allowed_count integer; limit_disabled boolean;
begin
 if coalesce(public.current_office_role(),'') not in ('owner','editor') then raise exception 'Editing permission required'; end if;
 if length(request_id) not between 16 and 100 or cardinality(selected)<1 or cardinality(selected)>1000 then raise exception 'Invalid reminder request'; end if;
 perform pg_advisory_xact_lock(928442);
 if exists(select 1 from public.notification_messages where request_key=request_id and requested_by=uid) then return 0; end if;
 select manual_limit_disabled into limit_disabled from public.app_settings where id=true;
 if not coalesce(limit_disabled,false) and ((select count(distinct request_key) from public.notification_messages where requested_by=uid and created_at>now()-interval '1 hour')>=5 or (select count(distinct request_key) from public.notification_messages where requested_by is not null and (created_at at time zone 'Asia/Karachi')::date=(now() at time zone 'Asia/Karachi')::date)>=20) then raise exception 'Manual reminder limit reached. Try later'; end if;
 select count(*) into allowed_count from public.digest_candidates(d) where contact_id=any(selected);
 if allowed_count=0 and not exists(select 1 from unnest(selected) s where not exists(select 1 from public.notification_messages n where n.contact_id=s and n.body=expected->>s::text and n.state not in ('skipped','failed'))) then return 0; end if;
 if allowed_count<>(select count(distinct x) from unnest(selected) x) then raise exception 'Conflict: recipients or subscriptions changed. Preview again'; end if;
 select messaging_mode into mode from public.app_settings;
 phase:=case when now() < ((d-1)+time '09:00') at time zone 'Asia/Karachi' then 'early' else 'normal' end;
 for c in select * from public.digest_candidates(d) where contact_id=any(selected) loop
   if expected->>c.contact_id::text is distinct from c.body then raise exception 'Conflict: reminder content changed. Preview again'; end if;
   insert into public.notification_messages(contact_id,contact_name,body,state,due_date,item_keys,logical_key,request_key,requested_by,contact_version,phone_snapshot)
   values(c.contact_id,c.contact_name,c.body,case when mode='mock' then 'mock' else 'queued' end,d,c.item_keys,c.contact_id||':'||d||':'||phase||':'||md5(c.item_keys::text),request_id,uid,c.contact_version,c.phone)
   on conflict(logical_key) do update set
     contact_name=excluded.contact_name,body=excluded.body,state=excluded.state,item_keys=excluded.item_keys,
     request_key=excluded.request_key,requested_by=excluded.requested_by,contact_version=excluded.contact_version,
     phone_snapshot=excluded.phone_snapshot,error=null,lease_until=null,attempts=0
   where public.notification_messages.state in ('skipped','failed') and public.notification_messages.provider_sid is null;
   if found then n:=n+1; end if;
 end loop;
 return n;
end $$;
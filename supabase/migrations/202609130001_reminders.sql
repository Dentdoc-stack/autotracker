create table public.daily_runs(run_date date primary key,created_at timestamptz not null default now(),state text not null,recipient_count integer not null default 0);
alter table public.daily_runs enable row level security;
revoke all on public.daily_runs from anon,authenticated;
grant select on public.daily_runs to authenticated;
create policy staff_read on public.daily_runs for select to authenticated using(public.current_office_role() in ('owner','editor'));
alter table public.notification_messages add column request_key text,add column requested_by uuid references public.memberships(id),add column contact_version integer,add column phone_snapshot text;

create function public.digest_candidates(d date,cutoff timestamptz default null) returns table(contact_id uuid,contact_name text,phone text,contact_version integer,items jsonb,item_keys jsonb,body text)
language sql stable security definer set search_path=public,pg_temp as $$
with events as (
 select 'deadline' kind,t.id,t.id task_id,t.reference,t.title,t.department_id,t.reminder_revision revision,
 case when t.status='reported_complete' then 'Completion awaiting confirmation' when t.deadline_kind='update' then 'Update due' else 'Completion due' end label,
 'deadline:'||t.id||':'||t.reminder_revision||':'||d as key
 from public.tasks t where deadline=d and status not in ('completed','cancelled') and (cutoff is null or reminder_changed_at<=cutoff)
 union all
 select 'meeting',m.id,t.id,t.reference,m.title,t.department_id,m.reminder_revision,
 case when m.state='confirmed' then 'Meeting scheduled' else 'Arrange meeting' end,
 'meeting:'||m.id||':'||m.reminder_revision||':'||d
 from public.meetings m join public.tasks t on t.id=m.task_id
 where m.effective_date=d and m.state in ('proposed','confirmed') and t.status<>'cancelled' and (cutoff is null or m.reminder_changed_at<=cutoff)
), matched as (
 select c.id contact_id,c.name contact_name,c.phone,c.version contact_version,e.*,dep.name department_name
 from public.contacts c cross join events e join public.departments dep on dep.id=e.department_id
 where c.enabled and c.consent_at is not null and (cutoff is null or c.created_at<=cutoff)
 and exists(select 1 from public.reminder_subscriptions s where s.contact_id=c.id and (cutoff is null or s.created_at<=cutoff)
 and (s.scope='office' or (s.scope='department' and s.target_id=e.department_id) or (s.scope='task' and s.target_id=e.task_id) or (s.scope='meeting' and e.kind='meeting' and s.target_id=e.id)))
)
select contact_id,contact_name,phone,contact_version,
 jsonb_agg(jsonb_build_object('key',key,'kind',kind,'id',id,'task_id',task_id,'title',title,'reference',reference,'department_id',department_id,'label',label,'revision',revision) order by reference,kind),
 jsonb_agg(key order by reference,kind),
 'ACS(G) Office • Follow-ups'||chr(10)||to_char(d,'FMDD Mon YYYY')||chr(10)||chr(10)||string_agg(reference||' · '||title||chr(10)||department_name||' — '||label,chr(10)||chr(10) order by reference,kind)
from matched group by contact_id,contact_name,phone,contact_version
$$;

create function public.preview_reminders(d date) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if coalesce(public.current_office_role(),'') not in ('owner','editor') then raise exception 'Editing permission required'; end if;
 return coalesce((select jsonb_agg(to_jsonb(c)) from public.digest_candidates(d) c),'[]');
end $$;

create function public.queue_manual_reminders(d date,selected uuid[],request_id text,expected jsonb) returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare c record; n integer:=0; mode text; phase text; uid uuid:=auth.uid(); allowed_count integer;
begin
 if coalesce(public.current_office_role(),'') not in ('owner','editor') then raise exception 'Editing permission required'; end if;
 if length(request_id) not between 16 and 100 or cardinality(selected)<1 or cardinality(selected)>1000 then raise exception 'Invalid reminder request'; end if;
 perform pg_advisory_xact_lock(928442);
 if exists(select 1 from public.notification_messages where request_key=request_id and requested_by=uid) then return 0; end if;
 if (select count(distinct request_key) from public.notification_messages where requested_by=uid and created_at>now()-interval '1 hour')>=5 or (select count(distinct request_key) from public.notification_messages where requested_by is not null and (created_at at time zone 'Asia/Karachi')::date=(now() at time zone 'Asia/Karachi')::date)>=20 then raise exception 'Manual reminder limit reached. Try later'; end if;
 select count(*) into allowed_count from public.digest_candidates(d) where contact_id=any(selected);
 if allowed_count<>(select count(distinct x) from unnest(selected) x) then raise exception 'Conflict: recipients or subscriptions changed. Preview again'; end if;
 select messaging_mode into mode from public.app_settings;
 phase:=case when now() < ((d-1)+time '09:00') at time zone 'Asia/Karachi' then 'early' else 'normal' end;
 for c in select * from public.digest_candidates(d) where contact_id=any(selected) loop
   if expected->>c.contact_id::text is distinct from c.body then raise exception 'Conflict: reminder content changed. Preview again'; end if;
   insert into public.notification_messages(contact_id,contact_name,body,state,due_date,item_keys,logical_key,request_key,requested_by,contact_version,phone_snapshot)
   values(c.contact_id,c.contact_name,c.body,case when mode='mock' then 'mock' else 'queued' end,d,c.item_keys,
     c.contact_id||':'||d||':'||phase||':'||md5(c.item_keys::text),request_id,uid,c.contact_version,c.phone)
   on conflict(logical_key) do nothing;
   if found then n:=n+1; end if;
 end loop;
 return n;
end $$;

create function public.schedule_daily_digest() returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare local_now timestamp:=now() at time zone 'Asia/Karachi'; d date; c record; n integer:=0; mode text; enabled boolean;
begin
 select messaging_mode,automatic_enabled into mode,enabled from public.app_settings;
 if not enabled or local_now::time<time '09:00' then return 0; end if;
 insert into public.daily_runs(run_date,state) values(local_now::date,case when local_now::time>time '09:30' then 'missed' else 'prepared' end) on conflict do nothing;
 if not found or local_now::time>time '09:30' then return 0; end if;
 d:=local_now::date+1;
 for c in select * from public.digest_candidates(d,(local_now::date+time '09:00') at time zone 'Asia/Karachi') loop
   insert into public.notification_messages(contact_id,contact_name,body,state,due_date,item_keys,logical_key,contact_version,phone_snapshot)
   values(c.contact_id,c.contact_name,c.body,case when mode='mock' then 'mock' else 'queued' end,d,c.item_keys,
     c.contact_id||':'||d||':normal:'||md5(c.item_keys::text),c.contact_version,c.phone) on conflict do nothing;
   if found then n:=n+1; end if;
 end loop;
 update public.daily_runs set recipient_count=n,state=case when n=0 then 'empty' else 'prepared' end where run_date=local_now::date;
 return n;
end $$;

create function public.claim_reminder_batch() returns setof public.notification_messages language plpgsql security definer set search_path=public,pg_temp as $$
begin
 update public.notification_messages set state='unknown',error='Delivery may have been accepted. Reconcile before retrying.' where state='sending' and lease_until<now();
 update public.notification_messages n set state='skipped',error='Recipient, content, subscription or delivery window changed; preview again.'
 where n.state='queued' and (
   (n.requested_by is null and ((now() at time zone 'Asia/Karachi')::date<>n.due_date-1 or (now() at time zone 'Asia/Karachi')::time>time '09:30'))
   or (n.requested_by is not null and n.created_at<now()-interval '30 minutes')
   or not exists(select 1 from public.digest_candidates(n.due_date) c where c.contact_id=n.contact_id and c.contact_version=n.contact_version and c.phone=n.phone_snapshot and c.body=n.body and c.item_keys=n.item_keys));
 return query with batch as (select id from public.notification_messages where state='queued' order by created_at for update skip locked limit 5)
 update public.notification_messages n set state='sending',lease_until=now()+interval '2 minutes',attempts=attempts+1 from batch where n.id=batch.id returning n.*;
end $$;

revoke all on function public.digest_candidates(date,timestamptz),public.preview_reminders(date),public.queue_manual_reminders(date,uuid[],text,jsonb),public.schedule_daily_digest(),public.claim_reminder_batch() from public,anon,authenticated;
grant execute on function public.preview_reminders(date),public.queue_manual_reminders(date,uuid[],text,jsonb) to authenticated;
grant execute on function public.digest_candidates(date,timestamptz),public.schedule_daily_digest(),public.claim_reminder_batch() to service_role;
grant select,update on public.notification_messages to service_role;
grant select on public.app_settings to service_role;

drop function public.digest_candidates(date,timestamptz,uuid);
create function public.digest_candidates(d date,cutoff timestamptz default null,for_message uuid default null) returns table(contact_id uuid,contact_name text,phone text,contact_version integer,items jsonb,item_keys jsonb,body text)
language sql stable security definer set search_path=public,pg_temp as $$
with events as (
 select 'deadline' kind,t.id,t.id task_id,t.reference,t.title,t.instruction,t.department_id,t.reminder_revision revision,
 t.deadline,t.deadline_kind,null::date requested_date,null::date effective_date,null::text meeting_time,null::text venue,null::text meeting_type,
 case when t.status='reported_complete' then 'Completion awaiting confirmation' when t.deadline_kind='update' then 'Update due' else 'Completion due' end label,
 'deadline:'||t.id||':'||t.reminder_revision||':'||d as key
 from public.tasks t where deadline=d and status not in ('completed','cancelled') and (cutoff is null or reminder_changed_at<=cutoff)
 union all
 select 'meeting',m.id,t.id,t.reference,m.title,t.instruction,t.department_id,m.reminder_revision,
 t.deadline,t.deadline_kind,m.requested_date,m.effective_date,m.time,m.venue,m.type,
 case when m.state='confirmed' then 'Meeting scheduled' else 'Arrange meeting' end,
 'meeting:'||m.id||':'||m.reminder_revision||':'||d
 from public.meetings m join public.tasks t on t.id=m.task_id
 where m.effective_date=d and m.state in ('proposed','confirmed') and t.status<>'cancelled' and (cutoff is null or m.reminder_changed_at<=cutoff)
), matched as (
 select c.id contact_id,c.name contact_name,c.phone,c.version contact_version,e.*,dep.name department_name
 from public.contacts c cross join events e join public.departments dep on dep.id=e.department_id
 where c.enabled and c.consent_at is not null and (cutoff is null or c.created_at<=cutoff)
 and not exists (
   select 1 from public.notification_messages n
   where n.contact_id=c.id and n.due_date=d and n.item_keys ? e.key
   and (for_message is null or n.id<>for_message)
   and n.state not in ('skipped','failed')
   and (n.state='mock')=((select messaging_mode from public.app_settings)='mock')
   and n.logical_key like '%:'||coalesce(
      (select case when x.logical_key like '%:early:%' then 'early' else 'normal' end from public.notification_messages x where x.id=for_message),
      case when cutoff is null and now()<((d-1)+time '09:00') at time zone 'Asia/Karachi' then 'early' else 'normal' end
   )||':%'
 )
 and exists(select 1 from public.reminder_subscriptions s where s.contact_id=c.id and (cutoff is null or s.created_at<=cutoff)
 and (s.scope='office' or (s.scope='department' and s.target_id=e.department_id) or (s.scope='task' and s.target_id=e.task_id) or (s.scope='meeting' and e.kind='meeting' and s.target_id=e.id)))
), rendered as (
 select *,
   case when kind='meeting' then
     reference||' · '||title||chr(10)||
     'Department: '||department_name||chr(10)||
     'Meeting: '||to_char(effective_date,'FMDD Mon YYYY')||coalesce(' at '||nullif(meeting_time,''),'')||coalesce(' · '||nullif(venue,''),'')||chr(10)||
     'Instruction: '||left(regexp_replace(instruction,E'[\\n\\r]+',' ','g'),240)||chr(10)||label
   else
     reference||' · '||title||chr(10)||
     'Department: '||department_name||chr(10)||
     'Deadline: '||to_char(deadline,'FMDD Mon YYYY')||' · '||label||chr(10)||
     'Instruction: '||left(regexp_replace(instruction,E'[\\n\\r]+',' ','g'),240)
   end as detail
 from matched
)
select contact_id,contact_name,phone,contact_version,
 jsonb_agg(jsonb_build_object('key',key,'kind',kind,'id',id,'task_id',task_id,'title',title,'instruction',instruction,'reference',reference,'department_id',department_id,'department_name',department_name,'label',label,'deadline',deadline,'deadline_kind',deadline_kind,'requested_date',requested_date,'effective_date',effective_date,'time',meeting_time,'venue',venue,'meeting_type',meeting_type,'revision',revision) order by reference,kind),
 jsonb_agg(key order by reference,kind),
 'ACS(G) Office · Follow-ups'||chr(10)||to_char(d,'FMDD Mon YYYY')||chr(10)||chr(10)||string_agg(detail,chr(10)||chr(10) order by reference,kind)
from rendered group by contact_id,contact_name,phone,contact_version
$$;
revoke all on function public.digest_candidates(date,timestamptz,uuid) from public,anon,authenticated;
grant execute on function public.digest_candidates(date,timestamptz,uuid) to service_role;

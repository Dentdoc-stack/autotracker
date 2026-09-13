-- The same business schema is used in hosted Supabase and the local PostgreSQL preview.
create table public.memberships (
  id uuid primary key references auth.users(id), name text not null check(length(name) between 1 and 200),
  role text not null check(role in ('owner','editor','viewer')), active boolean not null default true
);
create unique index one_active_owner on public.memberships(role) where role='owner' and active;
create table public.departments (id uuid primary key default gen_random_uuid(),name text not null check(length(name) between 1 and 160),active boolean not null default true);
create unique index department_name_unique on public.departments(lower(name));
create sequence public.task_reference_seq;
create table public.tasks (
  id uuid primary key default gen_random_uuid(),reference text unique not null default ('ACS-'||lpad(nextval('public.task_reference_seq')::text,6,'0')),
  title text not null check(length(trim(title)) between 1 and 160),instruction text not null check(length(trim(instruction)) between 1 and 5000),
  department_id uuid not null references public.departments(id),instruction_date date not null,
  responsible text not null default '' check(length(responsible)<=200),source text not null default '' check(length(source)<=500),
  status text not null default 'open' check(status in ('open','in_progress','reported_complete','completed','cancelled')),
  deadline date,deadline_kind text not null default 'completion' check(deadline_kind in ('completion','update')),
  version integer not null default 1,reminder_revision integer not null default 1,reminder_changed_at timestamptz not null default now(),
  created_by uuid references public.memberships(id),updated_by uuid references public.memberships(id),
  created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.meetings (
  id uuid primary key default gen_random_uuid(),task_id uuid not null references public.tasks(id),title text not null check(length(trim(title)) between 1 and 160),
  type text not null check(type in ('initial','review','followup')),requested_date date not null,effective_date date not null,
  time text not null default '' check(time='' or time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),venue text not null default '' check(length(venue)<=500),
  state text not null default 'proposed' check(state in ('proposed','confirmed','held','cancelled')),actual_date date,outcome text not null default '',
  previous_meeting_id uuid references public.meetings(id),version integer not null default 1,reminder_revision integer not null default 1,
  reminder_changed_at timestamptz not null default now(),created_at timestamptz not null default now(),created_by uuid references public.memberships(id)
);
create table public.contacts (
  id uuid primary key default gen_random_uuid(),name text not null check(length(trim(name)) between 1 and 200),phone text not null unique check(phone ~ '^\+[1-9][0-9]{7,14}$'),
  designation text not null default '' check(length(designation)<=200),enabled boolean not null default false,consent_at timestamptz,
  consent_note text not null default '' check(length(consent_note)<=1000),version integer not null default 1,created_at timestamptz not null default now(),
  check(not enabled or (consent_at is not null and length(trim(consent_note))>0))
);
create table public.reminder_subscriptions (
  id uuid primary key default gen_random_uuid(),contact_id uuid not null references public.contacts(id),scope text not null check(scope in ('office','department','task','meeting')),
  target_id uuid,created_at timestamptz not null default now(),check((scope='office' and target_id is null) or (scope<>'office' and target_id is not null)),
  unique nulls not distinct(contact_id,scope,target_id)
);
create table public.task_updates (id uuid primary key default gen_random_uuid(),task_id uuid not null references public.tasks(id),note text not null check(length(trim(note)) between 1 and 2000),kind text not null default 'progress',actor_name text not null,created_at timestamptz not null default now());
create table public.audit_events (id uuid primary key default gen_random_uuid(),entity_id uuid not null,action text not null,reason text not null default '',actor_name text not null,before jsonb,after jsonb,created_at timestamptz not null default now());
create table public.notification_messages (
  id uuid primary key default gen_random_uuid(),contact_id uuid not null references public.contacts(id),contact_name text not null,body text not null,
  state text not null default 'mock' check(state in ('mock','queued','sending','accepted','sent','delivered','read','failed','unknown','skipped')),
  due_date date not null,item_keys jsonb not null default '[]',logical_key text not null unique,created_at timestamptz not null default now(),
  provider_sid text unique,error text,lease_until timestamptz,attempts integer not null default 0
);
create table public.app_settings(id boolean primary key default true check(id),automatic_enabled boolean not null default false,messaging_mode text not null default 'mock' check(messaging_mode in ('mock','test','live')));
insert into public.app_settings default values;
create index tasks_due on public.tasks(deadline,status);
create index meetings_due on public.meetings(effective_date,state);
create index updates_task on public.task_updates(task_id,created_at desc);
create index messages_state on public.notification_messages(state,created_at);
create index audit_entity on public.audit_events(entity_id,created_at desc);

create function public.meeting_effective_date(d date) returns date language sql immutable strict as $$
select d+case extract(isodow from d)::integer when 6 then 2 when 7 then 1 else 0 end
$$;
create function public.current_office_role() returns text language sql stable security definer set search_path=public,pg_temp as $$
select role from public.memberships where id=auth.uid() and active
$$;
create function public.input_date(p jsonb,field text) returns date language plpgsql immutable set search_path=public,pg_temp as $$
declare d date; n integer;
begin
  if p ? (field||'_days') and nullif(p->>(field||'_days'),'') is not null then
    if (p->>(field||'_days')) !~ '^\d{1,4}$' then raise exception 'Days must be a whole number'; end if;
    n:=(p->>(field||'_days'))::integer;
    if n>3650 then raise exception 'Days must be between 0 and 3650'; end if;
    d:=nullif(p->>(field||'_base'),'')::date;
    if d is null then raise exception 'Choose a base date'; end if;
    return d+n;
  end if;
  return nullif(p->>field,'')::date;
end $$;

do $$ declare t text; begin
  foreach t in array array['memberships','departments','tasks','meetings','contacts','reminder_subscriptions','task_updates','audit_events','notification_messages','app_settings'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon, authenticated',t);
    execute format('grant select on public.%I to authenticated',t);
    if t in ('contacts','reminder_subscriptions','audit_events','notification_messages') then
      execute format('create policy office_read on public.%I for select to authenticated using (public.current_office_role() in (''owner'',''editor''))',t);
    else
      execute format('create policy office_read on public.%I for select to authenticated using (public.current_office_role() is not null)',t);
    end if;
  end loop;
end $$;

create function public.get_workspace() returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare member jsonb;
begin
  select to_jsonb(m) into member from public.memberships m where id=auth.uid() and active;
  if member is null then raise exception 'An active office invitation is required'; end if;
  return jsonb_build_object(
    'member',member,'mode','connected',
    'departments',coalesce((select jsonb_agg(d order by name) from public.departments d),'[]'),
    'tasks',coalesce((select jsonb_agg(t order by created_at desc) from public.tasks t),'[]'),
    'meetings',coalesce((select jsonb_agg(m order by effective_date) from public.meetings m),'[]'),
    'contacts',coalesce((select jsonb_agg(c order by name) from public.contacts c),'[]'),
    'subscriptions',coalesce((select jsonb_agg(s) from public.reminder_subscriptions s),'[]'),
    'updates',coalesce((select jsonb_agg(u order by created_at desc) from public.task_updates u),'[]'),
    'audit',coalesce((select jsonb_agg(a order by created_at desc) from (select * from public.audit_events order by created_at desc limit 300) a),'[]'),
    'messages',coalesce((select jsonb_agg(n order by created_at desc) from (select * from public.notification_messages order by created_at desc limit 200) n),'[]')
  );
end $$;

create function public.apply_command(action text,p jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare r text; actor text; rid uuid; old jsonb; result jsonb; t public.tasks; m public.meetings; c public.contacts; next_status text; target uuid; reason text; new_date date;
begin
  select role,name into r,actor from public.memberships where id=auth.uid() and active;
  if r is null or r='viewer' then raise exception 'Editing permission required'; end if;
  if jsonb_typeof(p)<>'object' then raise exception 'Invalid command'; end if;
  reason:=coalesce(p->>'reason',p->>'note','');
  if length(reason)>2000 then raise exception 'Note is too long'; end if;
  rid:=nullif(p->>'id','')::uuid;
  if action='save_department' then
    if r<>'owner' then raise exception 'Only the owner can manage departments'; end if;
    if rid is null then insert into public.departments(name) values(trim(p->>'name')) returning to_jsonb(departments.*) into result;
    else update public.departments set name=trim(p->>'name'),active=coalesce((p->>'active')::boolean,true) where id=rid returning to_jsonb(departments.*) into result; end if;
  elsif action='save_task' then
    new_date:=public.input_date(p,'deadline');
    if not exists(select 1 from public.departments where id=(p->>'department_id')::uuid and active) then raise exception 'Choose an active department'; end if;
    if rid is null then
      insert into public.tasks(title,instruction,department_id,instruction_date,responsible,source,deadline,deadline_kind,created_by,updated_by)
      values(trim(p->>'title'),trim(p->>'instruction'),(p->>'department_id')::uuid,(p->>'instruction_date')::date,coalesce(p->>'responsible',''),coalesce(p->>'source',''),new_date,coalesce(p->>'deadline_kind','completion'),auth.uid(),auth.uid()) returning * into t;
      rid:=t.id;
      if p->'meeting' is not null and p->'meeting'<>'null'::jsonb then
        perform public.apply_command('save_meeting',(p->'meeting')||jsonb_build_object('task_id',rid));
      end if;
      result:=to_jsonb(t);
    else
      select * into t from public.tasks where id=rid for update;
      if not found then raise exception 'Task not found'; end if;
      old:=to_jsonb(t);
      if t.version is distinct from (p->>'version')::integer then raise exception 'Conflict: this task has changed. Reload before saving'; end if;
      if t.status in ('completed','cancelled') then raise exception 'Owner must reopen this task before editing'; end if;
      if (t.deadline is distinct from new_date or t.instruction_date is distinct from (p->>'instruction_date')::date) and trim(reason)='' then raise exception 'A reason is required for date changes'; end if;
      update public.tasks set title=trim(p->>'title'),instruction=trim(p->>'instruction'),department_id=(p->>'department_id')::uuid,instruction_date=(p->>'instruction_date')::date,
      responsible=coalesce(p->>'responsible',''),source=coalesce(p->>'source',''),deadline=new_date,deadline_kind=coalesce(p->>'deadline_kind','completion'),
      version=version+1,reminder_revision=reminder_revision+case when deadline is distinct from new_date then 1 else 0 end,
      reminder_changed_at=case when deadline is distinct from new_date then now() else reminder_changed_at end,updated_at=now(),updated_by=auth.uid()
      where id=rid returning to_jsonb(tasks.*) into result;
    end if;
  elsif action='transition_task' then
    select * into t from public.tasks where id=rid for update;
    if not found then raise exception 'Task not found'; end if;
    old:=to_jsonb(t);
    if t.version is distinct from (p->>'version')::integer then raise exception 'Conflict: this task has changed'; end if;
    if p->>'action' in ('confirm_complete','return','reopen','cancel') and r<>'owner' then raise exception 'Only the owner can perform this action'; end if;
    if p->>'action'<>'start' and trim(reason)='' then raise exception 'Add a note explaining this action'; end if;
    next_status:=case
      when p->>'action'='start' and t.status='open' then 'in_progress'
      when p->>'action'='report_complete' and t.status in ('open','in_progress') then 'reported_complete'
      when p->>'action'='confirm_complete' and t.status='reported_complete' then 'completed'
      when p->>'action'='return' and t.status='reported_complete' then 'in_progress'
      when p->>'action'='reopen' and t.status in ('completed','cancelled') then 'in_progress'
      when p->>'action'='cancel' and t.status not in ('completed','cancelled') then 'cancelled' end;
    if next_status is null then raise exception 'Invalid status transition'; end if;
    update public.tasks set status=next_status,version=version+1,reminder_revision=reminder_revision+1,reminder_changed_at=now(),updated_at=now(),updated_by=auth.uid() where id=rid returning to_jsonb(tasks.*) into result;
    if next_status='cancelled' or (next_status='completed' and coalesce((p->>'cancel_meetings')::boolean,false)) then
      update public.meetings set state='cancelled',version=version+1,reminder_revision=reminder_revision+1,reminder_changed_at=now(),outcome=reason where task_id=rid and state in ('proposed','confirmed');
    end if;
    if trim(reason)<>'' then insert into public.task_updates(task_id,note,kind,actor_name) values(rid,reason,p->>'action',actor); end if;
  elsif action='add_update' then
    rid:=(p->>'task_id')::uuid;
    if not exists(select 1 from public.tasks where id=rid and status not in ('completed','cancelled')) then raise exception 'Open task required'; end if;
    insert into public.task_updates(task_id,note,actor_name) values(rid,trim(p->>'note'),actor) returning to_jsonb(task_updates.*) into result;
  elsif action='save_meeting' then
    new_date:=public.input_date(p,'requested_date');
    if new_date is null then raise exception 'Choose a meeting date'; end if;
    target:=(p->>'task_id')::uuid;
    if not exists(select 1 from public.tasks where id=target and status<>'cancelled') then raise exception 'Task not found or cancelled'; end if;
    if nullif(p->>'previous_meeting_id','') is not null and not exists(select 1 from public.meetings where id=(p->>'previous_meeting_id')::uuid and task_id=target and state='held') then raise exception 'Follow-up must refer to a held meeting on this task'; end if;
    if rid is null then
      insert into public.meetings(task_id,title,type,requested_date,effective_date,time,venue,previous_meeting_id,created_by)
      values(target,trim(p->>'title'),coalesce(p->>'type','review'),new_date,public.meeting_effective_date(new_date),coalesce(p->>'time',''),coalesce(p->>'venue',''),nullif(p->>'previous_meeting_id','')::uuid,auth.uid()) returning to_jsonb(meetings.*) into result;
    else
      select * into m from public.meetings where id=rid for update;
      if not found then raise exception 'Meeting not found'; end if;
      old:=to_jsonb(m);
      if m.version is distinct from (p->>'version')::integer then raise exception 'Conflict: this meeting has changed'; end if;
      if m.requested_date<>new_date and trim(reason)='' then raise exception 'A reason is required for date changes'; end if;
      if m.state in ('held','cancelled') then raise exception 'Historic meetings cannot be edited; add a follow-up'; end if;
      update public.meetings set title=trim(p->>'title'),requested_date=new_date,effective_date=public.meeting_effective_date(new_date),time=coalesce(p->>'time',''),venue=coalesce(p->>'venue',''),version=version+1,reminder_revision=reminder_revision+1,reminder_changed_at=now() where id=rid returning to_jsonb(meetings.*) into result;
    end if;
  elsif action='transition_meeting' then
    select * into m from public.meetings where id=rid for update;
    if not found then raise exception 'Meeting not found'; end if;
    old:=to_jsonb(m);
    if m.version is distinct from (p->>'version')::integer then raise exception 'Conflict: this meeting has changed'; end if;
    if m.state not in ('proposed','confirmed') or p->>'state' not in ('confirmed','held','cancelled') then raise exception 'Invalid meeting transition'; end if;
    if p->>'state' in ('held','cancelled') and trim(reason)='' then raise exception 'Add an outcome or reason'; end if;
    if p->>'state'='held' and nullif(p->>'actual_date','') is null then raise exception 'Record the actual meeting date'; end if;
    update public.meetings set state=p->>'state',actual_date=nullif(p->>'actual_date','')::date,outcome=reason,version=version+1,reminder_revision=reminder_revision+1,reminder_changed_at=now() where id=rid returning to_jsonb(meetings.*) into result;
  elsif action='save_contact' then
    if coalesce((p->>'enabled')::boolean,true) and trim(coalesce(p->>'consent_note',''))='' then raise exception 'Record consent before enabling reminders'; end if;
    if rid is null then
      insert into public.contacts(name,phone,designation,enabled,consent_note,consent_at) values(trim(p->>'name'),regexp_replace(p->>'phone','[[:space:]().-]','','g'),coalesce(p->>'designation',''),coalesce((p->>'enabled')::boolean,true),coalesce(p->>'consent_note',''),case when trim(coalesce(p->>'consent_note',''))<>'' then now() end) returning to_jsonb(contacts.*) into result;
    else
      select * into c from public.contacts where id=rid for update;
      if not found then raise exception 'Contact not found'; end if;
      old:=to_jsonb(c);
      if c.version is distinct from (p->>'version')::integer then raise exception 'Conflict: this contact has changed'; end if;
      if c.phone<>regexp_replace(p->>'phone','[[:space:]().-]','','g') and not coalesce((p->>'new_consent')::boolean,false) then raise exception 'Fresh consent is required for a new phone number'; end if;
      update public.contacts set name=trim(p->>'name'),phone=regexp_replace(p->>'phone','[[:space:]().-]','','g'),designation=coalesce(p->>'designation',''),enabled=coalesce((p->>'enabled')::boolean,false),consent_note=coalesce(p->>'consent_note',''),consent_at=case when coalesce((p->>'new_consent')::boolean,false) then now() else consent_at end,version=version+1 where id=rid returning to_jsonb(contacts.*) into result;
    end if;
  elsif action='save_subscription' then
    if p->>'scope'='office' and r<>'owner' then raise exception 'Only the owner can add office-wide recipients'; end if;
    target:=nullif(p->>'target_id','')::uuid;
    if (p->>'scope'='task' and not exists(select 1 from public.tasks where id=target)) or (p->>'scope'='meeting' and not exists(select 1 from public.meetings where id=target)) or (p->>'scope'='department' and not exists(select 1 from public.departments where id=target)) then raise exception 'Subscription target not found'; end if;
    insert into public.reminder_subscriptions(contact_id,scope,target_id) values((p->>'contact_id')::uuid,p->>'scope',target) on conflict(contact_id,scope,target_id) do update set scope=excluded.scope returning to_jsonb(reminder_subscriptions.*) into result;
  elsif action='remove_subscription' then
    if exists(select 1 from public.reminder_subscriptions where id=rid and scope='office') and r<>'owner' then raise exception 'Only the owner can change office-wide subscriptions'; end if;
    delete from public.reminder_subscriptions where id=rid returning to_jsonb(reminder_subscriptions.*) into result;
  else raise exception 'Unknown command';
  end if;
  if result is null then raise exception 'Record not found'; end if;
  rid:=coalesce((result->>'id')::uuid,rid);
  insert into public.audit_events(entity_id,action,reason,actor_name,before,after) values(rid,action,reason,actor,old,result);
  return result;
end $$;
revoke all on function public.apply_command(text,jsonb) from public,anon;
revoke all on function public.get_workspace() from public,anon;
revoke all on function public.current_office_role() from public,anon;
grant execute on function public.apply_command(text,jsonb),public.get_workspace(),public.current_office_role() to authenticated;
grant usage on schema public to authenticated;

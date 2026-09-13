-- Run only after the worker is deployed and REMINDER_CRON_SECRET / project_url
-- have been added to Supabase Vault. Do not put their secret values in this file.
create extension if not exists pg_cron;
create extension if not exists pg_net;
do $$ declare job bigint; begin
  select jobid into job from cron.job where jobname='acs-g-reminder-tick';
  if job is not null then perform cron.unschedule(job); end if;
end $$;
select cron.schedule('acs-g-reminder-tick','* * * * *',$job$
  select net.http_post(
    url:=(select decrypted_secret from vault.decrypted_secrets where name='project_url')||'/functions/v1/reminder-dispatch',
    headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='reminder_cron_secret')),
    body:='{}'::jsonb
  );
$job$);
-- Automatic preparation remains OFF until explicitly enabled by the owner:
-- update public.app_settings set automatic_enabled=true where id=true;

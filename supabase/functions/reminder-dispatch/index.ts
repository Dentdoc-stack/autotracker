import { createClient } from 'npm:@supabase/supabase-js@2.116.0';
import { buildVariables } from '../_shared/acs-template.ts';

// Gateway JWT checks are replaced by this dedicated scheduler secret, never by a public key.
Deno.serve(async(request:Request)=>{
  const cronSecret=Deno.env.get('REMINDER_CRON_SECRET');
  if(request.method!=='POST'||!cronSecret||request.headers.get('authorization')!==`Bearer ${cronSecret}`)return new Response('Forbidden',{status:403});
  const url=Deno.env.get('SUPABASE_URL')!,key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||Deno.env.get('WORKER_ADMIN_KEY');
  if(!url||!key)return Response.json({error:'Worker database configuration missing'},{status:503});
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const scheduled=await db.rpc('schedule_daily_digest');
  if(scheduled.error)console.error('Daily preparation failed; continuing with queued messages',scheduled.error.message);
  const prepared=scheduled.error?null:scheduled.data;
  const mode=Deno.env.get('MESSAGING_MODE')||'mock';
  if(mode==='mock'||Deno.env.get('WHATSAPP_SEND_ENABLED')!=='true')return Response.json({
    prepared,
    sending:false,
    reason:mode==='mock'?'Messaging mode is mock':'WhatsApp sending is disabled',
  },{status:scheduled.error?503:200});
  if(!['test','live'].includes(mode))return Response.json({error:'Invalid sending mode'},{status:503});
  const sid=Deno.env.get('TWILIO_ACCOUNT_SID'),token=Deno.env.get('TWILIO_AUTH_TOKEN'),from=Deno.env.get('TWILIO_WHATSAPP_FROM'),template=Deno.env.get('TWILIO_DIGEST_CONTENT_SID'),base=Deno.env.get('APP_BASE_URL');
  if(!sid||!token||!from||!template||!base)return Response.json({error:'Approved sender/template configuration incomplete'},{status:503});
  if(Deno.env.get('TWILIO_TEMPLATE_VERSION')!=='acs_followup_v1'||template==='HXfe5ab5f00277942d4d4200328b4d403c')return Response.json({error:'Configure the approved ACS template and TWILIO_TEMPLATE_VERSION=acs_followup_v1. Trial sample templates are not supported.'},{status:503});
  if(mode==='live'&&Deno.env.get('APP_ENV')!=='production')return Response.json({error:'Live mode is production-only'},{status:403});
  const allowed=new Set((Deno.env.get('TEST_RECIPIENT_ALLOWLIST')||'').split(',').map(x=>x.trim()).filter(Boolean));
  const claimed=await db.rpc('claim_reminder_batch');
  if(claimed.error)return Response.json({error:'Unable to claim queue'},{status:500});
  let processed=0;
  // Small sequential batch respects conservative sender throughput and isolates failures.
  for(const message of claimed.data||[]){
    const current=await db.rpc('digest_candidates',{d:message.due_date,for_message:message.id});
    const match=(current.data||[]).find((c:Record<string,unknown>)=>c.contact_id===message.contact_id);
    if(current.error||!match||match.contact_version!==message.contact_version||match.phone!==message.phone_snapshot||match.body!==message.body){
      await db.from('notification_messages').update({state:'skipped',error:'Recipient or reminder changed before submission; preview again'}).eq('id',message.id);continue;
    }
    if(mode==='test'&&!allowed.has(message.phone_snapshot)){
      await db.from('notification_messages').update({state:'skipped',error:'Recipient is not in the test allowlist'}).eq('id',message.id);continue;
    }
    const callback=`${url}/functions/v1/whatsapp-status?messageId=${encodeURIComponent(message.id)}`;
    let variables:string;
    try{variables=buildVariables(match.items);}
    catch(error){
      await db.from('notification_messages').update({state:'failed',error:error instanceof Error?error.message:'Unable to render ACS reminder',lease_until:null}).eq('id',message.id).eq('state','sending');continue;
    }
    const form=new URLSearchParams({From:from,To:`whatsapp:${message.phone_snapshot}`,ContentSid:template,StatusCallback:callback,ContentVariables:variables});
    try{
      const response=await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,{method:'POST',headers:{Authorization:`Basic ${btoa(`${sid}:${token}`)}`,'Content-Type':'application/x-www-form-urlencoded'},body:form,signal:AbortSignal.timeout(20000)});
      const body=await response.json();
      if(response.ok&&typeof body.sid==='string'){
        // A callback may already have advanced delivery. Do not overwrite its state.
        await db.from('notification_messages').update({state:'accepted',provider_sid:body.sid,lease_until:null}).eq('id',message.id).eq('state','sending');
      }else{
        // Never blindly retry an ambiguous server/network failure.
        await db.from('notification_messages').update({state:response.status>=500?'unknown':'failed',error:`Provider response ${response.status}; code ${body.code??'unavailable'}. Review before retrying.`,lease_until:null}).eq('id',message.id).eq('state','sending');
      }
    }catch{
      await db.from('notification_messages').update({state:'unknown',error:'Submission outcome uncertain. Check Twilio before retrying.',lease_until:null}).eq('id',message.id).eq('state','sending');
    }
    processed++;
  }
  return Response.json({prepared,processed,dailyPreparationFailed:Boolean(scheduled.error)} ,{
    status:scheduled.error?207:200,
  });
});

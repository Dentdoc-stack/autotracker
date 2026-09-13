import { createClient } from 'npm:@supabase/supabase-js@2.116.0';
import twilio from 'npm:twilio@5.10.5';

Deno.serve(async(request:Request)=>{
  if(request.method!=='POST')return new Response('Method not allowed',{status:405});
  const token=Deno.env.get('TWILIO_AUTH_TOKEN'),base=Deno.env.get('SUPABASE_URL');
  if(!token||!base)return new Response('Unavailable',{status:503});
  const url=new URL(request.url),messageId=url.searchParams.get('messageId');
  if(!messageId||!/^[0-9a-f-]{36}$/i.test(messageId))return new Response('Invalid message',{status:400});
  const params=Object.fromEntries(new URLSearchParams(await request.text()));
  const externalUrl=`${base}/functions/v1/whatsapp-status?messageId=${encodeURIComponent(messageId)}`;
  if(!twilio.validateRequest(token,request.headers.get('x-twilio-signature')||'',externalUrl,params))return new Response('Forbidden',{status:403});
  const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||Deno.env.get('WORKER_ADMIN_KEY');
  if(!key)return new Response('Unavailable',{status:503});
  const db=createClient(base,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const result=await db.rpc('record_whatsapp_status',{message_id:messageId,sid:params.MessageSid,new_state:params.MessageStatus,provider_error:params.ErrorCode||null});
  if(result.error)return new Response('Unable to record status',{status:500});
  return new Response('OK');
});

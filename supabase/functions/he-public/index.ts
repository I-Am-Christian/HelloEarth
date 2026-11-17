import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

/* Public booking requests & explicitly shared student summaries.
   Admin database credentials remain INSIDE this Edge Function, never in public JS.
   Public booking requests require the tutor to approve them manually. */
const base=Deno.env.get("SUPABASE_URL")||"";
const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const admin=createClient(base,service,{auth:{persistSession:false,autoRefreshToken:false}});
const allowed=new Set(["https://helloearth.co.za","https://www.helloearth.co.za",
 "https://i-am-christian.github.io","http://localhost:8000","http://127.0.0.1:8000"]);
const header=(origin:string|null)=>{
 const h:Record<string,string>={
  "content-type":"application/json; charset=utf-8",
  "cache-control":"no-store, private","referrer-policy":"no-referrer",
  "vary":"Origin","access-control-allow-headers":"authorization, apikey, content-type, x-client-info",
  "access-control-allow-methods":"POST, OPTIONS"
 };
 if(origin&&allowed.has(origin))h["access-control-allow-origin"]=origin;
 return h;
};
const reply=(body:unknown,status=200,origin:string|null=null)=>
 new Response(JSON.stringify(body),{status,headers:header(origin)});
const err=(message:string,status=400,origin:string|null=null)=>reply({error:message},status,origin);
const isId=(value:unknown)=>typeof value==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const validSlug=(s:unknown)=>typeof s==="string"&&/^[a-z0-9][a-z0-9-]{2,31}$/.test(s);
const dateString=(s:unknown)=>typeof s==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(s);
const hex=(v:Uint8Array)=>Array.from(v,b=>b.toString(16).padStart(2,"0")).join("");
const hash=async(value:string)=>hex(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value))));
const clamp=(n:number,lo:number,hi:number)=>Math.min(hi,Math.max(lo,n));
function formattedParts(instant:number,timezone:string){
 const fmt=new Intl.DateTimeFormat("en-GB",{timeZone:timezone,year:"numeric",month:"2-digit",day:"2-digit",
  hour:"2-digit",minute:"2-digit",hourCycle:"h23"});
 const parts=Object.fromEntries(fmt.formatToParts(new Date(instant)).map(x=>[x.type,x.value]));
 return {year:Number(parts.year),month:Number(parts.month),day:Number(parts.day),hour:Number(parts.hour)%24,minute:Number(parts.minute)};
}
function timezoneExists(timezone:string){
 try{new Intl.DateTimeFormat("en-US",{timeZone:timezone});return true}catch{return false}
}
function localToInstant(day:string,hour:number,minute:number,timezone:string){
 const [y,m,d]=day.split("-").map(Number);
 const target=Date.UTC(y,m-1,d,hour,minute);
 let result=target;
 for(let i=0;i<4;i++){
  const part=formattedParts(result,timezone);
  const shown=Date.UTC(part.year,part.month-1,part.day,part.hour,part.minute);
  result+=target-shown;
 }
 const p=formattedParts(result,timezone);
 if(p.year!==y||p.month!==m||p.day!==d||p.hour!==hour||p.minute!==minute)return null;
 return result;
}
const asLocal=(t:number,zone:string)=>{
 const p=formattedParts(t,zone);
 return String(p.year)+"-"+String(p.month).padStart(2,"0")+"-"+String(p.day).padStart(2,"0");
};
function advance(day:string,n:number){
 const [y,m,d]=day.split("-").map(Number),when=new Date(Date.UTC(y,m-1,d+n,12));
 return when.toISOString().slice(0,10);
}
const overlap=(a:number,b:number,c:number,d:number)=>a<d&&c<b;
async function publicTutor(slug:string){
 const {data,error}=await admin.from("he_tutor_settings").select("tutor_id,public_slug,display_label,booking_enabled,timezone,available_weekdays,work_start,work_end,slot_minutes,buffer_minutes")
  .eq("public_slug",slug).eq("booking_enabled",true).maybeSingle();
 if(error)throw error;
 return data||null;
}
async function availableSlots(tutor:any,day:string){
 const tz=timezoneExists(tutor.timezone)?tutor.timezone:"UTC";
 const today=asLocal(Date.now(),tz);
 if(day<today||day>advance(today,20))return [];
 const weekday=new Date(day+"T12:00:00Z").getUTCDay();
 if(!Array.isArray(tutor.available_weekdays)||!tutor.available_weekdays.includes(weekday))return [];
 const start=String(tutor.work_start).split(":").slice(0,2).map(Number);
 const end=String(tutor.work_end).split(":").slice(0,2).map(Number);
 const begin=start[0]*60+start[1],finish=end[0]*60+end[1];
 const duration=tutor.slot_minutes,spacing=tutor.buffer_minutes;
 const from=localToInstant(day,0,0,tz)??Date.parse(day+"T00:00:00Z");
 const tomorrow=advance(day,1);
 const to=localToInstant(tomorrow,0,0,tz)??from+86400000;
 const {data:bookings,error:bErr}=await admin.from("he_booking_requests")
  .select("starts_at,ends_at").eq("tutor_id",tutor.tutor_id)
  .in("status",["pending","confirmed"]).lt("starts_at",new Date(to+86400000).toISOString())
  .gt("ends_at",new Date(from-86400000).toISOString()).limit(500);
 if(bErr)throw bErr;
 const {data:recurring,error:rErr}=await admin.from("he_recurring_rules").select("weekday,local_start,duration_minutes,starts_on,ends_on,timezone")
  .eq("tutor_id",tutor.tutor_id).eq("active",true).eq("weekday",weekday).lte("starts_on",day).limit(200);
 if(rErr)throw rErr;
 const occupied=(bookings||[]).map((b:any)=>[Date.parse(b.starts_at),Date.parse(b.ends_at)]);
 for(const r of recurring||[]){
  if(r.ends_on&&r.ends_on<day)continue;
  const [h,m]=String(r.local_start).split(":").map(Number);
  const st=localToInstant(day,h,m,timezoneExists(r.timezone)?r.timezone:tz);
  if(st!=null)occupied.push([st,st+Number(r.duration_minutes)*60000]);
 }
 const out:any[]=[];
 for(let min=begin;min+duration<=finish;min+=duration+spacing){
  const instant=localToInstant(day,Math.floor(min/60),min%60,tz);
  if(instant===null||instant<=Date.now()+30*60000)continue;
  const last=instant+duration*60000;
  if(occupied.some(([a,b])=>overlap(instant,last,a-spacing*60000,b+spacing*60000)))continue;
  out.push({start:new Date(instant).toISOString(),end:new Date(last).toISOString(),
   label:String(Math.floor(min/60)).padStart(2,"0")+":"+String(min%60).padStart(2,"0")});
 }
 return out;
}
async function authorizedTutor(req:Request){
 const value=req.headers.get("authorization")||"";
 const token=value.match(/^Bearer ([^\s]+)$/i)?.[1];
 if(!token)return null;
 const {data,error}=await admin.auth.getUser(token);
 return error?null:data.user||null;
}
async function updateLimit(tutorId:string,email:string,req:Request){
 const addr=req.headers.get("cf-connecting-ip")||req.headers.get("x-real-ip")||req.headers.get("x-forwarded-for")?.split(",")[0]||"unknown";
 const key=await hash(addr+"|"+email.toLowerCase());
 const today=new Date().toISOString().slice(0,10);
 const {data:current}=await admin.from("he_request_limits").select("attempts").eq("tutor_id",tutorId).eq("key_hash",key).eq("request_date",today).maybeSingle();
 if((current?.attempts||0)>=3)return false;
 const {error}=await admin.from("he_request_limits").upsert({key_hash:key,tutor_id:tutorId,request_date:today,attempts:(current?.attempts||0)+1},{onConflict:"key_hash,tutor_id,request_date"});
 return !error;
}
async function handle(req:Request,origin:string|null){
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:header(origin)});
 if(req.method!=="POST")return err("Method not allowed",405,origin);
 if(origin&&!allowed.has(origin))return err("Origin not permitted",403,origin);
 if(Number(req.headers.get("content-length")||0)>10000)return err("Request too large",413,origin);
 let payload:any;
 try{payload=await req.json()}catch{return err("Invalid JSON",400,origin)}
 if(!payload||typeof payload!=="object")return err("Invalid request",400,origin);
 const action=payload.action;
 if(action==="profile"||action==="slots"||action==="request"){
  if(!validSlug(payload.slug))return err("Invalid booking link",400,origin);
  const tutor=await publicTutor(payload.slug);
  if(!tutor)return err("Booking page is unavailable",404,origin);
  if(!timezoneExists(tutor.timezone))return err("Tutor timezone needs configuration",503,origin);
  if(action==="profile"){
   return reply({name:tutor.display_label,timezone:tutor.timezone,weekdays:tutor.available_weekdays,
    slotMinutes:tutor.slot_minutes,bufferMinutes:tutor.buffer_minutes,bookingOpen:true},200,origin);
  }
  if(!dateString(payload.day))return err("Choose a date",400,origin);
  const slots=await availableSlots(tutor,payload.day);
  if(action==="slots")return reply({slots,timezone:tutor.timezone,requiresConfirmation:true},200,origin);
  const start=String(payload.start||"");
  const match=slots.find((slot:any)=>slot.start===start);
  if(!match)return err("This slot is not available. Please refresh and choose another.",409,origin);
  const name=String(payload.name||"").trim(),email=String(payload.email||"").trim().toLowerCase();
  const note=String(payload.note||"").trim();
  if(name.length<2||name.length>110||email.length>254||!/^.+@[^@\s]+\.[^@\s]+$/.test(email)||note.length>500)
   return err("Provide a valid name and email",400,origin);
  if(!await updateLimit(tutor.tutor_id,email,req))return err("Request limit reached for today. Contact your tutor directly.",429,origin);
  const {data:prior}=await admin.from("he_booking_requests").select("id").eq("tutor_id",tutor.tutor_id).eq("requester_email",email).eq("status","pending").gte("starts_at",new Date().toISOString()).limit(3);
  if((prior||[]).length>=2)return err("You already have pending booking requests. Please contact your tutor.",409,origin);
  const {error}=await admin.from("he_booking_requests").insert({
   tutor_id:tutor.tutor_id,requester_name:name,requester_email:email,
   starts_at:match.start,ends_at:match.end,customer_note:note,status:"pending",source:"public"
  });
  if(error)return err(error.code==="23P01"?"This time was just requested. Choose another.":"Could not save this request.",409,origin);
  return reply({ok:true,pending:true,message:"Request received. The tutor must approve it; this is not a confirmed lesson."},200,origin);
 }
 if(action==="portal"){
  const token=String(payload.token||"").trim();
  if(!/^[0-9a-f]{64}$/i.test(token))return err("Invalid or expired student link",401,origin);
  const hashed=await hash(token);
  const {data:link,error:linkError}=await admin.from("he_portal_links")
   .select("tutor_id,student_id,expires_at,revoked_at").eq("token_hash",hashed).maybeSingle();
  if(linkError||!link||link.revoked_at||new Date(link.expires_at)<=new Date())
   return err("Student link expired or revoked",401,origin);
  const [profile,homework,bookings,assessments]=await Promise.all([
   admin.from("atlas_students").select("display_name,cefr_level,learning_goals,current_homework").eq("tutor_id",link.tutor_id).eq("id",link.student_id).maybeSingle(),
   admin.from("he_homework").select("title,due_on,status").eq("tutor_id",link.tutor_id).eq("student_id",link.student_id).neq("status","cancelled").order("created_at",{ascending:false}).limit(25),
   admin.from("he_booking_requests").select("starts_at,ends_at").eq("tutor_id",link.tutor_id).eq("student_id",link.student_id).eq("status","confirmed").gte("starts_at",new Date().toISOString()).order("starts_at").limit(15),
   admin.from("atlas_skill_assessments").select("assessed_on,speaking,listening,reading,writing,grammar,confidence").eq("tutor_id",link.tutor_id).eq("student_id",link.student_id).order("assessed_on",{ascending:false}).limit(8)
  ]);
  if(!profile.data)return err("Student record not available",404,origin);
  return reply({student:{name:profile.data.display_name,level:profile.data.cefr_level,
   goals:profile.data.learning_goals,currentHomework:profile.data.current_homework},
   homework:homework.data||[],appointments:bookings.data||[],progress:assessments.data||[],
   expiresAt:link.expires_at},200,origin);
 }
 if(action==="createPortal"||action==="revokePortal"){
  const user=await authorizedTutor(req);
  if(!user)return err("Sign in as the tutor",401,origin);
  if(!isId(payload.studentId))return err("Choose a student",400,origin);
  const {data:student}=await admin.from("atlas_students").select("id").eq("tutor_id",user.id).eq("id",payload.studentId).maybeSingle();
  if(!student)return err("Student not found",404,origin);
  // One active link per student. Reissuing invalidates any earlier link.
  await admin.from("he_portal_links").delete().eq("tutor_id",user.id).eq("student_id",student.id);
  if(action==="revokePortal")return reply({ok:true},200,origin);
  const bytes=crypto.getRandomValues(new Uint8Array(32)),token=hex(bytes);
  const expiresAt=new Date(Date.now()+30*86400000).toISOString();
  const {error}=await admin.from("he_portal_links").insert({
   tutor_id:user.id,student_id:student.id,token_hash:await hash(token),expires_at:expiresAt
  });
  if(error)throw error;
  return reply({ok:true,token,expiresAt,warning:"Anyone with this link can view the shared student summary until expiry or revocation."},200,origin);
 }
 return err("Unknown action",400,origin);
}
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get("origin");
 try{return await handle(req,origin)}
 catch(error){
  console.error("HelloEarth booking service:",String(error));
  return err("Service temporarily unavailable. Please try again.",503,origin);
 }
});

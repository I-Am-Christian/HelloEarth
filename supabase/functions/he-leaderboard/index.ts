import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

/** Opt-in tutor rankings. Only aggregate counts + public alias leave this service.
 * No actual payments, government tax discounts, or verified payment claims.
 */
const admin=createClient(
 Deno.env.get("SUPABASE_URL")||"",
 Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"",
 {auth:{persistSession:false,autoRefreshToken:false}}
);
const allowed=new Set([
 "https://helloearth.co.za","https://www.helloearth.co.za",
 "https://i-am-christian.github.io",
 "http://localhost:8000","http://127.0.0.1:8000"
]);
const cors=(origin:string|null)=>{
 const headers:Record<string,string>={
  "Content-Type":"application/json; charset=utf-8",
  "Cache-Control":"no-store","Vary":"Origin",
  "Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods":"POST, OPTIONS"
 };
 if(origin&&allowed.has(origin))headers["Access-Control-Allow-Origin"]=origin;
 return headers;
};
const result=(body:unknown,status=200,origin:string|null=null)=>
 new Response(JSON.stringify(body),{status,headers:cors(origin)});
const fail=(text:string,status=400,origin:string|null=null)=>result({error:text},status,origin);
const asInt=(n:unknown)=>Math.max(0,Math.trunc(Number(n)||0));
const rate=(count:number)=>Math.max(12,Math.round((20-8*Math.min(1000,asInt(count))/1000)*100)/100);
const attendanceRate=(row:any)=>{
 const eligible=asInt(row.attended)+asInt(row.missed);
 return eligible>=10?Math.round(asInt(row.attended)*10000/eligible)/100:null;
};
const milestones=[25,100,250,500,750,1000];
const badges=(row:any)=>[
 ...(asInt(row.recorded_lessons)>=25?["First 25 lessons"]:[]),
 ...(asInt(row.recorded_lessons)>=100?["Century Club"]:[]),
 ...(asInt(row.recorded_lessons)>=1000?["Thousand Lesson Club"]:[]),
 ...(asInt(row.confirmed_bookings)>=25?["Booking Magnet"]:[]),
 ...(attendanceRate(row)!==null&&attendanceRate(row)>=95?["Dependability Star"]:[])
];
function published(row:any){
 return {
  name:String(row.display_name||"Tutor").slice(0,65),
  recordedLessons:asInt(row.recorded_lessons),
  teachingHours:Math.round(asInt(row.teaching_minutes)/6)/10,
  attended:asInt(row.attended),
  attendanceSamples:asInt(row.attended)+asInt(row.missed),
  attendanceRate:attendanceRate(row),
  bookings:asInt(row.confirmed_bookings),
  badges:badges(row)
 };
}
const categories=["lessons","attendance","bookings","hours"];
function ranking(rows:any[],category:string){
 const metric:Record<string,(item:any)=>number|null>={
  lessons:i=>i.recordedLessons,
  attendance:i=>i.attendanceRate,
  bookings:i=>i.bookings,
  hours:i=>i.teachingHours
 };
 if(!metric[category])return [];
 return rows
  .filter(x=>metric[category](x)!==null&&Number(metric[category](x))>0)
  .sort((a,b)=>Number(metric[category](b))-Number(metric[category](a))||
    b.recordedLessons-a.recordedLessons||a.name.localeCompare(b.name))
  .slice(0,20).map((row,index)=>({rank:index+1,...row}));
}
async function publicData(){
 const {data,error}=await admin.rpc("he_leaderboard_snapshot");
 if(error)throw error;
 const all=(data||[]).map(published);
 return {
  boards:Object.fromEntries(categories.map(type=>[type,ranking(all,type)])),
  participants:all.length,
  methodology:{
   lessons:"Tutor-entered completed lessons (not payment verified).",
   attendance:"Tutor-recorded attendance: attended / (attended + missed). At least 10 records required; cancelled lessons excluded.",
   bookings:"Confirmed requests from Hello Earth's public booking pages (not external-platform demand).",
   hours:"Hours from tutor-entered completed lessons.",
   disclosure:"Only tutors who opt in appear. These activity metrics are self-recorded, so rankings are provisional and do not determine financial rewards."
  },
  rewards:{
   minimumFeePercent:12,startingFeePercent:20,verifiedLessonsForMinimumFee:1000,
   activeBilling:false,calculation:"Proposed future Hello Earth service fee, not government tax. Only platform-verified paid lessons count toward financial discounts."
  }
 };
}
async function authenticated(req:Request){
 const header=req.headers.get("Authorization")||"";
 const bearer=header.match(/^Bearer\s+(\S+)$/i)?.[1];
 if(!bearer)return null;
 const {data,error}=await admin.auth.getUser(bearer);
 return error?null:data?.user||null;
}
async function privateData(userId:string){
 const [profileResult,statsResult]=await Promise.all([
  admin.from("he_leaderboard_profiles").select("display_name,is_public,updated_at").eq("tutor_id",userId).maybeSingle(),
  admin.rpc("he_leaderboard_private_totals",{p_tutor:userId})
 ]);
 if(profileResult.error)throw profileResult.error;
 if(statsResult.error)throw statsResult.error;
 const totals=statsResult.data?.[0]||{};
 const verified=asInt(totals.verified_lessons);
 const records=asInt(totals.recorded_lessons);
 return {
  profile:{
   name:profileResult.data?.display_name||"",
   public:profileResult.data?.is_public===true
  },
  stats:{
   recordedLessons:records,
   teachingHours:Math.round(asInt(totals.teaching_minutes)/6)/10,
   attended:asInt(totals.attended),missed:asInt(totals.missed),
   cancelled:asInt(totals.cancelled),
   attendanceSamples:asInt(totals.attended)+asInt(totals.missed),
   attendanceRate:attendanceRate(totals),
   bookings:asInt(totals.confirmed_bookings),
   badges:badges(totals)
  },
  reward:{
   verifiedPaidLessons:verified,
   proposedFeePercent:rate(verified),
   basedOnRecordedLessonsPreview:rate(records),
   lessonsToMinimumFee:Math.max(0,1000-verified),
   milestones:milestones.map(lessons=>({
    lessons,ratePercent:rate(lessons),reached:verified>=lessons
   })),
   activeBilling:false
  }
 };
}
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get("Origin");
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors(origin)});
 if(req.method!=="POST")return fail("Method not allowed",405,origin);
 if(origin&&!allowed.has(origin))return fail("Origin not allowed",403,origin);
 if(Number(req.headers.get("Content-Length")||0)>4096)return fail("Request too large",413,origin);
 try{
  const body=await req.json();
  if(!body||typeof body.action!=="string")return fail("Invalid request",400,origin);
  if(body.action==="list")return result(await publicData(),200,origin);
  if(!["mine","save"].includes(body.action))return fail("Unknown action",400,origin);
  const user=await authenticated(req);
  if(!user)return fail("Sign in to access tutor rewards settings",401,origin);
  if(body.action==="save"){
   const name=String(body.name||"").trim().replace(/\s+/g," ");
   const isPublic=body.isPublic===true;
   if(name.length<2||name.length>65)return fail("Choose a public name between 2 and 65 characters",400,origin);
   const {error}=await admin.from("he_leaderboard_profiles").upsert({
    tutor_id:user.id,display_name:name,is_public:isPublic,
    updated_at:new Date().toISOString()
   },{onConflict:"tutor_id"});
   if(error)throw error;
  }
  return result(await privateData(user.id),200,origin);
 }catch(error){
  console.error("he-leaderboard service failure",String(error));
  return fail("Leaderboard service unavailable. Try again shortly.",503,origin);
 }
});

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";
// Teacher-authenticated exercise creation and private one-use student submission links.
// Never return answer keys on public requests. Never commit student content.
const base = Deno.env.get("SUPABASE_URL") || "";
const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const admin = createClient(base,key,{auth:{persistSession:false,autoRefreshToken:false}});
const origins = new Set(["https://helloearth.co.za","https://www.helloearth.co.za",
  "https://i-am-christian.github.io","http://localhost:8000","http://127.0.0.1:8000"]);
const headers = (origin:string|null): Record<string,string> => ({
  "content-type":"application/json; charset=utf-8","cache-control":"no-store, private",
  "referrer-policy":"no-referrer","vary":"Origin",
  "access-control-allow-methods":"POST, OPTIONS",
  "access-control-allow-headers":"authorization,apikey,content-type,x-client-info",
  ...(origin && origins.has(origin) ? {"access-control-allow-origin":origin} : {})
});
const reply = (data:unknown, status:number, origin:string|null) =>
  new Response(JSON.stringify(data),{status,headers:headers(origin)});
const fail = (msg:string,status:number,origin:string|null) => reply({error:msg},status,origin);
const uuid = (s:unknown) => typeof s==="string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
const hex = (bytes:Uint8Array) => [...bytes].map(b=>b.toString(16).padStart(2,"0")).join("");
const digest = async (v:string) => hex(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v))));
const clip = (s:unknown,max:number) => typeof s==="string" ? s.trim().slice(0,max) : "";
async function teacher(req:Request) {
  const match = /^Bearer (\S+)$/.exec(req.headers.get("authorization")||"");
  if(!match) return null;
  const {data,error} = await admin.auth.getUser(match[1]);
  return error ? null : (data.user||null);
}
function validateQuestions(raw:unknown){
  if(!Array.isArray(raw)||raw.length<1||raw.length>12) return null;
  const out:any[]=[];
  for(const q of raw){
    if(!q || typeof q!=="object")return null;
    const prompt=clip(q.prompt,500),type=q.type;
    if(prompt.length<4 || !["choice","text"].includes(type))return null;
    if(type==="choice"){
      const options=Array.isArray(q.options) ? q.options.map((x:unknown)=>clip(x,180)) : [];
      if(options.length<2 || options.length>4 || options.some((x:string)=>!x))return null;
      if(!Number.isInteger(q.correct) || q.correct<0 || q.correct>=options.length)return null;
      out.push({type,prompt,options,correct:q.correct});
    }else out.push({type,prompt});
  }
  return JSON.stringify(out).length <= 18000 ? out : null;
}
function publicQuestion(q:any,i:number){
  return {index:i,type:q.type,prompt:q.prompt,...(q.type==="choice"?{options:q.options}: {})};
}
async function handle(req:Request,origin:string|null){
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:headers(origin)});
  if(req.method!=="POST")return fail("Use POST.",405,origin);
  const raw=await req.text();
  if(raw.length>26000)return fail("Request too large.",413,origin);
  let data:any;
  try{data=JSON.parse(raw)}catch{return fail("Invalid request.",400,origin)}
  const action=clip(data?.action,40);
  if(action==="open"||action==="submit"){
    const token=clip(data.token,80);
    if(!/^[0-9a-f]{64}$/.test(token))return fail("Invalid exercise link.",401,origin);
    const {data:exercise,error}=await admin.from("he_exercises")
      .select("id,tutor_id,student_id,title,instructions,questions,expires_at,status")
      .eq("token_hash",await digest(token)).maybeSingle();
    if(error || !exercise || exercise.status!=="open" || new Date(exercise.expires_at).getTime()<Date.now())
      return fail("This exercise link is closed or expired.",410,origin);
    const {data:existing,error:lookupError}=await admin.from("he_exercise_submissions")
      .select("id").eq("exercise_id",exercise.id).maybeSingle();
    if(lookupError)throw lookupError;
    if(action==="open")return reply({
      title:exercise.title,instructions:exercise.instructions,
      questions:exercise.questions.map(publicQuestion),
      expiresAt:exercise.expires_at,submitted:!!existing
    },200,origin);
    if(existing)return fail("Answers have already been submitted for this link.",409,origin);
    if(!Array.isArray(data.answers) || data.answers.length!==exercise.questions.length)
      return fail("Please answer every question.",400,origin);
    const answers:string[]=[];let score=0,maxScore=0;
    for(let i=0;i<exercise.questions.length;i++){
      const q=exercise.questions[i],a=data.answers[i];
      if(typeof a!=="string"||a.trim().length<1||a.length>1000)
        return fail("Please answer every question.",400,origin);
      const value=a.trim();
      if(q.type==="choice"){
        if(!/^[0-3]$/.test(value) || Number(value)>=q.options.length)return fail("Invalid selection.",400,origin);
        maxScore++;
        if(Number(value)===q.correct)score++;
      }
      answers.push(value);
    }
    const {error:saveError}=await admin.from("he_exercise_submissions").insert({
      exercise_id:exercise.id,tutor_id:exercise.tutor_id,student_id:exercise.student_id,
      answers,score,max_score:maxScore
    });
    if(saveError){
      if(saveError.code==="23505")return fail("Answers were already submitted.",409,origin);
      throw saveError;
    }
    return reply({ok:true,message:"Your answers were saved. Your teacher can now review them."},200,origin);
  }
  const user=await teacher(req);
  if(!user)return fail("Please sign in as a tutor.",401,origin);
  if(action==="create"){
    if(!uuid(data.studentId))return fail("Choose a student.",400,origin);
    const title=clip(data.title,140),instructions=clip(data.instructions,1200);
    if(title.length<3 || String(data.title||"").length>140)return fail("Enter a short title.",400,origin);
    const questions=validateQuestions(data.questions);
    if(!questions)return fail("Add 1–12 valid questions with answers.",400,origin);
    const {data:student,error:studentError}=await admin.from("atlas_students").select("id")
      .eq("id",data.studentId).eq("tutor_id",user.id).maybeSingle();
    if(studentError || !student)return fail("Student not found.",404,origin);
    const token=hex(crypto.getRandomValues(new Uint8Array(32)));
    const expiresAt=new Date(Date.now()+30*86400000).toISOString();
    const {data:created,error}=await admin.from("he_exercises").insert({
      tutor_id:user.id,student_id:student.id,title,instructions,questions,
      token_hash:await digest(token),expires_at:expiresAt
    }).select("id,expires_at").single();
    if(error)throw error;
    return reply({ok:true,id:created.id,token,expiresAt:created.expires_at},200,origin);
  }
  if(action==="list"){
    if(!uuid(data.studentId))return fail("Choose a student.",400,origin);
    const {data:exercises,error}=await admin.from("he_exercises")
      .select("id,title,status,created_at,expires_at").eq("tutor_id",user.id)
      .eq("student_id",data.studentId).order("created_at",{ascending:false}).limit(50);
    if(error)throw error;
    const ids=(exercises||[]).map(x=>x.id);
    let submitted:string[]=[];
    if(ids.length){
      const {data:rows,error:rError}=await admin.from("he_exercise_submissions")
        .select("exercise_id").eq("tutor_id",user.id).in("exercise_id",ids);
      if(rError)throw rError;
      submitted=(rows||[]).map(x=>x.exercise_id);
    }
    return reply({exercises:(exercises||[]).map(x=>({...x,submitted:submitted.includes(x.id)}))},200,origin);
  }
  if(action==="review"||action==="close"||action==="reissue"){
    if(!uuid(data.exerciseId))return fail("Choose an exercise.",400,origin);
    const {data:exercise,error}=await admin.from("he_exercises")
      .select("id,title,status,questions,instructions,student_id,created_at,expires_at")
      .eq("tutor_id",user.id).eq("id",data.exerciseId).maybeSingle();
    if(error||!exercise)return fail("Exercise not found.",404,origin);
    if(action==="close"){
      const {error:closeError}=await admin.from("he_exercises").update({status:"closed"})
        .eq("id",exercise.id).eq("tutor_id",user.id);
      if(closeError)throw closeError;
      return reply({ok:true},200,origin);
    }
    const {data:submission,error:sError}=await admin.from("he_exercise_submissions")
      .select("answers,score,max_score,submitted_at").eq("exercise_id",exercise.id)
      .eq("tutor_id",user.id).maybeSingle();
    if(sError)throw sError;
    if(action==="review")return reply({exercise,submission},200,origin);
    if(submission)return fail("Submitted exercise links cannot be reissued. Create a new exercise.",409,origin);
    if(exercise.status!=="open")return fail("Closed exercises cannot be reissued.",409,origin);
    const token=hex(crypto.getRandomValues(new Uint8Array(32)));
    const expiresAt=new Date(Date.now()+30*86400000).toISOString();
    const {error:updateError}=await admin.from("he_exercises")
      .update({token_hash:await digest(token),expires_at:expiresAt})
      .eq("id",exercise.id).eq("tutor_id",user.id);
    if(updateError)throw updateError;
    return reply({ok:true,token,expiresAt},200,origin);
  }
  return fail("Unknown action.",400,origin);
}
Deno.serve(async req=>{
  const origin=req.headers.get("origin");
  try{return await handle(req,origin)}
  catch(e){console.error("HelloEarth exercise request:",String(e));return fail("Please try again.",503,origin)}
});

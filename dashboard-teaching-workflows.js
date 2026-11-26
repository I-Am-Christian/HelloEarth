import { db } from "./supabase-client.js";
const el=id=>document.getElementById(id);
const W=()=>window.HelloEarthWorkspace;
let activeTutor=null, students=[], lessonRows=[], homeworkRows=[];
const levels=["A1","A2","B1","B2","C1","C2"];
const say=(id,msg,err=false)=>{const n=el(id);if(n){n.textContent=msg;n.classList.toggle("is-error",err)}};
const clean=t=>String(t||"").trim();
const dateToday=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-")};
function studentOptions(){
 students=W()?.students||[];
 for(const id of ["he-lesson-student","he-homework-student","he-homework-filter"]){
  const select=el(id),choice=select.value;select.replaceChildren();
  const defaultOption=document.createElement("option");defaultOption.value="";defaultOption.textContent=id==="he-homework-filter"?"All students":"Choose a student";select.append(defaultOption);
  students.forEach(s=>{const o=document.createElement("option");o.value=s.id;o.textContent=s.display_name;select.append(o)});
  if([...select.options].some(o=>o.value===choice))select.value=choice;
 }
}
function selectedName(id){return students.find(s=>s.id===id)?.display_name||"Student"}
async function ensureUser(){
 if(W()?.userId){activeTutor=W().userId;return activeTutor}
 const {data:{user},error}=await db.auth.getUser();if(error||!user)throw new Error("Please sign in again.");activeTutor=user.id;return activeTutor;
}
function presetLevel(){
 const s=students.find(s=>s.id===el("he-lesson-student").value);
 if(s&&levels.includes(s.cefr_level))el("he-lesson-level").value=s.cefr_level;
}
el("he-lesson-student").addEventListener("change",presetLevel);
el("he-homework-due").value=dateToday();
function listRow(parent,title,meta,body,actionText,onClick){
 const row=document.createElement("article");row.className="he-record-row";
 const main=document.createElement("div");const heading=document.createElement("strong");heading.textContent=title;
 const small=document.createElement("small");small.textContent=meta;main.append(heading,small);
 if(body){const summary=document.createElement("p");summary.textContent=body;main.append(summary)}
 const button=document.createElement("button");button.type="button";button.textContent=actionText;button.addEventListener("click",onClick);
 row.append(main,button);parent.append(row);
}
async function loadHomework(){
 try{
  const tutor=await ensureUser();
  const {data,error}=await db.from("he_homework").select("id,student_id,title,content_markdown,due_on,status,created_at").eq("tutor_id",tutor).order("created_at",{ascending:false}).limit(150);
  if(error)throw error;homeworkRows=data||[];renderHomework();
 }catch(e){say("he-homework-feedback","Could not load homework: "+e.message,true)}
}
function renderHomework(){
 const root=el("he-homework-list");root.replaceChildren();
 const filter=el("he-homework-filter").value;
 const rows=homeworkRows.filter(h=>!filter||h.student_id===filter);
 if(!rows.length){const p=document.createElement("p");p.className="he-record-empty";p.textContent="No assignments here yet. Add an assignment above.";root.append(p);return}
 rows.forEach(h=>listRow(root,h.title,selectedName(h.student_id)+" · "+(h.due_on?"Due "+h.due_on:"No due date")+" · "+h.status,(h.content_markdown||"").slice(0,350),h.status==="completed"?"Mark assigned":"Mark completed",async()=>{
  try{
   const next=h.status==="completed"?"assigned":"completed";
   const {error}=await db.from("he_homework").update({status:next,completed_at:next==="completed"?new Date().toISOString():null}).eq("id",h.id).eq("tutor_id",activeTutor);
   if(error)throw error;await loadHomework();
  }catch(e){say("he-homework-feedback","Could not update homework: "+e.message,true)}
 }));
}
el("he-homework-filter").addEventListener("change",renderHomework);
el("he-homework-form").addEventListener("submit",async e=>{
 e.preventDefault();
 const studentId=el("he-homework-student").value,title=clean(el("he-homework-title").value),content=clean(el("he-homework-content").value),due=el("he-homework-due").value;
 if(!studentId||!title){say("he-homework-feedback","Choose a student and enter an assignment.",true);return}
 const button=el("he-homework-save");button.disabled=true;
 try{
  await ensureUser();
  const {error}=await db.from("he_homework").insert({tutor_id:activeTutor,student_id:studentId,title:title.slice(0,800),content_markdown:content.slice(0,30000),due_on:due||null,status:"assigned"});
  if(error)throw error;el("he-homework-title").value="";el("he-homework-content").value="";say("he-homework-feedback","Homework saved.");await loadHomework();
 }catch(e){say("he-homework-feedback",e.message,true)}finally{button.disabled=false}
});
async function loadLessons(){
 try{
  const tutor=await ensureUser();
  const {data,error}=await db.from("atlas_lesson_plans").select("id,student_id,topic,cefr_level,duration_minutes,markdown,created_at").eq("tutor_id",tutor).order("created_at",{ascending:false}).limit(40);
  if(error)throw error;lessonRows=data||[];renderLessons();
 }catch(e){say("he-lesson-feedback","Could not load saved lessons: "+e.message,true)}
}
function renderLessons(){
 const root=el("he-lesson-history");root.replaceChildren();
 if(!lessonRows.length){const p=document.createElement("p");p.className="he-record-empty";p.textContent="No saved lessons yet.";root.append(p);return}
 lessonRows.forEach(p=>listRow(root,p.topic,selectedName(p.student_id)+" · "+p.cefr_level+" · "+p.duration_minutes+" min","", "Open",()=>{
  el("he-lesson-student").value=p.student_id;el("he-lesson-topic").value=p.topic;el("he-lesson-level").value=p.cefr_level;el("he-lesson-duration").value=p.duration_minutes;
  el("he-lesson-editor").value=p.markdown;el("he-lesson-editor").focus();say("he-lesson-feedback","Loaded a saved lesson into the editor. Saving creates a new copy.");
 }));
}
function baseLesson(){
 const topic=clean(el("he-lesson-topic").value),level=el("he-lesson-level").value,duration=Number(el("he-lesson-duration").value)||50;
 return {topic,level,duration};
}
el("he-lesson-template").addEventListener("click",()=>{
 const {topic,level,duration}=baseLesson();
 if(!topic){say("he-lesson-feedback","Enter a lesson topic first.",true);return}
 el("he-lesson-editor").value=`# ${topic}\n\n**Level:** ${level} · **Duration:** ${duration} minutes\n\n## Learning objectives\n- \n- \n\n## Warm-up (5 minutes)\n\n## Vocabulary and grammar\n\n## Guided practice\n\n## Speaking or communication task\n\n## Independent practice\n\n## Review and feedback\n\n## Homework\n\n## Answer key\n`;
 say("he-lesson-feedback","Editable lesson template created.");
});
el("he-lesson-save").addEventListener("click",async()=>{
 const {topic,level,duration}=baseLesson(),studentId=el("he-lesson-student").value,markdown=clean(el("he-lesson-editor").value);
 if(!studentId||!topic||!markdown){say("he-lesson-feedback","Choose a student, enter a topic, and add lesson content.",true);return}
 const button=el("he-lesson-save");button.disabled=true;
 try{
  await ensureUser();const {error}=await db.from("atlas_lesson_plans").insert({id:crypto.randomUUID(),tutor_id:activeTutor,student_id:studentId,topic:topic.slice(0,200),cefr_level:level,duration_minutes:duration,markdown:markdown.slice(0,100000)});
  if(error)throw error;say("he-lesson-feedback","Lesson saved to this student's records.");await loadLessons();
 }catch(e){say("he-lesson-feedback",e.message,true)}finally{button.disabled=false}
});
// Managed Claude is the default. Tutor-owned keys are sent only when opted in;
// neither mode stores API credentials in the browser or student records.
const aiProvider=el("he-ai-provider");
const personalKeyRow=el("he-ai-personal-key-row");
aiProvider.addEventListener("change",()=>{
 personalKeyRow.hidden=aiProvider.value!=="anthropic-byok";
 say("he-ai-feedback",aiProvider.value==="managed"
  ?"HelloEarth will cover this generation within your included allowance."
  :"Your Anthropic API key is used for this request only, and isn't stored.");
});
async function generateWithHaiku(mode){
 const {topic,level,duration}=baseLesson();
 const studentId=el("he-lesson-student").value;
 const byok=aiProvider.value==="anthropic-byok";
 const ownKey=el("he-openai-key").value.trim();
 if(!topic){say("he-ai-feedback","Enter a topic for this lesson or homework.",true);return}
 if(!studentId){say("he-ai-feedback","Choose a student first.",true);return}
 if(byok&&!ownKey.startsWith("sk-ant-")){
  say("he-ai-feedback","Enter your Anthropic API key or select HelloEarth AI.",true);return
 }
 const buttons=[el("he-lesson-generate"),el("he-homework-ai-generate")];
 buttons.forEach(b=>{b.disabled=true});
 say("he-ai-feedback","Claude Haiku 5.5 is generating an editable "+mode+" draft…");
 try{
  await ensureUser();
  const {data:{session},error:authError}=await db.auth.getSession();
  if(authError||!session?.access_token)throw new Error("Session expired. Sign in again.");
  const chosen=students.find(student=>student.id===studentId);
  let studentContext="";
  if(el("he-share-context").checked&&chosen){
   studentContext=`CEFR: ${chosen.cefr_level}. Goals: ${(chosen.learning_goals||[]).join("; ")}. Focus: ${(chosen.focus_areas||[]).join("; ")}. Interests: ${(chosen.interests||[]).join("; ")}.`.slice(0,900);
  }
  const body={provider:byok?"anthropic-byok":"managed",mode,topic,cefr:level,duration,
   instructions:el("he-lesson-instructions").value,studentContext};
  if(byok)body.apiKey=ownKey;
  const {data,error}=await db.functions.invoke("helloearth-generate",{body});
  if(error){
   let message=error.message||"Claude generation failed.";
   if(typeof error.context?.json==="function"){
    try{const detail=await error.context.json();if(detail?.error)message=detail.error}catch{}
   }
   throw new Error(message);
  }
  if(!data?.text)throw new Error(data?.error||"Claude returned no content.");
  el("he-lesson-editor").value=String(data.text).slice(0,100000);
  if(mode==="homework"){
   el("he-homework-student").value=studentId;
   el("he-homework-title").value=("Practice: "+topic).slice(0,800);
   el("he-homework-content").value=String(data.text).slice(0,30000);
  }
  say("he-ai-feedback",
   mode==="homework"?"Homework generated and copied to the Homework assignment form. Review and assign it from the Homework tab.":"Lesson generated. Review and edit it before saving."+
   (Number.isFinite(data.remainingToday)?" Remaining generations today: "+data.remainingToday+".":""));
 }catch(e){say("he-ai-feedback",e.message,true)}
 finally{buttons.forEach(b=>{b.disabled=false})}
}
el("he-lesson-generate").addEventListener("click",()=>generateWithHaiku("lesson"));
el("he-homework-ai-generate").addEventListener("click",()=>generateWithHaiku("homework"));
el("he-homework-from-lesson").addEventListener("click",()=>{
 const text=clean(el("he-lesson-editor").value);if(!text){say("he-lesson-feedback","Create or open a lesson first.",true);return}
 el("he-homework-student").value=el("he-lesson-student").value;
 el("he-homework-title").value=("Practice: "+clean(el("he-lesson-topic").value)).slice(0,800);
 el("he-homework-content").value=text.slice(0,30000);
 el("homework-tab")?.click();
 say("he-homework-feedback","Homework draft prepared. Add the assignment details before saving.");
});
el("he-openai-key").addEventListener("input",()=>say("he-ai-feedback","Personal Anthropic key is used for this request only. It is not saved."));
el("he-homework-create-ai").addEventListener("click",()=>{
 const chosen=el("he-homework-student").value;
 el("lessons-tab")?.click();
 if(chosen)el("he-lesson-student").value=chosen;
 el("he-ai-integration").open=true;
 el("he-homework-ai-generate").focus();
 say("he-ai-feedback","Enter a topic and click Generate homework with Haiku.");
});
document.addEventListener("helloearth:studentsloaded",()=>{studentOptions();loadHomework();loadLessons()});
document.addEventListener("helloearth:view-changed",e=>{if(e.detail?.view==="homework")loadHomework();if(e.detail?.view==="lessons")loadLessons()});
const ready=()=>{if(W()?.userId){studentOptions();loadHomework();loadLessons()}};
ready();

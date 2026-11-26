import { db } from "./supabase-client.js";
const el=id=>document.getElementById(id);
const W=()=>window.HelloEarthWorkspace;
let activeTutor=null, activeLessonId=null, students=[], lessonRows=[], homeworkRows=[], reviewWorksheet=null;
const levels=["A1","A2","B1","B2","C1","C2"];
const say=(id,msg,err=false)=>{const n=el(id);if(n){n.textContent=msg;n.classList.toggle("is-error",err)}};
const clean=t=>String(t||"").trim();
const dateToday=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-")};
const downloadText=(filename,body)=>{
 const url=URL.createObjectURL(new Blob([body],{type:"text/plain;charset=utf-8"}));
 const a=document.createElement("a");a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1500);
};
const splitAnswerKey=text=>{
 const raw=String(text||"");
 const match=/^\\s{0,3}#{1,6}\\s*(?:answer\\s*key|answers\\s*(?:for\\s*teachers?|key)?|solutions?|teacher(?:'s)?\\s*(?:notes?|answers?))\\s*[:\\-]?\\s*$/im.exec(raw);
 return match?{worksheet:raw.slice(0,match.index).trim(),key:raw.slice(match.index+match[0].length).trim()}:{worksheet:raw.trim(),key:""};
};
const homeworkPart=text=>{
 const raw=String(text||"");
 const section=/^\\s{0,3}#{1,4}\\s*(?:homework|independent\\s+practice)\\s*[:\\-]?\\s*$/im.exec(raw);
 if(!section)return "";
 const rest=raw.slice(section.index+section[0].length);
 const end=/^\\s{0,3}#{1,4}\\s+\\S/m.exec(rest);
 return (end?rest.slice(0,end.index):rest).trim();
};
const extractError=async error=>{
 let message=error?.message||"Request failed";
 if(typeof error?.context?.json==="function"){
  try{const payload=await error.context.json();if(payload?.error)message=payload.error}catch{}
 }
 return new Error(message);
};
const getHomeworkLink=async id=>{
 await ensureUser();
 const {data,error}=await db.functions.invoke("he-homework-links",{body:{action:"link",homeworkId:id}});
 if(error)throw await extractError(error);
 if(!data?.url)throw Error(data?.error||"Couldn't create the homework link.");
 return data.url;
};
const copyLink=async id=>{
 try{
  const url=await getHomeworkLink(id);
  el("he-homework-new-link").hidden=false;
  el("he-homework-link-url").value=url;
  if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(url);say("he-homework-feedback","Link copied. It expires 14 days after creation.");}
  else {el("he-homework-link-url").focus();el("he-homework-link-url").select();say("he-homework-feedback","Link ready. Copy it from the highlighted field.");}
 }catch(err){say("he-homework-feedback",err.message,true)}
};
const openLink=async id=>{
 // Open a blank tab synchronously so popup blockers don't stop the new window.
 const tab=window.open("about:blank","_blank");
 if(tab)tab.opener=null;
 try{
  const url=await getHomeworkLink(id);
  if(tab)tab.location.href=url;
  else {el("he-homework-new-link").hidden=false;el("he-homework-link-url").value=url;say("he-homework-feedback","Popup blocked. Copy or open the link in the field below.",true)}
 }catch(err){if(tab)tab.close();say("he-homework-feedback",err.message,true)}
};

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
  const {data,error}=await db.from("he_homework")
   .select("id,student_id,lesson_plan_id,title,content_markdown,teacher_answer_key,student_answers,student_last_saved_at,expires_at,created_at,status")
   .eq("tutor_id",tutor).order("created_at",{ascending:false}).limit(150);
  if(error)throw error;
  homeworkRows=data||[];renderHomework();renderLessons();
 }catch(e){say("he-homework-feedback","Could not load shared worksheets: "+e.message,true)}
}
function actionButton(label,onClick){
 const b=document.createElement("button");b.type="button";b.textContent=label;b.addEventListener("click",onClick);return b;
}
function renderHomework(){
 const root=el("he-homework-list");root.replaceChildren();
 const filter=el("he-homework-filter").value;
 const rows=homeworkRows.filter(h=>!filter||h.student_id===filter);
 if(!rows.length){
  const p=document.createElement("p");p.className="he-record-empty";
  p.textContent="No shared worksheets yet. Create one above, then copy its 14-day link.";root.append(p);return;
 }
 for(const h of rows){
  const expired=Date.now()>=Date.parse(h.expires_at)||h.status==="cancelled";
  const row=document.createElement("article");row.className="he-record-row he-homework-row";
  const main=document.createElement("div");main.className="he-homework-row-main";
  const title=document.createElement("strong");title.textContent=h.title;
  const meta=document.createElement("small");
  meta.textContent=selectedName(h.student_id)+" · "+(expired?"Expired":"Active")+
   " · Until "+new Date(h.expires_at).toLocaleDateString();
  main.append(title,meta);
  const actions=document.createElement("div");actions.className="he-work-actions he-inline-actions";
  if(!expired){
   actions.append(actionButton("Copy link",()=>copyLink(h.id)),actionButton("Open tab",()=>openLink(h.id)));
  }
  actions.append(actionButton("View answers",()=>reviewHomework(h)));
  actions.append(actionButton("Download worksheet",()=>{
   downloadText("helloearth-worksheet.txt",h.title+"\\n\\n"+splitAnswerKey(h.content_markdown).worksheet);
  }));
  row.append(main,actions);root.append(row);
 }
}
function reviewHomework(h){
 reviewWorksheet=h;
 el("he-review-title").textContent=h.title;
 el("he-review-meta").textContent=selectedName(h.student_id)+" · "+(h.student_last_saved_at?
  "Last saved "+new Date(h.student_last_saved_at).toLocaleString():"No answers saved yet");
 const answer=String(h.student_answers||"").trim();
 el("he-review-content").textContent=answer||"No student responses saved yet.";
 const dialog=el("he-homework-review-dialog");
 if(typeof dialog.showModal==="function")dialog.showModal();
 else dialog.setAttribute("open","");
}
el("he-review-copy").addEventListener("click",async()=>{
 if(!reviewWorksheet)return;
 try{await navigator.clipboard.writeText(reviewWorksheet.student_answers||"");}
 catch{say("he-homework-feedback","Couldn't copy answers. Use Download instead.",true)}
});
el("he-review-download").addEventListener("click",()=>{
 if(!reviewWorksheet)return;
 downloadText("helloearth-student-answers.txt",
  reviewWorksheet.title+"\\n\\nSTUDENT ANSWERS\\n"+String(reviewWorksheet.student_answers||""));
});
el("he-homework-link-copy").addEventListener("click",async()=>{
 const input=el("he-homework-link-url");
 try{await navigator.clipboard.writeText(input.value);say("he-homework-feedback","Shareable link copied.");}
 catch{input.select();say("he-homework-feedback","Copy the selected link from the field.")}
});
el("he-homework-link-open").addEventListener("click",()=>{
 const url=el("he-homework-link-url").value;if(url)window.open(url,"_blank","noopener");
});
el("he-homework-filter").addEventListener("change",renderHomework);
el("he-homework-form").addEventListener("submit",async e=>{
 e.preventDefault();
 const studentId=el("he-homework-student").value,title=clean(el("he-homework-title").value);
 const raw=clean(el("he-homework-content").value),split=splitAnswerKey(raw);
 const teacherKey=[clean(el("he-homework-key").value),split.key].filter(Boolean).join("\\n\\n");
 const lessonPlanId=el("he-homework-lesson-id").value||null;
 if(!studentId||!title||!split.worksheet){say("he-homework-feedback","Select a student, title and worksheet.",true);return}
 if(teacherKey.length>12000){say("he-homework-feedback","The private answer key must be shorter than 12,000 characters.",true);return}
 const btn=el("he-homework-save");btn.disabled=true;
 try{
  await ensureUser();
  const {data,error}=await db.from("he_homework").insert({
   tutor_id:activeTutor,student_id:studentId,lesson_plan_id:lessonPlanId,
   title:title.slice(0,800),content_markdown:split.worksheet.slice(0,30000),
   teacher_answer_key:teacherKey,due_on:null,status:"assigned"
  }).select("id").single();
  if(error)throw error;
  el("he-homework-title").value="";el("he-homework-content").value="";
  el("he-homework-key").value="";el("he-homework-lesson-id").value="";
  say("he-homework-feedback","Worksheet created. Share its link by copying it—no message was sent.");
  await loadHomework();
  await copyLink(data.id);
 }catch(err){say("he-homework-feedback",err.message,true)}
 finally{btn.disabled=false}
});
async function loadLessons(){
 try{
  const tutor=await ensureUser();
  const {data,error}=await db.from("atlas_lesson_plans").select("id,student_id,topic,cefr_level,duration_minutes,markdown,created_at").eq("tutor_id",tutor).order("created_at",{ascending:false}).limit(40);
  if(error)throw error;lessonRows=data||[];renderLessons();
 }catch(e){say("he-lesson-feedback","Could not load saved lessons: "+e.message,true)}
}

function prepareHomeworkFromLesson(plan){
 const source=String(plan.markdown||"");
 const body=homeworkPart(source);
 const split=splitAnswerKey(body||"");
 el("he-homework-student").value=plan.student_id;
 el("he-homework-lesson-id").value=plan.id;
 el("he-homework-title").value=("Practice: "+plan.topic).slice(0,800);
 el("he-homework-content").value=split.worksheet;
 el("he-homework-key").value=split.key;
 el("homework-tab")?.click();
 say("he-homework-feedback",body
  ?"Review the extracted homework and create a 14-day link. Nothing is sent automatically."
  :"No standalone Homework section found in this lesson. Add your questions and create a shareable link.");
}
function renderLessons(){
 const root=el("he-lesson-history");root.replaceChildren();
 if(!lessonRows.length){
  const p=document.createElement("p");p.className="he-record-empty";p.textContent="No saved lessons yet.";root.append(p);return;
 }
 for(const p of lessonRows){
  const row=document.createElement("article");row.className="he-record-row he-lesson-row";
  const main=document.createElement("div");
  const title=document.createElement("strong");title.textContent=p.topic;
  const meta=document.createElement("small");
  meta.textContent=selectedName(p.student_id)+" · "+p.cefr_level+" · "+p.duration_minutes+" min";
  main.append(title,meta);
  const actions=document.createElement("div");actions.className="he-work-actions he-inline-actions";
  actions.append(actionButton("Open lesson",()=>{
   activeLessonId=p.id;
   el("he-lesson-student").value=p.student_id;
   el("he-lesson-topic").value=p.topic;
   el("he-lesson-level").value=p.cefr_level;
   el("he-lesson-duration").value=p.duration_minutes;
   el("he-lesson-editor").value=p.markdown;
   el("he-lesson-editor").focus();
   say("he-lesson-feedback","Opened lesson. This lesson is now selected for live feedback and homework links.");
  }));
  const linked=homeworkRows.find(h=>h.lesson_plan_id===p.id&&
   h.status!=="cancelled"&&Date.now()<Date.parse(h.expires_at));
  if(linked)actions.append(actionButton("Copy homework link",()=>copyLink(linked.id)));
  actions.append(actionButton(linked?"New worksheet":"Create homework link",()=>prepareHomeworkFromLesson(p)));
  actions.append(actionButton("Download lesson",()=>downloadText("helloearth-lesson.md",p.markdown||"")));
  row.append(main,actions);root.append(row);
 }
}
function baseLesson(){
 const topic=clean(el("he-lesson-topic").value),level=el("he-lesson-level").value,duration=Number(el("he-lesson-duration").value)||50;
 return {topic,level,duration};
}
el("he-lesson-download").addEventListener("click",()=>{
 const text=clean(el("he-lesson-editor").value);
 if(!text){say("he-lesson-feedback","Create or open a lesson first.",true);return}
 downloadText("helloearth-lesson.md",text);
});
el("he-lesson-copy").addEventListener("click",async()=>{
 const text=clean(el("he-lesson-editor").value);
 if(!text){say("he-lesson-feedback","Create or open a lesson first.",true);return}
 try{await navigator.clipboard.writeText(text);say("he-lesson-feedback","Lesson copied. Paste it wherever you like.");}
 catch{el("he-lesson-editor").focus();el("he-lesson-editor").select();say("he-lesson-feedback","Lesson selected. Press Ctrl+C to copy.");}
});
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
  await ensureUser();const id=crypto.randomUUID();const {error}=await db.from("atlas_lesson_plans").insert({id,tutor_id:activeTutor,student_id:studentId,topic:topic.slice(0,200),cefr_level:level,duration_minutes:duration,markdown:markdown.slice(0,100000)});if(!error)activeLessonId=id;
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
   const parts=splitAnswerKey(String(data.text));
   el("he-homework-content").value=parts.worksheet.slice(0,30000);
   el("he-homework-key").value=parts.key.slice(0,12000);
   el("he-homework-lesson-id").value=activeLessonId||"";
  }
  say("he-ai-feedback",
   mode==="homework"?"Homework worksheet prepared in the Homework tab. Review it, then create and copy its 14-day link. Nothing has been sent.":"Lesson generated. Review and edit it before saving."+
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
 const extracted=homeworkPart(text);
 const split=splitAnswerKey(extracted||"");
 el("he-homework-content").value=split.worksheet;
 el("he-homework-key").value=split.key;
 el("he-homework-lesson-id").value=activeLessonId||"";
 el("homework-tab")?.click();
 say("he-homework-feedback","Homework draft prepared. Add the assignment details before saving.");
});
el("he-openai-key").addEventListener("input",()=>say("he-ai-feedback","Personal Anthropic key is used for this request only. It is not saved."));
el("he-homework-create-ai").addEventListener("click",()=>{
 const chosen=el("he-homework-student").value;
 el("lessons-tab")?.click();
 if(chosen)el("he-lesson-student").value=chosen;
 activeLessonId=null;
 el("he-ai-integration").open=true;
 el("he-homework-ai-generate").focus();
 say("he-ai-feedback","Enter a topic and click Generate homework with Haiku.");
});
document.addEventListener("helloearth:studentsloaded",()=>{studentOptions();loadHomework();loadLessons()});
document.addEventListener("helloearth:view-changed",e=>{if(e.detail?.view==="homework")loadHomework();if(e.detail?.view==="lessons")loadLessons()});
const ready=()=>{if(W()?.userId){studentOptions();loadHomework();loadLessons()}};
ready();

import { db } from "./supabase-client.js";
const el=id=>document.getElementById(id);
const W=()=>window.HelloEarthWorkspace;
let activeTutor=null, activeLessonId=null, students=[], lessonRows=[], homeworkRows=[], reviewWorksheet=null;
const savedPublicLinks=new Map();
let lessonFolder="all",lessonFilter="saved",lessonSearch="",lessonLoadVersion=0;
const lessonFolderOpen=new Set();
async function shareSavedLesson(plan,copy=true){
 try{
  await ensureUser();
  const {data,error}=await db.functions.invoke("he-lesson-sharing",{
   body:{action:"create",sourceKind:"saved",sourceId:plan.id}
  });
  if(error)throw await extractError(error);
  if(!data?.url)throw Error(data?.error||"Share link missing.");
  savedPublicLinks.set(plan.id,{url:data.url,expiresAt:data.expiresAt});
  renderLessons();
  if(copy){
   try{await navigator.clipboard.writeText(data.url);
    say("he-lesson-feedback","Public student link copied. Anyone with it can open without signing in.");
   }catch{say("he-lesson-feedback","Student lesson link: "+data.url)}
  }
  return data.url;
 }catch(error){
  say("he-lesson-feedback","Could not create student link: "+error.message,true);return null;
 }
}
async function refreshSavedPublicLinks(){
 const {data,error}=await db.functions.invoke("he-lesson-sharing",{body:{action:"list"}});
 if(error)throw await extractError(error);
 savedPublicLinks.clear();
 for(const item of data.shares||[]){
  if(item.sourceKind==="saved")savedPublicLinks.set(item.sourceId,{url:item.url,expiresAt:item.expiresAt});
 }
}
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
 const match=/^\s{0,3}(?:#{1,6}\s*)?\*{0,2}(?:answer\s*key|answers\s*(?:for\s*teachers?|key)?|solutions?|teacher(?:'s)?\s*(?:notes?|answers?))\s*[:\-]?\*{0,2}\s*[:\-]?\s*$/im.exec(raw);
 return match?{worksheet:raw.slice(0,match.index).trim(),key:raw.slice(match.index+match[0].length).trim()}:{worksheet:raw.trim(),key:""};
};
const homeworkPart=text=>{
 const raw=String(text||"");
 const section=/^\s{0,3}#{1,4}\s*(?:homework|independent\s+practice)\s*[:\-]?\s*$/im.exec(raw);
 if(!section)return "";
 const rest=raw.slice(section.index+section[0].length);
 const end=/^\s{0,3}#{1,4}\s+\S/m.exec(rest);
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
  if(navigator.clipboard?.writeText){
   await navigator.clipboard.writeText(url);
   say("he-homework-feedback","Link copied. It expires 14 days after creation.");
   if(!el("lessons-view").hidden)say("he-lesson-feedback","Homework link copied. Share it with the student.");
  }
  else {
   el("homework-tab")?.click();
   el("he-homework-link-url").focus();el("he-homework-link-url").select();
   say("he-homework-feedback","Link ready. Copy it from the highlighted field.");
  }
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
 el("he-share-context").checked=s?.ai_context_enabled===true;
 const topicField=el("he-lesson-topic");
 if(topicField.dataset.autoSuggested&&topicField.value===topicField.dataset.autoSuggested){
  topicField.value="";delete topicField.dataset.autoSuggested;delete topicField.dataset.autoFocus;delete topicField.dataset.autoCategory;
 }
}
el("he-share-context").addEventListener("change",async event=>{
 const chosen=students.find(s=>s.id===el("he-lesson-student").value);
 const checked=event.target.checked;
 if(!chosen){
  event.target.checked=false;
  say("he-ai-feedback","Choose a student before enabling profile personalisation.",true);
  return;
 }
 try{
  const tutor=await ensureUser();
  const {error}=await db.from("atlas_students")
    .update({ai_context_enabled:checked})
    .eq("id",chosen.id).eq("tutor_id",tutor);
  if(error)throw error;
  chosen.ai_context_enabled=checked;
  say("he-ai-feedback",checked?
   "Personalisation enabled for this student. Nova will use learning goals, interests and skill focus.":
   "Personalisation disabled for this student. Nova will use category and lesson history only.");
 }catch(err){
  event.target.checked=!checked;
  say("he-ai-feedback","Couldn't save personalisation preference: "+err.message,true);
 }
});
el("he-lesson-topic").addEventListener("input",event=>{
 delete event.target.dataset.autoSuggested;delete event.target.dataset.autoFocus;delete event.target.dataset.autoCategory;
});
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
  if(h.teacher_answer_key)actions.append(actionButton("Teacher key",()=>reviewHomework(h,true)));
  actions.append(actionButton("Download worksheet",()=>{
   downloadText("helloearth-worksheet.txt",h.title+"\n\n"+splitAnswerKey(h.content_markdown).worksheet);
  }));
  row.append(main,actions);root.append(row);
 }
}
function reviewHomework(h,showKey=false){
 reviewWorksheet={...h,reviewText:showKey?h.teacher_answer_key:(h.student_answers||"")};
 el("he-review-title").textContent=(showKey?"Teacher answer key: ":"Student answers: ")+h.title;
 el("he-review-meta").textContent=showKey?"Private tutor-only answers and marking notes.":
  selectedName(h.student_id)+" · "+(h.student_last_saved_at?
   "Last saved "+new Date(h.student_last_saved_at).toLocaleString():"No answers saved yet");
 const answer=String(reviewWorksheet.reviewText||"").trim();
 el("he-review-content").textContent=answer||"No student responses saved yet.";
 const dialog=el("he-homework-review-dialog");
 if(typeof dialog.showModal==="function")dialog.showModal();
 else dialog.setAttribute("open","");
}
el("he-review-copy").addEventListener("click",async()=>{
 if(!reviewWorksheet)return;
 try{await navigator.clipboard.writeText(reviewWorksheet.reviewText||"");}
 catch{say("he-homework-feedback","Couldn't copy answers. Use Download instead.",true)}
});
el("he-review-download").addEventListener("click",()=>{
 if(!reviewWorksheet)return;
 downloadText("helloearth-student-answers.txt",
  reviewWorksheet.title+"\n\n"+String(reviewWorksheet.reviewText||""));
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
 const teacherKey=[clean(el("he-homework-key").value),split.key].filter(Boolean).join("\n\n");
 const lessonPlanId=el("he-homework-lesson-id").value||null;
 if(!studentId||!title||!split.worksheet){say("he-homework-feedback","Select a student, title and worksheet.",true);return}
 if(teacherKey.length>12000){say("he-homework-feedback","The private answer key must be shorter than 12,000 characters.",true);return}
 const btn=el("he-homework-save");btn.disabled=true;
 // Open a tab while the submit gesture is active to avoid popup blockers.
 const tab=window.open("about:blank","_blank");
 if(tab){
  tab.opener=null;
  try{tab.document.title="Preparing HelloEarth homework";tab.document.body.textContent="Preparing your student worksheet…"}catch{}
 }
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
  const url=await getHomeworkLink(data.id);
  el("he-homework-new-link").hidden=false;
  el("he-homework-link-url").value=url;
  if(tab)tab.location.replace(url);
  else say("he-homework-feedback","Worksheet created. Popup blocked—use Open in new tab below.");
  await loadHomework();
  say("he-homework-feedback","Worksheet created and ready to share. No message was sent.");
 }catch(err){if(tab)tab.close();say("he-homework-feedback",err.message,true)}
 finally{btn.disabled=false}
});
async function loadLessons(){
 try{
  const tutor=await ensureUser();
  const version=++lessonLoadVersion,all=[];for(let offset=0;;offset+=100){const {data,error}=await db.from("atlas_lesson_plans").select("id,student_id,topic,cefr_level,duration_minutes,markdown,created_at,completed_at,unsaved_at,review_note_id,review_assessment_id").eq("tutor_id",tutor).order("created_at",{ascending:false}).order("id",{ascending:false}).range(offset,offset+99);if(error)throw error;if(version!==lessonLoadVersion)return;all.push(...(data||[]));if(!data||data.length<100)break}lessonRows=all;
   try{await refreshSavedPublicLinks()}catch{}
   renderLessons();
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
 el("he-homework-key").value=split.key||splitAnswerKey(source).key;
 el("homework-tab")?.click();
 say("he-homework-feedback",body
  ?"Review the extracted homework and create a 14-day link. Nothing is sent automatically."
  :"No standalone Homework section found in this lesson. Add your questions and create a shareable link.");
}
async function changeLessonState(p,operation,button){
 if(operation==="complete"&&!p.completed_at){openLessonReview(p);return}
 if(operation==="complete"&&p.completed_at&&!confirm("Reopen this lesson? Its existing teacher review will be retained."))return;
 if(operation==="delete"&&!confirm("Permanently delete this lesson? Its saved-lesson sharing links will stop working. Existing homework, notes, skill assessments and reports remain."))return;
 button.disabled=true;
 try{const tutor=await ensureUser();let result;
 if(operation==="delete")result=await db.from("atlas_lesson_plans").delete().eq("id",p.id).eq("tutor_id",tutor).select("id").single();
 else{const patch=operation==="complete"?{completed_at:p.completed_at?null:new Date().toISOString()}:{unsaved_at:operation==="restore"?null:new Date().toISOString()};result=await db.from("atlas_lesson_plans").update(patch).eq("id",p.id).eq("tutor_id",tutor).select("id,completed_at,unsaved_at").single()}
 if(result.error)throw result.error;
 if(operation==="delete"){lessonRows=lessonRows.filter(x=>x.id!==p.id);savedPublicLinks.delete(p.id);if(activeLessonId===p.id)activeLessonId=null}
 else Object.assign(p,result.data);
 renderLessons();say("he-lesson-feedback",operation==="delete"?"Lesson permanently deleted.":operation==="restore"?"Lesson restored to Saved.":operation==="unsave"?"Lesson unsaved. Restore it from the Unsaved tab.":p.completed_at?"Lesson marked complete.":"Lesson reopened.");
 document.dispatchEvent(new CustomEvent("helloearth:workspace-data"));
 }catch(e){say("he-lesson-feedback",e.message,true);button.disabled=false}
}
const reviewSkills=[["speaking","Speaking"],["listening","Listening"],["reading","Reading"],["writing","Writing"],["grammar","Grammar"],["confidence","Confidence"]];
const reviewDialog=document.createElement("dialog");reviewDialog.className="he-lesson-review-dialog";reviewDialog.setAttribute("translate","no");document.body.append(reviewDialog);
let reviewBusy=false,reviewOpening=false;
async function openLessonReview(p){
 if(reviewBusy||reviewOpening||reviewDialog.open)return;reviewOpening=true;
 const build=(tag,cls="",value="")=>{const n=document.createElement(tag);if(cls)n.className=cls;if(value)n.textContent=value;return n};
 reviewDialog.replaceChildren();const top=build("div","he-review-header"),title=build("h2","","Lesson review"),close=actionButton("×",()=>reviewDialog.close());close.setAttribute("aria-label","Close review");top.append(title,close);reviewDialog.append(top,build("p","he-review-subtitle",selectedName(p.student_id)+" · "+p.topic),build("p","he-review-loading","Loading existing review…"));reviewDialog.showModal();
 try{
  const tutor=await ensureUser();const [note,assessment]=await Promise.all([p.review_note_id?db.from("atlas_lesson_notes").select("lesson_date,summary,strengths,challenges,next_steps,homework").eq("id",p.review_note_id).eq("tutor_id",tutor).eq("student_id",p.student_id).maybeSingle():Promise.resolve({data:null}),p.review_assessment_id?db.from("atlas_skill_assessments").select("speaking,listening,reading,writing,grammar,confidence,assessed_on").eq("id",p.review_assessment_id).eq("tutor_id",tutor).eq("student_id",p.student_id).maybeSingle():Promise.resolve({data:null})]);
  if(note.error||assessment.error)throw note.error||assessment.error;if(!reviewDialog.open)return;
  reviewDialog.querySelector(".he-review-loading")?.remove();const form=build("form","he-review-form"),controls={};
  const makeField=(label,key,max,placeholder,value,rows=2)=>{const field=build("label","he-review-field",label),input=build("textarea");input.rows=rows;input.maxLength=max;input.placeholder=placeholder;input.value=value||"";field.append(input);controls[key]=input;return field};
  const dateLabel=build("label","he-review-field","Lesson date"),date=build("input");date.type="date";date.required=true;date.max=dateToday();date.value=note.data?.lesson_date||assessment.data?.assessed_on||(p.completed_at?new Date(p.completed_at).toLocaleDateString("en-CA"):dateToday());if(!date.value)date.value=dateToday();dateLabel.append(date);form.append(dateLabel);
  form.append(makeField("Lesson summary","summary",1500,"What did you cover?",note.data?.summary,2));
  const fields=build("div","he-review-note-grid");fields.append(makeField("Strengths","strengths",600,"What went well?",(note.data?.strengths||[]).join("\n")),makeField("Difficulties","challenges",600,"What did the student struggle with?",(note.data?.challenges||[]).join("\n")),makeField("Next lesson focus","next_steps",600,"What should you practise next?",(note.data?.next_steps||[]).join("\n")),makeField("Homework / follow-up","homework",1500,"Optional practice or assignment notes",note.data?.homework));form.append(fields);
  form.append(build("h3","","Skill ratings"),build("p","he-review-hint","Rate performance in this lesson only: 1 = needs substantial support, 3 = developing, 5 = independent. Leave any untested skill unassessed. These are not CEFR levels."));
  const skills=build("div","he-review-skills"),ratings={};
  for(const [key,label] of reviewSkills){const field=build("label","he-review-field",label),select=build("select");select.add(new Option("Not assessed",""));for(const n of [1,2,3,4,5])select.add(new Option(n+" / 5",String(n)));select.value=assessment.data?.[key]==null?"":String(assessment.data[key]);field.append(select);ratings[key]=select;skills.append(field)}form.append(skills);
  const confirmation=build("label","he-review-confirm"),checked=build("input");checked.type="checkbox";checked.required=true;confirmation.append(checked,document.createTextNode(" I confirm this lesson took place and these are my own observations."));form.append(confirmation);
  const status=build("p","he-review-status");status.setAttribute("role","status");const footer=build("div","he-review-footer"),cancel=actionButton("Cancel",()=>reviewDialog.close()),save=build("button","he-review-primary",p.completed_at?"Save review":"Confirm & complete");save.type="submit";footer.append(cancel,save);form.append(status,footer);reviewDialog.append(form);
  form.onsubmit=async e=>{e.preventDefault();if(reviewBusy||!checked.checked)return;reviewBusy=true;save.disabled=cancel.disabled=close.disabled=true;status.textContent="Saving review…";
   try{const {data,error}=await db.rpc("he_confirm_lesson_review",{p_lesson_id:p.id,p_lesson_date:date.value,p_summary:controls.summary.value,p_strengths:controls.strengths.value,p_challenges:controls.challenges.value,p_next_steps:controls.next_steps.value,p_homework:controls.homework.value,p_ratings:Object.fromEntries(reviewSkills.map(([key])=>[key,ratings[key].value?Number(ratings[key].value):null]))});if(error)throw error;if(!data?.completed_at)throw Error("Review not confirmed");Object.assign(p,data);reviewDialog.close();renderLessons();say("he-lesson-feedback","Lesson confirmed. Notes and assessed skills saved to student progress.");document.dispatchEvent(new CustomEvent("helloearth:workspace-data"));loadLessons();}
   catch(err){status.textContent=err.message||"Review could not be saved."}finally{reviewBusy=false;save.disabled=cancel.disabled=close.disabled=false}
  };
 }catch(e){const status=reviewDialog.querySelector(".he-review-loading");if(status)status.textContent=e.message||"Could not load review."}finally{reviewOpening=false}
}
reviewDialog.addEventListener("cancel",e=>{if(reviewBusy)e.preventDefault()});
function renderLessons(){
 const root=el("he-lesson-history");if(!root)return;root.replaceChildren();
 const controls=document.createElement("div");controls.className="he-folder-controls";
 const studentPicker=document.createElement("select");studentPicker.setAttribute("aria-label","Filter saved lessons by student");studentPicker.add(new Option("All students","all"));
 const ids=[...new Set(lessonRows.map(p=>p.student_id))].sort((a,b)=>selectedName(a).localeCompare(selectedName(b)));
 for(const id of ids)studentPicker.add(new Option("📁 "+selectedName(id),id));
 if(lessonFolder!=="all"&&!ids.includes(lessonFolder))lessonFolder="all";
 studentPicker.value=lessonFolder;studentPicker.onchange=()=>{lessonFolder=studentPicker.value;renderLessons()};
 const filters=document.createElement("div");filters.className="he-folder-filters";for(const [key,label] of [["saved","Saved"],["pending","To teach"],["complete","Completed"],["unsaved","Unsaved"]]){
 const b=actionButton(label,()=>{lessonFilter=key;renderLessons()});b.setAttribute("aria-pressed",String(key===lessonFilter));filters.append(b)}
 const search=document.createElement("input");search.type="search";search.placeholder="Find a lesson…";search.setAttribute("aria-label","Find lesson");search.value=lessonSearch;search.oninput=()=>{lessonSearch=search.value;const pos=search.selectionStart;renderLessons();const next=root.querySelector("input[type=search]");next?.focus();try{next?.setSelectionRange(pos,pos)}catch{}};
 controls.append(studentPicker,filters,search);root.append(controls);
 const folders=new Map();
 for(const p of lessonRows){if(lessonFolder!=="all"&&p.student_id!==lessonFolder)continue;if(lessonFilter==="unsaved"?!p.unsaved_at:p.unsaved_at)continue;if(lessonFilter==="complete"&&!p.completed_at||lessonFilter==="pending"&&p.completed_at)continue;if(lessonSearch&&!([p.topic,selectedName(p.student_id),p.cefr_level].join(" ").toLowerCase().includes(lessonSearch.toLowerCase())))continue;if(!folders.has(p.student_id))folders.set(p.student_id,[]);folders.get(p.student_id).push(p)}
 if(!folders.size){const p=document.createElement("p");p.className="he-record-empty";p.textContent="No lessons match this folder or filter.";root.append(p);return}
 for(const [id,plans] of [...folders].sort((a,b)=>selectedName(a[0]).localeCompare(selectedName(b[0])))){
 const folder=document.createElement("details");folder.className="he-student-folder";folder.open=lessonFolder===id||lessonFolderOpen.has(id)||Boolean(lessonSearch)||folders.size===1;
 const head=document.createElement("summary"),label=document.createElement("strong"),count=document.createElement("small");label.textContent="📁 "+selectedName(id);count.textContent=plans.length+" lesson"+(plans.length===1?"":"s");head.append(label,count);folder.append(head);folder.addEventListener("toggle",()=>{if(folder.open)lessonFolderOpen.add(id);else lessonFolderOpen.delete(id)});root.append(folder);
 for(const p of plans){
  const row=document.createElement("article");row.className="he-record-row he-lesson-row";
  const main=document.createElement("div");
  const title=document.createElement("strong");title.textContent=p.topic;
  const meta=document.createElement("small");
  meta.textContent=p.cefr_level+" · "+p.duration_minutes+" min · "+new Date(p.created_at).toLocaleDateString()+(p.completed_at?" · Completed":"")+(p.unsaved_at?" · Unsaved":"");
  main.append(title,meta);
  const actions=document.createElement("div");actions.className="he-saved-primary-actions";
  const menu=document.createElement("details");menu.className="he-saved-menu";const menuLabel=document.createElement("summary");menuLabel.textContent="More ⋯";menuLabel.setAttribute("aria-label","More lesson actions");menu.append(menuLabel);const menuBody=document.createElement("div");menuBody.className="he-saved-menu-body";menu.append(menuBody);const group=label=>{const g=document.createElement("div");g.className="he-saved-menu-group";const h=document.createElement("small");h.textContent=label;g.append(h);menuBody.append(g);return g};const work=group("Lesson"),sharing=group("Share & export"),homework=group("Homework"),manage=group("Manage");
  work.append(actionButton("Edit lesson",()=>{
   activeLessonId=p.id;
   document.dispatchEvent(new CustomEvent("helloearth:lesson-selected",{detail:{id:p.id,studentId:p.student_id}}));
   el("he-lesson-student").value=p.student_id;
   el("he-lesson-topic").value=p.topic;delete el("he-lesson-topic").dataset.autoSuggested;delete el("he-lesson-topic").dataset.autoFocus;delete el("he-lesson-topic").dataset.autoCategory;
   el("he-lesson-level").value=p.cefr_level;
   el("he-lesson-duration").value=p.duration_minutes;
   el("he-lesson-editor").value=p.markdown;
   el("he-lesson-editor").focus();
   say("he-lesson-feedback","Opened lesson. This lesson is now selected for live feedback and homework links.");
  }));
  const linked=homeworkRows.find(h=>h.lesson_plan_id===p.id&&
   h.status!=="cancelled"&&Date.now()<Date.parse(h.expires_at));
  if(linked)homework.append(
   actionButton("Copy homework link",()=>copyLink(linked.id)),
   actionButton("Open homework",()=>openLink(linked.id))
  );
  homework.append(actionButton(linked?"New worksheet":"Create homework link",()=>prepareHomeworkFromLesson(p)));
  const share=savedPublicLinks.get(p.id);
   if(share){
    const a=document.createElement("a");a.href=share.url;
    a.target="_blank";a.rel="noopener noreferrer";a.className="he-workbook-link";
    a.textContent="Open student lesson ↗";main.append(a);
   }
   sharing.append(actionButton(share?"Copy student link":"Share with student",()=>shareSavedLesson(p,true)));
   const present=actionButton("Present live",async()=>{
    const win=window.open("about:blank","_blank");
    const url=await shareSavedLesson(p,false);
    if(url){if(win)win.location.href=url;else say("he-lesson-feedback","Public lesson ready: "+url)}
    else if(win)win.close();
   });present.className="he-saved-present";actions.append(present);
  sharing.append(actionButton("PDF view",()=>window.open(new URL("lesson.html#saved="+p.id,location.href).href,"_blank","noopener")));
  sharing.append(actionButton("Download lesson",()=>downloadText("helloearth-lesson.md",p.markdown||"")));
  const review=actionButton(p.completed_at?"Review":"✓ Complete & review",()=>openLessonReview(p));review.className="he-saved-review";actions.append(review,menu);
  if(p.completed_at)manage.append(actionButton("Reopen lesson",()=>changeLessonState(p,"complete",menuLabel)));
  for(const [op,label] of [[p.unsaved_at?"restore":"unsave",p.unsaved_at?"Restore":"Unsave"],["delete","Delete permanently"]]){const b=actionButton(label,()=>changeLessonState(p,op,b));if(op==="delete")b.className+=" he-delete-lesson";manage.append(b)}
  menuBody.addEventListener("click",e=>{if(e.target.closest("button"))menu.open=false});
  if(p.review_note_id){const badge=document.createElement("span");badge.className="he-saved-reviewed";badge.textContent="Review saved";main.append(badge)}
  row.append(main,actions);folder.append(row);
 }
 }
}
document.addEventListener("helloearth:open-lesson-folder",e=>{lessonFolder=e.detail?.studentId||"all";lessonFilter="saved";lessonSearch="";if(lessonFolder!=="all")lessonFolderOpen.add(lessonFolder);el("lessons-tab")?.click();loadLessons().then(()=>el("he-lesson-history")?.scrollIntoView({block:"start"}))});
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
  await ensureUser();const id=crypto.randomUUID();const {error}=await db.from("atlas_lesson_plans").insert({id,tutor_id:activeTutor,student_id:studentId,topic:topic.slice(0,200),cefr_level:level,duration_minutes:duration,markdown:markdown.slice(0,100000)});if(!error){
   activeLessonId=id;
   document.dispatchEvent(new CustomEvent("helloearth:lesson-selected",{detail:{id,studentId}}));
  }
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
  ?"Nova will use your included lesson credits."
  :"Your own API key is used for this request only and isn't saved.");
});
async function generateWithHaiku(mode){
 const {topic,level,duration}=baseLesson();
 const topicField=el("he-lesson-topic");
 const category=el("he-lesson-category").value;
 const requestTopic=topicField.dataset.autoSuggested===topic?(topicField.dataset.autoCategory===category?topicField.dataset.autoFocus||"":""):topic;
 const studentId=el("he-lesson-student").value;
 const byok=aiProvider.value==="anthropic-byok";
 const ownKey=el("he-openai-key").value.trim();
 if(!studentId){say("he-ai-feedback","Choose a student first.",true);return}
 if(byok&&!ownKey.startsWith("sk-ant-")){
  say("he-ai-feedback","Enter your API key or select Nova included credits.",true);return
 }
 const buttons=[el("he-lesson-generate"),el("he-homework-ai-generate")];
 buttons.forEach(b=>{b.disabled=true});
 say("he-ai-feedback","Nova is preparing your print-ready "+mode+" workbook…");
 try{
  await ensureUser();
  const {data:{session},error:authError}=await db.auth.getSession();
  if(authError||!session?.access_token)throw new Error("Session expired. Sign in again.");
  const useStudentProfile=el("he-share-context").checked;
  const body={provider:byok?"anthropic-byok":"managed",mode,topic:requestTopic,cefr:level,
   category,studentId,useStudentProfile,duration,
   instructions:el("he-lesson-instructions").value};
  if(byok)body.apiKey=ownKey;
  const {data,error}=await db.functions.invoke("helloearth-generate",{body});
  if(error){
   let message=error.message||"Nova could not complete this generation.";
   if(typeof error.context?.json==="function"){
    try{const detail=await error.context.json();if(detail?.error)message=detail.error}catch{}
   }
   throw new Error(message);
  }
  if(!data?.text)throw new Error(data?.error||"No workbook content was returned.");
  const resolvedTopic=String(data.topic||topic||"Personalised English lesson").slice(0,200);
  if(data.autoTopic===true||!requestTopic){
   el("he-lesson-topic").value=resolvedTopic;
   el("he-lesson-topic").dataset.autoSuggested=resolvedTopic;
   el("he-lesson-topic").dataset.autoFocus=requestTopic;
   const categoryField=el("he-lesson-category");if([...categoryField.options].some(o=>o.value===data.category))categoryField.value=data.category;
   topicField.dataset.autoCategory=categoryField.value;
  }
  const workbook=String(data.text).replace(/^\s*>\s*\*\*Note for the tutor:\*\*[^\n]*(?:\n>[^\n]*)*\n?/gim,"").trim().slice(0,100000);
  el("he-lesson-editor").value=workbook;
  let logged=false;
  try{
   if(!window.HelloEarthGenerationLog?.record)throw Error("Generation history is unavailable.");
   await window.HelloEarthGenerationLog.record({studentId,topic:resolvedTopic,level,duration,markdown:workbook,kind:mode});
   logged=true;
  }catch(logError){
   say("he-lesson-feedback","Workbook ready, but the temporary link could not be saved: "+logError.message,true);
  }
  if(mode==="homework"){
   el("he-homework-student").value=studentId;
   el("he-homework-title").value=("Practice: "+resolvedTopic).slice(0,800);
   const parts=splitAnswerKey(workbook);
   el("he-homework-content").value=parts.worksheet.slice(0,30000);
   el("he-homework-key").value=parts.key.slice(0,12000);
   el("he-homework-lesson-id").value=activeLessonId||"";
  }
  say("he-ai-feedback",
   (mode==="homework"
    ?"Homework worksheet prepared. Review the tasks, then create a student link in Homework."
    :"Your workbook is ready. Open its printable page or edit it before saving.")+
   (data.autoTopic?" Nova selected: "+resolvedTopic+".":"")+
   (logged?" A temporary link is in Generation history.":"")+
   (Number.isInteger(data.historyUsed)&&data.historyUsed>0?" Compared with "+data.historyUsed+" previous learning activities.":"")+
   (Number.isInteger(data.archiveUsed)&&data.archiveUsed>0?" Consulted "+data.archiveUsed+" of "+data.archiveAvailable+" learner-specific archived sources.":"")+
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
 el("he-homework-key").value=split.key||splitAnswerKey(text).key;
 el("he-homework-lesson-id").value=activeLessonId||"";
 el("homework-tab")?.click();
 say("he-homework-feedback","Homework draft prepared. Add the assignment details before saving.");
});
el("he-openai-key").addEventListener("input",()=>say("he-ai-feedback","Your API key is used for this request only. It is not saved."));
el("he-homework-create-ai").addEventListener("click",()=>{
 const chosen=el("he-homework-student").value;
 el("lessons-tab")?.click();
 if(chosen)el("he-lesson-student").value=chosen;
 activeLessonId=null;
 el("he-ai-integration").open=true;
 el("he-homework-ai-generate").focus();
 say("he-ai-feedback","Type a topic or skill (e.g. vocabulary), or leave it blank for Nova to choose.");
});
document.addEventListener("helloearth:studentsloaded",()=>{studentOptions();loadHomework();loadLessons()});
document.addEventListener("helloearth:view-changed",e=>{if(e.detail?.view==="homework")loadHomework();if(e.detail?.view==="lessons")loadLessons()});
const ready=()=>{if(W()?.userId){studentOptions();loadHomework();loadLessons()}};
ready();

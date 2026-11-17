import {db,$,W,state,esc,dateOnly,friendlyDate,formData,message,refresh,onRender,nameFor,studentFor,options} from "./dashboard-suite-shared.js";
let homeworkForm,prepForm,prefsForm,searchInput;
const prepKeys=["review_notes","check_homework","confirm_goals","prepare_materials","confirm_schedule"];
function renderHomework(){
 const root=$("he-suite-homework-list");
 const pending=[...state.homework].sort((a,b)=>Number(a.status==="completed")-Number(b.status==="completed")||
  (a.due_on||"9999").localeCompare(b.due_on||"9999"));
 const current=state.students.filter(s=>s.current_homework?.trim());
 root.innerHTML=(current.length?'<p class="he-suite-note">Homework recorded in existing student profiles</p>'+
 current.slice(0,35).map(s=>'<div class="he-suite-row"><div><strong>'+esc(s.display_name)+'</strong><small>From student profile</small><p>'+esc(s.current_homework)+'</p></div>'+
 '<button type="button" data-suite-open="'+esc(s.id)+'">Profile</button></div>').join(""):"")+
 '<p class="he-suite-note">Tracked assignments · '+pending.filter(h=>h.status==="assigned").length+' pending</p>'+
 (pending.length?pending.slice(0,90).map(h=>
  '<div class="he-suite-row"><div><strong>'+esc(nameFor(h.student_id))+'</strong><small>'+
  (h.due_on?"Due "+esc(friendlyDate(h.due_on)):"No due date")+'</small><p>'+esc(h.title)+'</p></div>'+
  '<div class="he-suite-row-actions"><span>'+esc(h.status)+'</span>'+
  (h.status==="assigned"?'<button type="button" data-homework="'+esc(h.id)+'" data-homework-action="completed">Mark done</button>':
   '<button type="button" data-homework="'+esc(h.id)+'" data-homework-action="assigned">Reopen</button>')+
  '</div></div>').join(""):'<p class="he-suite-empty">No tracked assignments yet.</p>');
}
function updatePrep(){
 const id=prepForm.elements.namedItem("student_id").value;
 const record=state.preparation.find(p=>p.student_id===id);
 for(const key of prepKeys)prepForm.elements.namedItem(key).checked=Boolean(record?.completed?.[key]);
 prepForm.elements.namedItem("preparation_note").value=record?.preparation_note||"";
}
function updatePrefs(){
 const id=prefsForm.elements.namedItem("student_id").value;
 const p=state.preferences.find(pref=>pref.student_id===id);
 prefsForm.elements.namedItem("timezone").value=p?.timezone||"UTC";
 prefsForm.elements.namedItem("contact_email").value=p?.contact_email||"";
 prefsForm.elements.namedItem("default_rate").value=p?.default_rate??"";
 showTimezone();
 const link=state.links.find(l=>l.student_id===id&& !l.revoked_at && new Date(l.expires_at)>new Date());
 $("he-suite-portal-result").textContent=link?
  "An active portal link exists until "+friendlyDate(link.expires_at)+". For security, create a new link if you need to copy it again.":
  "No active student portal link found.";
}
function showTimezone(){
 const id=prefsForm.elements.namedItem("student_id").value;
 const student=studentFor(id);
 const tutorTz=state.settings?.timezone||"Africa/Johannesburg";
 const chosen=prefsForm.elements.namedItem("timezone").value.trim();
 const root=$("he-suite-timezone");
 if(!student){root.textContent="Select a student to compare timezones.";return}
 try{
  const now=new Date();
  const fmt=tz=>new Intl.DateTimeFormat("en",{timeZone:tz,dateStyle:"medium",timeStyle:"short"}).format(now);
  root.textContent="Tutor · "+tutorTz+": "+fmt(tutorTz)+" | "+student.display_name+" · "+chosen+": "+fmt(chosen);
 }catch{root.textContent="Use a valid IANA timezone, e.g. Europe/Warsaw or America/Sao_Paulo."}
}
function searchRecords(){
 const q=searchInput.value.trim().toLocaleLowerCase();
 const target=$("he-suite-search-results");
 if(q.length<2){target.innerHTML='<p class="he-suite-empty">Enter at least two characters to search your private records.</p>';return}
 const results=[];
 const add=(id,kind,content)=>{
  const text=String(content||"");
  const ix=text.toLocaleLowerCase().indexOf(q);
  if(ix<0)return;
  results.push({id,kind,text:text.slice(Math.max(0,ix-65),Math.min(text.length,ix+130))});
 };
 for(const s of state.students){
  add(s.id,"Student profile",[
   s.display_name,(s.learning_goals||[]).join(" "),s.background_notes,
   (s.focus_areas||[]).join(" "),s.current_homework,s.assessment_notes].join(" | "));
 }
 for(const n of state.notes){
  add(n.student_id,"Lesson note",[n.summary,n.homework,(n.challenges||[]).join(" "),
   (n.next_steps||[]).join(" ")].join(" | "));
 }
 for(const p of state.plans)add(p.student_id,"Lesson plan",p.topic+" | "+p.markdown);
 for(const h of state.homework)add(h.student_id,"Homework",h.title);
 target.innerHTML=results.length?results.slice(0,45).map(r=>
  '<div class="he-suite-row"><div><strong>'+esc(r.kind+" · "+nameFor(r.id))+'</strong>'+
  '<p>'+esc(r.text)+'</p></div><button type="button" data-search-student="'+esc(r.id)+'">Open profile</button></div>').join("")+
  (results.length>45?'<p class="he-suite-note">Showing first 45 matches. Refine your search.</p>':""):
 '<p class="he-suite-empty">No matching records found.</p>';
}
function openStudent(id){
 if(!studentFor(id))return;
 $("students-tab").click();
 W()?.openStudent(id);
}
export function setupStudents(){
 homeworkForm=$("he-suite-homework-form");
 prepForm=$("he-suite-prep");
 prefsForm=$("he-suite-student-settings");
 searchInput=$("he-suite-search-input");
 onRender(renderHomework);
 $("he-suite-homework-form").addEventListener("submit",async e=>{
  e.preventDefault();const data=formData(e.currentTarget);
  if(!studentFor(data.student_id)){message("Choose a student.",true);return}
  try{
   const {error}=await db.from("he_homework").insert({
    tutor_id:state.userId,student_id:data.student_id,title:data.title.trim(),
    due_on:data.due_on||null,status:"assigned"});
   if(error)throw error;
   e.currentTarget.elements.namedItem("title").value="";
   await refresh(["homework"]);message("Homework assigned to this student.");
  }catch(err){message("Could not assign homework: "+err.message,true)}
 });
 $("he-suite-homework-list").addEventListener("click",async e=>{
  const btn=e.target.closest("button");if(!btn)return;
  if(btn.dataset.suiteOpen){openStudent(btn.dataset.suiteOpen);return}
  if(!btn.dataset.homework)return;
  try{
   const status=btn.dataset.homeworkAction;
   const {error}=await db.from("he_homework").update({
    status,completed_at:status==="completed"?new Date().toISOString():null
   }).eq("tutor_id",state.userId).eq("id",btn.dataset.homework);
   if(error)throw error;await refresh(["homework"]);message("Homework updated.");
  }catch(err){message(err.message,true)}
 });
 prepForm.elements.namedItem("student_id").addEventListener("change",updatePrep);
 prepForm.addEventListener("submit",async e=>{
  e.preventDefault();const data=formData(e.currentTarget);
  if(!studentFor(data.student_id))return message("Choose a student.",true);
  const completed=Object.fromEntries(prepKeys.map(k=>[k,!!data[k]]));
  try{
   const {error}=await db.from("he_preparation").upsert({
    tutor_id:state.userId,student_id:data.student_id,completed,
    preparation_note:String(data.preparation_note||"").slice(0,1500),updated_at:new Date().toISOString()
   },{onConflict:"tutor_id,student_id"});
   if(error)throw error;await refresh(["preparation"]);message("Lesson preparation checklist saved.");
  }catch(err){message(err.message,true)}
 });
 $("he-suite-open-student").addEventListener("click",()=>openStudent(prepForm.elements.namedItem("student_id").value));
 prefsForm.elements.namedItem("student_id").addEventListener("change",updatePrefs);
 prefsForm.elements.namedItem("timezone").addEventListener("input",showTimezone);
 prefsForm.addEventListener("submit",async e=>{
  e.preventDefault();const data=formData(e.currentTarget);
  if(!studentFor(data.student_id))return message("Choose a student.",true);
  try{new Intl.DateTimeFormat("en",{timeZone:data.timezone})}catch{return message("Enter an IANA timezone such as Europe/Warsaw.",true)}
  try{
   const rate=data.default_rate===""?null:Number(data.default_rate);
   const {error}=await db.from("he_student_preferences").upsert({
    tutor_id:state.userId,student_id:data.student_id,timezone:data.timezone,
    contact_email:data.contact_email||null,default_rate:rate,updated_at:new Date().toISOString()
   },{onConflict:"tutor_id,student_id"});
   if(error)throw error;await refresh(["preferences"]);message("Student preferences saved.");
  }catch(err){message("Could not save preferences: "+err.message,true)}
 });
 async function portal(action){
  const id=prefsForm.elements.namedItem("student_id").value;
  const student=studentFor(id);if(!student)return message("Select a student first.",true);
  if(action==="createPortal"&&!confirm(
   "Create a private 30-day share link for "+student.display_name+"? Anyone with the link can read the selected student summary."))return;
  try{
   const {data,error}=await db.functions.invoke("he-public",{body:{action,studentId:id}});
   if(error)throw error;
   if(data?.error)throw Error(data.error);
   if(action==="revokePortal"){
    $("he-suite-portal-result").textContent="Student portal access revoked.";
   }else{
    const url=location.origin+"/student-portal.html#"+data.token;
    const n=$("he-suite-portal-result");
    n.replaceChildren();
    const input=document.createElement("input");input.readOnly=true;input.value=url;input.setAttribute("aria-label","Private student portal link");
    const btn=document.createElement("button");btn.type="button";btn.textContent="Copy private link";
    btn.onclick=()=>navigator.clipboard.writeText(url).then(()=>message("Student link copied."),()=>message("Copy the link manually.",true));
    const warning=document.createElement("p");warning.textContent="Expires "+friendlyDate(data.expiresAt)+". Anyone who receives the link can see the limited portal summary.";
    n.append(input,btn,warning);
   }
   await refresh(["links"]);message(action==="revokePortal"?"Student portal link revoked.":"Private student link created.");
  }catch(error){message("Student portal action failed: "+(error.message||"Try again."),true)}
 }
 $("he-suite-create-portal").addEventListener("click",()=>portal("createPortal"));
 $("he-suite-revoke-portal").addEventListener("click",()=>portal("revokePortal"));
 $("he-suite-search").addEventListener("click",searchRecords);
 searchInput.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();searchRecords()}});
 $("he-suite-search-results").addEventListener("click",e=>{
  const btn=e.target.closest("[data-search-student]");
  if(btn)openStudent(btn.dataset.searchStudent);
 });
 onRender(()=>{
  const a=prepForm.elements.namedItem("student_id"),b=prefsForm.elements.namedItem("student_id");
  if(!a.value&&state.selectedStudent&&studentFor(state.selectedStudent)){a.value=state.selectedStudent;updatePrep()}
  if(!b.value&&state.selectedStudent&&studentFor(state.selectedStudent)){b.value=state.selectedStudent;updatePrefs()}
 });
}

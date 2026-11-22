import {db} from "./supabase-client.js";
const $=id=>document.getElementById(id);
const dateToday=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-")};
const clean=(value,max=1500)=>String(value||"").trim().slice(0,max);
const el=(tag,value,cls)=>{const n=document.createElement(tag);n.textContent=String(value??"");if(cls)n.className=cls;return n};
const button=(label,fn)=>{const b=document.createElement("button");b.type="button";b.textContent=label;b.onclick=fn;return b};
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let tutorId=null,learners=[],items=[],questions=[],feedbackId=null;
const selected=()=>$("t-student").value;
const learnerName=()=>learners.find(s=>s.id===selected())?.display_name||"Student";
const msg=(s,error=false)=>{$("t-status").textContent=s;$("t-status").classList.toggle("error",error)};
function tab(which){
 $("t-notes-view").hidden=which!=="notes";$("t-exercise-view").hidden=which!=="exercise";
 $("t-tab-notes").classList.toggle("active",which==="notes");$("t-tab-exercise").classList.toggle("active",which==="exercise");
}
$("t-tab-notes").onclick=()=>tab("notes");$("t-tab-exercise").onclick=()=>tab("exercise");
$("t-date").value=dateToday();
function resetLesson(){
 feedbackId=null;items=[];
 ["t-objective","t-summary","t-strengths","t-next","t-homework"].forEach(id=>$(id).value="");
 $("t-date").value=dateToday();renderItems();
}
$("t-new").onclick=()=>{resetLesson();msg("New lesson draft ready.")};
function drawCard(root,title,description,actions=[]){
 const card=el("article","","teach-entry");card.append(el("strong",title));
 if(description)card.append(el("p",description));
 if(actions.length){const row=el("div","","teach-entry-actions");actions.forEach(b=>row.append(b));card.append(row)}
 root.append(card);return card;
}
function renderItems(){
 const root=$("t-items");root.replaceChildren();
 $("t-item-count").textContent=items.length+" items";
 items.forEach((item,i)=>{
  const card=drawCard(root,item.kind==="vocabulary"?"Vocabulary":"Sentence correction",item.before+" → "+item.after,[button("Remove",()=>{items.splice(i,1);renderItems()})]);
  if(item.explanation)card.insertBefore(el("small",item.explanation),card.lastElementChild);
 });
}
$("t-kind").onchange=()=>{
 const vocab=$("t-kind").value==="vocabulary";
 $("t-before-label").textContent=vocab?"Word or phrase":"Student said";
 $("t-after-label").textContent=vocab?"Meaning":"Correct sentence";
 $("t-before").placeholder=vocab?"resilient":"Yesterday I go to work";
 $("t-after").placeholder=vocab?"Able to recover from difficulties":"Yesterday I went to work";
};
$("t-add-item").onclick=()=>{
 if(!selected())return msg("Choose a student first.",true);
 const before=clean($("t-before").value,280),after=clean($("t-after").value,280);
 if(!before||!after)return msg("Enter both the original text and the correction or meaning.",true);
 if(items.length>=30)return msg("Maximum 30 feedback items per lesson.",true);
 items.push({kind:$("t-kind").value,before,after,explanation:clean($("t-explain").value,400)});
 ["t-before","t-after","t-explain"].forEach(id=>$(id).value="");
 renderItems();msg("Added to your lesson draft.");
};
async function loadHistory(){
 const studentId=selected();if(!studentId)return $("t-history").replaceChildren(el("p","Choose a student."));
 const {data,error}=await db.from("he_lesson_feedback")
  .select("id,lesson_date,objective,summary,strengths,next_steps,homework,items,status,created_at")
  .eq("tutor_id",tutorId).eq("student_id",studentId).order("created_at",{ascending:false}).limit(40);
 if(selected()!==studentId)return;
 const root=$("t-history");root.replaceChildren();
 if(error)return msg("Could not load lesson history: "+error.message,true);
 if(!data.length)return root.append(el("p","No reports saved yet."));
 data.forEach(r=>drawCard(root,r.lesson_date+" · "+(r.status==="final"?"Finished":"Draft"),
  r.objective||r.summary||"Recorded feedback",[button("Open report",()=>openReport(r))]));
}
function openReport(record){
 feedbackId=record.id;items=Array.isArray(record.items)?record.items:[];
 $("t-date").value=record.lesson_date;
 const fields={"t-objective":"objective","t-summary":"summary","t-strengths":"strengths","t-next":"next_steps","t-homework":"homework"};
 Object.entries(fields).forEach(([id,key])=>$(id).value=record[key]||"");
 renderItems();tab("notes");msg("Opened saved report. Click Save to keep any changes.");
 window.scrollTo({top:0,behavior:"smooth"});
}
async function saveReport(status){
 if(!selected())return msg("Choose a student.",true);
 const record={tutor_id:tutorId,student_id:selected(),lesson_date:$("t-date").value||dateToday(),
  objective:clean($("t-objective").value,500),summary:clean($("t-summary").value,2500),
  strengths:clean($("t-strengths").value,1500),next_steps:clean($("t-next").value,1500),
  homework:clean($("t-homework").value,1500),items,status,updated_at:new Date().toISOString()};
 if(!record.objective&&!record.summary&&!items.length)return msg("Add an objective, summary or correction first.",true);
 const buttons=[$("t-draft"),$("t-final")];buttons.forEach(b=>b.disabled=true);
 try{
  const q=feedbackId?db.from("he_lesson_feedback").update(record).eq("id",feedbackId).eq("tutor_id",tutorId).select("id").single():
    db.from("he_lesson_feedback").insert(record).select("id").single();
  const {data,error}=await q;if(error)throw error;
  feedbackId=data.id;msg(status==="final"?"Lesson report finished and saved.":"Draft saved privately.");
  await loadHistory();
 }catch(e){msg("Could not save: "+e.message,true)}
 finally{buttons.forEach(b=>b.disabled=false)}
}
$("t-draft").onclick=()=>saveReport("draft");$("t-final").onclick=()=>saveReport("final");
$("t-print").onclick=()=>{
 if(!selected())return msg("Choose a student first.",true);
 const notes=items.map(x=>"<li><strong>"+esc(x.kind==="vocabulary"?"Vocabulary":"Correction")+"</strong>: "+esc(x.before)+" → "+esc(x.after)+(x.explanation?"<br>"+esc(x.explanation):"")+"</li>").join("");
 const fields=[["Learning objective",$("t-objective").value],["Lesson summary",$("t-summary").value],["Strengths",$("t-strengths").value],["Next steps",$("t-next").value],["Homework",$("t-homework").value]];
 const body=fields.slice(0,3).map(([a,b])=>"<h2>"+esc(a)+"</h2><p>"+esc(b)+"</p>").join("")+"<h2>Corrections & vocabulary</h2><ul>"+notes+"</ul>"+fields.slice(3).map(([a,b])=>"<h2>"+esc(a)+"</h2><p>"+esc(b)+"</p>").join("");
 const html='<!doctype html><html><head><meta charset="utf-8"><title>Lesson feedback</title><style>body{font:15px/1.6 system-ui;color:#26324a;max-width:800px;margin:35px}h1{color:#7655aa}h2{margin-top:22px}li{margin:8px 0}@media print{button{display:none}body{margin:16mm}}</style></head><body><button onclick="window.print()">Print / Save as PDF</button><h1>HelloEarth · Student feedback</h1><p><strong>'+esc(learnerName())+'</strong> · '+esc($("t-date").value)+'</p>'+body+'</body></html>';
 const w=window.open("","_blank");
 if(!w)return msg("Allow popups to print the report.",true);
 w.document.open();w.document.write(html);w.document.close();w.focus();
};
function questionMode(){
 const choice=$("t-type").value==="choice";
 $("t-options-wrap").hidden=!choice;$("t-correct-wrap").hidden=!choice;
}
$("t-type").onchange=questionMode;
function renderQuestions(){
 const root=$("t-questions");root.replaceChildren();
 $("t-question-count").textContent=questions.length+" / 12";
 questions.forEach((q,i)=>{
  const options=q.type==="choice"?q.options.map((s,j)=>(j===q.correct?"✓ ":"")+s).join(" · "):"Written response · teacher reviews";
  drawCard(root,(i+1)+". "+q.prompt,options,[button("Remove",()=>{questions.splice(i,1);renderQuestions()})]);
 });
}
$("t-add-question").onclick=()=>{
 if(questions.length>=12)return msg("Maximum 12 questions in each exercise.",true);
 const prompt=clean($("t-prompt").value,500),type=$("t-type").value;
 if(prompt.length<4)return msg("Write your question first.",true);
 if(type==="choice"){
  const options=$("t-options").value.split(/\r?\n/).map(x=>clean(x,180)).filter(Boolean);
  const correct=Number($("t-correct").value);
  if(options.length<2||options.length>4||correct>=options.length)return msg("Enter 2–4 options and choose the correct one.",true);
  questions.push({prompt,type,options,correct});
 }else questions.push({prompt,type});
 $("t-prompt").value="";$("t-options").value="";
 renderQuestions();msg("Question added.");
};
async function exerciseAction(payload){
 const {data,error}=await db.functions.invoke("he-exercises",{body:payload});
 if(error)throw error;if(data?.error)throw Error(data.error);return data;
}
function showLink(token){
 $("t-link-box").hidden=false;
 $("t-link").value=location.origin+"/exercise.html#"+token;
}
$("t-copy").onclick=async()=>{
 try{await navigator.clipboard.writeText($("t-link").value);msg("Private exercise link copied!")}
 catch{$("t-link").select();msg("Copy the selected URL manually.")}
};
$("t-preview").onclick=()=>{if($("t-link").value)window.open($("t-link").value,"_blank","noopener")};
$("t-publish").onclick=async()=>{
 if(!selected())return msg("Choose a student first.",true);
 const title=clean($("t-ex-title").value,140);
 if(title.length<3||!questions.length)return msg("Add a title and at least one question.",true);
 $("t-publish").disabled=true;
 try{
  const data=await exerciseAction({action:"create",studentId:selected(),title,
    instructions:clean($("t-ex-instructions").value,1200),questions});
  showLink(data.token);msg("Exercise created! Copy the link now and send it to your student.");
  questions=[];renderQuestions();$("t-ex-title").value="";$("t-ex-instructions").value="";
  await loadExercises();
 }catch(e){msg("Could not generate link: "+e.message,true)}
 finally{$("t-publish").disabled=false}
};
async function loadExercises(){
 const studentId=selected();if(!studentId)return $("t-exercises").replaceChildren(el("p","Choose a student."));
 try{
  const data=await exerciseAction({action:"list",studentId});
  if(studentId!==selected())return;
  const root=$("t-exercises");root.replaceChildren();
  if(!data.exercises.length)return root.append(el("p","No exercises created yet."));
  data.exercises.forEach(e=>{
   const expired=new Date(e.expires_at)<new Date();
   const state=e.submitted?"Answers received":e.status==="closed"?"Closed":expired?"Expired":"Awaiting answers";
   const controls=[button("Review",()=>review(e.id))];
   if(!e.submitted&&e.status==="open")controls.push(button("New link",()=>reissue(e.id)));
   if(e.status==="open")controls.push(button("Close",()=>closeExercise(e.id)));
   drawCard(root,e.title,state+" · "+new Date(e.created_at).toLocaleDateString(),controls);
  });
 }catch(e){msg("Could not load exercises: "+e.message,true)}
}
async function review(id){
 try{
  const d=await exerciseAction({action:"review",exerciseId:id});
  const root=$("t-review");root.replaceChildren();root.hidden=false;
  root.append(el("h3",d.exercise.title));
  root.append(el("p",d.submission?"Submitted "+new Date(d.submission.submitted_at).toLocaleString()+" · Multiple-choice score: "+d.submission.score+"/"+d.submission.max_score:"No answers submitted yet."));
  d.exercise.questions.forEach((q,i)=>{
   const textAnswer=d.submission?.answers?.[i]??"";
   const response=q.type==="choice"?(q.options[Number(textAnswer)]??"—"):textAnswer;
   const card=drawCard(root,(i+1)+". "+q.prompt,d.submission?"Student answered: "+response:"Not answered");
   card.append(el("small",q.type==="choice"?"Correct answer: "+q.options[q.correct]:"Written response · review manually"));
  });
  root.scrollIntoView({behavior:"smooth",block:"nearest"});
 }catch(e){msg("Could not review: "+e.message,true)}
}
async function reissue(id){
 if(!confirm("Replace the unused link? The previous link will stop working."))return;
 try{const d=await exerciseAction({action:"reissue",exerciseId:id});showLink(d.token);msg("New link created. Copy it now.");await loadExercises();}
 catch(e){msg("Could not reissue: "+e.message,true)}
}
async function closeExercise(id){
 if(!confirm("Close this link? Students will no longer be able to submit it."))return;
 try{await exerciseAction({action:"close",exerciseId:id});msg("Exercise closed.");await loadExercises()}
 catch(e){msg("Could not close: "+e.message,true)}
}
function switchStudent(){
 resetLesson();questions=[];renderQuestions();$("t-link-box").hidden=true;$("t-review").hidden=true;
 if(!selected())return msg("Choose a student.");
 msg("Ready for "+learnerName()+".");loadHistory();loadExercises();
}
$("t-student").onchange=switchStudent;
async function init(){
 const {data:{user},error}=await db.auth.getUser();
 if(error||!user){location.replace("login.html?next=dashboard.html");return}
 tutorId=user.id;
 const {data, error:loadError}=await db.from("atlas_students").select("id,display_name").eq("tutor_id",tutorId).order("display_name").limit(500);
 if(loadError){msg("Couldn't load students: "+loadError.message,true)}
 else{
  learners=data||[];
  learners.forEach(s=>$("t-student").append(new Option(s.display_name,s.id)));
  const requested=new URLSearchParams(location.search).get("student");
  if(requested&&learners.some(s=>s.id===requested))$("t-student").value=requested;
  switchStudent();
 }
 $("teach-app").hidden=false;$("teach-loading").hidden=true;
}
renderItems();renderQuestions();questionMode();init();

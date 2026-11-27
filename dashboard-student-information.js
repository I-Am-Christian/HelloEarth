import {db} from "./supabase-client.js";
// Progressive enhancement of the existing student form and detail screen.
// All original input IDs and the existing save handlers remain unchanged.
const studentForm=document.getElementById("student-form");
const modal=document.getElementById("student-modal");
const detail=document.getElementById("student-detail");
const fields=document.getElementById("student-fields");
const categories=[
 {id:"profile",label:"Essentials",hint:"Name, photo, CEFR and language",inputs:["student-name","student-nickname","student-photo-preview","student-cefr","student-translation","student-status"]},
 {id:"goals",label:"Learning goals",hint:"What to improve and what already works",inputs:["student-goals","student-focus","student-strengths","student-weaknesses"]},
 {id:"teaching",label:"Interests & lessons",hint:"Personalise the experience",inputs:["student-interests","student-preferences","student-background","student-homework"]},
 {id:"history",label:"History & assessment",hint:"Your supporting notes and observations",inputs:["student-level-notes","student-assessment","student-history"]}
];
let formCurrent="profile",selectedStudent=null,detailCurrent="snapshot";
function button(label,callback,cls=""){
 const node=document.createElement("button");node.type="button";
 node.textContent=label;node.className=cls;node.addEventListener("click",callback);return node;
}
if(studentForm){
 const nav=document.createElement("nav");nav.id="he-student-editor-tabs";
 nav.className="he-student-editor-tabs";nav.setAttribute("aria-label","Student information sections");
 const intro=document.createElement("div");intro.className="he-profile-intro";
 intro.innerHTML='<strong>Student information, simplified</strong><p>Start with the basics, then add goals and learning details as you get to know your student.</p>';
 studentForm.prepend(intro,nav);
 const panels=new Map();
 for(const section of categories){
  const panel=document.createElement("section");
  panel.className="he-student-form-step";panel.dataset.section=section.id;
  const title=document.createElement("div");title.className="he-step-heading";
  const h=document.createElement("h3");h.textContent=section.label;
  const p=document.createElement("p");p.textContent=section.hint;title.append(h,p);
  panel.append(title);
  for(const id of section.inputs){
   const input=document.getElementById(id);
   const wrapper=input?.closest(".field");
   if(wrapper&&wrapper.parentElement===studentForm)panel.append(wrapper);
  }
  panels.set(section.id,panel);
  studentForm.insertBefore(panel,document.getElementById("save-student"));
  const tab=button(section.label,()=>activate(section.id));
  tab.dataset.section=section.id;tab.setAttribute("aria-pressed","false");
  nav.append(tab);
 }
 const controls=document.createElement("div");controls.className="he-student-step-controls";
 const prev=button("← Previous",()=>activate(categories[Math.max(0,categories.findIndex(x=>x.id===formCurrent)-1)].id));
 const next=button("Next section →",()=>activate(categories[Math.min(categories.length-1,categories.findIndex(x=>x.id===formCurrent)+1)].id));
 const name=document.createElement("span");name.id="he-student-step-name";
 controls.append(prev,name,next);
 studentForm.insertBefore(controls,document.getElementById("save-student"));
 function activate(id){
  formCurrent=id;
  for(const [key,panel] of panels)panel.hidden=key!==id;
  for(const b of nav.querySelectorAll("button"))b.setAttribute("aria-pressed",String(b.dataset.section===id));
  const position=categories.findIndex(x=>x.id===id);
  name.textContent="Section "+(position+1)+" of "+categories.length;
  prev.disabled=position===0;next.disabled=position===categories.length-1;
 }
 activate("profile");
 for(const control of ["add-student","edit-student","ux-header-add-student"]){
  document.getElementById(control)?.addEventListener("click",()=>activate("profile"));
 }
 // If validation fails on a field in another section, reveal that section.
 studentForm.addEventListener("invalid",event=>{
  const group=event.target.closest(".he-student-form-step");
  if(group)activate(group.dataset.section);
 },true);
}
if(detail&&fields){
 const tabs=document.createElement("nav");tabs.id="he-student-info-tabs";
 tabs.className="he-student-info-tabs";tabs.setAttribute("aria-label","Student profile topics");
 const sections=[
  ["snapshot","Overview"],
  ["learning","Goals & skills"],
  ["personal","Interests & preferences"],
  ["records","History & records"]
 ];
 for(const [id,label] of sections){
  const tab=button(label,()=>show(id));tab.dataset.tab=id;
  tab.setAttribute("aria-pressed",id==="snapshot"?"true":"false");
  tabs.append(tab);
 }
 fields.parentNode.insertBefore(tabs,fields);
 const summary=document.createElement("div");summary.id="he-student-profile-summary";
 summary.className="he-student-profile-summary";
 fields.parentNode.insertBefore(summary,tabs);
 const observations=document.createElement("section");observations.id="he-student-recent-feedback";
 observations.className="he-student-recent-feedback";
 const title=document.createElement("div");title.className="he-student-observations-header";
 title.innerHTML='<h3>Recent classroom observations</h3><p>Private notes entered during lessons or saved with Nova.</p>';
 const list=document.createElement("div");list.id="he-student-recent-list";
 const actions=document.createElement("div");actions.className="he-student-observations-buttons";
 actions.append(
  button("✎ Add live feedback",()=>{
   document.getElementById("he-live-feedback-launch")?.click();
  }),
  button("✦ Ask Nova",()=>{
   document.getElementById("he-nova-launch")?.click();
  }),
  button("▥ Lesson reports",()=>{
   if(selectedStudent?.id)window.HelloEarthLessonReports?.openForStudent?.(selectedStudent.id);
  })
 );
 observations.append(title,actions,list);
 fields.parentNode.insertBefore(observations,fields.nextSibling);
 const reviewBox=document.createElement("section");reviewBox.className="he-student-recent-feedback";reviewBox.id="he-student-review-timeline";
 const reviewHeading=document.createElement("div");reviewHeading.className="he-student-observations-header";reviewHeading.innerHTML="<h3>Lesson summary &amp; evaluation</h3><p>Recent transcript-based AI drafts. Evidence is provisional until the teacher confirms it.</p>";
 const reviewList=document.createElement("div");reviewBox.append(reviewHeading,reviewList);observations.before(reviewBox);
 async function refreshReviews(id){
  reviewList.textContent="Loading lesson summaries…";
  try{const {data:{user}}=await db.auth.getUser();if(!user)throw Error("Sign in again.");
   const {data,error}=await db.from("he_lesson_reports").select("id,created_at,title,report_markdown,progress_data").eq("tutor_id",user.id).eq("student_id",id).order("created_at",{ascending:false}).limit(5);if(error)throw error;if(selectedStudent?.id!==id)return;reviewList.replaceChildren();
   if(!data?.length){reviewList.textContent="No saved lesson reviews yet. With permission, stop and analyse a recorded class to build this history.";return}
   for(const [i,row] of data.entries()){
    const p=row.progress_data||{};const entry=document.createElement("details");entry.className="he-student-observation";entry.open=i===0;
    const label=document.createElement("summary");label.textContent=new Date(row.created_at).toLocaleDateString()+" · "+(row.title||"Lesson review");entry.append(label);
    const markdownSection=pattern=>{const section=String(row.report_markdown||"").split(/^##\s+/m).find(x=>pattern.test(x));return section?section.split("\n").slice(1).join("\n").trim().slice(0,1300):""};
    const append=(title,value)=>{if(!value)return;const h=document.createElement("strong");h.textContent=title;const text=document.createElement("p");text.textContent=value;entry.append(h,text)};
    append("Summary",p.summary||markdownSection(/^(?:Lesson summary|Lesson Snapshot)/i));
    append("Skill evaluation",Array.isArray(p.skills)?p.skills.map(x=>x.skill+": "+x.observation).join("\n"):markdownSection(/^(?:Skill observations|Skill assessment|CEFR)/i));
    append("Next lesson",Array.isArray(p.nextSteps)?p.nextSteps.join("\n"):markdownSection(/^(?:Next lesson|Suggested next lesson|Areas to practise)/i));
    append("Limitations",p.limitations||"Transcript-based evidence only; unassessed skills are not scored.");
    reviewList.append(entry);
   }
  }catch(e){if(selectedStudent?.id===id)reviewList.textContent="Could not load lesson reviews: "+e.message}
 }

 function show(tab){
  detailCurrent=tab;
  for(const b of tabs.querySelectorAll("button"))b.setAttribute("aria-pressed",String(b.dataset.tab===tab));
  for(const section of fields.querySelectorAll(".he-profile-section"))
   section.hidden=section.dataset.section!==tab;
  observations.hidden=tab!=="records"&&tab!=="snapshot";reviewBox.hidden=observations.hidden;
 }
 function fieldTitle(field){return field.querySelector("strong")?.textContent||""}
 function arrange(student){
  selectedStudent=student;
  const values=[...fields.querySelectorAll(":scope > .ws-field")];
  if(!values.length)return;
  const placement={
   "CEFR level":"snapshot","Learning goals":"learning","Focus areas":"learning",
   "Strengths":"learning","Needs improvement":"learning",
   "Current homework":"records","Interests":"personal",
   "Translation language":"snapshot","Assessment observations":"records",
   "Prior lesson references":"records","Additional background":"personal",
   "Provisional level notes":"records","Teaching preferences":"personal"
  };
  fields.replaceChildren();
  const panels=new Map();
  for(const [id] of sections){
   const section=document.createElement("section");section.className="he-profile-section";
   section.dataset.section=id;panels.set(id,section);fields.append(section);
  }
  for(const entry of values)panels.get(placement[fieldTitle(entry)]||"records").append(entry);
  for(const [id,section] of panels){
   if(!section.childNodes.length){
    const p=document.createElement("p");p.className="he-profile-empty";p.textContent="Nothing recorded in this section yet.";
    section.append(p);
   }
  }
  summary.replaceChildren();
  const createStat=(label,value)=>{
   const card=document.createElement("div");
   const small=document.createElement("small");small.textContent=label;
   const strong=document.createElement("strong");strong.textContent=value;
   card.append(small,strong);return card;
  };
  summary.append(
   createStat("Current level",student.cefr_level==="UNASSESSED"?"Unassessed":student.cefr_level),
   createStat("Main goal",student.learning_goals?.[0]||"Add a goal"),
   createStat("Interests",String((student.interests||[]).length)+" recorded"),
   createStat("Translation",student.translation_language==="none"?"Not selected":student.translation_language||"Not selected")
  );
  show("snapshot");
  refreshNotes(student.id);refreshReviews(student.id);
 }
 async function refreshNotes(id){
  const list=document.getElementById("he-student-recent-list");
  if(!list||!id)return;
  list.replaceChildren();
  const loading=document.createElement("p");loading.className="he-profile-empty";loading.textContent="Loading classroom notes…";list.append(loading);
  try{
   const {data:{user},error:authError}=await db.auth.getUser();
   if(authError||!user)throw Error("Please sign in again.");
   const {data,error}=await db.from("he_live_observations")
    .select("category,observation,created_at")
    .eq("tutor_id",user.id).eq("student_id",id)
    .order("created_at",{ascending:false}).limit(12);
   if(error)throw error;
   if(selectedStudent?.id!==id)return;
   list.replaceChildren();
   if(!data?.length){const p=document.createElement("p");p.className="he-profile-empty";p.textContent="No classroom notes yet. Use Live feedback or ask Nova to add one.";list.append(p);return}
   for(const row of data){
    const item=document.createElement("article");item.className="he-student-observation";
    const meta=document.createElement("small");
    meta.textContent=row.category.replaceAll("_"," ")+" · "+new Date(row.created_at).toLocaleString();
    const body=document.createElement("p");body.textContent=row.observation;
    item.append(meta,body);list.append(item);
   }
  }catch(err){list.textContent="Couldn't load recent observations: "+err.message}
 }
 document.addEventListener("helloearth:student-opened",e=>{
  const s=e.detail?.student;if(!s)return;
  // dashboard.js fills the fields after it dispatches student-opened.
  setTimeout(()=>arrange(s),0);
 });
 document.addEventListener("helloearth:nova-student-saved",e=>{
  if(e.detail?.studentId===selectedStudent?.id)refreshNotes(selectedStudent.id);
 });
 document.addEventListener("helloearth:lesson-report-saved",e=>{if(selectedStudent?.id===e.detail?.studentId)refreshReviews(selectedStudent.id)});
 document.addEventListener("helloearth:view-changed",e=>{
  if(e.detail?.view==="students"&&selectedStudent?.id&&!detail.hidden){refreshNotes(selectedStudent.id);refreshReviews(selectedStudent.id)}
 });
}

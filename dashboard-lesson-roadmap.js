import {db} from "./supabase-client.js";
const el=id=>document.getElementById(id),root=el("he-roadmap");
if(root){
 const student=el("he-roadmap-student"),title=el("he-roadmap-title"),goal=el("he-roadmap-goal"),unitTitle=el("he-roadmap-new-unit"),unitTasks=el("he-roadmap-new-tasks"),unitsRoot=el("he-roadmap-units"),status=el("he-roadmap-status"),save=el("he-roadmap-save"),add=el("he-roadmap-add"),template=el("he-roadmap-template");
 let tutor=null,selected="",units=[],plans=[],dirty=false,busy=false,loadVersion=0,prepared=null;
 const node=(tag,cls="",str="")=>{const n=document.createElement(tag);if(cls)n.className=cls;if(str)n.textContent=str;return n};
 const btn=(label,fn)=>{const b=node("button","",label);b.type="button";b.onclick=fn;return b};
 const tell=(text,error=false)=>{status.textContent=text;status.classList.toggle("is-error",error)};
 const changed=()=>{dirty=true;tell("Unsaved roadmap changes.");save.disabled=busy};
 const unit=(name,tasks)=>({id:crypto.randomUUID(),title:name,tasks:tasks.map(text=>({id:crypto.randomUUID(),text,state:"pending"})),notes:"",lessonId:null,completedAt:null});
 const defaults=["Warm-up and review","Introduce the main skill","Guided practice","Independent speaking or writing","Review and feedback"];
 const cleanTasks=raw=>raw.split(/\r?\n/).map(x=>x.trim()).filter(Boolean).slice(0,20).map(x=>x.slice(0,300));
 async function loadPlans(id){
  const {data,error}=await db.from("atlas_lesson_plans").select("id,topic,completed_at,unsaved_at,review_note_id,created_at").eq("tutor_id",tutor).eq("student_id",id).is("unsaved_at",null).order("created_at",{ascending:false}).limit(500);
  if(error)throw error;return data||[];
 }
 async function populate(){
  const current=student.value;
  const {data:{user}}=await db.auth.getUser();if(!user)return;tutor=user.id;
  const {data,error}=await db.from("atlas_students").select("id,display_name,cefr_level").eq("tutor_id",tutor).order("display_name");
  if(error){tell(error.message,true);return}
  student.replaceChildren(new Option("Choose a student",""));
  for(const s of data||[]){const o=new Option(s.display_name,s.id);o.dataset.level=s.cefr_level||"";student.add(o)}
  student.value=selected||current;
  if(student.value&&!selected)load(student.value);
 }
 function controls(){for(const field of [title,goal,unitTitle,unitTasks,save,add,template])field.disabled=busy||!selected;student.disabled=busy}
 function render(){
  controls();unitsRoot.replaceChildren();const current=units.findIndex(u=>!u.completedAt);
  el("he-roadmap-progress").textContent=units.filter(u=>u.completedAt).length+" / "+units.length+" lessons completed";
  if(!selected||!units.length){unitsRoot.append(node("p","he-record-empty",selected?"Add your first lesson, or create a 12-lesson starter roadmap.":"Choose a student to open their roadmap."));return}
  units.forEach((u,index)=>{
   const card=node("article","he-roadmap-unit");card.classList.toggle("is-current",index===current);
   const top=node("div","he-roadmap-unit-head"),heading=node("strong","", "Lesson "+(index+1)+" · "+u.title),badge=node("span","he-roadmap-badge",u.completedAt?"Completed":index===current?"Current lesson":"Upcoming");top.append(heading,badge);card.append(top);
   const isCurrent=index===current,editable=!u.completedAt;
   const name=node("input");name.value=u.title;name.maxLength=160;name.setAttribute("aria-label","Lesson "+(index+1)+" title");name.disabled=!editable;name.onchange=()=>{u.title=name.value.trim()||u.title;changed();render()};
   if(editable)card.append(name);
   const taskList=node("div","he-roadmap-tasks");
   for(const t of u.tasks){
    const row=node("div","he-roadmap-task"),text=node("span","",t.text),state=node("select");
    state.setAttribute("aria-label","Task status: "+t.text);for(const [key,label] of [["pending","To do"],["done","Done"],["review","Needs review"],["carry","Carry forward"]])state.add(new Option(label,key));
    state.value=t.state;state.disabled=!isCurrent||busy;state.onchange=()=>{t.state=state.value;changed()};
    row.append(text,state);taskList.append(row)
   }
   card.append(taskList);
   if(isCurrent){
    const notes=node("textarea");notes.value=u.notes||"";notes.maxLength=1500;notes.rows=2;notes.placeholder="Teacher notes / next lesson focus";notes.setAttribute("aria-label","Teacher notes");notes.oninput=()=>{u.notes=notes.value;changed()};card.append(notes);
    const link=node("select");link.setAttribute("aria-label","Link saved lesson");link.add(new Option("Link an existing saved lesson",""));
    for(const p of plans){const used=units.some(x=>x.id!==u.id&&x.lessonId===p.id);if(!used)link.add(new Option(p.topic+(p.completed_at?" · Reviewed":""),p.id))}
    if(u.lessonId&&!plans.some(p=>p.id===u.lessonId))link.add(new Option("Linked lesson unavailable",u.lessonId));
    link.value=u.lessonId||"";link.onchange=()=>{u.lessonId=link.value||null;changed();render()};card.append(link);
    const actions=node("div","he-work-actions");const linked=plans.find(p=>p.id===u.lessonId);
    const prep=btn(linked?"Open saved lesson":"Prepare in Lesson Studio",()=>prepare(u,index));prep.className="he-primary";actions.append(prep);
    if(linked&&!linked.completed_at)actions.append(btn("Complete & review lesson",()=>document.dispatchEvent(new CustomEvent("helloearth:review-saved-lesson",{detail:{lessonId:linked.id,studentId:selected}}))));
    const next=btn("Finish & advance",()=>advance(u,index));next.disabled=!linked?.completed_at||busy;next.title=next.disabled?"Complete and review the linked saved lesson first":"Carry incomplete tasks forward";actions.append(next);card.append(actions);
    if(!linked?.completed_at)card.append(node("small","he-work-help","Confirm the linked lesson's review before moving on. Unfinished and review tasks carry forward."));
   }
   if(editable&&!u.lessonId){const remove=btn("Remove unit",()=>{if(confirm("Remove this planned lesson?")){units=units.filter(x=>x.id!==u.id);changed();render()}});remove.className="he-roadmap-remove";card.append(remove)}
   unitsRoot.append(card);
  });
 }
 async function load(id){
  const version=++loadVersion;busy=true;selected=id;prepared=null;units=[];plans=[];title.value="Learning roadmap";goal.value="";dirty=false;render();tell(id?"Loading roadmap…":"Choose a student.");
  if(!id){busy=false;render();return}
  try{const [roadmap,list]=await Promise.all([db.from("he_student_roadmaps").select("title,goal,units").eq("tutor_id",tutor).eq("student_id",id).maybeSingle(),loadPlans(id)]);if(version!==loadVersion)return;if(roadmap.error)throw roadmap.error;const d=roadmap.data;title.value=d?.title||"Learning roadmap";goal.value=d?.goal||"";units=Array.isArray(d?.units)?d.units:[];plans=list;tell("Ready.")}
  catch(e){if(version===loadVersion)tell("Could not load roadmap: "+e.message,true)}
  finally{if(version===loadVersion){busy=false;render()}}
 }
 async function store(){
  if(!selected||busy)return false;
  busy=true;controls();
  try{const {error}=await db.from("he_student_roadmaps").upsert({tutor_id:tutor,student_id:selected,title:title.value.trim()||"Learning roadmap",goal:goal.value.trim(),units,updated_at:new Date().toISOString()},{onConflict:"tutor_id,student_id"});if(error)throw error;dirty=false;tell("Roadmap saved.");return true}
  catch(e){tell("Roadmap not saved: "+e.message,true);return false}
  finally{busy=false;render()}
 }
 async function prepare(u,index){
  if(u.lessonId){const p=plans.find(x=>x.id===u.lessonId);if(p){window.open("lesson.html#saved="+encodeURIComponent(p.id),"_blank","noopener");return}}
  const id=selected,level=student.selectedOptions[0]?.dataset.level;
  if(dirty&&!await store())return;if(selected!==id)return;
  const select=el("he-lesson-student");select.value=id;select.dispatchEvent(new Event("change",{bubbles:true}));
  if(level&&[...el("he-lesson-level").options].some(x=>x.value===level))el("he-lesson-level").value=level;
  const topic=el("he-lesson-topic");topic.value=u.title;topic.dispatchEvent(new Event("input",{bubbles:true}));
  const previous=units.slice(0,index).filter(x=>x.completedAt).at(-1);
  const instruction=["Course: "+title.value,"Goal: "+goal.value,"Lesson "+(index+1)+" of "+units.length,"Tasks in order: "+u.tasks.map(t=>t.text).join("; "),previous?.notes?"Previous lesson teacher notes: "+previous.notes:"",u.notes?"Current focus: "+u.notes:"","Use short student-facing instructions, clear numbered sections, examples and answer spaces. Keep answer key separate."].filter(Boolean).join("\n").slice(0,2400);
  el("he-lesson-instructions").value=instruction;el("he-ai-integration").open=true;
  prepared={studentId:id,unitId:u.id,topic:u.title};tell("Lesson Studio prepared. Generate or make a manual template, then save to link it here.");el("he-lesson-new-title").scrollIntoView({block:"start",behavior:"smooth"});
 }
 async function advance(u,index){
  if(busy)return;try{plans=await loadPlans(selected)}catch(e){tell(e.message,true);return}
  if(units.findIndex(x=>!x.completedAt)!==index||!plans.some(p=>p.id===u.lessonId&&p.completed_at)){tell("Complete and confirm the linked lesson review first.",true);render();return}
  const carry=u.tasks.filter(t=>t.state!=="done");
  if(carry.length&&!confirm("Finish lesson "+(index+1)+" and carry "+carry.length+" unfinished/review task(s) forward?"))return;
  if(carry.length&&!units[index+1]){if(units.length>=40){tell("Roadmap has reached 40 lessons. Finish remaining tasks before advancing.",true);return}units.push(unit("Follow-up and review",[]))}
  if(carry.length){const next=units[index+1];if(next.tasks.length+carry.length>40){tell("Too many follow-up tasks for the next lesson. Complete or consolidate tasks first.",true);return}next.tasks=[...carry.map(t=>({id:crypto.randomUUID(),text:t.text,state:"pending",from:u.id})),...next.tasks]}
  u.completedAt=new Date().toISOString();changed();await store();
 }
 student.onchange=()=>{const id=student.value;if(dirty&&!confirm("Discard unsaved roadmap changes?")){student.value=selected;return}load(id)};
 title.oninput=goal.oninput=changed;
 save.onclick=store;
 add.onclick=()=>{const name=unitTitle.value.trim();if(!name){tell("Enter a lesson title.",true);return}if(units.length>=40){tell("Maximum 40 lessons per roadmap.",true);return}units.push(unit(name.slice(0,160),cleanTasks(unitTasks.value).length?cleanTasks(unitTasks.value):defaults));unitTitle.value="";unitTasks.value="";changed();render()};
 template.onclick=()=>{if(units.length){tell("Add custom lessons to your existing roadmap instead.",true);return}const topics=["Baseline and confidence","Functional vocabulary","Sentence building","Listening for meaning","Speaking fluency","Reading and comprehension","Grammar in context","Pronunciation and clarity","Real-world communication","Writing and accuracy","Integrated skills practice","Final review and next goals"];units=topics.map(t=>unit(t,defaults));changed();render()};
 document.addEventListener("helloearth:lesson-saved",async e=>{if(!prepared||e.detail?.studentId!==prepared.studentId||e.detail.studentId!==selected||e.detail.topic!==prepared.topic)return;const u=units.find(x=>x.id===prepared.unitId);if(!u||u.lessonId)return;u.lessonId=e.detail.id;prepared=null;changed();try{plans=await loadPlans(selected)}catch{}await store()});
 document.addEventListener("helloearth:workspace-data",async()=>{if(!selected||busy)return;const id=selected;try{const list=await loadPlans(id);if(id===selected){plans=list;render()}}catch{}});
 document.addEventListener("helloearth:studentsloaded",populate);
 window.addEventListener("beforeunload",e=>{if(dirty){e.preventDefault();e.returnValue=""}});
 populate();render();
}

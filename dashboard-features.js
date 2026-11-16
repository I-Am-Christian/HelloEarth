import { db } from "./supabase-client.js";

// Student information only travels between this browser and authenticated Supabase tables.
// GitHub stores implementation code, never learner profiles or lesson contents.
const el=id=>document.getElementById(id);
const workspace=()=>window.HelloEarthWorkspace;
const entries={students:[],userId:null,selected:null,assessment:[],plans:[],events:[],calendarReady:false,lastNote:null};
const skills=["speaking","listening","reading","writing","grammar","confidence"];
const toLocalDate=d=>new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);
const today=()=>toLocalDate(new Date());
const safeError=e=>String(e?.message||e||"Something went wrong.").slice(0,250);
const clear=node=>node.replaceChildren();
const text=(tag,content,cls)=>{const e=document.createElement(tag);e.textContent=String(content??"");if(cls)e.className=cls;return e};
function status(id,message,error=false){
 const node=el(id);if(!node)return;
 node.textContent=message;node.classList.toggle("is-error",error);
}
function button(label,fn,style="ws-mini-btn"){
 const b=document.createElement("button");b.type="button";b.className=style;b.textContent=label;b.addEventListener("click",fn);return b;
}
function openTab(name){el(name+"-tab")?.click()}
function studentById(id){return entries.students.find(s=>s.id===id)}
function syncStudents(detail){
 entries.students=Array.isArray(detail.students)?detail.students:workspace()?.students||[];
 entries.userId=detail.userId||workspace()?.userId||null;
 for(const id of ["progress-student-select","schedule-student"]){
  const input=el(id),current=input.value;clear(input);
  input.append(new Option(id==="progress-student-select"?"Choose student":"No student linked",""));
  for(const s of entries.students.slice().sort((a,b)=>a.display_name.localeCompare(b.display_name)))
   input.append(new Option(s.display_name,s.id));
  if(entries.students.some(s=>s.id===current))input.value=current;
 }
 renderTeachingDay();
}
document.addEventListener("helloearth:workspace-data",e=>syncStudents(e.detail));
if(workspace()?.userId)syncStudents({students:workspace().students,userId:workspace().userId});

// Teaching day: never invent an appointment when Calendar access is missing.
function startAt(event){
 return new Date(event.start?.dateTime||event.start?.date||"");
}
function matchStudent(event){
 const id=event.extendedProperties?.private?.helloearth_student_id;
 if(id&&studentById(id))return {student:studentById(id),exact:true};
 const name=(event.summary||"").trim().toLocaleLowerCase();
 const candidates=entries.students.filter(s=>s.display_name.length>=4&&name.includes(s.display_name.toLocaleLowerCase()));
 return candidates.length===1?{student:candidates[0],exact:false}:null;
}
function renderTeachingDay(){
 const target=el("teaching-day-events");if(!target)return;
 clear(target);
 if(!entries.calendarReady){
  el("day-lessons-count").textContent="—";
  el("day-week-count").textContent="—";
  el("day-next-label").textContent="—";
  const p=text("p","Connect Google Calendar to see upcoming lessons here.");
  target.append(p,button("Go to Calendar",()=>openTab("calendar")));return;
 }
 const now=new Date();
 const week=entries.events.filter(e=>startAt(e).getTime()>=now.getTime()).sort((a,b)=>startAt(a)-startAt(b));
 const countToday=entries.events.filter(e=>toLocalDate(startAt(e))===today()).length;
 el("day-lessons-count").textContent=String(countToday);
 el("day-week-count").textContent=String(week.length);
 el("day-next-label").textContent=week[0]?startAt(week[0]).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}):"—";
 if(!week.length){target.append(text("p","No remaining appointments in the displayed calendar week."));return}
 for(const event of week.slice(0,7)){
  const row=text("article","","ws-lesson-row"),data=text("div");
  const dt=startAt(event);data.append(text("time",dt.toLocaleDateString([],{weekday:"short",month:"short",day:"numeric"})+" · "+dt.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})),text("strong",event.summary||"Busy"),text("small",event.calendarName||"Google Calendar"));
  const actions=text("div","","ws-action-row"),matched=matchStudent(event);
  if(matched){
   const hint=matched.exact?"Linked student":"Possible title match";
   data.append(text("small",hint+": "+matched.student.display_name));
   actions.append(button("Open profile",()=>openStudent(matched.student.id)),button("Prepare lesson",()=>openStudent(matched.student.id,true),"dash-primary"));
  }else actions.append(button("Students",()=>openTab("students")));
  row.append(data,actions);target.append(row);
 }
}
async function openStudent(id,plan=false){
 openTab("students");
 await workspace()?.openStudent(id);
 if(plan){el("plan-student-lesson").click();el("student-workflow").scrollIntoView({block:"start",behavior:"smooth"})}
}
document.addEventListener("helloearth:calendar-events",e=>{
 entries.events=Array.isArray(e.detail?.events)?e.detail.events:[];
 entries.calendarReady=Boolean(e.detail?.connected);
 renderTeachingDay();
});
document.addEventListener("helloearth:calendar-disconnected",()=>{
 entries.events=[];entries.calendarReady=false;renderTeachingDay();
});

// Editable, deterministic lesson plans — no API or AI claims.
const levelActivities={
 A1:["Model five essential phrases and practice pronunciation.","Use picture-supported questions and short answers.","Role-play a simple everyday interaction."],
 A2:["Review familiar vocabulary using personal examples.","Practise past, present and future mini-dialogues.","Complete a realistic role-play with guided feedback."],
 B1:["Share an opinion and add two supporting details.","Use target structures in problem-solving dialogue.","Respond to follow-up questions without a script."],
 B2:["Compare viewpoints using nuanced connectors.","Analyse a short real-world scenario and propose solutions.","Debate alternatives and reformulate your answer."],
 C1:["Make precise claims with evidence and qualification.","Explore register, collocations and implied meaning.","Defend a position and respond to counterarguments."],
 C2:["Explore subtle tone, pragmatics and rhetorical effects.","Synthesise contrasting perspectives spontaneously.","Deliver a polished argument with nuanced rebuttals."]
};
function draftLesson(s){
 const level=el("plan-level").value,duration=Number(el("plan-duration").value);
 const topic=el("plan-topic").value.trim()||s.focus_areas?.[0]||s.learning_goals?.[0]||"Functional English";
 el("plan-topic").value=String(topic).slice(0,200);
 const goals=(s.learning_goals||[]).slice(0,2).join("; ")||"Improve communicative confidence";
 const focus=(s.focus_areas||[]).slice(0,3).join("; ")||"Vocabulary, sentence structure and fluency";
 const interests=(s.interests||[]).slice(0,2).join("; ")||"Student-selected everyday examples";
 const previous=entries.lastNote;
 const revisit=previous?[(previous.challenges||[]).join("; "),(previous.next_steps||[]).join("; "),previous.homework||""].filter(Boolean).join(" | "):"No previous lesson observations recorded";
 const mins=[Math.round(duration*.15),Math.round(duration*.2),Math.round(duration*.4)];
 const wrap=duration-mins.reduce((a,b)=>a+b,0);
 return `# ${topic} — ${level} | ${duration} minutes

Student: ${s.display_name}
Goal: ${goals}
Areas to practise: ${focus}
Context to personalize: ${interests}
Previous lesson follow-up: ${revisit}

## Warm-up (${mins[0]} min)
- Ask what the learner remembers from the last lesson.
- Invite a short, level-appropriate conversation about ${topic}.
- Listen for one strength and one improvement target.

## Language focus (${mins[1]} min)
- Introduce 4–6 useful expressions connected to ${topic}.
- Show natural examples, then let the learner create their own.
- Check pronunciation and clarify meaning in context.

## Guided and free practice (${mins[2]} min)
- ${levelActivities[level][0]}
- ${levelActivities[level][1]}
- ${levelActivities[level][2]}

## Feedback and next steps (${wrap} min)
- Give specific examples of successful communication.
- Correct 2–3 repeated errors gently.
- Ask the student to summarize one takeaway.
- Agree on optional practice before the next lesson.

## Teacher notes
- What worked:
- What was difficult:
- Next lesson:
`;
}
function setPlanVisibility(panel){el("student-workflow").hidden=panel!=="plan";el("assessment-workflow").hidden=panel!=="skills"}
el("plan-student-lesson").addEventListener("click",()=>{const s=entries.selected;if(!s)return;setPlanVisibility("plan");el("workflow-heading").textContent="Prepare a lesson for "+s.display_name;el("plan-level").value=s.cefr_level==="UNASSESSED"?"A2":s.cefr_level;el("plan-topic").value=s.focus_areas?.[0]||s.learning_goals?.[0]||"";el("plan-editor").value="";status("planner-feedback",s.cefr_level==="UNASSESSED"?"Level not assessed: A2 is a placeholder. Choose an appropriate level before drafting.":"");});
el("assess-student").addEventListener("click",()=>{if(!entries.selected)return;setPlanVisibility("skills");el("skill-date").value=today();});
el("generate-plan").addEventListener("click",async()=>{
 const s=entries.selected;if(!s)return;
 const id=s.id;await loadLatestNote(id);if(entries.selected?.id!==id)return;
 el("plan-editor").value=draftLesson(s);
 status("planner-feedback","Editable lesson template created from the student profile and latest recorded lesson. Review before using.");
});
async function loadLatestNote(id){
 const {data,error}=await db.from("atlas_lesson_notes")
  .select("summary,challenges,next_steps,homework,lesson_date")
  .eq("student_id",id).eq("tutor_id",entries.userId)
  .order("lesson_date",{ascending:false}).limit(1);
 if(entries.selected?.id===id)entries.lastNote=!error&&data?.length?data[0]:null;
}
el("save-plan").addEventListener("click",async()=>{
 const s=entries.selected;if(!s||!entries.userId)return;
 const markdown=el("plan-editor").value.trim(),topic=el("plan-topic").value.trim();
 if(!topic||!markdown){status("planner-feedback","Add a topic and an editable lesson plan first.",true);return}
 if(markdown.length>100000){status("planner-feedback","Plan exceeds the size limit.",true);return}
 const btn=el("save-plan");btn.disabled=true;
 try{
  const {error}=await db.from("atlas_lesson_plans").insert({
   id:crypto.randomUUID(),tutor_id:entries.userId,student_id:s.id,
   topic,cefr_level:el("plan-level").value,duration_minutes:Number(el("plan-duration").value),markdown
  });
  if(error)throw error;
  status("planner-feedback","Lesson plan saved to your private student workspace.");
  await loadPlans(s.id);
 }catch(e){status("planner-feedback",safeError(e),true)}
 finally{btn.disabled=false}
});
el("download-plan").addEventListener("click",()=>{
 const content=el("plan-editor").value;
 if(!content.trim()){status("planner-feedback","Create or write a lesson plan first.",true);return}
 const blob=new Blob([content],{type:"text/markdown;charset=utf-8"}),url=URL.createObjectURL(blob);
 const a=document.createElement("a");a.href=url;a.download="HelloEarth-lesson-plan.md";a.click();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
});
async function loadPlans(id){
 const list=el("saved-plans-list");clear(list);
 const {data,error}=await db.from("atlas_lesson_plans").select("id,topic,cefr_level,duration_minutes,markdown,created_at").eq("tutor_id",entries.userId).eq("student_id",id).order("created_at",{ascending:false}).limit(12);
 if(entries.selected?.id!==id)return;
 if(error){list.append(text("p",safeError(error)));return}
 entries.plans=data||[];
 if(!entries.plans.length){list.append(text("p","No saved plans yet."));return}
 for(const p of entries.plans){
  const row=text("div","","ws-saved-plan-row");
  row.append(text("span",p.topic+" · "+p.cefr_level+" · "+p.duration_minutes+" min · "+new Date(p.created_at).toLocaleDateString()));
  row.append(button("Open",()=>{setPlanVisibility("plan");el("workflow-heading").textContent=p.topic;el("plan-topic").value=p.topic;el("plan-level").value=p.cefr_level;el("plan-duration").value=String(p.duration_minutes);el("plan-editor").value=p.markdown;el("student-workflow").scrollIntoView({block:"start",behavior:"smooth"});}));
  list.append(row);
 }
}

// Historical skill observations, scoped by student and signed-in tutor.
for(const id of skills){
 const select=el("skill-"+id);
 select.append(new Option("Not assessed",""));
 for(let score=1;score<=5;score++)select.append(new Option(String(score),String(score)));
}
function scoreBars(data){
 const root=text("div","","ws-skill-bars");
 for(const name of skills){
  if(data[name]==null)continue;
  const row=text("div","","ws-skill-score"),track=text("b"),bar=text("i");
  bar.style.width=(Number(data[name])*20)+"%";track.append(bar);
  row.append(text("span",name[0].toUpperCase()+name.slice(1)),track,text("strong",data[name]+"/5"));root.append(row);
 }
 return root;
}
function renderHistory(root,rows){
 clear(root);
 if(!rows.length){root.append(text("p","No skill assessments recorded yet."));return}
 for(const item of rows){
  const card=text("article","","ws-assessment-entry");
  card.append(text("time",new Date(item.assessed_on+"T12:00:00").toLocaleDateString()),scoreBars(item));
  if(item.notes)card.append(text("p",item.notes));
  root.append(card);
 }
}
async function loadSkillHistory(id){
 const {data,error}=await db.from("atlas_skill_assessments").select("*").eq("tutor_id",entries.userId).eq("student_id",id).order("assessed_on",{ascending:false}).limit(80);
 if(error){status("skills-feedback",safeError(error),true);return}
 if(entries.selected?.id===id){entries.assessment=data||[];renderHistory(el("student-skills-history"),entries.assessment)}
 if(el("progress-student-select").value===id)renderHistory(el("progress-history"),data||[]);
}
el("skill-form").addEventListener("submit",async ev=>{
 ev.preventDefault();const s=entries.selected;if(!s)return;
 const record={id:crypto.randomUUID(),tutor_id:entries.userId,student_id:s.id,assessed_on:el("skill-date").value,notes:el("skill-comments").value.trim()};
 let filled=0;
 for(const field of skills){const value=el("skill-"+field).value;record[field]=value?Number(value):null;if(value)filled++}
 if(!filled){status("skills-feedback","Rate at least one observed skill.",true);return}
 const submit=el("save-skills");submit.disabled=true;
 try{
  const {error}=await db.from("atlas_skill_assessments").insert(record);
  if(error)throw error;
  status("skills-feedback","Skill assessment saved to the student's private history.");
  await loadSkillHistory(s.id);
 }catch(e){status("skills-feedback",safeError(e),true)}finally{submit.disabled=false}
});
el("progress-student-select").addEventListener("change",async ev=>{
 const id=ev.target.value;if(!id){clear(el("progress-history"));el("progress-history").append(text("p","Choose a student to view assessments."));return}
 const {data,error}=await db.from("atlas_skill_assessments").select("*").eq("tutor_id",entries.userId).eq("student_id",id).order("assessed_on",{ascending:false}).limit(80);
 if(error){el("progress-history").textContent=safeError(error);return}
 renderHistory(el("progress-history"),data||[]);
});
el("download-progress-report").addEventListener("click",()=>{
 const id=el("progress-student-select").value,s=studentById(id);
 if(!s){el("progress-history").textContent="Choose a student before printing a report.";return}
 const print=el("progress-print");clear(print);
 print.append(text("h1","HelloEarth | Student progress report"),text("h2",s.display_name),text("p","Current recorded CEFR level: "+s.cefr_level));
 print.append(text("p","Goals: "+((s.learning_goals||[]).join("; ")||"Not recorded")));
 print.append(text("p","Generated: "+new Date().toLocaleDateString()));
 const copy=el("progress-history").cloneNode(true);print.append(copy);
 window.print();
});

// Import common spreadsheet files in the browser, without uploading the source document.
function csvRows(content){
 const first=(content.split(/\r?\n/,1)[0]||"");
 const sep=["\t",",",";"].sort((a,b)=>first.split(b).length-first.split(a).length)[0];
 const rows=[];let row=[],cell="",quoted=false;
 content=content.replace(/^\uFEFF/,"");
 for(let i=0;i<content.length;i++){
  const ch=content[i];
  if(ch==='"'){if(quoted&&content[i+1]==='"'){cell+='"';i++}else quoted=!quoted}
  else if(!quoted&&ch===sep){row.push(cell);cell=""}
  else if(!quoted&&(ch==="\n"||ch==="\r")){if(ch==="\r"&&content[i+1]==="\n")i++;row.push(cell);if(row.some(c=>String(c).trim()))rows.push(row);row=[];cell=""}
  else cell+=ch;
 }
 if(quoted)throw Error("CSV contains an unclosed quotation mark.");
 row.push(cell);if(row.some(c=>String(c).trim()))rows.push(row);
 return rows;
}
let excelLoader;
function loadExcelJS(){
 if(window.ExcelJS)return Promise.resolve(window.ExcelJS);
 if(excelLoader)return excelLoader;
 excelLoader=new Promise((resolve,reject)=>{
  const script=document.createElement("script");script.src="https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js";
  script.onload=()=>window.ExcelJS?resolve(window.ExcelJS):reject(Error("Excel reader failed to initialize."));
  script.onerror=()=>reject(Error("Excel reader could not load. Export the file as CSV and retry."));
  document.head.append(script);
 });
 return excelLoader;
}
async function spreadsheetRows(file){
 if(/\.csv$/i.test(file.name)||file.type==="text/csv")return csvRows(await file.text());
 const ExcelJS=await loadExcelJS();
 const wb=new ExcelJS.Workbook();await wb.xlsx.load(await file.arrayBuffer());
 const ws=wb.worksheets[0];if(!ws)throw Error("Spreadsheet has no worksheet.");
 const rows=[];ws.eachRow({includeEmpty:false},row=>{
  const result=[];const max=Math.min(row.cellCount||25,35);
  for(let col=1;col<=max;col++)result.push(String(row.getCell(col).text||"").trim());
  if(result.some(Boolean))rows.push(result);
 });
 return rows;
}
function mappedColumns(header){
 const normalize=value=>String(value).toLowerCase().trim().replace(/[^a-z0-9]+/g,"");
 const names={name:["name","student","studentname","displayname","fullname","learner","learnername"],
  cefr:["cefr","cefrlevel","level","englishlevel","proficiencylevel"],
  goals:["goals","learninggoals","goal","objectives","learningobjectives"],
  focus:["focus","focusareas","weaknesses","needs","areasforimprovement"],
  interests:["interests","hobbies","topics"],language:["language","translationlanguage","nativelanguage"],
  notes:["notes","background","backgroundnotes","studentnotes"]};
 const columns={};header.forEach((value,index)=>{
  const key=normalize(value);
  for(const [target,variants] of Object.entries(names))if(columns[target]===undefined&&variants.includes(key))columns[target]=index;
 });
 if(columns.name===undefined)throw Error("Spreadsheet needs a Name or Student Name column.");
 return columns;
}
const splitList=value=>String(value||"").split(/[;|\n]+/).map(s=>s.trim()).filter(Boolean).slice(0,12).map(x=>x.slice(0,180));
async function importSpreadsheet(file){
 if(file.size>2_000_000)throw Error("Please use a spreadsheet smaller than 2 MB.");
 const rows=await spreadsheetRows(file);
 if(rows.length<2)throw Error("Your spreadsheet needs a heading row and at least one student.");
 if(rows.length>251)throw Error("Import up to 250 students at a time.");
 const cols=mappedColumns(rows[0]),read=(row,key)=>cols[key]===undefined?"":String(row[cols[key]]||"").trim();
 const seen=new Set(entries.students.map(s=>s.display_name.toLocaleLowerCase()));
 const newRows=[];let skipped=0;
 for(const row of rows.slice(1)){
  const name=read(row,"name").slice(0,120);
  if(!name)continue;
  const key=name.toLocaleLowerCase();
  if(seen.has(key)){skipped++;continue}
  seen.add(key);
  const raw=read(row,"cefr").toUpperCase(),level=["A1","A2","B1","B2","C1","C2"].includes(raw)?raw:"UNASSESSED";
  newRows.push({
   id:crypto.randomUUID(),tutor_id:entries.userId,display_name:name,
   cefr_level:level,learning_goals:splitList(read(row,"goals")),
   focus_areas:splitList(read(row,"focus")),interests:splitList(read(row,"interests")),
   translation_language:read(row,"language").slice(0,60)||"none",
   background_notes:read(row,"notes").slice(0,2000),
   record_status:"reference",source_document:file.name.slice(0,300),ai_context_enabled:false
  });
 }
 if(!newRows.length){status("dashboard-feedback","No new students to import; existing names were skipped.");return}
 const examples=newRows.slice(0,5).map(s=>s.display_name+" ("+s.cefr_level+")").join("\n");
 if(!confirm("Import "+newRows.length+" new profiles into your private HelloEarth account?\n"+skipped+" existing or repeated names will be skipped.\n\nPreview:\n"+examples+"\n\nNo students will be emailed."))return;
 const {error}=await db.from("atlas_students").insert(newRows);
 if(error)throw error;
 await workspace().reloadStudents();
 status("dashboard-feedback",newRows.length+" students imported successfully. "+skipped+" duplicates skipped.");
}
el("spreadsheet-import-button").addEventListener("click",()=>el("spreadsheet-import-file").click());
el("download-import-template").addEventListener("click",()=>{
 const csv="Name,CEFR,Learning Goals,Focus Areas,Interests,Language,Notes\nExample Student,B1,Speak confidently,Fluency; grammar,Travel,Spanish,Replace this example with your student";
 const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});
 const url=URL.createObjectURL(blob);
 const link=document.createElement("a");link.href=url;link.download="helloearth-student-template.csv";link.click();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
});
el("spreadsheet-import-file").addEventListener("change",async ev=>{
 const file=ev.target.files?.[0];ev.target.value="";if(!file)return;
 const btn=el("spreadsheet-import-button");btn.disabled=true;status("dashboard-feedback","Reading student spreadsheet…");
 try{await importSpreadsheet(file)}
 catch(e){status("dashboard-feedback","Import stopped: "+safeError(e),true)}
 finally{btn.disabled=false}
});

// Keep per-profile history and saved plans current.
document.addEventListener("helloearth:student-opened",async ev=>{
 entries.selected=ev.detail.student;entries.lastNote=null;
 el("student-workflow").hidden=true;el("assessment-workflow").hidden=true;
 await Promise.allSettled([loadPlans(entries.selected.id),loadSkillHistory(entries.selected.id),loadLatestNote(entries.selected.id)]);
});

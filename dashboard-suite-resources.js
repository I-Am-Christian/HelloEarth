import {db,$,W,state,esc,dateOnly,friendlyDate,formData,message,refresh,onRender,nameFor,studentFor,options} from "./dashboard-suite-shared.js";
const standardTemplates=[
 {key:"conversation",title:"Conversation & confidence",cefr:"B1",content:"# [STUDENT] · Conversation practice\n\nLevel: [LEVEL]\nGoals: [GOALS]\n\n## Warm-up (5 min)\nAsk about recent events and encourage complete answers.\n\n## Guided speaking (15 min)\nPractise explaining an opinion using 'because', 'however' and examples.\n\n## Role-play (20 min)\nUse a realistic daily-life scenario.\n\n## Feedback (10 min)\nNote two strengths, one recurring challenge and the next practice priority."},
 {key:"beginner",title:"Everyday English essentials",cefr:"A1",content:"# [STUDENT] · Everyday English\n\nLevel: [LEVEL]\nGoals: [GOALS]\n\n## Warm-up (5 min)\nName common objects and greet the tutor.\n\n## Vocabulary (10 min)\nLearn six useful words and check their meanings.\n\n## Guided sentences (20 min)\nMake positive, negative and question forms with the target vocabulary.\n\n## Role-play (10 min)\nOrder a drink or ask for directions.\n\n## Review (5 min)\nRepeat key phrases and choose optional homework."},
 {key:"business",title:"Business English meeting",cefr:"B2",content:"# [STUDENT] · Business communication\n\nLevel: [LEVEL]\nGoals: [GOALS]\n\n## Opening (5 min)\nDescribe a current work project.\n\n## Useful phrases (10 min)\nPractice clarifying, agreeing and polite disagreement.\n\n## Meeting simulation (25 min)\nExplain a problem, propose a solution and answer follow-up questions.\n\n## Feedback (10 min)\nReview clarity, fluency and a next-meeting action."},
 {key:"listening",title:"Listening & comprehension",cefr:"B1",content:"# [STUDENT] · Listening practice\n\nLevel: [LEVEL]\nGoals: [GOALS]\n\n## Prediction (5 min)\nDiscuss the topic and predict vocabulary.\n\n## First listening (10 min)\nListen for the main idea and identify the speakers' goals.\n\n## Detailed listening (15 min)\nAnswer targeted detail questions and compare answers.\n\n## Discussion (15 min)\nSummarise and respond with your own opinion.\n\n## Exit ticket (5 min)\nName two new expressions and one strategy to practise."}
];
let lastSelectedTemplate="";
function templateGrid(){
 const root=$("he-suite-templates");if(!root)return;
 const chosen=root.querySelector("[data-template-student]")?.value||state.selectedStudent||"";
 const builtins=standardTemplates.map(t=>({...t,id:"preset:"+t.key,custom:false}));
 const custom=state.templates.map(t=>({...t,id:t.id,custom:true}));
 const all=[...builtins,...custom];
 root.innerHTML='<label class="he-suite-template-picker">Use template with student<select data-template-student>'+options(chosen)+'</select></label>'+
 '<div class="he-suite-template-grid">'+all.map(t=>
  '<div class="he-suite-template"><span class="he-suite-level">'+esc(t.cefr)+'</span><h4>'+esc(t.title)+'</h4>'+
  '<small>'+(t.custom?"Saved by you":"Included template")+'</small>'+
  '<div class="he-suite-actions"><button type="button" data-template-use="'+esc(t.id)+'">Use in lesson planner</button>'+
  (t.custom?'<button type="button" data-template-delete="'+esc(t.id)+'">Delete</button>':"")+'</div></div>').join("")+'</div>';
}
function renderAttendance(){
 const root=$("he-suite-attendance-list");
 const statuses=state.attendance.reduce((m,a)=>(m[a.status]=(m[a.status]||0)+1,m),{});
 root.innerHTML='<p class="he-suite-note">Saved attendance · '+(statuses.attended||0)+' attended · '+(statuses.missed||0)+' missed / no-show · '+(statuses.cancelled||0)+' cancelled.</p>'+
 (state.attendance.length?[...state.attendance].sort((a,b)=>String(b.lesson_date).localeCompare(String(a.lesson_date))).slice(0,40).map(a=>
 '<div class="he-suite-row"><div><strong>'+esc(nameFor(a.student_id))+'</strong><small>'+
 esc(friendlyDate(a.lesson_date))+'</small><p>'+esc(a.note||"No note")+'</p></div><span class="he-suite-row-status">'+
 esc(a.status==="missed"?"No-show / missed":a.status)+'</span></div>').join(""):
 '<p class="he-suite-empty">No saved attendance records yet.</p>');
}
async function useTemplate(id){
 const box=$("he-suite-templates");
 const studentId=box.querySelector("[data-template-student]")?.value||state.selectedStudent;
 const s=studentFor(studentId);
 if(!s){message("Choose a student before applying a template.",true);return}
 const t=id.startsWith("preset:")?
  standardTemplates.find(v=>"preset:"+v.key===id):
  state.templates.find(v=>v.id===id);
 if(!t)return;
 if($("plan-editor").value.trim()&&!confirm("Open the template in the lesson editor for "+s.display_name+"? Save any unsaved work in the editor first."))return;
 $("students-tab").click();
 await W().openStudent(s.id);
 // The lesson plan remains editable: these are predefined outlines, not AI.
 const editor=$("plan-editor");
 const text=t.content.replaceAll("[STUDENT]",s.display_name).replaceAll("[LEVEL]",s.cefr_level)
  .replaceAll("[GOALS]",(s.learning_goals||[]).join("; ")||"Not yet recorded");
 $("student-workflow").hidden=false;
 $("assessment-workflow").hidden=true;
 $("workflow-heading").textContent="Prepare lesson for "+s.display_name;
 $("plan-topic").value=t.title;
 $("plan-level").value=s.cefr_level==="UNASSESSED"?"B1":s.cefr_level;
 editor.value=text;
 $("planner-feedback").textContent="Template applied. Edit and save it when ready.";
 editor.scrollIntoView({block:"center",behavior:"smooth"});
 message("Template opened in "+s.display_name+"'s private lesson planner.");
}
export function setupResources(){
 $("he-suite-attendance-form").elements.namedItem("lesson_date").value=dateOnly();
 onRender(()=>{templateGrid();renderAttendance()});
 $("he-suite-template-form").addEventListener("submit",async e=>{
  e.preventDefault();const p=formData(e.currentTarget);
  try{
   const {error}=await db.from("he_templates").insert({tutor_id:state.userId,
    title:p.title.trim(),cefr:p.cefr,content:p.content.trim()});
   if(error)throw error;
   e.currentTarget.reset();
   await refresh(["templates"]);message("Reusable teaching template saved.");
  }catch(err){message("Could not save template: "+err.message,true)}
 });
 $("he-suite-templates").addEventListener("click",async e=>{
  const b=e.target.closest("button");if(!b)return;
  if(b.dataset.templateUse){await useTemplate(b.dataset.templateUse);return}
  if(b.dataset.templateDelete){
   if(!confirm("Delete this saved template? Lesson plans that already use it will not be changed."))return;
   try{
    const {error}=await db.from("he_templates").delete().eq("tutor_id",state.userId).eq("id",b.dataset.templateDelete);
    if(error)throw error;await refresh(["templates"]);message("Template removed.");
   }catch(error){message(error.message,true)}
  }
 });
 $("he-suite-attendance-form").addEventListener("submit",async e=>{
  e.preventDefault();const p=formData(e.currentTarget);
  if(!studentFor(p.student_id)){message("Choose a student.",true);return}
  try{
   const record={tutor_id:state.userId,student_id:p.student_id,lesson_date:p.lesson_date,
    status:p.status,note:String(p.note||"").trim()};
   const {error}=await db.from("atlas_lesson_attendance").upsert(record,{onConflict:"tutor_id,student_id,lesson_date"});
   if(error)throw error;
   document.dispatchEvent(new CustomEvent("helloearth:attendance-saved",{detail:{studentId:p.student_id}}));
   await refresh(["attendance"]);message("Attendance recorded. No-show and cancellation tracking updated.");
  }catch(error){message("Could not save attendance: "+error.message,true)}
 });
}

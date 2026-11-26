import {db} from "./supabase-client.js";
const root=document.createElement("div");root.id="he-live-feedback-tools";
root.innerHTML="<div class=\"he-live-launchers\" id=\"he-live-launchers\">\n <button type=\"button\" id=\"he-live-feedback-launch\">✎ Live feedback</button>\n</div>\n<section class=\"he-live-panel\" id=\"he-live-feedback-panel\" aria-label=\"Live student feedback\" hidden>\n <div class=\"he-live-panel-header\"><h2>Live student feedback</h2><button type=\"button\" id=\"he-live-feedback-close\" aria-label=\"Close\">×</button></div>\n <p class=\"he-live-hint\">Record observations while teaching. Notes are private and available for future lesson planning.</p>\n <label>Student<select id=\"he-live-student\"><option value=\"\">Choose student</option></select></label>\n <label>Skill or category<select id=\"he-live-category\">\n  <option value=\"general\">General observation</option><option value=\"grammar\">Grammar</option>\n  <option value=\"pronunciation\">Pronunciation</option><option value=\"fluency\">Fluency</option>\n  <option value=\"listening\">Listening</option><option value=\"vocabulary\">Vocabulary</option>\n  <option value=\"strength\">Strength</option><option value=\"next_steps\">Next steps</option>\n </select></label>\n <div class=\"he-flag-row\"><button type=\"button\" data-he-flag=\"grammar\">Grammar</button><button type=\"button\" data-he-flag=\"pronunciation\">Pronunciation</button><button type=\"button\" data-he-flag=\"strength\">Strength</button><button type=\"button\" data-he-flag=\"next_steps\">Next step</button></div>\n <label>Observation<textarea id=\"he-live-note\" maxlength=\"2000\" rows=\"4\" placeholder=\"e.g. Confident past tense, needs work on irregular verbs.\"></textarea></label>\n <div class=\"he-live-actions\"><button type=\"button\" id=\"he-live-feedback-save\" class=\"primary\">Save observation</button><button type=\"button\" id=\"he-live-open-reports\">▥ Transcribe &amp; report</button></div>\n <p id=\"he-live-feedback-status\" class=\"he-status\" role=\"status\" aria-live=\"polite\"></p>\n <div class=\"he-live-recent\"><h3>Recent observations</h3><div id=\"he-live-feedback-recent\"></div></div>\n</section>";
document.body.append(root);
const get=id=>root.querySelector("#"+id);
const panel=get("he-live-feedback-panel"),student=get("he-live-student");
let linkedLesson=null;
const notice=(value,error=false)=>{
 const n=get("he-live-feedback-status");n.textContent=value;n.classList.toggle("he-error",error);
};
function populate(prefer){
 const chosen=prefer||student.value||document.getElementById("he-lesson-student")?.value||"";
 const students=window.HelloEarthWorkspace?.students||[];
 student.replaceChildren();
 const opt=document.createElement("option");opt.value="";opt.textContent="Choose student";student.append(opt);
 for(const st of students){
  const o=document.createElement("option");o.value=st.id;o.textContent=st.display_name;student.append(o);
 }
 if([...student.options].some(x=>x.value===chosen))student.value=chosen;
}
async function user(){
 const {data:{user},error}=await db.auth.getUser();
 if(error||!user)throw Error("Sign in to save student feedback.");
 return user;
}
async function refresh(){
 const area=get("he-live-feedback-recent");area.replaceChildren();
 if(!student.value){area.textContent="Choose a student to see feedback.";return}
 try{
  const current=await user();
  const {data,error}=await db.from("he_live_observations")
   .select("category,observation,created_at")
   .eq("tutor_id",current.id).eq("student_id",student.value)
   .order("created_at",{ascending:false}).limit(10);
  if(error)throw error;
  if(!data?.length){area.textContent="No observations yet.";return}
  for(const observation of data){
   const row=document.createElement("article");row.className="he-note-row";
   const meta=document.createElement("small");meta.textContent=observation.category.replaceAll("_"," ")+" · "+new Date(observation.created_at).toLocaleString();
   const p=document.createElement("p");p.textContent=observation.observation;
   row.append(meta,p);area.append(row);
  }
 }catch(err){notice("Unable to load feedback: "+err.message,true)}
}
get("he-live-feedback-launch").addEventListener("click",()=>{
 document.getElementById("he-live-translate-panel")?.setAttribute("hidden","");
 populate();panel.hidden=false;refresh();
});
get("he-live-feedback-close").addEventListener("click",()=>{panel.hidden=true});
get("he-live-open-reports").addEventListener("click",()=>{
 const studentId=student.value;
 panel.hidden=true;
 if(studentId&&window.HelloEarthLessonReports?.openForStudent){
  window.HelloEarthLessonReports.openForStudent(studentId);
 }else document.getElementById("reports-tab")?.click();
});
root.querySelectorAll("[data-he-flag]").forEach(button=>button.addEventListener("click",()=>{
 get("he-live-category").value=button.dataset.heFlag;get("he-live-note").focus();
}));
student.addEventListener("change",()=>{if(student.value!==document.getElementById("he-lesson-student")?.value)linkedLesson=null;refresh()});
get("he-live-feedback-save").addEventListener("click",async()=>{
 const studentId=student.value,observation=get("he-live-note").value.trim();
 if(!studentId||!observation){notice("Choose a student and enter an observation.",true);return}
 const button=get("he-live-feedback-save");button.disabled=true;
 try{
  const current=await user();
  const {error}=await db.from("he_live_observations").insert({
   tutor_id:current.id,student_id:studentId,lesson_plan_id:linkedLesson,
   category:get("he-live-category").value,observation:observation.slice(0,2000)
  });
  if(error)throw error;
  get("he-live-note").value="";notice("Feedback saved privately to this student's records.");
  await refresh();
 }catch(err){notice("Unable to save feedback: "+err.message,true)}
 finally{button.disabled=false}
});
document.addEventListener("helloearth:studentsloaded",()=>populate());
document.addEventListener("helloearth:lesson-selected",event=>{
 linkedLesson=event.detail?.id||null;
 populate(event.detail?.studentId);
});
document.getElementById("he-lesson-student")?.addEventListener("change",event=>{
 linkedLesson=null;populate(event.target.value);
});
populate();

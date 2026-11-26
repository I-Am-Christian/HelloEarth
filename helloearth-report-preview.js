import {db} from "./supabase-client.js";
import {renderWorkbook} from "./helloearth-workbook-renderer.js";
const el=id=>document.getElementById(id);
const id=decodeURIComponent(location.hash.replace(/^#(?:id=)?/,""));
const uuid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
let report=null;
const fail=message=>{
 el("lesson-title").textContent="Report unavailable";
 el("lesson-error").hidden=false;el("lesson-error").textContent=message;
 el("lesson-status").textContent=message;
};
async function load(){
 if(!uuid.test(id)){fail("The lesson report link is not valid.");return}
 const {data:{user},error:authError}=await db.auth.getUser();
 if(authError||!user){fail("Sign in to HelloEarth to open this private tutor report.");return}
 const {data,error}=await db.from("he_lesson_reports")
  .select("id,title,report_markdown,created_at,transcript_chars,recorded_minutes,transcription_method")
  .eq("id",id).eq("tutor_id",user.id).maybeSingle();
 if(error||!data){fail("This report was deleted or doesn't belong to your HelloEarth account.");return}
 report=data;
 el("lesson-title").textContent=data.title;
 el("lesson-level").textContent="Transcript-based report";
 el("lesson-duration").textContent=data.recorded_minutes?
  data.recorded_minutes+" minutes captured":"Duration not recorded";
 el("lesson-date").textContent=new Date(data.created_at).toLocaleDateString();
 el("lesson-life").textContent="Tutor-private · saved in student records";
 renderWorkbook(el("lesson-content"),data.report_markdown);
 document.title=data.title+" | HelloEarth";
 for(const key of ["lesson-copy","lesson-download","lesson-print"])el(key).disabled=false;
 el("lesson-status").textContent="Private report based on available transcript text · Teacher review recommended";
}
function download(content){
 const url=URL.createObjectURL(new Blob([content],{type:"text/markdown;charset=utf-8"}));
 const a=document.createElement("a");a.href=url;a.download="helloearth-lesson-report.md";
 document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1300);
}
el("lesson-print").addEventListener("click",()=>{if(report)window.print()});
el("lesson-download").addEventListener("click",()=>{if(report)download(report.report_markdown)});
el("lesson-copy").addEventListener("click",async()=>{
 if(!report)return;
 try{await navigator.clipboard.writeText(report.report_markdown);el("lesson-status").textContent="Report copied."}
 catch{el("lesson-status").textContent="Unable to copy automatically. Use Download instead."}
});
load();

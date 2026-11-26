import {db} from "./supabase-client.js";
import {renderWorkbook} from "./helloearth-workbook-renderer.js";
const el=id=>document.getElementById(id);
const id=decodeURIComponent(location.hash.replace(/^#(?:id=)?/,""));
const valid=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
let lesson=null;
function message(text,error=false){
 const node=el("lesson-status");node.textContent=text;
 if(error){el("lesson-error").hidden=false;el("lesson-error").textContent=text}
}
const lifespan=()=>{
 if(!lesson)return;
 const left=Date.parse(lesson.expires_at)-Date.now();
 if(left<=0){el("lesson-life").textContent="Expired";el("lesson-content").replaceChildren();message("This temporary lesson has expired. Please create another copy.",true);return}
 const days=Math.floor(left/86400000),hours=Math.floor((left%86400000)/3600000),minutes=Math.floor((left%3600000)/60000);
 el("lesson-life").textContent="Temporary link · deleted in "+(days?days+"d ":"")+hours+"h "+minutes+"m";
};
async function open(){
 if(!valid.test(id)){message("The lesson link is invalid.",true);return}
 const {data:{user},error:authError}=await db.auth.getUser();
 if(authError||!user){
  message("This is a tutor-only lesson link. Please sign in to HelloEarth first, then reopen this link.",true);
  return;
 }
 const {data,error}=await db.from("he_generation_log")
  .select("id,tutor_id,topic,cefr_level,duration_minutes,markdown,created_at,expires_at")
  .eq("id",id).eq("tutor_id",user.id).gt("expires_at",new Date().toISOString()).maybeSingle();
 if(error||!data){message("This lesson is unavailable or its 14-day link has expired.",true);return}
 lesson=data;
 el("lesson-title").textContent=data.topic;
 el("lesson-level").textContent="CEFR "+data.cefr_level;
 el("lesson-duration").textContent=data.duration_minutes+" minutes";
 el("lesson-date").textContent=new Date(data.created_at).toLocaleDateString();
 renderWorkbook(el("lesson-content"),data.markdown);
 document.title=data.topic+" | HelloEarth lesson";
 for(const name of ["lesson-copy","lesson-download","lesson-print"])el(name).disabled=false;
 message("Private tutor preview · Printable A4 workbook");
 lifespan();setInterval(lifespan,60000);
}
function saveFile(filename,text){
 const blob=new Blob([text],{type:"text/markdown;charset=utf-8"}),url=URL.createObjectURL(blob);
 const a=document.createElement("a");a.href=url;a.download=filename;
 document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
el("lesson-print").addEventListener("click",()=>{if(lesson)window.print()});
el("lesson-download").addEventListener("click",()=>{if(lesson)saveFile("helloearth-"+lesson.topic.toLowerCase().replace(/[^a-z0-9]+/g,"-").slice(0,45)+".md",lesson.markdown)});
el("lesson-copy").addEventListener("click",async()=>{
 if(!lesson)return;
 try{await navigator.clipboard.writeText(lesson.markdown);message("Lesson text copied.")}
 catch{message("Couldn't copy automatically. Download the Markdown file instead.",true)}
});
open();

import {db} from "./supabase-client.js";
import {renderWorkbook} from "./helloearth-workbook-renderer.js";
const el=id=>document.getElementById(id);
const saved=location.hash.startsWith("#saved=");
const id=decodeURIComponent(location.hash.replace(/^#(?:id=|saved=)?/,""));
const valid=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
let lesson=null,sharedUrl="";
async function createShare(){
 if(!lesson)throw Error("Open a lesson first.");
 const {data,error}=await db.functions.invoke("he-lesson-sharing",{
  body:{action:"create",sourceKind:saved?"saved":"generated",sourceId:id}
 });
 if(error){
  let msg=error.message||"Couldn't create a student link.";
  if(typeof error.context?.json==="function"){
   try{const details=await error.context.json();if(details?.error)msg=details.error}catch{}
  }
  throw Error(msg);
 }
 if(!data?.url)throw Error(data?.error||"No share link returned.");
 sharedUrl=data.url;
 el("lesson-share-tools").hidden=false;
 el("lesson-share-url").value=sharedUrl;
 return sharedUrl;
}
function message(text,error=false){
 const node=el("lesson-status");node.textContent=text;
 if(error){el("lesson-error").hidden=false;el("lesson-error").textContent=text}
}
const lifespan=()=>{
 if(!lesson)return;
 const left=Date.parse(lesson.expires_at)-Date.now();
 if(left<=0){el("lesson-life").textContent="Expired";el("lesson-content").replaceChildren();message("This temporary lesson has expired. Please create another copy.",true);return}
 const days=Math.floor(left/86400000),hours=Math.floor((left%86400000)/3600000),minutes=Math.floor((left%3600000)/60000);
 el("lesson-life").textContent="Link expires in "+(days?days+"d ":"")+hours+"h "+minutes+"m · auto-deletes shortly after";
};
async function open(){
 if(!valid.test(id)){message("The lesson link is invalid.",true);return}
 const {data:{user},error:authError}=await db.auth.getUser();
 if(authError||!user){
  message("This is a tutor-only lesson link. Please sign in to HelloEarth first, then reopen this link.",true);
  return;
 }
 let query=db.from(saved?"atlas_lesson_plans":"he_generation_log")
  .select(saved?"id,tutor_id,topic,cefr_level,duration_minutes,markdown,created_at":
   "id,tutor_id,topic,cefr_level,duration_minutes,markdown,created_at,expires_at,kind")
  .eq("id",id).eq("tutor_id",user.id);
 if(!saved)query=query.gt("expires_at",new Date().toISOString());
 const {data,error}=await query.maybeSingle();
 if(error||!data){message("This lesson is unavailable, not owned by this account, or its temporary link has expired.",true);return}
 lesson=data;
 el("lesson-title").textContent=data.topic;
 el("lesson-level").textContent="CEFR "+data.cefr_level;
 el("lesson-duration").textContent=data.duration_minutes+" minutes";
 el("lesson-date").textContent=new Date(data.created_at).toLocaleDateString();
 renderWorkbook(el("lesson-content"),data.markdown);
 document.title=data.topic+" | HelloEarth lesson";
 for(const name of ["lesson-copy","lesson-download","lesson-print","lesson-share","lesson-present"])el(name).disabled=false;
 message("Private tutor preview · Printable A4 workbook");
 if(saved){el("lesson-life").textContent="Saved in student records · no 14-day expiry";}
 else{lifespan();setInterval(lifespan,60000);}
 if(data.kind==="homework")document.querySelector(".paper-identity-tag").textContent="HOMEWORK";
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
el("lesson-share").addEventListener("click",async()=>{
 try{
  const url=await createShare();
  try{await navigator.clipboard.writeText(url);message("Public student lesson link copied. Anyone with the link can view it without signing in.")}
  catch{el("lesson-share-url").focus();el("lesson-share-url").select();message("Student link selected. Press Ctrl+C to copy.")}
 }catch(err){message(err.message,true)}
});
el("lesson-share-copy").addEventListener("click",async()=>{
 if(!sharedUrl)return;
 try{await navigator.clipboard.writeText(sharedUrl);message("Student link copied.")}
 catch{el("lesson-share-url").select();message("Student link selected. Press Ctrl+C to copy.")}
});
el("lesson-present").addEventListener("click",async()=>{
 const win=window.open("about:blank","_blank");
 try{
  const url=await createShare();
  if(win)win.location.href=url;
  else message("Popup blocked. Use the student link above to open your presenter view.");
 }catch(err){if(win)win.close();message(err.message,true)}
});
open();

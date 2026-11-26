import {db} from "./supabase-client.js";
// Private temporary lesson links. Drafts expire after 14 days; Supabase Cron
// purges expired rows every fifteen minutes. Saved student plans are separate.
const el=id=>document.getElementById(id);
const ROOT="he_generation_log";
const URLfor=id=>new URL("lesson.html#id="+id,location.href).href;
let cached=[],loaded=false,loading=false,current=null;
function remaining(iso){
 const ms=Date.parse(iso)-Date.now();
 if(!Number.isFinite(ms)||ms<=0)return "Expired";
 const d=Math.floor(ms/86400000),h=Math.floor(ms%86400000/3600000),m=Math.floor(ms%3600000/60000);
 return (d?d+"d ":"")+h+"h "+m+"m until expiry · deleted within 15 min after";
}
function textError(message,isError=false){
 const node=el("he-generation-feedback");
 if(!node)return;
 node.textContent=message;node.classList.toggle("is-error",isError);
}
async function user(){
 const {data:{user},error}=await db.auth.getUser();
 if(error||!user)throw Error("Please sign in again.");
 return user;
}
function copyFallback(value,feedback){
 const field=el("he-generation-url");field.value=value;
 if(navigator.clipboard?.writeText){
  navigator.clipboard.writeText(value).then(()=>textError(feedback||"Lesson link copied."))
   .catch(()=>{field.select();textError("Link selected. Press Ctrl+C to copy.")});
 }else{field.select();textError("Link selected. Press Ctrl+C to copy.")}
}
function showCurrent(row){
 if(!row||Date.parse(row.expires_at)<=Date.now())return;
 current=row;
 const box=el("he-generation-current");
 box.hidden=false;
 el("he-generation-url").value=URLfor(row.id);
 el("he-generation-expiry").textContent="Temporary generation · "+remaining(row.expires_at);
}
function button(title,callback){
 const b=document.createElement("button");b.type="button";b.textContent=title;
 b.addEventListener("click",callback);return b;
}
function paint(){
 const root=el("he-generation-list");if(!root)return;
 root.replaceChildren();
 const valid=cached.filter(x=>Date.parse(x.expires_at)>Date.now());
 if(!valid.length){
  const p=document.createElement("p");p.className="he-record-empty";
  p.textContent="No temporary workbooks. Generate a lesson above to get a printable link.";
  root.append(p);return;
 }
 for(const row of valid){
  const item=document.createElement("article");item.className="he-record-row he-generation-row";
  const info=document.createElement("div");info.className="he-generation-info";
  const title=document.createElement("strong");title.textContent=row.topic;
  const meta=document.createElement("small");
  meta.textContent=row.cefr_level+" · "+row.duration_minutes+" min · "+
   new Date(row.created_at).toLocaleDateString();
  const timer=document.createElement("span");timer.className="he-expiration-count";
  timer.dataset.expiry=row.expires_at;timer.textContent=remaining(row.expires_at);
  const link=document.createElement("a");
  link.href=URLfor(row.id);link.target="_blank";link.rel="noopener noreferrer";
  link.className="he-workbook-link";link.textContent="Open printable lesson ↗";
  info.append(title,meta,link,timer);
  const actions=document.createElement("div");actions.className="he-work-actions he-inline-actions";
  actions.append(
   button("Open PDF-style page",()=>window.open(URLfor(row.id),"_blank","noopener")),
   button("Copy link",()=>copyFallback(URLfor(row.id),"Private lesson link copied.")),
   button("Delete",async()=>{
    if(!confirm("Delete this temporary lesson now? This cannot be undone."))return;
    try{
     const auth=await user();
     const {error}=await db.from(ROOT).delete().eq("id",row.id).eq("tutor_id",auth.id);
     if(error)throw error;cached=cached.filter(x=>x.id!==row.id);
     if(current?.id===row.id){current=null;el("he-generation-current").hidden=true}
     paint();textError("Temporary lesson deleted.");
    }catch(err){textError("Couldn't delete lesson: "+err.message,true)}
   })
  );
  item.append(info,actions);root.append(item);
 }
}
async function load(){
 if(loading)return;
 loading=true;
 try{
  const auth=await user();
  const {data,error}=await db.from(ROOT)
   .select("id,student_id,topic,cefr_level,duration_minutes,kind,created_at,expires_at")
   .eq("tutor_id",auth.id).gt("expires_at",new Date().toISOString())
   .order("created_at",{ascending:false}).limit(70);
  if(error)throw error;cached=data||[];loaded=true;paint();
 }catch(err){textError("History unavailable: "+err.message,true)}
 finally{loading=false}
}
async function record({studentId,topic,level,duration,markdown,kind="lesson"}){
 const auth=await user();
 const {data,error}=await db.from(ROOT).insert({
  tutor_id:auth.id,student_id:studentId,topic:topic.slice(0,200),
  cefr_level:level,duration_minutes:duration,markdown:String(markdown).slice(0,32000),kind
 }).select("id,student_id,topic,cefr_level,duration_minutes,kind,created_at,expires_at").single();
 if(error)throw error;
 cached.unshift(data);showCurrent(data);paint();
 textError("Printable workbook logged. Private link valid for 14 days.");
 return data;
}
el("he-generation-refresh")?.addEventListener("click",load);
el("he-generation-copy")?.addEventListener("click",()=>{
 if(current)copyFallback(URLfor(current.id),"Private lesson link copied.");
});
el("he-generation-open")?.addEventListener("click",()=>{
 if(current)window.open(URLfor(current.id),"_blank","noopener");
});
document.addEventListener("helloearth:view-changed",e=>{
 if(e.detail?.view==="lessons")load();
});
setInterval(()=>{
 if(current)el("he-generation-expiry").textContent=
  "Temporary generation · "+remaining(current.expires_at);
 for(const node of document.querySelectorAll(".he-expiration-count")){
  node.textContent=remaining(node.dataset.expiry);
 }
 if(cached.some(x=>Date.parse(x.expires_at)<=Date.now())){cached=cached.filter(x=>Date.parse(x.expires_at)>Date.now());paint()}
},60000);
window.HelloEarthGenerationLog={record,load,showCurrent};
if(document.getElementById("lessons-view")&&!document.getElementById("lessons-view").hidden)load();

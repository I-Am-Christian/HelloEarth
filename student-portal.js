import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./supabase-config.js";
const $=id=>document.getElementById(id);
const token=location.hash.replace(/^#/,"").trim();
const cell=(tag,text)=>{const el=document.createElement(tag);el.textContent=String(text??"");return el};
const formatted=value=>{
 if(!value)return "Not specified";
 const date=new Date(/^\d{4}-\d{2}-\d{2}$/.test(value)?value+"T12:00:00":value);
 return Number.isNaN(date.getTime())?String(value):date.toLocaleString([],{year:"numeric",month:"short",day:"numeric",
  ...(value.includes("T")?{hour:"2-digit",minute:"2-digit"}:{})});
};
function entry(root,heading,detail,meta=""){
 const article=cell("article","");article.className="portal-entry";
 article.append(cell("strong",heading));
 if(meta)article.append(cell("small",meta));
 if(detail)article.append(cell("p",detail));
 root.append(article);
}
function empty(root,message){entry(root,message,"")}
function show(data){
 const s=data.student;
 $("portal-name").textContent=s.name;
 $("portal-level").textContent=s.level==="UNASSESSED"?"Not assessed":s.level||"Not assessed";
 $("portal-goals").textContent=Array.isArray(s.goals)&&s.goals.length?s.goals.join(" · "):"No learning goals have been shared yet.";
 $("portal-current-homework").textContent=s.currentHomework||"No current homework recorded in your profile.";
 const homework=$("portal-homework");
 homework.replaceChildren();
 if(!data.homework?.length)empty(homework,"No tracked homework shared yet.");
 else for(const h of data.homework){
  entry(homework,h.title,"Status: "+h.status,h.due_on?"Due "+formatted(h.due_on):"No due date");
 }
 const lessons=$("portal-lessons");lessons.replaceChildren();
 if(!data.appointments?.length)empty(lessons,"No confirmed internal bookings are currently shared.");
 else for(const b of data.appointments)
  entry(lessons,"Confirmed internal booking",formatted(b.starts_at)+" – "+formatted(b.ends_at));
 const progress=$("portal-progress");progress.replaceChildren();
 if(!data.progress?.length){empty(progress,"No saved tutor assessments shared yet.");}
 else{
  const table=document.createElement("table"),thead=document.createElement("thead"),tr=document.createElement("tr");
  const skills=["speaking","listening","reading","writing","grammar","confidence"];
  for(const h of ["Date",...skills.map(v=>v[0].toUpperCase()+v.slice(1))])tr.append(cell("th",h));
  thead.append(tr);table.append(thead);
  const tbody=document.createElement("tbody");
  for(const row of data.progress){
   const line=document.createElement("tr");line.append(cell("td",formatted(row.assessed_on)));
   for(const skill of skills)line.append(cell("td",row[skill]??"—"));
   tbody.append(line);
  }
  table.append(tbody);progress.append(table);
 }
 $("portal-expiry").textContent="This read-only student link expires "+formatted(data.expiresAt)+
  ". For a correction or to revoke access, contact your tutor.";
 $("portal-content").hidden=false;
 $("portal-status").textContent="Secure summary link verified.";
 $("portal-status").className="public-status is-good";
}
async function load(){
 if(!/^[0-9a-f]{64}$/i.test(token)){
  $("portal-status").textContent="Missing or invalid student link. Ask your tutor to share a new private link.";
  $("portal-status").className="public-status is-error";return;
 }
 try{
  const response=await fetch(SUPABASE_URL+"/functions/v1/he-public",{
   method:"POST",cache:"no-store",
   headers:{"Content-Type":"application/json","apikey":SUPABASE_PUBLISHABLE_KEY},
   body:JSON.stringify({action:"portal",token})
  });
  let data={};try{data=await response.json()}catch{}
  if(!response.ok||data.error)throw Error(data.error||"Student link unavailable.");
  show(data);
 }catch(error){
  $("portal-status").textContent="Unable to open this student summary: "+error.message;
  $("portal-status").className="public-status is-error";
 }
}
load();

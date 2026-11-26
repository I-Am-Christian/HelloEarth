import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from "./supabase-config.js";
const el=id=>document.getElementById(id);
const token=decodeURIComponent(location.hash.slice(1).replace(/^t=/,""));
let state=null,dirty=false,saving=false,timer=null;
const fmt=date=>new Date(date).toLocaleString(undefined,{year:"numeric",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"});
const status=(message,error=false)=>{el("homework-save-status").textContent=message;el("homework-save-status").style.color=error?"#ffb8c4":"#b7e1d4"};
const valid=/^[0-9a-f-]{36}\.[0-9a-f-]{36}\.[0-9a-f]{64}$/i;
async function api(action,extra={}){
 const resp=await fetch(SUPABASE_URL+"/functions/v1/he-homework-links",{
  method:"POST",headers:{"content-type":"application/json","apikey":SUPABASE_PUBLISHABLE_KEY},
  body:JSON.stringify({action,token,...extra}),cache:"no-store",referrerPolicy:"no-referrer"
 });
 const data=await resp.json().catch(()=>({}));
 if(!resp.ok)throw new Error(data.error||"The homework service is unavailable.");
 return data;
}
function worksheetText(raw){
 const root=el("homework-worksheet");root.replaceChildren();
 const lines=String(raw||"").split(/\r?\n/);
 let list=null;
 for(const line of lines){
  const match=line.match(/^(#{1,4})\s+(.+)$/);
  const bullet=line.match(/^\s*[-*]\s+(.+)$/);
  const number=line.match(/^\s*\d+[.)]\s+(.+)$/);
  if(match){list=null;const h=document.createElement(match[1].length<=2?"h2":"h3");h.textContent=match[2];root.append(h);continue}
  if(bullet||number){
   const tag=bullet?"ul":"ol";
   if(!list||list.tagName.toLowerCase()!==tag){list=document.createElement(tag);root.append(list)}
   const li=document.createElement("li");li.textContent=(bullet||number)[1];list.append(li);continue;
  }
  list=null;
  if(!line.trim())continue;
  const p=document.createElement("p");p.textContent=line;root.append(p);
 }
 if(!root.childNodes.length){const p=document.createElement("p");p.textContent="Your teacher has not added exercises yet.";root.append(p)}
}
function closed(message){
 if(message)el("homework-error").textContent=message,el("homework-error").hidden=false;
 el("homework-active").hidden=true;el("homework-closed").hidden=false;
 el("homework-title").textContent="Homework link unavailable";
 status("Link closed",true);
}
async function open(){
 if(!valid.test(token)){closed("This is not a valid homework link.");return}
 try{
  state=await api("open");
  el("homework-title").textContent=state.title;
  el("homework-expiry").textContent="Available until "+fmt(state.expiresAt);
  worksheetText(state.worksheet);
  el("homework-answers").value=state.answers||"";
  el("homework-active").hidden=false;
  status(state.savedAt?"Saved "+fmt(state.savedAt):"Ready. Changes save automatically.");
 }catch(err){closed(err.message)}
}
async function save(){
 if(!state||!dirty||saving)return;
 if(Date.now()>=Date.parse(state.expiresAt)){closed("The 14-day editing window has ended.");return}
 saving=true;
 const snapshot=el("homework-answers").value;
 status("Saving…");
 try{
  const result=await api("save",{answers:snapshot});
  state.savedAt=result.savedAt;
  if(el("homework-answers").value===snapshot){dirty=false;status("Saved "+fmt(result.savedAt))}
  else{status("Saved earlier changes. More changes pending.");scheduleSave()}
 }catch(err){
  status(err.message,true);
  if(/expired|no longer|closed/i.test(err.message)){closed(err.message)}
 }finally{saving=false}
}
function scheduleSave(){
 if(timer)clearTimeout(timer);
 timer=setTimeout(()=>{timer=null;save()},2500);
}
el("homework-answers").addEventListener("input",()=>{
 dirty=true;status("Unsaved changes — autosave in a moment");scheduleSave();
});
el("homework-save").addEventListener("click",async()=>{
 if(timer)clearTimeout(timer);timer=null;
 if(saving){status("Saving…");return}
 if(!dirty){status("Everything is already saved.");return}
 await save();
});
function download(){
 if(!state)return;
 const text=[state.title,"Expires: "+fmt(state.expiresAt),"","WORKSHEET",state.worksheet,"","MY ANSWERS",el("homework-answers").value].join("\n");
 const blob=new Blob([text],{type:"text/plain;charset=utf-8"});
 const url=URL.createObjectURL(blob);
 const a=document.createElement("a");a.href=url;a.download="helloearth-homework.txt";document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),2000);
}
el("homework-download").addEventListener("click",download);
el("homework-print").addEventListener("click",()=>{
 let printable=el("homework-print-answers");
 if(!printable){printable=document.createElement("pre");printable.id="homework-print-answers";printable.hidden=true;el("homework-active").append(printable)}
 printable.textContent=el("homework-answers").value;
 // Print-only CSS unhides the text outside the form's textarea.
 window.print();
});
// Keep saving during long uninterrupted writing sessions, not only after pauses.
setInterval(()=>{if(dirty&&!saving)save()},18000);
window.addEventListener("beforeunload",e=>{if(dirty){e.preventDefault();e.returnValue=""}});
open();

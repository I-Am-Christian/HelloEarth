import { db } from "./supabase-client.js";
export { db };
export const $=id=>document.getElementById(id);
export const W=()=>window.HelloEarthWorkspace;
export const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
export const dateOnly=(d=new Date())=>{
 const local=new Date(d.getTime()-d.getTimezoneOffset()*60000);
 return local.toISOString().slice(0,10);
};
export const friendlyDate=value=>{
 if(!value)return "No date";
 const date=new Date(/^\d{4}-\d{2}-\d{2}$/.test(String(value))?value+"T12:00:00":value);
 return Number.isNaN(date.getTime())?String(value):date.toLocaleDateString([],{day:"numeric",month:"short",year:"numeric"});
};
export const formData=form=>Object.fromEntries(new FormData(form).entries());
export const state={
 userId:null,students:[],settings:null,preferences:[],bookings:[],recurring:[],homework:[],
 ledger:[],preparation:[],templates:[],links:[],notes:[],plans:[],assessments:[],attendance:[],
 calendar:{events:[],connected:false,start:null,end:null},
 selectedStudent:null,loading:false,errors:[],loaded:false
};
const listeners=new Set();
export const onRender=cb=>{listeners.add(cb);return()=>listeners.delete(cb)};
export function render(){
 for(const cb of listeners){
  try{cb()}catch(error){console.error("HelloEarth suite render failed",error)}
 }
}
export function message(value,error=false){
 const n=$("he-suite-status");
 if(!n)return;
 n.textContent=value;n.classList.toggle("is-error",error);
}
export const nameFor=id=>state.students.find(s=>s.id===id)?.display_name||"Unlinked / external";
export const studentFor=id=>state.students.find(s=>s.id===id)||null;
export const options=(value="",empty="Select student")=>'<option value="">'+esc(empty)+'</option>'+
 state.students.map(s=>'<option value="'+esc(s.id)+'" '+(value===s.id?'selected':'')+'>'+esc(s.display_name)+' · '+esc(s.cefr_level)+'</option>').join("");
export function syncStudents(){
 document.querySelectorAll("#tools-view [data-suite-students]").forEach(el=>{
  const keep=el.value||state.selectedStudent||"";
  el.innerHTML=options(keep);
  if(!keep||!state.students.some(s=>s.id===keep))el.value="";
 });
}
export function groupCurrency(entries,getAmount=e=>Number(e.amount)||0){
 const totals={};
 for(const e of entries){
  const currency=e.currency||"ZAR";
  totals[currency]=(totals[currency]||0)+getAmount(e);
 }
 return totals;
}
export const formatMoney=(amount,currency)=>new Intl.NumberFormat("en",{style:"currency",currency,
 maximumFractionDigits:2}).format(Number(amount)||0);
export function downloadFile(name,body,type="text/plain;charset=utf-8"){
 const blob=new Blob([body],{type}),url=URL.createObjectURL(blob);
 const anchor=document.createElement("a");anchor.href=url;anchor.download=name;
 document.body.append(anchor);anchor.click();anchor.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function csvRow(fields){
 return fields.map(value=>'"'+String(value??"").replaceAll('"','""')+'"').join(",");
}
export function downloadCSV(name,rows){
 downloadFile(name,"\uFEFF"+rows.map(csvRow).join("\r\n")+"\r\n","text/csv;charset=utf-8");
}
const tables={
 preferences:["he_student_preferences",700],
 bookings:["he_booking_requests",300],
 recurring:["he_recurring_rules",300],
 homework:["he_homework",800],
 ledger:["he_lesson_ledger",1000],
 preparation:["he_preparation",700],
 templates:["he_templates",500],
 links:["he_portal_links",500],
 notes:["atlas_lesson_notes",1000],
 plans:["atlas_lesson_plans",500],
 assessments:["atlas_skill_assessments",1000],
 attendance:["atlas_lesson_attendance",1000]
};
let loadGeneration=0;
export async function refresh(fields=Object.keys(tables)){
 const userId=W()?.userId;
 if(!userId)return;
 const generation=++loadGeneration;
 state.userId=userId;
 if(!state.loading){state.loading=true;message("Loading private tutor records…")}
 const jobs=[];
 if(!fields.length||fields.includes("settings"))
  jobs.push(["settings",db.from("he_tutor_settings").select("*").eq("tutor_id",userId).maybeSingle()]);
 for(const field of fields){
  if(!tables[field])continue;
  const [table,cap]=tables[field];
  // Portal tokens are never retrieved into the dashboard.
  const columns=field==="links"?"id,student_id,expires_at,revoked_at":"*";
  jobs.push([field,db.from(table).select(columns).eq("tutor_id",userId).limit(cap)]);
 }
 const settled=await Promise.allSettled(jobs.map(x=>x[1]));
 if(generation!==loadGeneration)return;
 state.errors=[];
 for(let i=0;i<settled.length;i++){
  const key=jobs[i][0],item=settled[i];
  if(item.status==="rejected"||item.value?.error){
   const error=item.status==="rejected"?item.reason:item.value.error;
   state.errors.push(key+": "+String(error?.message||error).slice(0,100));
  }else{
   state[key]=key==="settings"?item.value.data:(item.value.data||[]);
  }
 }
 state.students=W()?.students||state.students;
 state.loaded=true;state.loading=false;
 syncStudents();render();
 message(state.errors.length?"Some information could not be loaded: "+state.errors.join("; "):"Private workspace tools ready.",state.errors.length>0);
}
export async function put(table,record,opts={}){
 const query=opts.upsert?db.from(table).upsert(record,opts.onConflict?{onConflict:opts.onConflict}:{}):
  db.from(table).insert(record);
 const {data,error}=await query.select("*");
 if(error)throw error;
 return data;
}
export function row(value,date,text,status=""){
 return '<div class="he-suite-row"><div><strong>'+esc(value)+'</strong><small>'+esc(date)+'</small><p>'+esc(text||"")+'</p></div><span class="he-suite-row-status">'+esc(status)+'</span></div>';
}
document.addEventListener("helloearth:calendar-events",e=>{
 state.calendar={events:e.detail?.events||[],connected:Boolean(e.detail?.connected),
  start:e.detail?.windowStart||null,end:e.detail?.windowEnd||null};
 render();
});
document.addEventListener("helloearth:calendar-disconnected",()=>{
 state.calendar={events:[],connected:false,start:null,end:null};render();
});
document.addEventListener("helloearth:student-opened",e=>{
 state.selectedStudent=e.detail?.student?.id||null;
});

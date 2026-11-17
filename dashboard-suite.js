import {renderSuite} from "./dashboard-suite-ui.js?v=20261118-suite1";
import {state,W,refresh,syncStudents,render,message} from "./dashboard-suite-shared.js";
import {setupSchedule} from "./dashboard-suite-schedule.js";
import {setupStudents} from "./dashboard-suite-students.js";
import {setupBusiness} from "./dashboard-suite-business.js";
import {setupResources} from "./dashboard-suite-resources.js";

/* Authenticated-only UI. Functions use RLS-scoped queries from the signed-in
   tutor; public booking and student-share links call a restricted server API. */
renderSuite();
const tabs=["schedule","students","business","resources"];
function setSection(next){
 if(!tabs.includes(next))return;
 for(const tab of tabs){
  const active=next===tab;
  document.getElementById("he-suite-"+tab).hidden=!active;
  const btn=document.querySelector('[data-suite-tab="'+tab+'"]');
  btn.classList.toggle("active",active);
  btn.setAttribute("aria-pressed",String(active));
 }
}
document.querySelectorAll("[data-suite-tab]").forEach(btn=>
 btn.addEventListener("click",()=>setSection(btn.dataset.suiteTab)));

setupSchedule();
setupStudents();
setupBusiness();
setupResources();
document.getElementById("overview-lesson-shortcut")?.addEventListener("click",()=>document.getElementById("ws-companion-open")?.click());

let lastUser=null,loading=false;
const allFields=["settings","preferences","bookings","recurring","homework","ledger","preparation",
 "templates","links","notes","plans","assessments","attendance"];
async function initialLoad(){
 const uid=W()?.userId;
 if(!uid)return;
 state.students=W().students||[];
 state.selectedStudent=W().selectedStudent?.id||null;
 syncStudents();
 if(lastUser!==uid){
  lastUser=uid;
  if(loading)return;
  loading=true;
  try{await refresh(allFields)}finally{loading=false}
 }else render();
}
document.addEventListener("helloearth:workspace-data",initialLoad);
document.addEventListener("helloearth:note-saved",()=>refresh(["notes"]));
document.addEventListener("helloearth:plan-saved",()=>refresh(["plans"]));
document.addEventListener("helloearth:assessment-saved",()=>refresh(["assessments"]));
document.addEventListener("helloearth:attendance-saved",()=>refresh(["attendance"]));
document.addEventListener("helloearth:student-opened",e=>{
 state.selectedStudent=e.detail?.student?.id||null;
});
if(W()?.userId)initialLoad();
window.HelloEarthTutorSuite={
 open:(tab="schedule")=>{document.getElementById("tools-tab").click();setSection(tab)},
 reload:()=>refresh(allFields)
};

/* HelloEarth Optimize Calendar — advisory, local-only preferences.
   Uses the same authenticated students and last synced Google Calendar window.
   Recommendations never create or update calendar events. */
import { state as suite } from "./dashboard-suite-shared.js";
const $=id=>document.getElementById(id);
const area=$("he-optimize-calendar");
const form=$("he-optimize-form");
const studentEl=$("he-opt-student");
const zoneEl=$("he-opt-zone");
const startEl=$("he-opt-start");
const endEl=$("he-opt-end");
const daysEl=$("he-opt-days");
const statusEl=$("he-opt-status");
const resultsEl=$("he-opt-results");
const teacherStart=$("he-opt-teacher-start");
const teacherEnd=$("he-opt-teacher-end");
const durationEl=$("he-opt-duration");
const weekdays=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const zoneList=["Africa/Johannesburg","Europe/London","Europe/Warsaw","Europe/Madrid","Europe/Istanbul","Europe/Berlin","Europe/Paris","Europe/Rome","America/Sao_Paulo","America/Mexico_City","America/New_York","America/Chicago","America/Los_Angeles","America/Toronto","Asia/Shanghai","Asia/Tokyo","Asia/Dubai","Asia/Kolkata","Australia/Sydney","Pacific/Auckland"];
const fmtCache=new Map();
let lastUser="";
let latest=[];
const getStudents=()=>window.HelloEarthWorkspace?.students||[];
const userId=()=>window.HelloEarthWorkspace?.userId||null;
const storageKey=()=>userId()?"helloearth-student-tz-v1:"+userId():null;
function validZone(zone){
 try{new Intl.DateTimeFormat("en-US",{timeZone:zone}).format();return true}catch{return false}
}
function load(){
 const key=storageKey();if(!key)return {};
 try{const parsed=JSON.parse(localStorage.getItem(key)||"{}");return parsed&&typeof parsed==="object"&&!Array.isArray(parsed)?parsed:{}}catch{return {}}
}
function persist(entries){
 const key=storageKey();if(!key)return false;
 try{localStorage.setItem(key,JSON.stringify(entries));return true}catch{return false}
}
function fmt(zone){
 if(!fmtCache.has(zone))fmtCache.set(zone,new Intl.DateTimeFormat("en-GB",{
  timeZone:zone,year:"numeric",month:"2-digit",day:"2-digit",weekday:"short",
  hour:"2-digit",minute:"2-digit",hourCycle:"h23"
 }));
 return fmtCache.get(zone);
}
function parts(date,zone){
 const all=Object.fromEntries(fmt(zone).formatToParts(date).filter(p=>p.type!=="literal").map(p=>[p.type,p.value]));
 return {minute:Number(all.hour)*60+Number(all.minute),day:weekdays.indexOf(all.weekday),
  date:all.day+"/"+all.month,weekday:all.weekday,time:all.hour+":"+all.minute};
}
function timeToMinutes(value){const match=/^(\d\d):(\d\d)$/.exec(value||"");return match?Number(match[1])*60+Number(match[2]):NaN}
function inside(a,from,to,duration){return Number.isFinite(from)&&Number.isFinite(to)&&a>=from&&a+duration<=to}
function renderStudents(){
 const previous=studentEl.value;
 const students=getStudents().slice().sort((a,b)=>String(a.display_name).localeCompare(String(b.display_name)));
 studentEl.replaceChildren(new Option("Choose a student",""));
 for(const s of students)studentEl.add(new Option(s.display_name,s.id));
 if(students.some(s=>s.id===previous))studentEl.value=previous;
 else if(suite.selectedStudent&&students.some(s=>s.id===suite.selectedStudent))studentEl.value=suite.selectedStudent;
 else if(students.length===1)studentEl.value=students[0].id;
 fill();
}
function fill(){
 const row=load()[studentEl.value]||{};
 zoneEl.value=row.zone||"";
 startEl.value=row.start||"09:00";
 endEl.value=row.end||"20:00";
 const days=Array.isArray(row.days)?row.days:[1,2,3,4,5];
 daysEl.querySelectorAll("input[type=checkbox]").forEach(n=>n.checked=days.includes(Number(n.value)));
}
function getPreference(){
 const days=[...daysEl.querySelectorAll("input:checked")].map(n=>Number(n.value));
 return {zone:zoneEl.value.trim(),start:startEl.value,end:endEl.value,days};
}
function message(msg,invalid=false){statusEl.textContent=msg;statusEl.classList.toggle("is-error",invalid)}
function eventInterval(e){
 const start=e.start?.dateTime?new Date(e.start.dateTime):e.start?.date?new Date(e.start.date+"T00:00:00"):null;
 const end=e.end?.dateTime?new Date(e.end.dateTime):e.end?.date?new Date(e.end.date+"T00:00:00"):null;
 if(!start||!end||!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime()))return null;
 return {start:start.getTime(),end:end.getTime()};
}
function create(tag,cls,content){
 const n=document.createElement(tag);if(cls)n.className=cls;if(content!=null)n.textContent=content;return n;
}
function render(){
 resultsEl.replaceChildren();
 const id=studentEl.value,student=getStudents().find(s=>s.id===id);
 if(!student){resultsEl.append(create("p","he-opt-empty","Select a student to see recommended lesson times."));return}
 const pref=load()[id];
 if(!pref||!validZone(pref.zone)){
  resultsEl.append(create("p","he-opt-empty","Save this student's time zone and preferred hours first."));return;
 }
 const studentStart=timeToMinutes(pref.start),studentEnd=timeToMinutes(pref.end);
 const tStart=timeToMinutes(teacherStart.value),tEnd=timeToMinutes(teacherEnd.value);
 const duration=Number(durationEl.value);
 if(!Number.isFinite(studentStart)||!Number.isFinite(studentEnd)||studentEnd<=studentStart||
  !Number.isFinite(tStart)||!Number.isFinite(tEnd)||tEnd<=tStart){
  resultsEl.append(create("p","he-opt-empty","Check the working-hour ranges before optimizing."));return;
 }
 const teacherZone=validZone(suite.settings?.timezone)?suite.settings.timezone:Intl.DateTimeFormat().resolvedOptions().timeZone;
 const calendar=suite.calendar;
 const verified=Boolean(calendar.connected&&calendar.start&&calendar.end);
 const now=Date.now();
 const from=verified?Math.max(now,new Date(calendar.start).getTime()):now;
 const to=verified?new Date(calendar.end).getTime():now+7*86400000;
 const events=verified?calendar.events.map(eventInterval).filter(Boolean):[];
 const busyBuffer=10*60000;
 let candidates=[];
 const initial=Math.ceil(from/(30*60000))*30*60000;
 for(let ms=initial;ms+duration*60000<=to&&candidates.length<2000;ms+=30*60000){
  const date=new Date(ms),studentTime=parts(date,pref.zone),teacherTime=parts(date,teacherZone);
  const endDate=new Date(ms+duration*60000-60000);
  const studentEndPart=parts(endDate,pref.zone),teacherEndPart=parts(endDate,teacherZone);
  if(!pref.days.includes(studentTime.day)||studentTime.date!==studentEndPart.date||
   teacherTime.date!==teacherEndPart.date)continue;
  if(!inside(studentTime.minute,studentStart,studentEnd,duration)||
   !inside(teacherTime.minute,tStart,tEnd,duration))continue;
  if(events.some(e=>ms<e.end+busyBuffer&&ms+duration*60000>e.start-busyBuffer))continue;
  // Prefer comfortable mid-day hours for both people, with small reward for sooner dates.
  const studentMid=studentTime.minute+duration/2,teacherMid=teacherTime.minute+duration/2;
  const score=Math.abs(studentMid-14*60)*.65+Math.abs(teacherMid-13*60)*.35+(ms-now)/86400000*8;
  candidates.push({ms,score,studentTime,teacherTime});
 }
 candidates.sort((a,b)=>a.score-b.score||a.ms-b.ms);
 latest=candidates.slice(0,8);
 const heading=create("div","he-opt-results-head");
 heading.append(create("strong","",verified?"Best open times in your synced week":"Possible overlaps — calendar not verified"));
 heading.append(create("small","",teacherZone+" · "+duration+" minute lessons · 10 minute conflict buffer"));
 resultsEl.append(heading);
 if(!verified)resultsEl.append(create("p","he-opt-warning","Connect and refresh Google Calendar to check existing events. These suggestions might clash with appointments."));
 if(verified&&to<=now)resultsEl.append(create("p","he-opt-warning","The synced calendar window has passed. Move to a future week and refresh your calendar."));
 if(!latest.length){
  resultsEl.append(create("p","he-opt-empty","No matching times in this window. Try widening working hours, changing preferred days, or moving the calendar week."));return;
 }
 const list=create("div","he-opt-list");
 latest.forEach((item,i)=>{
  const card=create("div","he-opt-slot");
  const title=create("strong","",item.teacherTime.weekday+" "+item.teacherTime.date+" · "+item.teacherTime.time+" (your time)");
  const second=create("span","",item.studentTime.weekday+" "+item.studentTime.date+" · "+item.studentTime.time+" ("+pref.zone+")");
  const details=create("small","",i===0?"Top match based on both schedules":"Recommended time zone overlap");
  const copy=create("button","ws-mini-btn","Copy times");
  copy.type="button";
  copy.addEventListener("click",()=>{
   const line=student.display_name+" — "+title.textContent+" / "+second.textContent;
   navigator.clipboard?.writeText(line).then(()=>message("Suggested times copied.")).catch(()=>message("Select and copy the displayed times."));
  });
  const left=create("div","he-opt-slot-info");left.append(title,second,details);
  card.append(left,copy);list.append(card);
 });
 resultsEl.append(list);
}
form.addEventListener("submit",e=>{
 e.preventDefault();const id=studentEl.value,pref=getPreference();
 if(!id){message("Choose a student first.",true);return}
 if(!validZone(pref.zone)){message("Enter a valid IANA time zone, such as Europe/Warsaw or America/Sao_Paulo.",true);return}
 if(timeToMinutes(pref.end)<=timeToMinutes(pref.start)||!pref.days.length){
  message("Choose at least one day and an end time after the start time.",true);return;
 }
 const entries=load();entries[id]=pref;
 if(!persist(entries)){message("Browser storage is unavailable; preferences were not saved.",true);return}
 message("Saved on this browser for your tutor account. Time zone changes are reflected in the recommendations.");
 render();
});
studentEl.addEventListener("change",()=>{fill();message("");render()});
[teacherStart,teacherEnd,durationEl].forEach(el=>el.addEventListener("change",render));
$("he-opt-run").addEventListener("click",render);
document.addEventListener("helloearth:calendar-events",()=>queueMicrotask(render));
document.addEventListener("helloearth:calendar-disconnected",()=>queueMicrotask(render));
document.addEventListener("helloearth:student-opened",e=>{
 if(e.detail?.student?.id&&[...studentEl.options].some(o=>o.value===e.detail.student.id)){
  studentEl.value=e.detail.student.id;fill();render();
 }
});
document.addEventListener("helloearth:workspace-data",()=>{
 if(userId()!==lastUser){lastUser=userId();renderStudents()}
 else renderStudents();
 render();
});
if(userId()){lastUser=userId();renderStudents()}else{renderStudents()}

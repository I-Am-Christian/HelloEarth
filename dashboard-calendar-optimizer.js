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
const viewEl=$("he-opt-view");
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
function currentTeacherZone(){
 const candidate=suite.settings?.timezone;
 const fallback=Intl.DateTimeFormat().resolvedOptions().timeZone;
 return validZone(candidate)?candidate:(validZone(fallback)?fallback:"Africa/Johannesburg");
}
function calendarContext(){
 const cal=suite.calendar;
 const start=cal.start?new Date(cal.start).getTime():NaN;
 const end=cal.end?new Date(cal.end).getTime():NaN;
 const verified=Boolean(cal.connected&&Number.isFinite(start)&&Number.isFinite(end)&&end>start);
 const now=Date.now();
 return {verified,now,from:verified?Math.max(now,start):now,
  to:verified?end:now+7*86400000,
  events:verified?cal.events.map(eventInterval).filter(Boolean):[]};
}
function validPreference(pref){
 return Boolean(pref&&validZone(pref.zone)&&
  Array.isArray(pref.days)&&pref.days.length&&
  timeToMinutes(pref.start)>=0&&timeToMinutes(pref.end)>timeToMinutes(pref.start));
}
function candidatesFor(pref,context,teacherZone,duration,tStart,tEnd){
 const start=timeToMinutes(pref.start),end=timeToMinutes(pref.end);
 const list=[],initial=Math.ceil(context.from/1800000)*1800000;
 for(let ms=initial;ms+duration*60000<=context.to;ms+=1800000){
  const st=parts(new Date(ms),pref.zone),tt=parts(new Date(ms),teacherZone);
  const endAt=new Date(ms+duration*60000-60000);
  const stEnd=parts(endAt,pref.zone),ttEnd=parts(endAt,teacherZone);
  if(!pref.days.includes(st.day)||st.date!==stEnd.date||
    tt.date!==ttEnd.date)continue;
  if(!inside(st.minute,start,end,duration)||!inside(tt.minute,tStart,tEnd,duration))continue;
  if(context.events.some(e=>ms<e.end+600000&&ms+duration*60000>e.start-600000))continue;
  const studentMid=st.minute+duration/2,teacherMid=tt.minute+duration/2;
  const score=Math.abs(studentMid-14*60)*.65+Math.abs(teacherMid-13*60)*.35+
   (ms-context.now)/86400000*8;
  list.push({ms,score,studentTime:st,teacherTime:tt});
 }
 return list.sort((a,b)=>a.score-b.score||a.ms-b.ms);
}
function slotCard(student,pref,item,index,teacherZone,all=false){
 const card=create("div","he-opt-slot");
 const left=create("div","he-opt-slot-info");
 if(all)left.append(create("strong","he-opt-slot-name",student.display_name));
 left.append(create("strong","",item.teacherTime.weekday+" "+item.teacherTime.date+
  " · "+item.teacherTime.time+" (your time)"));
 left.append(create("span","",item.studentTime.weekday+" "+item.studentTime.date+
  " · "+item.studentTime.time+" ("+pref.zone+")"));
 left.append(create("small","",all?"Preview suggestion · not reserved":
  index===0?"Best match for this student":"Alternative suggestion"));
 const copy=create("button","ws-mini-btn","Copy");
 copy.type="button";
 copy.addEventListener("click",()=>{
  const summary=student.display_name+" — "+new Date(item.ms).toLocaleString("en-GB",{
   timeZone:teacherZone,weekday:"short",day:"numeric",month:"short",year:"numeric",
   hour:"2-digit",minute:"2-digit",hourCycle:"h23"})+" ("+teacherZone+") / "+
   new Date(item.ms).toLocaleString("en-GB",{
   timeZone:pref.zone,weekday:"short",day:"numeric",month:"short",year:"numeric",
   hour:"2-digit",minute:"2-digit",hourCycle:"h23"})+" ("+pref.zone+")";
  if(!navigator.clipboard?.writeText){message("Copying is unavailable in this browser.",true);return}
  navigator.clipboard.writeText(summary).then(()=>message("Preview time copied. No lessons changed."))
   .catch(()=>message("Unable to copy. You can select the displayed times.",true));
 });
 card.append(left,copy);return card;
}
function render(){
 resultsEl.replaceChildren();
 const all=viewEl.value==="all",students=getStudents();
 const selected=students.find(s=>s.id===studentEl.value);
 const saved=load(),teacherZone=currentTeacherZone(),context=calendarContext();
 const duration=Number(durationEl.value),tStart=timeToMinutes(teacherStart.value),
  tEnd=timeToMinutes(teacherEnd.value);
 if(!Number.isFinite(tStart)||!Number.isFinite(tEnd)||tStart>=tEnd){
  resultsEl.append(create("p","he-opt-empty","Enter valid teaching hours to generate a preview."));return;
 }
 if(!all&&!selected){
  resultsEl.append(create("p","he-opt-empty","Choose a student or switch to All students."));return;
 }
 const eligible=all?students.filter(s=>validPreference(saved[s.id])):
  validPreference(saved[selected.id])?[selected]:[];
 const missing=all?students.length-eligible.length:0;
 const heading=create("div","he-opt-results-head");
 heading.append(create("strong","",all?"Whole-week student recommendations (preview)":
  "Recommended times for "+selected.display_name+" (preview)"));
 heading.append(create("small","",teacherZone+" · "+duration+" min · 10 min buffer"));
 resultsEl.append(heading);
 if(!context.verified)resultsEl.append(create("p","he-opt-warning",
  "Google Calendar is not synced for this window. Results are tentative and may conflict with appointments."));
 if(context.verified&&context.to<=context.now)resultsEl.append(create("p","he-opt-warning",
  "The synced week has passed. Select a future week and refresh Google Calendar."));
 if(all&&missing)resultsEl.append(create("p","he-opt-warning",
  missing+" student(s) are excluded because their time zone or preferred hours have not been saved."));
 if(!eligible.length){
  resultsEl.append(create("p","he-opt-empty",all?
   "No student preferences saved yet. Select students individually, ask their preferred times, and save their answers.":
   "Save this student's preferred days, hours and time zone first."));
  return;
 }
 const list=create("div","he-opt-list");
 if(all){
  // Assign at most one non-overlapping suggestion per student, without writing to any calendar.
  const requests=eligible.map(student=>({
   student,pref:saved[student.id],
   candidates:candidatesFor(saved[student.id],context,teacherZone,duration,tStart,tEnd)
  }));
  // Hardest-to-place students first reduces clashes for the shared preview.
  requests.sort((a,b)=>a.candidates.length-b.candidates.length||
   a.student.display_name.localeCompare(b.student.display_name));
  const reserved=[];
  let assigned=0;
  for(const request of requests){
   const item=request.candidates.find(candidate=>reserved.every(other=>
    candidate.ms>=other.end+600000||candidate.ms+duration*60000+600000<=other.start));
   if(!item){
    const missingCard=create("div","he-opt-slot");
    const info=create("div","he-opt-slot-info");
    info.append(create("strong","",request.student.display_name),
     create("span","","No non-overlapping match in this preview window"));
    missingCard.append(info);list.append(missingCard);
    continue;
   }
   reserved.push({start:item.ms,end:item.ms+duration*60000});
   list.append(slotCard(request.student,request.pref,item,0,teacherZone,true));
   assigned++;
  }
  resultsEl.append(create("p","he-opt-summary",
   assigned+" of "+eligible.length+" eligible students have a suggested slot. "+
   "Suggestions do not overlap one another, but are not bookings."));
 }else{
  const pref=saved[selected.id];
  const candidates=candidatesFor(pref,context,teacherZone,duration,tStart,tEnd).slice(0,8);
  if(!candidates.length){
   resultsEl.append(create("p","he-opt-empty","No matching times found. Adjust preferred days or working hours, or check a different calendar week."));
   return;
  }
  candidates.forEach((item,i)=>list.append(slotCard(selected,pref,item,i,teacherZone)));
 }
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
 message("Preferences saved in this browser. Preview only — no lessons or calendars changed.");
 render();
});
studentEl.addEventListener("change",()=>{fill();message("");render()});
viewEl.addEventListener("change",()=>{
 const all=viewEl.value==="all";
 studentEl.closest("label").classList.toggle("he-opt-field-dimmed",all);
 render();
});
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

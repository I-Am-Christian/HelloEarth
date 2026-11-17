/* Accessible, dependency-free date selection for Google Calendar scheduling.
   All dates use the browser's local timezone; availability is supplied live
   by dashboard-navigation.js, not fabricated by this UI. */
(() => {
 const root=document.getElementById("schedule-form");
 if(!root)return;
 const get=id=>document.getElementById(id);
 const z=value=>String(value).padStart(2,"0");
 const localDate=date=>date.getFullYear()+"-"+z(date.getMonth()+1)+"-"+z(date.getDate());
 const parseDate=value=>{
  const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(value||"");
  if(!match)return null;
  const date=new Date(Number(match[1]),Number(match[2])-1,Number(match[3]));
  return localDate(date)===value?date:null;
 };
 const advance=(date,days)=>{const d=new Date(date);d.setDate(d.getDate()+days);return d};
 const startDay=date=>new Date(date.getFullYear(),date.getMonth(),date.getDate());
 const escape=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const fmt=(date,opts)=>date.toLocaleDateString(document.documentElement.lang||undefined,opts);
 let mode="lesson",month=startDay(new Date()),target="start",monthEvents=[],monthComplete=false;
 let changed=()=>{},monthChanged=()=>{},existingTitle="English lesson";
 const kind=()=>mode;
 const allDay=()=>mode==="timeoff"&&get("schedule-all-day").checked;
 const selectedStart=()=>parseDate(get("schedule-date").value);
 const selectedEnd=()=>parseDate(get("schedule-date-end").value);
 function fromTime(date,time){
  if(!date||!/^\d{2}:\d{2}$/.test(time||""))return null;
  const [hour,minute]=time.split(":").map(Number);
  if(hour>23||minute>59)return null;
  return new Date(date.getFullYear(),date.getMonth(),date.getDate(),hour,minute);
 }
 function range(){
  const date=selectedStart();
  if(!date)return {valid:false,error:"Choose a valid start date."};
  if(mode==="timeoff"&&allDay()){
   const endDate=selectedEnd();
   if(!endDate||endDate<date)return {valid:false,error:"The final day of your time off must be on or after the first day."};
   const final=advance(endDate,1);
   if((final-date)/86400000>90)return {valid:false,error:"Select up to 90 days of time off at once."};
   return {valid:true,mode,start:date,end:final,allDay:true,firstDate:localDate(date),lastDate:localDate(endDate),
    allDayStart:localDate(date),allDayEnd:localDate(final),
    label:fmt(date,{weekday:"short",day:"numeric",month:"short",year:"numeric"})+
      (localDate(date)!==localDate(endDate)?" – "+fmt(endDate,{weekday:"short",day:"numeric",month:"short",year:"numeric"}):"")+" · All day"};
  }
  const start=fromTime(date,get("schedule-time-start").value);
  if(!start)return {valid:false,error:"Choose a valid starting time."};
  let end;
  if(mode==="lesson"){
   const minutes=Number(get("schedule-duration").value);
   if(!Number.isFinite(minutes)||minutes<15||minutes>480)return {valid:false,error:"Choose a lesson length of 15 minutes to 8 hours."};
   end=new Date(start.getTime()+minutes*60000);
  }else{
   end=fromTime(date,get("schedule-time-end").value);
  }
  if(!end||end<=start)return {valid:false,error:"Your end time must be later than your start time."};
  if(end-start>(mode==="lesson"?8:12)*3600000)return {valid:false,error:"Choose a shorter time period."};
  return {valid:true,mode,start,end,allDay:false,firstDate:localDate(date),lastDate:localDate(date),
   label:fmt(date,{weekday:"short",day:"numeric",month:"short",year:"numeric"})+" · "+
   start.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})+" – "+
   end.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})};
 }
 function updatePreview(){
  const value=range();
  const preview=get("schedule-preview");
  preview.textContent=value.valid?value.label:value.error;
  preview.classList.toggle("invalid",!value.valid);
  return value;
 }
 function displayMonth(){
  get("schedule-month-label").textContent=fmt(month,{month:"long",year:"numeric"});
  const root=get("schedule-month-days");
  root.replaceChildren();
  const first=new Date(month.getFullYear(),month.getMonth(),1);
  const offset=(first.getDay()+6)%7;
  for(let i=0;i<offset;i++){
   const blank=document.createElement("span");blank.className="ws-schedule-month-pad";root.append(blank);
  }
  const numberOfDays=new Date(month.getFullYear(),month.getMonth()+1,0).getDate();
  const from=selectedStart(),end=selectedEnd();
  for(let day=1;day<=numberOfDays;day++){
   const date=new Date(month.getFullYear(),month.getMonth(),day);
   const key=localDate(date);
   const button=document.createElement("button");
   button.type="button";button.className="ws-schedule-date-button";
   button.dataset.scheduleDay=key;
   const dayEnd=advance(date,1);
   const busyCount=monthEvents.filter(e=>{
    if(e.transparency==="transparent"||e.status==="cancelled")return false;
    // All-day Google Calendar dates are calendar-local, not UTC instants.
    // Parsing YYYY-MM-DD via new Date(string) can shift booked-day markers.
    const start=e.start?.date?parseDate(e.start.date):new Date(e.start?.dateTime||"");
    const finish=e.end?.date?parseDate(e.end.date):new Date(e.end?.dateTime||"");
    return Number.isFinite(start.getTime())&&Number.isFinite(finish.getTime())&&start<dayEnd&&finish>date;
   }).length;
   if(busyCount){button.classList.add("has-booking");const dot=document.createElement("i");dot.className="ws-schedule-busy-dot";dot.setAttribute("aria-hidden","true");button.append(dot)}
   const span=document.createElement("span");span.textContent=day;button.append(span);
   if(from&&key===localDate(from))button.classList.add("is-start");
   if(mode==="timeoff"&&allDay()&&end&&key===localDate(end))button.classList.add("is-end");
   if(mode==="timeoff"&&allDay()&&from&&end&&date>=from&&date<=end)button.classList.add("is-in-range");
   if(key===localDate(new Date()))button.classList.add("is-today");
   const label=fmt(date,{weekday:"long",day:"numeric",month:"long",year:"numeric"});
   button.setAttribute("aria-label",label+(busyCount?", "+busyCount+" calendar event"+(busyCount>1?"s":""):""));
   button.setAttribute("aria-pressed",String(from&&key===localDate(from)||(mode==="timeoff"&&allDay()&&end&&key===localDate(end))));
   root.append(button);
  }
 }
 function pickDate(key){
  const date=parseDate(key);if(!date)return;
  if(mode==="timeoff"&&allDay()&&target==="end"){
   if(selectedStart()&&date<selectedStart()){get("schedule-date").value=key;get("schedule-date-end").value=key}
   else get("schedule-date-end").value=key;
  }else{
   get("schedule-date").value=key;
   if(!selectedEnd()||selectedEnd()<date)get("schedule-date-end").value=key;
   if(mode==="timeoff"&&allDay())target="end";
  }
  updateTarget();displayMonth();fireChange();
 }
 function updateTarget(){
  for(const which of ["start","end"]){
   const button=get("schedule-pick-"+which);
   const active=target===which;
   button.classList.toggle("is-selected",active);
   button.setAttribute("aria-pressed",String(active));
  }
 }
 function applyMode(which,resetTitle){
  mode=which==="timeoff"?"timeoff":"lesson";
  get("schedule-kind-lesson").classList.toggle("active",mode==="lesson");
  get("schedule-kind-timeoff").classList.toggle("active",mode==="timeoff");
  get("schedule-kind-lesson").setAttribute("aria-pressed",String(mode==="lesson"));
  get("schedule-kind-timeoff").setAttribute("aria-pressed",String(mode==="timeoff"));
  const off=mode==="timeoff",full=off&&allDay();
  get("schedule-timeoff-options").hidden=!off;
  get("schedule-date-end-row").hidden=!full;
  get("schedule-pick-end").hidden=!full;
  get("schedule-student-row").hidden=off;
  get("schedule-student").disabled=off;
  get("schedule-time-start-row").hidden=full;
  get("schedule-time-start").disabled=full;
  get("schedule-duration-row").hidden=off;
  get("schedule-duration").disabled=off;
  get("schedule-time-end-row").hidden=!off||full;
  get("schedule-time-end").disabled=!off||full;
  get("schedule-date-end").disabled=!full;
  get("schedule-submit").textContent=off?"Add time off to Google Calendar":"Add lesson to Google Calendar";
  if(resetTitle&&(existingTitle===""||["English lesson","Time off"].includes(get("schedule-title").value.trim())))
   get("schedule-title").value=off?"Time off":"English lesson";
  if(!full)target="start";
  updateTarget();displayMonth();updatePreview();
 }
 function fireChange(){
  get("schedule-override").checked=false;
  updatePreview();
  changed();
  document.dispatchEvent(new CustomEvent("helloearth:schedule-changed"));
 }
 function setMonthData(events,complete,message){
  monthEvents=Array.isArray(events)?events:[];
  monthComplete=Boolean(complete);
  const note=get("schedule-month-status");
  const busy=monthEvents.filter(e=>e.transparency!=="transparent"&&e.status!=="cancelled").length;
  note.textContent=message||((complete?"● ":"◌ ")+busy+" event"+(busy===1?"":"s")+" on this month’s connected calendars"+(complete?".":". Some calendars could not be checked."));
  note.classList.toggle("has-warning",!complete);
  displayMonth();
 }
 function getMonthWindow(){
  const from=new Date(month.getFullYear(),month.getMonth(),1);
  const until=new Date(month.getFullYear(),month.getMonth()+1,1);
  return {from,until,key:localDate(from)};
 }
 function setAvailability(info={}){
  const root=get("schedule-availability");
  const status=info.status||"loading";
  root.className="field full ws-schedule-availability is-"+status;
  root.replaceChildren();
  const heading=document.createElement("strong");heading.textContent=info.title||"Checking Google Calendar…";root.append(heading);
  if(info.description){
   const message=document.createElement("p");message.textContent=info.description;root.append(message);
  }
  const events=Array.isArray(info.events)?info.events:[];
  if(events.length){
   const list=document.createElement("ul");list.className="ws-schedule-conflicts";
   for(const e of events.slice(0,6)){
    const li=document.createElement("li");
    if(e.overlap)li.className="is-overlap";
    const icon=document.createElement("span");icon.textContent=e.overlap?"⚠":"•";icon.setAttribute("aria-hidden","true");
    const content=document.createElement("span");
    const title=document.createElement("strong");title.textContent=e.title||"Busy";
    const subtitle=document.createElement("small");subtitle.textContent=e.label||"";
    content.append(title,subtitle);li.append(icon,content);list.append(li);
   }
   root.append(list);
   if(events.length>6){const p=document.createElement("p");p.textContent="Plus "+(events.length-6)+" more bookings.";root.append(p)}
  }
  const needsOverride=status==="conflict"||status==="unverified";
  get("schedule-override-row").hidden=!needsOverride;
 }
 function reset(date){
  const start=date instanceof Date&&!Number.isNaN(date.getTime())?new Date(date):new Date();
  const day=localDate(start);
  get("schedule-date").value=day;
  get("schedule-date-end").value=day;
  get("schedule-time-start").value=z(start.getHours())+":"+z(start.getMinutes());
  get("schedule-time-end").value=z(Math.min(23,start.getHours()+1))+":"+z(start.getMinutes());
  get("schedule-duration").value="50";
  get("schedule-all-day").checked=true;
  get("schedule-override").checked=false;
  month=new Date(start.getFullYear(),start.getMonth(),1);
  monthEvents=[];monthComplete=false;target="start";
  applyMode("lesson",true);
  setMonthData([],false,"Loading bookings for this month…");
  setAvailability({status:"loading",title:"Checking your connected calendars…"});
  monthChanged();
  changed();
 }
 get("schedule-month-prev").addEventListener("click",()=>{
  month=new Date(month.getFullYear(),month.getMonth()-1,1);
  setMonthData([],false,"Loading bookings for this month…");monthChanged();
 });
 get("schedule-month-next").addEventListener("click",()=>{
  month=new Date(month.getFullYear(),month.getMonth()+1,1);
  setMonthData([],false,"Loading bookings for this month…");monthChanged();
 });
 get("schedule-month-days").addEventListener("click",event=>{
  const button=event.target.closest("[data-schedule-day]");
  if(button)pickDate(button.dataset.scheduleDay);
 });
 for(const which of ["start","end"])get("schedule-pick-"+which).addEventListener("click",()=>{
  target=which;updateTarget();
 });
 for(const button of document.querySelectorAll("[data-schedule-mode]"))button.addEventListener("click",()=>{
  applyMode(button.dataset.scheduleMode,true);fireChange();
 });
 get("schedule-all-day").addEventListener("change",()=>{applyMode(mode,false);fireChange()});
 for(const id of ["schedule-date","schedule-date-end","schedule-time-start","schedule-time-end","schedule-duration"]){
  get(id).addEventListener("change",()=>{
   if(id==="schedule-date"||id==="schedule-date-end"){
    const d=parseDate(get(id).value);
    if(d){
     if(id==="schedule-date"&&(!selectedEnd()||selectedEnd()<d))get("schedule-date-end").value=localDate(d);
     if(id==="schedule-date-end"&&selectedStart()&&d<selectedStart())get("schedule-date").value=localDate(d);
     month=new Date(d.getFullYear(),d.getMonth(),1);
     setMonthData([],false,"Loading bookings for this month…");monthChanged();
    }
   }
   displayMonth();fireChange();
  });
 }
 get("schedule-calendar").addEventListener("change",fireChange);
 get("schedule-student").addEventListener("change",fireChange);
 get("schedule-title").addEventListener("input",()=>{existingTitle=get("schedule-title").value});
 window.HelloEarthSchedulingUI={
  reset,range,getMonthWindow,setMonthData,setAvailability,kind,
  onChange:callback=>{changed=callback},
  onMonthChange:callback=>{monthChanged=callback},
  getSelectedDates:()=>({start:selectedStart(),end:selectedEnd()}),
  isMonthComplete:()=>monthComplete,
  getMonthEvents:()=>monthEvents.slice(),
  localDate
 };
})();

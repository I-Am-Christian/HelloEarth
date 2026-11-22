/* HelloEarth full interactive week calendar.
   Live event data comes only from the existing authenticated Google Calendar controller.
   The legacy date/agenda controls remain mounted invisibly for existing integrations. */
const heGet=id=>document.getElementById(id);
const heCalendarSection=heGet("calendar-view");
if(heCalendarSection){
 const main=document.createElement("div");
 main.className="he-week-shell";
 main.innerHTML='<aside class="he-week-sidebar" aria-label="Calendar actions">'
  +'<button type="button" class="he-week-primary" id="he-week-schedule">Schedule lesson</button>'
  +'<button type="button" class="he-week-secondary" id="he-week-timeoff">Add time off</button>'
  +'<button type="button" class="he-week-secondary" id="he-week-optimize">Set up availability</button>'
  +'<div class="he-week-legend"><h3>Calendar colours</h3>'
  +'<p><i class="he-legend-dot he-lesson-dot"></i>One-time appointment</p>'
  +'<p><i class="he-legend-dot he-recurring-dot"></i>Recurring appointment</p>'
  +'<p><i class="he-legend-dot he-timeoff-dot"></i>Time off / out of office</p>'
  +'<p><i class="he-legend-dot he-all-day-dot"></i>All-day event</p></div>'
  +'<p class="he-week-sidebar-note">Choose a lesson to reschedule it, or click an open time slot to schedule.</p></aside>'
  +'<div class="he-week-main">'
  +'<div class="he-week-toolbar"><div class="he-week-nav">'
  +'<button type="button" id="he-week-prev" aria-label="Previous week">‹</button>'
  +'<button type="button" id="he-week-next" aria-label="Next week">›</button>'
  +'<strong id="he-week-range" aria-live="polite">This week</strong></div>'
  +'<div class="he-week-modes"><button type="button" id="he-week-today">Today</button>'
  +'<button type="button" id="he-week-mode" class="he-mode-active" aria-pressed="true">Week</button>'
  +'<button type="button" id="he-week-agenda" aria-pressed="false">Agenda</button></div></div>'
  +'<div class="he-week-connection"><div class="he-week-connection-main">'
  +'<span class="he-week-connection-dot" id="he-week-connection-dot" aria-hidden="true"></span>'
  +'<div><strong id="he-week-connection-name">Google Calendar</strong>'
  +'<small id="he-week-connection-detail">Checking connection…</small></div></div>'
  +'<div class="he-week-connection-actions">'
  +'<button type="button" id="he-week-connect">Connect calendar</button>'
  +'<button type="button" id="he-week-refresh" hidden>Refresh</button>'
  +'<button type="button" id="he-week-authorize" hidden>Allow changes</button>'
  +'<button type="button" id="he-week-manage">Settings</button></div></div>'
  +'<p class="he-week-status" id="he-week-status" role="status" aria-live="polite">Loading your weekly timetable…</p>'
  +'<div id="he-week-scroll" class="he-week-scroll" tabindex="0" aria-label="Weekly appointment timetable">'
  +'<div class="he-week-grid" id="he-week-grid" role="group" aria-label="Calendar grid"></div></div>'
  +'<div id="he-week-agenda-list" class="he-week-agenda-list" hidden></div>'
  +'</div></div>';
 heCalendarSection.insertBefore(main,heCalendarSection.firstChild);

 // All existing controls remain available to the original Google Calendar and
 // scheduling modules, but their separate date picker is not the main UI.
 const engine=document.createElement("div");
 engine.className="he-calendar-engine";
 engine.hidden=true;
 const advanced=document.createElement("details");
 advanced.className="he-calendar-advanced";
 advanced.innerHTML='<summary>Advanced calendar settings, notifications and day details</summary>';
 const weekCard=heCalendarSection.querySelector(".ws-calendar-card");
 const agendaCard=heCalendarSection.querySelector(".ws-agenda-card");
 const scheduleActions=heCalendarSection.querySelector(".ws-scheduling-actions");
 if(weekCard)engine.append(weekCard);
 if(agendaCard)engine.append(agendaCard);
 if(scheduleActions)engine.append(scheduleActions);
 heCalendarSection.append(engine);
 for(const selector of [".ws-calendar-intro",".ws-calendar-connection",".he-notice-card","#he-optimize-calendar"]){
  const el=heCalendarSection.querySelector(selector);
  if(el)advanced.append(el);
 }
 heCalendarSection.append(advanced);
 const calendarSources=heCalendarSection.querySelector("#calendar-source-row");
 if(calendarSources)main.querySelector(".he-week-main").insertBefore(calendarSources,heGet("he-week-status"));

 const startHour=6, endHour=24, hourHeight=96, rowsHeight=(endHour-startHour)*hourHeight;
 const toDay=date=>new Date(date.getFullYear(),date.getMonth(),date.getDate());
 function monday(date){const d=toDay(date);d.setDate(d.getDate()-(d.getDay()+6)%7);return d}
 let events=[],connected=false,canWrite=false,mode="week",weekStart=monday(new Date());
 let scrollKey="",dragged=null,scrollOnNextRender=true;
 function dateField(field){
  if(field?.dateTime)return new Date(field.dateTime);
  if(field?.date){const a=field.date.split("-").map(Number);return new Date(a[0],a[1]-1,a[2])}
  return new Date(NaN);
 }
 function dayKey(d){return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-")}
 function timeKey(d){return String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0")}
 function clock(d){return window.HelloEarthTime?.formatTime(d)||d.toLocaleTimeString(undefined,{hour:"2-digit",minute:"2-digit",hour12:false})}
 function textNode(tag,cls,content){const node=document.createElement(tag);if(cls)node.className=cls;if(content!==undefined)node.textContent=content;return node}
 function isAllDay(e){return Boolean(e.start?.date)}
 function eventType(e){
  if(isAllDay(e))return "all-day";
  if(e.eventType==="outOfOffice"||e.transparency==="transparent"||e.extendedProperties?.private?.helloearth_type==="timeoff")return "timeoff";
  if(e.recurringEventId)return "recurring";
  return "lesson";
 }
 function formatRange(start,end,allday=false){
  return allday?"All day":clock(start)+" – "+clock(end);
 }
 function calendarDays(){
  const buttons=Array.from(document.querySelectorAll("#calendar-days .ws-day[data-day]"));
  if(buttons.length)return monday(new Date(buttons[0].dataset.day+"T12:00:00"));
  return null;
 }
 function syncWeek(){const day=calendarDays();if(day)weekStart=day}
 function statusConnection(){
  const label=heGet("calendar-account-email")?.textContent?.trim()||"";
  const detail=heGet("calendar-sync-status")?.textContent?.trim()||"";
  const active=Boolean(connected||heGet("calendar-connection-indicator")?.classList.contains("is-connected"));
  heGet("he-week-connection-name").textContent=active?(label&&label!=="Not connected"?label:"Google Calendar connected"):"Google Calendar";
  heGet("he-week-connection-detail").textContent=detail||(active?"Calendar connected":"Connect to display real events");
  heGet("he-week-connection-dot").classList.toggle("connected",active);
  heGet("he-week-connect").hidden=active;
  heGet("he-week-connect").textContent=label&&label!=="Not connected"?"Reconnect":"Connect calendar";
  heGet("he-week-refresh").hidden=!active;
  heGet("he-week-authorize").hidden=!active||canWrite;
 }
 function openSchedule(date,hour=startHour,minute=0){
  const when=new Date(date.getFullYear(),date.getMonth(),date.getDate(),hour,minute);
  document.dispatchEvent(new CustomEvent("helloearth:calendar-slot-select",{detail:{when:when.toISOString()}}));
 }
 function editEvent(event,presetDate=null,presetTime=null){
  if(!event.id||!event.calendarId)return;
  document.dispatchEvent(new CustomEvent("helloearth:calendar-edit-request",{detail:{
   id:event.id,calendarId:event.calendarId,summary:event.summary,
   start:event.start,end:event.end,targetDate:presetDate,targetTime:presetTime
  }}));
 }
 function displayWeek(){
  const last=new Date(weekStart);last.setDate(last.getDate()+6);
  const firstLabel=weekStart.toLocaleDateString(undefined,{month:"short",day:"numeric"});
  const lastLabel=last.toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"});
  heGet("he-week-range").textContent=firstLabel+" – "+lastLabel;
 }
 function makeEventButton(event,start,end,compact=false){
  const type=eventType(event);
  const button=textNode("button","he-week-event he-week-"+type);
  button.type="button";button.title=(event.summary||"Busy")+" · "+formatRange(start,end,isAllDay(event))+" · Click to reschedule";
  button.setAttribute("aria-label",button.title);
  const when=textNode("small","he-event-when",formatRange(start,end,isAllDay(event)));
  const title=textNode("strong","he-event-title",event.summary||"Busy");
  button.append(when,title);
  if(event.recurringEventId){button.append(textNode("span","he-recurring-mark","↻"))}
  button.addEventListener("click",e=>{e.stopPropagation();editEvent(event)});
  if(!compact){
   button.draggable=true;
   button.addEventListener("dragstart",e=>{
    dragged=event;
    e.dataTransfer?.setData("text/plain","helloearth-calendar");
    if(e.dataTransfer)e.dataTransfer.effectAllowed="move";
    button.classList.add("is-dragging");
   });
   button.addEventListener("dragend",()=>{dragged=null;button.classList.remove("is-dragging")});
  }
  return button;
 }
 function renderAgenda(){
  const root=heGet("he-week-agenda-list");root.replaceChildren();
  const until=new Date(weekStart);until.setDate(until.getDate()+7);
  const visible=events.filter(e=>dateField(e.start)<until&&dateField(e.end)>weekStart)
    .sort((a,b)=>dateField(a.start)-dateField(b.start));
  if(!visible.length){
   const p=textNode("p","he-week-agenda-empty",connected?"No appointments during this week.":"Connect your Google Calendar to see appointments.");
   root.append(p);return;
  }
  for(let i=0;i<7;i++){
   const date=new Date(weekStart);date.setDate(date.getDate()+i);
   const next=new Date(date);next.setDate(next.getDate()+1);
   const list=visible.filter(e=>dateField(e.start)<next&&dateField(e.end)>date);
   if(!list.length)continue;
   const group=textNode("section","he-week-agenda-day");
   group.append(textNode("h3","",date.toLocaleDateString(undefined,{weekday:"long",month:"short",day:"numeric"})));
   list.forEach(e=>{
    const start=dateField(e.start),end=dateField(e.end);
    const row=makeEventButton(e,start,end,true);row.classList.add("he-agenda-event");
    group.append(row);
   });
   root.append(group);
  }
 }
 function placeGroupedEvents(day,entries){
  entries.sort((a,b)=>a.begin-b.begin||b.finish-a.finish);
  const groups=[];let current=[],clusterEnd=-1;
  const push=()=>{if(current.length)groups.push(current);current=[];clusterEnd=-1};
  for(const e of entries){
   if(current.length&&e.begin>=clusterEnd)push();
   current.push(e);clusterEnd=Math.max(clusterEnd,e.finish);
  }
  push();
  for(const group of groups){
   const slotEnds=[];
   group.forEach(e=>{
    let slot=slotEnds.findIndex(t=>t<=e.begin);
    if(slot===-1){slot=slotEnds.length;slotEnds.push(e.finish)}else slotEnds[slot]=e.finish;
    e.slot=slot;
   });
   const count=slotEnds.length;
   group.forEach(e=>{
    const b=makeEventButton(e.event,e.start,e.end);
    b.style.top=(Math.max(0,e.begin)*hourHeight/60+2)+"px";
    const eventHeight=Math.max(14,(e.finish-e.begin)*hourHeight/60-4);
    b.style.height=eventHeight+"px";
    if(eventHeight<37)b.classList.add("he-week-compact");
    b.style.left="calc("+(e.slot*100/count)+"% + 3px)";
    b.style.width="calc("+(100/count)+"% - 6px)";
    day.append(b);
   });
  }
 }
 function renderGrid(){
  displayWeek();
  const grid=heGet("he-week-grid");grid.replaceChildren();
  const corner=textNode("div","he-week-corner","GMT "+(-new Date().getTimezoneOffset()/60>=0?"+":"")+(-new Date().getTimezoneOffset()/60));
  grid.append(corner);
  const days=[];
  for(let i=0;i<7;i++){
   const d=new Date(weekStart);d.setDate(d.getDate()+i);days.push(d);
   const header=textNode("button","he-week-day",d.toLocaleDateString(undefined,{weekday:"short",day:"numeric"}));
   header.type="button";header.setAttribute("aria-label","Schedule on "+d.toLocaleDateString(undefined,{dateStyle:"full"}));
   if(dayKey(d)===dayKey(new Date()))header.classList.add("he-week-current");
   header.addEventListener("click",()=>openSchedule(d,Math.max(9,new Date().getHours()),0));
   grid.append(header);
  }
  grid.append(textNode("div","he-week-allday-label","All day"));
  days.forEach(date=>{
   const next=new Date(date);next.setDate(next.getDate()+1);
   const row=textNode("div","he-week-allday-cell");
   events.filter(e=>isAllDay(e)&&dateField(e.start)<next&&dateField(e.end)>date)
    .forEach(e=>row.append(makeEventButton(e,dateField(e.start),dateField(e.end),true)));
   grid.append(row);
  });
  const axis=textNode("div","he-week-axis");
  axis.style.height=rowsHeight+"px";
  for(let h=startHour;h<=endHour;h++){
   const hour=textNode("span","he-hour-label",clock(new Date(2026,0,1,h,0)));
   hour.style.top=((h-startHour)*hourHeight)+"px";axis.append(hour);
  }
  grid.append(axis);
  let shown=0;
  days.forEach(date=>{
   const next=new Date(date);next.setDate(next.getDate()+1);
   const day=textNode("div","he-week-column");
   day.style.height=rowsHeight+"px";
   day.style.setProperty("--he-hour-height",hourHeight+"px");
   day.setAttribute("aria-label","Appointments "+date.toLocaleDateString(undefined,{dateStyle:"full"}));
   day.title="Click an empty slot to schedule, or drag an appointment here to reschedule";
   const minutesForY=y=>Math.max(0,Math.min(rowsHeight-1,y))*60/hourHeight+startHour*60;
   const slotAt=(clientY)=>{
    const r=day.getBoundingClientRect();
    const total=Math.max(startHour*60,Math.min(endHour*60-15,Math.round(minutesForY(clientY-r.top)/15)*15));
    return {hour:Math.floor(total/60),minute:total%60};
   };
   day.addEventListener("click",e=>{
    if(e.target.closest(".he-week-event"))return;
    const slot=slotAt(e.clientY);openSchedule(date,slot.hour,slot.minute);
   });
   day.addEventListener("dragover",e=>{
    if(!dragged)return;
    e.preventDefault();if(e.dataTransfer)e.dataTransfer.dropEffect="move";
    day.classList.add("he-week-drop-target");
   });
   day.addEventListener("dragleave",e=>{if(!day.contains(e.relatedTarget))day.classList.remove("he-week-drop-target")});
   day.addEventListener("drop",e=>{
    if(!dragged)return;
    e.preventDefault();day.classList.remove("he-week-drop-target");
    const slot=slotAt(e.clientY),event=dragged;dragged=null;
    editEvent(event,dayKey(date),String(slot.hour).padStart(2,"0")+":"+String(slot.minute).padStart(2,"0"));
   });
   const entries=[];
   for(const event of events){
    const start=dateField(event.start),end=dateField(event.end);
    if(isAllDay(event)||!(start<next&&end>date))continue;
    const begin=Math.max(0,(Math.max(start.getTime(),date.getTime())-date.getTime())/60000-startHour*60);
    const finish=Math.min(rowsHeight*60/hourHeight,(Math.min(end.getTime(),next.getTime())-date.getTime())/60000-startHour*60);
    if(finish<=begin)continue;
    entries.push({event,start,end,begin,finish});shown++;
   }
   placeGroupedEvents(day,entries);
   if(dayKey(date)===dayKey(new Date())){
    const now=new Date();
    const offset=now.getHours()*60+now.getMinutes()-startHour*60;
    if(offset>=0&&offset<rowsHeight*60/hourHeight){
     const line=textNode("div","he-week-now-line");
     line.style.top=offset*hourHeight/60+"px";
     const badge=textNode("span","he-week-now-badge","Now");line.append(badge);
     day.append(line);
    }
   }
   grid.append(day);
  });
  const allDayCount=events.filter(e=>isAllDay(e)).length;
  heGet("he-week-status").textContent=connected
   ?shown+" timed appointment"+(shown===1?"":"s")+(allDayCount?" · "+allDayCount+" all-day event"+(allDayCount===1?"":"s"):"")+" · Click a lesson to edit or an empty slot to schedule"
   :"Connect Google Calendar to see your actual appointments in the week grid.";
 }
 function scrollToSchedule(force=false){
  if(mode!=="week")return;
  const area=heGet("he-week-scroll");
  const key=dayKey(weekStart);
  if(!force&&scrollKey===key)return;
  scrollKey=key;
  const now=new Date(),weekEnd=new Date(weekStart);weekEnd.setDate(weekEnd.getDate()+7);
  const within=now>=weekStart&&now<weekEnd;
  const candidates=events.filter(e=>e.start?.dateTime&&dateField(e.end)>now&&dateField(e.start)<weekEnd)
   .sort((a,b)=>dateField(a.start)-dateField(b.start));
  const earliest=events.filter(e=>e.start?.dateTime).map(e=>dateField(e.start).getHours());
  const hour=within ? (candidates.length?Math.min(now.getHours(),dateField(candidates[0].start).getHours()):now.getHours())
   : (earliest.length?Math.min(...earliest):10);
  area.scrollTop=Math.max(0,(Math.min(endHour-3,Math.max(startHour,hour-1))-startHour)*hourHeight);
 }
 function render(){
  renderGrid();renderAgenda();
  heGet("he-week-scroll").hidden=mode!=="week";
  heGet("he-week-agenda-list").hidden=mode!=="agenda";
  heGet("he-week-mode").setAttribute("aria-pressed",String(mode==="week"));
  heGet("he-week-agenda").setAttribute("aria-pressed",String(mode==="agenda"));
  heGet("he-week-mode").classList.toggle("he-mode-active",mode==="week");
  heGet("he-week-agenda").classList.toggle("he-mode-active",mode==="agenda");
  statusConnection();scrollToSchedule(scrollOnNextRender);
  scrollOnNextRender=false;
 }
 function moveWeek(direction){
  heGet(direction<0?"calendar-prev":"calendar-next")?.click();
  syncWeek();scrollOnNextRender=true;render();
 }
 heGet("he-week-prev").addEventListener("click",()=>moveWeek(-1));
 heGet("he-week-next").addEventListener("click",()=>moveWeek(1));
 heGet("he-week-today").addEventListener("click",()=>{heGet("calendar-today")?.click();syncWeek();scrollOnNextRender=true;render()});
 heGet("he-week-mode").addEventListener("click",()=>{mode="week";render()});
 heGet("he-week-agenda").addEventListener("click",()=>{mode="agenda";render()});
 heGet("he-week-schedule").addEventListener("click",()=>heGet("calendar-schedule")?.click());
 heGet("he-week-timeoff").addEventListener("click",()=>{heGet("calendar-schedule")?.click();heGet("schedule-kind-timeoff")?.click()});
 heGet("he-week-optimize").addEventListener("click",()=>{advanced.open=true;heGet("he-optimize-calendar")?.scrollIntoView({behavior:"smooth",block:"start"})});
 heGet("he-week-manage").addEventListener("click",()=>{advanced.open=true;advanced.scrollIntoView({behavior:"smooth",block:"start"})});
 heGet("he-week-connect").addEventListener("click",()=>document.dispatchEvent(new CustomEvent("helloearth:calendar-connect-request")));
 heGet("he-week-refresh").addEventListener("click",()=>document.dispatchEvent(new CustomEvent("helloearth:calendar-refresh-request")));
 heGet("he-week-authorize").addEventListener("click",()=>heGet("calendar-request-write")?.click());
 document.addEventListener("helloearth:calendar-connection-status",statusConnection);
 const legacyStatus=heGet("calendar-sync-status");
 if(legacyStatus && typeof MutationObserver!=="undefined")new MutationObserver(statusConnection).observe(legacyStatus,{subtree:true,childList:true,characterData:true});
 document.addEventListener("helloearth:calendar-events",e=>{
  connected=Boolean(e.detail?.connected);
  canWrite=Boolean(e.detail?.canWrite);
  events=Array.isArray(e.detail?.events)?e.detail.events:[];
  if(e.detail?.windowStart)weekStart=monday(new Date(e.detail.windowStart));
  scrollOnNextRender=true;render();
 });
 document.addEventListener("helloearth:calendar-disconnected",()=>{
  connected=false;canWrite=false;events=[];render();
 });
 document.addEventListener("helloearth:view-changed",e=>{
  if(e.detail?.view==="calendar"){syncWeek();render()}
 });
 document.addEventListener("helloearth:time-format-changed",render);
 document.addEventListener("helloearth:languagechanged",render);
 // The calendar displays time that changes even without navigation.
 window.setInterval(()=>{if(!heCalendarSection.hidden)render()},60000);
 render();
}

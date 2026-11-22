/* HelloEarth weekly timetable. A read-only presentation of the authenticated
   Google Calendar events that dashboard-navigation.js already fetches. */
const $=id=>document.getElementById(id);
const section=$("calendar-view");
if(section){
 const shell=document.createElement("div");shell.className="he-week-shell";
 shell.innerHTML=`<aside class="he-week-sidebar">
  <button type="button" class="he-week-primary" id="he-week-schedule">Schedule lesson</button>
  <button type="button" class="he-week-secondary" id="he-week-timeoff">Add time off</button>
  <button type="button" class="he-week-secondary" id="he-week-optimize">Optimize availability</button>
  <div class="he-week-legend"><h3>Calendar colours</h3>
   <p><i class="he-legend-dot he-lesson-dot"></i> Lesson / appointment</p>
   <p><i class="he-legend-dot he-other-dot"></i> Other calendar event</p>
   <p><i class="he-legend-dot he-all-day-dot"></i> All-day event</p>
  </div><p class="he-week-sidebar-note">Events are read directly from your connected Google Calendar.</p>
 </aside>
 <div class="he-week-main">
  <div class="he-week-toolbar">
   <div class="he-week-nav"><button type="button" id="he-week-prev" aria-label="Previous week">‹</button><button type="button" id="he-week-next" aria-label="Next week">›</button>
    <strong id="he-week-range">This week</strong></div>
   <div class="he-week-modes"><button type="button" id="he-week-pick-date" aria-expanded="false" aria-controls="he-week-date-picker">Choose date</button><button type="button" id="he-week-today">Today</button><button type="button" class="he-mode-active" id="he-week-mode">Week</button><button type="button" id="he-week-agenda">Agenda</button></div>
  </div>
  <div class="he-week-date-picker" id="he-week-date-picker" hidden></div>
  <div id="he-week-status" class="he-week-status" role="status" aria-live="polite">Connect Google Calendar to display your weekly timetable.</div>
  <div class="he-week-scroll" id="he-week-scroll" tabindex="0" aria-label="Weekly appointment timetable">
   <div class="he-week-grid" id="he-week-grid"></div>
  </div>
 </div></div>`;
 const reschedule=document.createElement("div");
 reschedule.className="he-reschedule-overlay";
 reschedule.hidden=true;
 reschedule.innerHTML='<div class="he-reschedule-dialog" role="dialog" aria-modal="true" aria-labelledby="he-reschedule-heading"><div class="he-reschedule-top"><h2 id="he-reschedule-heading">Reschedule appointment</h2><button type="button" id="he-reschedule-close" aria-label="Close">×</button></div><p id="he-reschedule-name"></p><form id="he-reschedule-form"><label for="he-reschedule-date">Choose a new date</label><input id="he-reschedule-date" type="date" required><p class="he-reschedule-help">The appointment keeps its original time and duration. You will confirm before Google Calendar is changed.</p><div class="he-reschedule-actions"><button type="button" id="he-reschedule-cancel">Cancel</button><button type="submit">Review change</button></div></form></div>';
 section.append(reschedule);
 let selectedEvent=null,previousFocus=null;
 const closeReschedule=()=>{
  reschedule.hidden=true;
  selectedEvent=null;
  previousFocus?.focus?.();
 };
 const openReschedule=event=>{
  selectedEvent=event;previousFocus=document.activeElement;
  $("he-reschedule-name").textContent=event.summary||"Untitled appointment";
  $("he-reschedule-date").value=dayKey(dateOf(event.start));
  reschedule.hidden=false;$("he-reschedule-date").focus();
 };
 $("he-reschedule-close").addEventListener("click",closeReschedule);
 $("he-reschedule-cancel").addEventListener("click",closeReschedule);
 reschedule.addEventListener("click",e=>{if(e.target===reschedule)closeReschedule()});
 reschedule.addEventListener("keydown",e=>{
  if(e.key==="Escape"){e.preventDefault();closeReschedule()}
  if(e.key==="Tab"){
   const focusable=Array.from(reschedule.querySelectorAll("button,input")).filter(el=>!el.disabled);
   const first=focusable[0],last=focusable[focusable.length-1];
   if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
   else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
  }
 });
 $("he-reschedule-form").addEventListener("submit",e=>{
  e.preventDefault();
  if(!selectedEvent)return;
  const date=$("he-reschedule-date").value;
  if(!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date))return;
  const chosen=selectedEvent;
  closeReschedule();
  document.dispatchEvent(new CustomEvent("helloearth:calendar-reschedule",{
   detail:{id:chosen.id,calendarId:chosen.calendarId,newDate:date}
  }));
 });
 function scheduleSlot(date,hour=startHour,minute=0){
  const when=new Date(date.getFullYear(),date.getMonth(),date.getDate(),hour,minute);
  document.dispatchEvent(new CustomEvent("helloearth:calendar-slot-select",{detail:{when:when.toISOString()}}));
 }
 const connectionBar=document.createElement("div");
 connectionBar.className="he-week-connection";
 connectionBar.innerHTML='<div class="he-week-connection-main"><span id="he-week-connection-dot" class="he-week-connection-dot" aria-hidden="true"></span><div><strong id="he-week-connection-name">Google Calendar</strong><small id="he-week-connection-detail">Checking your connection…</small></div></div><div class="he-week-connection-actions"><button type="button" id="he-week-connect">Connect Google Calendar</button><button type="button" id="he-week-refresh" hidden>Refresh calendar</button><button type="button" id="he-week-manage">Calendar settings</button></div>';
 shell.querySelector(".he-week-main").insertBefore(connectionBar,shell.querySelector(".he-week-status"));
 const syncConnection=()=>{
  const label=$("calendar-account-email")?.textContent?.trim()||"";
  const detail=$("calendar-sync-status")?.textContent?.trim()||"";
  const isConnected=$("calendar-connection-indicator")?.classList.contains("is-connected")||connected;
  const name=$("he-week-connection-name"),dot=$("he-week-connection-dot");
  name.textContent=isConnected?(label||"Google Calendar connected"):(label&&label!=="Not connected"?label:"Google Calendar");
  $("he-week-connection-detail").textContent=detail|| (isConnected?"Your calendar is connected.":"Connect your calendar to display lessons.");
  dot.classList.toggle("connected",Boolean(isConnected));
  $("he-week-connect").hidden=Boolean(isConnected);
  $("he-week-connect").textContent=label&&label!=="Not connected"?"Reconnect Google Calendar":"Connect Google Calendar";
  $("he-week-refresh").hidden=!isConnected;
 };
 $("he-week-connect").addEventListener("click",()=>document.dispatchEvent(new CustomEvent("helloearth:calendar-connect-request")));
 $("he-week-refresh").addEventListener("click",()=>document.dispatchEvent(new CustomEvent("helloearth:calendar-refresh-request")));
 $("he-week-manage").addEventListener("click",()=>{extras.open=true;extras.scrollIntoView({behavior:"smooth",block:"start"})});
 document.addEventListener("helloearth:calendar-connection-status",syncConnection);
 const statusNode=$("calendar-sync-status");
 if(statusNode){new MutationObserver(syncConnection).observe(statusNode,{childList:true,characterData:true,subtree:true})}
 const sourceSelector=section.querySelector("#calendar-source-row");
 if(sourceSelector)shell.querySelector(".he-week-main").insertBefore(sourceSelector,shell.querySelector(".he-week-status"));
 const legacy=section.querySelector(".ws-calendar-card");
 if(legacy){
  // Keep the real clickable day picker visible on demand, not inside settings.
  shell.querySelector("#he-week-date-picker").append(legacy);
  legacy.hidden=false;
 }
 section.insertBefore(shell,section.firstElementChild);
 const picker=$("he-week-date-picker");
 const pickerButton=$("he-week-pick-date");
 const showPicker=open=>{
  picker.hidden=!open;
  pickerButton.setAttribute("aria-expanded",String(open));
  pickerButton.classList.toggle("he-mode-active",open);
 };
 pickerButton.addEventListener("click",()=>showPicker(picker.hidden));
 // Date selection uses the existing calendar controller, retaining its
 // click handlers, weekly navigation and Google refresh logic.
 $("calendar-days")?.addEventListener("click",e=>{
  if(!e.target.closest(".ws-day[data-day]"))return;
  syncWeek();render();showPicker(false);
 });

 const extras=document.createElement("details");extras.className="he-calendar-extras";
 extras.innerHTML='<summary>Calendar settings, notifications, scheduling tools &amp; day agenda</summary>';
 const preserved=[".ws-calendar-intro",".ws-calendar-connection",".he-notice-card",".ws-scheduling-actions","#he-optimize-calendar",".ws-agenda-card"];
 preserved.forEach(selector=>{const node=section.querySelector(selector);if(node)extras.append(node)});
 section.append(extras);
 let current=[],connected=false,weekStart=monday(new Date()),selectedDate=new Date(),mode="week";
 const startHour=7,endHour=23,hourHeight=64;
 function monday(date){const d=new Date(date.getFullYear(),date.getMonth(),date.getDate());d.setDate(d.getDate()-(d.getDay()+6)%7);return d}
 function dateOf(raw){if(raw?.dateTime)return new Date(raw.dateTime);if(raw?.date)return new Date(raw.date+"T00:00:00");return new Date(NaN)}
 function pad(n){return String(n).padStart(2,"0")}
 function dayKey(d){return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate())}
 function formatTime(d){return window.HelloEarthTime?.formatTime(d)||d.toLocaleTimeString(undefined,{hour:"2-digit",minute:"2-digit",hour12:false})}
 function selectDay(date){
  selectedDate=date;
  const button=Array.from(document.querySelectorAll("#calendar-days .ws-day")).find(b=>b.dataset.day===dayKey(date));
  button?.click();
 }
 function syncWeek(){
  const buttons=Array.from(document.querySelectorAll("#calendar-days .ws-day"));
  if(buttons[0]?.dataset.day)weekStart=monday(new Date(buttons[0].dataset.day+"T12:00:00"));
 }
 function move(direction){const b=$(direction<0?"calendar-prev":"calendar-next");b?.click();syncWeek();render()}
 $("he-week-prev").addEventListener("click",()=>move(-1));
 $("he-week-next").addEventListener("click",()=>move(1));
 $("he-week-today").addEventListener("click",()=>{$("calendar-today")?.click();syncWeek();render()});
 $("he-week-schedule").addEventListener("click",()=>$("calendar-schedule")?.click());
 $("he-week-timeoff").addEventListener("click",()=>{$("calendar-schedule")?.click();$("schedule-kind-timeoff")?.click()});
 $("he-week-optimize").addEventListener("click",()=>{extras.open=true;$("he-optimize-calendar")?.scrollIntoView({behavior:"smooth",block:"start"})});
 $("he-week-agenda").addEventListener("click",()=>{mode="agenda";setModes();extras.open=true;$("calendar-agenda")?.scrollIntoView({behavior:"smooth",block:"start"})});
 $("he-week-mode").addEventListener("click",()=>{mode="week";setModes();shell.scrollIntoView({behavior:"smooth",block:"start"})});
 function setModes(){$("he-week-mode").classList.toggle("he-mode-active",mode==="week");$("he-week-agenda").classList.toggle("he-mode-active",mode==="agenda")}
 function block(tag,cls,text){const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el}
 function render(){
  const end=new Date(weekStart);end.setDate(end.getDate()+6);
  $("he-week-range").textContent=weekStart.toLocaleDateString(undefined,{month:"short",day:"numeric"})+" – "+end.toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"});
  const grid=$("he-week-grid");grid.replaceChildren();
  const corner=block("div","he-week-corner","GMT "+(-new Date().getTimezoneOffset()/60>=0?"+":"")+(-new Date().getTimezoneOffset()/60));grid.append(corner);
  const days=[];
  for(let i=0;i<7;i++){
   const date=new Date(weekStart);date.setDate(date.getDate()+i);days.push(date);
   const head=block("button","he-week-day",date.toLocaleDateString(undefined,{weekday:"short",day:"numeric"}));head.type="button";
   if(dayKey(date)===dayKey(new Date()))head.classList.add("he-week-current");
   head.addEventListener("click",()=>scheduleSlot(date,Math.max(startHour,9)));head.title="Schedule on this date";grid.append(head);
  }
  const axis=block("div","he-week-axis");axis.style.height=((endHour-startHour)*hourHeight)+"px";
  for(let hour=startHour;hour<=endHour;hour++){
   const axisDate=new Date(2026,0,1,hour,0);const l=block("span","he-hour-label",formatTime(axisDate));l.style.top=((hour-startHour)*hourHeight)+"px";axis.append(l);
  }
  grid.append(axis);
  let count=0;
  days.forEach(date=>{
   const day=block("div","he-week-column");day.style.height=((endHour-startHour)*hourHeight)+"px";
   day.title="Click an empty time slot to schedule an appointment";
   day.addEventListener("click",e=>{if(e.target.closest(".he-week-event"))return;const bounds=day.getBoundingClientRect();const relative=Math.max(0,Math.min((endHour-startHour)*hourHeight-1,e.clientY-bounds.top));const mins=Math.round(relative/hourHeight*60/15)*15;const total=startHour*60+mins;scheduleSlot(date,Math.floor(total/60),total%60)});
   const next=new Date(date);next.setDate(next.getDate()+1);
   const dayEvents=current.filter(e=>dateOf(e.start)<next&&dateOf(e.end)>date);
   dayEvents.sort((a,b)=>dateOf(a.start)-dateOf(b.start));
   dayEvents.forEach((event,i)=>{
    const start=dateOf(event.start),finish=dateOf(event.end);
    if(!Number.isFinite(start.getTime())||!Number.isFinite(finish.getTime()))return;
    const allDay=Boolean(event.start?.date);
    const top=allDay?0:Math.max(0,((start<date?date:start)-date)/60000-startHour*60);
    const bottom=allDay?60:Math.min((endHour-startHour)*60,((finish>next?next:finish)-date)/60000-startHour*60);
    if(bottom<=top)return;
    count++;
    const btn=block("button","he-week-event"+(allDay?" he-week-all-day":""));
    btn.type="button";btn.style.top=(top*hourHeight/60+2)+"px";btn.style.height=Math.max(23,(bottom-top)*hourHeight/60-4)+"px";
    const heading=block("strong","",event.summary||"Busy");
    const when=block("small","",allDay?"All day":formatTime(start)+" – "+formatTime(finish));
    btn.append(when,heading);
    btn.title=(event.summary||"Busy")+" · "+(allDay?"All day":formatTime(start)+" – "+formatTime(finish));
    btn.setAttribute("aria-label",btn.title+". Reschedule appointment");
    btn.addEventListener("click",e=>{e.stopPropagation();if(event.id&&event.calendarId)document.dispatchEvent(new CustomEvent("helloearth:calendar-edit-request",{detail:{id:event.id,calendarId:event.calendarId,summary:event.summary,start:event.start,end:event.end}}));else{selectDay(date);mode="agenda";setModes();extras.open=true;$("calendar-agenda")?.scrollIntoView({behavior:"smooth",block:"nearest"})}});
    // For simultaneous events share the available column space, rather than obscuring each other.
    const concurrent=dayEvents.filter(other=>other!==event&&dateOf(other.start)<finish&&dateOf(other.end)>start);
    const earlier=concurrent.filter(other=>dateOf(other.start)<=start);
    const slots=Math.min(3,Math.max(1,concurrent.length+1));
    const slot= Math.min(slots-1,earlier.length);
    btn.style.width="calc("+(100/slots)+"% - 5px)";
    btn.style.left="calc("+(100*slot/slots)+"% + 2px)";
    day.append(btn);
   });
   grid.append(day);
  });
  $("he-week-status").textContent=connected?(count?count+" appointment blocks in this week. Click an appointment to reschedule, or an empty slot to schedule.":"No appointments in this week. Use the arrows to browse other weeks."):"Connect Google Calendar above to see your schedule.";
 }
 document.addEventListener("helloearth:calendar-events",e=>{connected=Boolean(e.detail?.connected);current=e.detail?.events||[];if(e.detail?.windowStart)weekStart=monday(new Date(e.detail.windowStart));render();syncConnection()});
 document.addEventListener("helloearth:calendar-disconnected",()=>{connected=false;current=[];render();syncConnection()});
 document.addEventListener("helloearth:view-changed",e=>{if(e.detail?.view==="calendar"){syncWeek();render()}});
 document.addEventListener("helloearth:languagechanged",render);
 document.addEventListener("helloearth:time-format-changed",render);
 // Navigation changes update the old agenda before the new week fetch completes.
 $("calendar-prev")?.addEventListener("click",()=>{syncWeek();render()});
 $("calendar-next")?.addEventListener("click",()=>{syncWeek();render()});
 $("calendar-today")?.addEventListener("click",()=>{syncWeek();render()});
 render();syncConnection();
}

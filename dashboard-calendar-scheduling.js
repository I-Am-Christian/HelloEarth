/* Shared Preply-style scheduling dialog: lesson, time off, and reschedule
   all live on the Calendar page. Reuses existing Google write authorization,
   conflict prompts, and scheduled-event updates. */
const byId=id=>document.getElementById(id);
const modal=byId("schedule-modal");
if(modal){
 const dialog=modal.querySelector(".ws-scheduler-dialog");
 const form=byId("schedule-form");
 const heading=byId("schedule-heading");
 const wrapper=document.createElement("div");wrapper.className="he-schedule-tabs";wrapper.setAttribute("role","tablist");wrapper.setAttribute("aria-label","Scheduling options");
 wrapper.innerHTML='<button type="button" id="he-schedule-lesson" class="is-active" aria-selected="true">Lesson</button><button type="button" id="he-schedule-timeoff" aria-selected="false">Time off</button><button type="button" id="he-schedule-reschedule" aria-selected="false">Reschedule</button>';
 form.before(wrapper);
 const editor=document.createElement("section");
 editor.id="he-inline-reschedule";editor.className="he-inline-reschedule";editor.hidden=true;
 editor.innerHTML='<h3 id="he-inline-name">Select a calendar appointment</h3><p class="he-reschedule-hint">Click any appointment on the weekly calendar to edit it here. The new date and start time will be checked before saving to Google Calendar.</p><form id="he-inline-reschedule-form"><label for="he-inline-date">New date<input type="date" id="he-inline-date" required></label><label for="he-inline-time">New start time<input type="time" id="he-inline-time" step="1800" required></label><p id="he-inline-duration" class="he-reschedule-hint">Original lesson duration is retained.</p><div class="he-work-actions"><button type="submit" class="dash-primary" id="he-inline-submit">Review reschedule</button></div><p id="he-inline-status" role="status" aria-live="polite"></p></form>';
 form.after(editor);
 let selected=null,mode="lesson";
 const fmtDate=date=>[date.getFullYear(),String(date.getMonth()+1).padStart(2,"0"),String(date.getDate()).padStart(2,"0")].join("-");
 const parseDate=raw=>raw?.dateTime?new Date(raw.dateTime):raw?.date?new Date(raw.date+"T00:00:00"):new Date(NaN);
 const setMode=next=>{
  mode=next;
  editor.hidden=next!=="reschedule";
  form.hidden=next==="reschedule";
  wrapper.querySelectorAll("button").forEach(button=>{
   const active=button.id==="he-schedule-"+next;
   button.classList.toggle("is-active",active);
   button.setAttribute("aria-selected",String(active));
  });
  heading.textContent=next==="reschedule"?"Reschedule appointment":next==="timeoff"?"Book time off":"Schedule lesson";
  if(next==="lesson")byId("schedule-kind-lesson")?.click();
  if(next==="timeoff")byId("schedule-kind-timeoff")?.click();
  byId("he-inline-status").textContent="";
 };
 byId("he-schedule-lesson").addEventListener("click",()=>setMode("lesson"));
 byId("he-schedule-timeoff").addEventListener("click",()=>setMode("timeoff"));
 byId("he-schedule-reschedule").addEventListener("click",()=>setMode("reschedule"));
 document.addEventListener("helloearth:calendar-edit-request",e=>{
  const detail=e.detail||{};
  selected=detail.id&&detail.calendarId?detail:null;
  if(!selected)return;
  const start=parseDate(selected.start),end=parseDate(selected.end);
  if(!Number.isFinite(start.getTime()))return;
  byId("he-inline-name").textContent=selected.summary||"Untitled appointment";
  byId("he-inline-date").value=/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(detail.targetDate||"")?detail.targetDate:fmtDate(start);
  byId("he-inline-time").value=/^[0-9]{2}:[0-9]{2}$/.test(detail.targetTime||"")?detail.targetTime:String(start.getHours()).padStart(2,"0")+":"+String(start.getMinutes()).padStart(2,"0");
  // Preserve existing off-grid event times while new selections use 00/:30.
  byId("he-inline-time").step=start.getMinutes()%30===0||detail.targetTime?"1800":"300";
  byId("he-inline-time").disabled=Boolean(selected.start?.date);
  const duration=Math.round((end-start)/60000);
  byId("he-inline-duration").textContent=selected.start?.date?"All-day event — date can be changed.":Number.isFinite(duration)?"Duration: "+duration+" minutes (unchanged).":"Original duration is preserved.";
  modal.hidden=false;setMode("reschedule");
  byId("he-inline-date").focus();
 });
 byId("he-inline-reschedule-form").addEventListener("submit",e=>{
  e.preventDefault();
  if(!selected){byId("he-inline-status").textContent="Choose an appointment in the weekly calendar first.";return}
  const newDate=byId("he-inline-date").value,time=byId("he-inline-time").disabled?null:byId("he-inline-time").value;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(newDate)||(!byId("he-inline-time").disabled&&!/^\d{2}:\d{2}$/.test(time||"")))return;
  // Older Google events may start at :15 or :25; allow preserving that
  // unchanged time, but require a half-hour boundary for any NEW start time.
  const original=parseDate(selected.start);
  const originalTime=String(original.getHours()).padStart(2,"0")+":"+String(original.getMinutes()).padStart(2,"0");
  if(time&&time!==originalTime&&Number(time.slice(3))%30!==0){
   byId("he-inline-status").textContent="Choose a 30-minute time slot, e.g. 06:00 or 06:30.";
   return;
  }
  modal.hidden=true;
  document.dispatchEvent(new CustomEvent("helloearth:calendar-reschedule",{detail:{id:selected.id,calendarId:selected.calendarId,newDate,newTime:time}}));
 });
 // Existing sidebar shortcuts open the same scheduling dialog.
 byId("he-week-schedule")?.addEventListener("click",()=>setMode("lesson"));
 byId("he-week-timeoff")?.addEventListener("click",()=>setMode("timeoff"));
 // If a slot has already been selected, do not reset its date/time.
 document.addEventListener("helloearth:calendar-slot-select",()=>{selected=null;setMode("lesson")});
 // The old calendar button and dashboard quick actions should also open the lesson tab.
 byId("calendar-schedule")?.addEventListener("click",()=>{selected=null;setMode("lesson")});
 byId("schedule-close")?.addEventListener("click",()=>{selected=null;setMode("lesson")});
 // Default 'reschedule' tab prompts selection rather than editing stale data.
 byId("he-schedule-reschedule").addEventListener("click",()=>{
  if(!selected){byId("he-inline-name").textContent="Select an appointment in the weekly calendar";byId("he-inline-date").value="";byId("he-inline-time").value="";byId("he-inline-status").textContent="Close this window and click an existing lesson to reschedule it."}
 });
}

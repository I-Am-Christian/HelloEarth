import {db,$,W,state,esc,dateOnly,friendlyDate,formData,message,refresh,onRender,nameFor,studentFor} from "./dashboard-suite-shared.js";
let settingsFilled=false;
const time=s=>String(s||"").slice(0,5);
const eventText=e=>new Date(e).toLocaleString([],{weekday:"short",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"});
const bookingLink=()=>location.origin+"/booking.html?t="+encodeURIComponent($("he-suite-settings").elements.namedItem("public_slug").value.trim());
function renderSettings(){
 const form=$("he-suite-settings");
 if(!form||settingsFilled||!state.loaded)return;
 settingsFilled=true;
 const s=state.settings;
 if(s){
  for(const [name,value]of Object.entries(s)){
   const el=form.elements.namedItem(name);
   if(!el||name==="weekday")continue;
   if(name==="booking_enabled")el.checked=Boolean(value);
   else if(el.tagName==="INPUT"||el.tagName==="SELECT")el.value=
    name==="work_start"||name==="work_end"?time(value):String(value??"");
  }
 }
 const days=s?.available_weekdays||[1,2,3,4,5];
 form.querySelectorAll('[name="weekday"]').forEach(el=>el.checked=days.includes(Number(el.value)));
 $("he-suite-booking-preview").href=bookingLink();
}
function renderBookings(){
 const root=$("he-suite-bookings");if(!root)return;
 const list=[...state.bookings].sort((a,b)=>(a.status==="pending"?-1:1)-(b.status==="pending"?-1:1)||Date.parse(a.starts_at)-Date.parse(b.starts_at));
 root.innerHTML=list.length?list.slice(0,70).map(b=>
  '<div class="he-suite-row"><div><strong>'+esc(b.requester_name)+'</strong><small>'+esc(eventText(b.starts_at))+' · '+esc(b.requester_email)+'</small><p>'+esc(b.customer_note||"No note")+'</p></div>'+
  '<div class="he-suite-row-actions"><span>'+esc(b.status)+'</span>'+
  (b.status==="pending"?'<button type="button" data-booking-id="'+esc(b.id)+'" data-status="confirmed">Approve</button><button type="button" data-booking-id="'+esc(b.id)+'" data-status="declined">Decline</button>':"")+
  (b.status==="confirmed"?'<a href="'+draftGoogle(b)+'" target="_blank" rel="noopener noreferrer">Add to Google ↗</a>':"")+
  '</div></div>').join(""):'<p class="he-suite-empty">No booking requests yet.</p>';
}
function draftGoogle(b){
 const date=s=>new Date(s).toISOString().replace(/[-:]/g,"").replace(/\.\d{3}/,"");
 return "https://calendar.google.com/calendar/u/0/r/eventedit?text="+encodeURIComponent("Lesson: "+b.requester_name)+"&dates="+encodeURIComponent(date(b.starts_at)+"/"+date(b.ends_at));
}
function renderRecurring(){
 const root=$("he-suite-recurring-list");
 root.innerHTML=state.recurring.length?state.recurring.map(r=>
  '<div class="he-suite-row"><div><strong>'+esc(nameFor(r.student_id))+'</strong><small>Weekly · '+esc(time(r.local_start))+' · '+r.duration_minutes+' min · '+esc(r.timezone)+'</small><p>Starts '+esc(friendlyDate(r.starts_on))+'</p></div>'+
  '<div class="he-suite-row-actions"><span>'+(!r.active?"Paused":r.google_event_id?"In Google Calendar":"Active")+'</span>'+
  '<button data-rule-id="'+esc(r.id)+'" data-action="google" type="button">Add to Google</button>'+
  '<button data-rule-id="'+esc(r.id)+'" data-action="pause" type="button">'+(r.active?"Pause":"Resume")+'</button>'+
  '<button data-rule-id="'+esc(r.id)+'" data-action="delete" type="button">Delete</button></div></div>').join(""):'<p class="he-suite-empty">No recurring student lessons saved.</p>';
}
function renderLinks(){
 const root=$("he-suite-calendar-links");
 if(!state.calendar.connected){root.innerHTML='<p class="he-suite-empty">Connect Google Calendar to find appointments matching your student profiles.</p>';return}
 const matches=[];
 for(const [index,e] of state.calendar.events.entries()){
  const explicit=studentFor(e.extendedProperties?.private?.helloearth_student_id);
  const candidates=!explicit?state.students.filter(s=>s.display_name.length>=4&&String(e.summary||"").toLowerCase().includes(s.display_name.toLowerCase())):[];
  const suggestion=candidates.length===1?candidates[0]:null;
  if(explicit||suggestion)matches.push({index,e,student:explicit||suggestion,explicit:!!explicit});
 }
 root.innerHTML=matches.length?matches.slice(0,35).map(x=>
  '<div class="he-suite-row"><div><strong>'+esc(x.e.summary||"Calendar appointment")+'</strong><small>'+esc(x.e.start?.dateTime?eventText(x.e.start.dateTime):"All day")+'</small><p>'+
  (x.explicit?"Linked: ":"Possible match: ")+esc(x.student.display_name)+'</p></div><div class="he-suite-row-actions">'+
  (x.explicit?'<button type="button" data-open-student="'+esc(x.student.id)+'">Open student</button>':
   '<button type="button" data-calendar-index="'+x.index+'" data-student-id="'+esc(x.student.id)+'">Confirm link</button>')+'</div></div>').join(""):
  '<p class="he-suite-empty">No exact student-name matches in the synced week. Linked student IDs are preferred over name matching.</p>';
}
function suggestions(){
 const root=$("he-suite-suggestions");
 if(!state.calendar.connected||!state.calendar.start||!state.calendar.end){
  root.innerHTML='<p class="he-suite-empty">Connect Google Calendar and load a week to get suggestions.</p>';return;
 }
 const s=state.settings||{},duration=Number($("he-suite-suggest-duration").value);
 const days=s.available_weekdays||[1,2,3,4,5],start=time(s.work_start||"09:00").split(":").map(Number),end=time(s.work_end||"17:00").split(":").map(Number);
 const a=start[0]*60+start[1],b=end[0]*60+end[1],buffer=Number(s.buffer_minutes??10);
 const events=state.calendar.events.filter(e=>e.transparency!=="transparent"&&e.status!=="cancelled").map(e=>[Date.parse(e.start?.dateTime||e.start?.date||""),Date.parse(e.end?.dateTime||e.end?.date||"")]);
 const picks=[];
 for(let d=new Date(state.calendar.start),limit=new Date(state.calendar.end);d<limit&&picks.length<12;d.setDate(d.getDate()+1)){
  if(!days.includes(d.getDay()))continue;
  for(let min=a;min+duration<=b&&picks.length<12;min+=Math.max(duration,30)){
   const at=new Date(d.getFullYear(),d.getMonth(),d.getDate(),Math.floor(min/60),min%60).getTime();
   if(at<Date.now()+20*60000)continue;
   if(events.some(([x,y])=>at<y+buffer*60000&&at+duration*60000>x-buffer*60000))continue;
   picks.push(at);
  }
 }
 root.innerHTML=picks.length?picks.map(at=>'<button type="button" class="he-suite-slot" data-slot="'+new Date(at).toISOString()+'">'+esc(eventText(at))+'</button>').join("")+
 '<p class="he-suite-note">Suggested times are not reserved. Availability is checked again before saving in Google Calendar.</p>':
 '<p class="he-suite-empty">No open times in the currently synced week.</p>';
}
export function setupSchedule(){
 onRender(()=>{renderSettings();renderBookings();renderRecurring();renderLinks()});
 $("he-suite-settings").elements.namedItem("public_slug").addEventListener("input",()=>{
  $("he-suite-booking-preview").href=bookingLink();
 });
 $("he-suite-settings").addEventListener("submit",async e=>{
  e.preventDefault();const f=e.currentTarget,p=formData(f);
  const timezone=String(p.timezone||"").trim(),slug=String(p.public_slug||"").trim().toLowerCase();
  try{new Intl.DateTimeFormat("en",{timeZone:timezone})}catch{message("Enter an IANA timezone such as Europe/Warsaw.",true);return}
  const days=[...f.querySelectorAll('[name="weekday"]:checked')].map(x=>Number(x.value));
  if(p.booking_enabled&&(!/^[a-z0-9][a-z0-9-]{2,31}$/.test(slug)||!days.length)){
   message("An enabled booking page needs a valid slug and at least one working day.",true);return;
  }
  try{
   const {error}=await db.from("he_tutor_settings").upsert({tutor_id:state.userId,public_slug:slug||null,
    display_label:p.display_label.trim(),timezone,slot_minutes:Number(p.slot_minutes),
    buffer_minutes:Number(p.buffer_minutes),work_start:p.work_start,work_end:p.work_end,
    available_weekdays:days,booking_enabled:!!p.booking_enabled,hourly_rate:Number(p.hourly_rate||0),
    currency:p.currency,updated_at:new Date().toISOString()},{onConflict:"tutor_id"});
   if(error)throw error;settingsFilled=false;await refresh(["settings"]);
   message("Booking settings saved. "+(p.booking_enabled?"Public request page enabled.":"Public bookings remain disabled."));
  }catch(err){message("Booking settings failed: "+err.message,true)}
 });
 $("he-suite-copy-booking").addEventListener("click",()=>{
  if(!state.settings?.booking_enabled){message("Enable and save public bookings before sharing the URL.",true);return}
  navigator.clipboard.writeText(bookingLink()).then(()=>message("Booking link copied."),()=>message("Open the booking page and copy its URL.",true));
 });
 $("he-suite-bookings").addEventListener("click",async e=>{
  const button=e.target.closest("[data-booking-id]");if(!button)return;
  if(button.dataset.status==="confirmed"&&!confirm("Have you checked your Google Calendar for conflicts? Approval does not create a Google event."))return;
  try{
   const {error}=await db.from("he_booking_requests").update({status:button.dataset.status,updated_at:new Date().toISOString()})
    .eq("tutor_id",state.userId).eq("id",button.dataset.bookingId).eq("status","pending");
   if(error)throw error;await refresh(["bookings"]);message("Request "+button.dataset.status+". Add approved requests to Google Calendar separately.");
  }catch(err){message(err.message,true)}
 });
 $("he-suite-recurring").elements.namedItem("starts_on").value=dateOnly();
 $("he-suite-recurring").addEventListener("submit",async e=>{
  e.preventDefault();const p=formData(e.currentTarget);
  if(!studentFor(p.student_id)){message("Choose a student first.",true);return}
  try{
   new Intl.DateTimeFormat("en",{timeZone:p.timezone});
   const {error}=await db.from("he_recurring_rules").insert({tutor_id:state.userId,
    student_id:p.student_id,weekday:Number(p.weekday),local_start:p.local_start,
    duration_minutes:Number(p.duration_minutes),timezone:p.timezone,
    starts_on:p.starts_on,ends_on:p.ends_on||null,active:true});
   if(error)throw error;await refresh(["recurring"]);message("Weekly pattern saved. Google Calendar is not changed until you choose Add to Google.");
  }catch(err){message("Could not save pattern: "+err.message,true)}
 });
 $("he-suite-recurring-list").addEventListener("click",async e=>{
  const btn=e.target.closest("[data-rule-id]");if(!btn)return;
  const r=state.recurring.find(x=>x.id===btn.dataset.ruleId);if(!r)return;
  if(btn.dataset.action==="google"){
   if(!confirm("Create a recurring Google Calendar series for up to 26 occurrences? Check your existing bookings before continuing."))return;
   document.dispatchEvent(new CustomEvent("helloearth:create-recurring",{detail:{rule:r,student:studentFor(r.student_id)}}));return;
  }
  if(btn.dataset.action==="delete"&&!confirm("Delete this rule? Existing Google events will not be deleted."))return;
  try{
   const q=db.from("he_recurring_rules");const {error}=btn.dataset.action==="delete"?
    await q.delete().eq("tutor_id",state.userId).eq("id",r.id):
    await q.update({active:!r.active}).eq("tutor_id",state.userId).eq("id",r.id);
   if(error)throw error;await refresh(["recurring"]);message("Weekly pattern updated.");
  }catch(err){message(err.message,true)}
 });
 document.addEventListener("helloearth:recurring-result",async e=>{
  if(e.detail?.success)await refresh(["recurring"]);
  message(e.detail?.message||"Google scheduling failed.",!e.detail?.success);
 });
 $("he-suite-suggest").addEventListener("click",suggestions);
 $("he-suite-suggestions").addEventListener("click",e=>{
  const btn=e.target.closest("[data-slot]");if(!btn)return;
  const date=new Date(btn.dataset.slot);
  $("calendar-tab").click();$("calendar-schedule").click();
  window.HelloEarthSchedulingUI?.reset(date);
  $("schedule-duration").value=$("he-suite-suggest-duration").value;
  $("schedule-duration").dispatchEvent(new Event("change",{bubbles:true}));
 });
 $("he-suite-calendar-links").addEventListener("click",e=>{
  const button=e.target.closest("button");if(!button)return;
  if(button.dataset.openStudent){$("students-tab").click();W().openStudent(button.dataset.openStudent);return}
  if(button.dataset.calendarIndex){
   const event=state.calendar.events[Number(button.dataset.calendarIndex)],student=studentFor(button.dataset.studentId);
   if(event&&student&&confirm("Link this appointment to "+student.display_name+"?"))
    document.dispatchEvent(new CustomEvent("helloearth:link-google-event",{detail:{calendarId:event.calendarId,eventId:event.id,studentId:student.id}}));
  }
 });
}

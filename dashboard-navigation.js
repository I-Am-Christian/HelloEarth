import "./dashboard-scheduler-ui.js?v=20261118-suite-tz1";
import { db } from "./supabase-client.js";

const get = id => document.getElementById(id);
const translate = key => window.HelloEarthI18n?.t(key) ?? key;
const views = ["overview","calendar","students","progress","homework","lessons","tools","settings"];
const monday = date => {
 const day = new Date(date.getFullYear(),date.getMonth(),date.getDate());
 day.setDate(day.getDate() - ((day.getDay()+6)%7));return day;
};
const sameDay = (a,b) => a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate();
const toDate = date => new Date(date.getFullYear(),date.getMonth(),date.getDate());
const calendar = {view:"overview",date:toDate(new Date()),week:monday(new Date()),
 token:null,pendingToken:null,connected:false,events:[],sources:[],source:"all",email:"",
 request:0,userId:null,disconnected:false,restored:false,errorType:"",errorDescription:"",writeAuthorized:false};
// Google access is short-lived. Persist only the access token (not any Google refresh token)
// so a reload, tab switch or browser restart within its lifespan does not drop Calendar.
// JS-accessible storage is not a secure home for long-lived Google credentials.
// Full automatic renewal requires an authenticated server-side token vault.
const tokenKey = id => "helloearth-calendar-session:" + id;
const linkKey = id => "helloearth-calendar-link:" + id;
const googleTokenLifetime = 45 * 60 * 1000;
function storageRead(storage,key){
 try{return storage.getItem(key)}catch{return null}
}
function storageRemove(storage,key){
 try{storage.removeItem(key)}catch{}
}
function readStoredToken(id){
 if(!id)return null;
 const key=tokenKey(id);
 const raw=storageRead(localStorage,key)||storageRead(sessionStorage,key);
 if(!raw)return null;
 try{
  const saved=JSON.parse(raw);
  if(typeof saved.token!=="string" || !saved.token ||
     !Number.isFinite(saved.expires) || saved.expires<=Date.now()+10_000){
   storageRemove(localStorage,key);storageRemove(sessionStorage,key);return null;
  }
  // Migrate older same-tab connections while keeping the ORIGINAL expiry.
  if(!storageRead(localStorage,key)){
   try{
    localStorage.setItem(key,JSON.stringify({
     token:saved.token,expires:saved.expires,
     canWrite:Boolean(saved.canWrite||storageRead(sessionStorage,"helloearth-calendar-write:"+id)==="1")
    }));
    storageRemove(sessionStorage,key);
   }catch{/* Some private browsers disallow persistent storage; keep the tab copy. */}
  }else storageRemove(sessionStorage,key);
  return {token:saved.token,expires:saved.expires,
   canWrite:Boolean(saved.canWrite||storageRead(sessionStorage,"helloearth-calendar-write:"+id)==="1")};
 }catch{
  storageRemove(localStorage,key);storageRemove(sessionStorage,key);return null;
 }
}
function rememberToken(id,token,canWrite=false){
 if(!id||typeof token!=="string"||!token)return;
 const entry=JSON.stringify({
  token,expires:Date.now()+googleTokenLifetime,canWrite:Boolean(canWrite)
 });
 try{localStorage.setItem(tokenKey(id),entry);storageRemove(sessionStorage,tokenKey(id))}
 catch{try{sessionStorage.setItem(tokenKey(id),entry)}catch{}}
}
function forgetToken(id){
 if(!id)return;
 storageRemove(localStorage,tokenKey(id));
 storageRemove(sessionStorage,tokenKey(id));
 storageRemove(sessionStorage,"helloearth-calendar-write:"+id);
}
function connectionLabel(id){
 if(!id)return "";
 try{return JSON.parse(localStorage.getItem(linkKey(id))||"null")?.email||""}catch{return ""}
}
function rememberConnection(id,email){
 if(!id||!email)return;
 try{localStorage.setItem(linkKey(id),JSON.stringify({email,linkedAt:Date.now()}))}catch{}
}
function forgetConnection(id){if(id)storageRemove(localStorage,linkKey(id))}
function setConnection(email,status,active=false){
 const emailNode=get("calendar-account-email");
 const statusNode=get("calendar-sync-status");
 emailNode.textContent=email||translate("Not connected");
 statusNode.textContent=status;
 get("calendar-connection-indicator").classList.toggle("is-connected",active);
 document.dispatchEvent(new CustomEvent("helloearth:calendar-connection-status",{detail:{email,status,connected:active}}));
}
function setCalendarSources(){
 const select=get("calendar-source-select");
 const row=get("calendar-source-row");
 select.replaceChildren();
 const all=document.createElement("option");all.value="all";all.textContent=translate("All my calendars");
 select.append(all);
 for(const source of calendar.sources){
  const option=document.createElement("option");option.value=source.id;
  option.textContent=(source.primary?"★ ":"")+source.name;
  option.classList.add("i18n-user-content");select.append(option);
 }
 if(!calendar.sources.some(s=>s.id===calendar.source))calendar.source="all";
 select.value=calendar.source;
 row.hidden=!calendar.connected||!calendar.sources.length;
 get("calendar-source-count").textContent=calendar.sources.length+" "+translate("calendars available");
}
const calendarStorageKey = id => "helloearth-calendar-off:" + id;
const isCalendarOff = id => {try{return Boolean(id && localStorage.getItem(calendarStorageKey(id))==="1")}catch{return false}};
const setCalendarOff = (id,value) => {try{if(id){if(value)localStorage.setItem(calendarStorageKey(id),"1");else localStorage.removeItem(calendarStorageKey(id))}}catch{}};
function updateCalendarControls(){
 get("calendar-refresh").hidden=!calendar.token||calendar.disconnected;
 // Even an expired connected account can be forgotten without signing out of HelloEarth.
 get("calendar-disconnect").hidden=calendar.disconnected||(!calendar.token&&!connectionLabel(calendar.userId));
}
const language = () => document.documentElement.lang || "en";
const localized = (date,options) => date.toLocaleDateString(language(),options);
function setView(view,focus=false){
 if(!views.includes(view))return;
 calendar.view=view;
 for(const name of views){
  const active=name===view,tab=get(name+"-tab"),panel=get(name+"-view");
  panel.hidden=!active;
  tab.classList.toggle("is-current",active);
  tab.setAttribute("aria-selected",String(active));
  tab.tabIndex=active?0:-1;
 }
 syncSideNav();
 if(focus)get(view+"-tab").focus({preventScroll:true});
 history.replaceState(null,"",location.pathname+location.search+"#"+view);
 document.dispatchEvent(new CustomEvent("helloearth:view-changed",{detail:{view}}));
}
for(const name of views)get(name+"-tab").addEventListener("click",()=>setView(name));
document.querySelectorAll("[data-open-view],[data-view]").forEach(button=>{
 const target=button.dataset.openView||button.dataset.view;
 if(!views.includes(target))return;
 button.addEventListener("click",()=>setView(target));
});
function syncSideNav(){
 document.querySelectorAll(".ws-side-nav [data-view]").forEach(button=>{
  const active=button.dataset.view===calendar.view;
  button.classList.toggle("active",active);
  if(active)button.setAttribute("aria-current","page");else button.removeAttribute("aria-current");
 });
}

document.querySelector(".ws-view-switch").addEventListener("keydown",event=>{
 if(event.key!=="ArrowLeft"&&event.key!=="ArrowRight")return;
 event.preventDefault();
 const index=views.indexOf(calendar.view);
 setView(views[(index+(event.key==="ArrowRight"?1:-1)+views.length)%views.length],true);
});
// Page-wide swipe navigation is intentionally disabled. It conflicted with
// horizontal calendar interactions, forms and native mobile scrolling.
// On phones use the bottom navigation; on desktop use the grouped sidebar.
function renderWeek(){
 const finish=new Date(calendar.week);finish.setDate(finish.getDate()+6);
 get("calendar-month").textContent=calendar.week.getMonth()===finish.getMonth()
  ?localized(calendar.week,{month:"long",year:"numeric"})
  :localized(calendar.week,{month:"short"})+" – "+localized(finish,{month:"short",year:"numeric"});
 const grid=get("calendar-days");grid.replaceChildren();
 for(let i=0;i<7;i++){
  const date=new Date(calendar.week);date.setDate(date.getDate()+i);
  const button=document.createElement("button");button.type="button";button.className="ws-day";
  if(sameDay(date,new Date()))button.classList.add("is-today");
  if(sameDay(date,calendar.date))button.classList.add("is-selected");
  button.setAttribute("aria-label",localized(date,{weekday:"long",day:"numeric",month:"long",year:"numeric"}));
  button.setAttribute("aria-pressed",String(sameDay(date,calendar.date)));
  button.dataset.day=localField(date).slice(0,10);
  const weekday=document.createElement("span");weekday.textContent=localized(date,{weekday:"short"});
  const number=document.createElement("strong");number.textContent=date.getDate();
  const dot=document.createElement("i");dot.className="ws-day-event-dot";dot.setAttribute("aria-hidden","true");
  const dayEnd=new Date(date);dayEnd.setDate(dayEnd.getDate()+1);
  dot.hidden=!calendar.connected||!calendar.events.some(event=>{
   const a=eventDate(event.start),b=eventDate(event.end);
   return a<dayEnd&&b>date;
  });
  button.append(weekday,number,dot);
  button.addEventListener("click",()=>{calendar.date=date;renderWeek();renderAgenda()});
  grid.append(button);
 }
 renderAgenda();
}
function simpleStatus(title,description,button=false){
 const root=get("calendar-agenda");root.replaceChildren();
 const empty=document.createElement("div");empty.className="ws-calendar-empty";
 const symbol=document.createElement("span");symbol.textContent="☄";symbol.setAttribute("aria-hidden","true");
 const strong=document.createElement("strong");strong.textContent=translate(title);
 const p=document.createElement("p");p.textContent=translate(description);
 empty.append(symbol,strong,p);
 if(button){
  const connect=document.createElement("button");connect.type="button";connect.className="dash-primary ws-calendar-connect";connect.id="calendar-connect";connect.textContent=translate("Connect Google Calendar");
  connect.addEventListener("click",()=>connectGoogle(false));
  empty.append(connect);
 }
 if(calendar.disconnected){
  const revoke=document.createElement("a");
  revoke.href="https://myaccount.google.com/connections";
  revoke.target="_blank";
  revoke.rel="noopener noreferrer";
  revoke.className="ws-calendar-revoke";
  revoke.textContent=translate("Manage Google access ↗");
  empty.append(revoke);
 }
 root.append(empty);
}
function eventDate(field){
 if(!field)return new Date(NaN);
 if(field.dateTime)return new Date(field.dateTime);
 if(field.date){
  const [y,m,d]=field.date.split("-").map(Number);
  return new Date(y,m-1,d);
 }
 return new Date(NaN);
}
function renderAgenda(){
 get("calendar-day-title").textContent=localized(calendar.date,{weekday:"long",day:"numeric",month:"long"});
 if(!calendar.connected){
  get("calendar-source-row").hidden=true;
  if(calendar.errorType){
   simpleStatus(calendar.errorType,calendar.errorDescription,true);
  }else if(calendar.disconnected){
   simpleStatus("Google Calendar disconnected","Calendar events are hidden here. Your HelloEarth login and student profiles are unchanged. To fully revoke access, use your Google Account settings.",true);
  }else{
   simpleStatus("Connect your Google Calendar","View your lessons and appointments here with read-only access. Your calendar events are not saved to HelloEarth.",true);
  }
  return;
 }
 setCalendarSources();
 const start=toDate(calendar.date);const end=new Date(start);end.setDate(end.getDate()+1);
 const events=calendar.events.filter(event=>{
  const st=eventDate(event.start),en=eventDate(event.end);
  return st<end&&en>start;
 });
 const root=get("calendar-agenda");root.replaceChildren();
 if(!events.length){
  const available=calendar.events.length;
  simpleStatus("No events on this day",available
   ?"No events on the selected day. Other dates in this week have events — choose a day with a dot."
   :"No events in the selected week. Check the connected Google email, calendar selection, or another week.");
  return;
 }
 for(const event of events){
  const item=document.createElement("article");item.className="ws-event";
  if(event.id&&event.calendarId){item.dataset.eventIndex=String(calendar.events.indexOf(event));item.draggable=true;}
  const at=document.createElement("span");at.className="ws-event-time";
  at.textContent=event.start?.dateTime?(window.HelloEarthTime?.formatTime(new Date(event.start.dateTime))||localized(new Date(event.start.dateTime),{hour:"2-digit",minute:"2-digit",hour12:false})):translate("All day");
  const body=document.createElement("div");const title=document.createElement("strong");
  title.textContent=event.summary||translate("Busy");if(event.summary)title.classList.add("i18n-user-content");
  body.append(title);
  if(event.calendarName){
   const cal=document.createElement("small");cal.textContent=event.calendarName;
   cal.className="ws-event-calendar";cal.classList.add("i18n-user-content");body.append(cal);
  }
  if(event.location){const loc=document.createElement("small");loc.textContent=event.location;loc.classList.add("i18n-user-content");body.append(loc)}
  if(event.htmlLink){
   try{const url=new URL(event.htmlLink);if(url.protocol==="https:"&&(url.hostname==="calendar.google.com"||url.hostname.endsWith(".google.com"))){const link=document.createElement("a");link.href=url.href;link.target="_blank";link.rel="noopener noreferrer";link.textContent=translate("View in Google Calendar");body.append(link)}}catch{}
  }
  const source=calendar.sources.find(s=>s.id===event.calendarId);
  if(source?.writable&&calendar.writeAuthorized&&event.id&&event.start){
   const widget=document.createElement("details");widget.className="ws-event-move";
   const summary=document.createElement("summary");summary.textContent="Reschedule this appointment";
   const row=document.createElement("div");row.className="ws-event-move-row";
   const picker=document.createElement("input");picker.type="date";
   picker.value=localField(eventDate(event.start)).slice(0,10);
   picker.setAttribute("aria-label","New appointment date");
   const move=document.createElement("button");move.type="button";move.textContent="Move date";
   move.dataset.moveEventIndex=String(calendar.events.indexOf(event));
   row.append(picker,move);widget.append(summary,row);body.append(widget);
  }
  item.append(at,body);root.append(item);
 }
}
async function googleGet(url,token){
 const response=await fetch(url,{headers:{Authorization:"Bearer "+token},cache:"no-store"});
 if(!response.ok){
  const error=new Error("Google API request failed");
  error.status=response.status;
  throw error;
 }
 return response.json();
}
async function calendarList(token){
 const calendars=[];
 let page;
 for(let n=0;n<4;n++){
  const url=new URL("https://www.googleapis.com/calendar/v3/users/me/calendarList");
  url.searchParams.set("maxResults","250");
  if(page)url.searchParams.set("pageToken",page);
  const data=await googleGet(url,token);
  calendars.push(...(Array.isArray(data.items)?data.items:[]));
  page=data.nextPageToken;
  if(!page)break;
 }
 return calendars.filter(c=>c.id&&!c.deleted&&!c.hidden).map(c=>({
  id:c.id,name:c.summaryOverride||c.summary||c.id,primary:Boolean(c.primary),
  accessRole:c.accessRole||"reader",writable:["owner","writer","writerWithoutPrivateAccess"].includes(c.accessRole)
 }));
}
async function eventsForSource(source,from,until,token){
 const events=[];let page;
 for(let n=0;n<4;n++){
  const url=new URL("https://www.googleapis.com/calendar/v3/calendars/"+encodeURIComponent(source.id)+"/events");
  url.searchParams.set("timeMin",from.toISOString());
  url.searchParams.set("timeMax",until.toISOString());
  url.searchParams.set("singleEvents","true");
  url.searchParams.set("orderBy","startTime");
  url.searchParams.set("maxResults","250");
  if(page)url.searchParams.set("pageToken",page);
  const data=await googleGet(url,token);
  for(const event of data.items||[]){
   if(event.status==="cancelled")continue;
   events.push({...event,calendarName:source.name,calendarId:source.id});
  }
  page=data.nextPageToken;
  if(!page)break;
 }
 events.incomplete=Boolean(page);
 return events;
}
async function refreshEvents(){
 if(!calendar.token||calendar.disconnected){
  calendar.connected=false;updateCalendarControls();renderAgenda();return;
 }
 const req=++calendar.request,token=calendar.token;
 const from=new Date(calendar.week),until=new Date(from);until.setDate(until.getDate()+7);
 calendar.errorType="";
 setConnection(calendar.email||"",translate("Syncing calendars…"));
 updateCalendarControls();
 simpleStatus("Loading calendar","Reading your upcoming events from Google Calendar.");
 try{
  // This is the actual Google identity behind the provider token, not the HelloEarth login email.
  const [profileResult,sourcesResult]=await Promise.allSettled([
   googleGet("https://www.googleapis.com/oauth2/v3/userinfo",token),
   calendarList(token)
  ]);
  if(req!==calendar.request||calendar.disconnected)return;
  if(profileResult.status==="fulfilled"&&profileResult.value?.email){
   calendar.email=profileResult.value.email;
  }
  if(sourcesResult.status==="rejected")throw sourcesResult.reason;
  calendar.sources=sourcesResult.value;
  const primary=calendar.sources.find(c=>c.primary);
  // When Google UserInfo is unavailable, avoid claiming a calendar ID is a verified email.
  if(!calendar.email && primary && primary.id.includes("@") && !primary.id.includes(" ")){
   calendar.email="Calendar ID: "+primary.id;
  }
  if(!calendar.sources.length){
   const err=new Error("No readable Google calendars were found for this account");
   err.status=404;throw err;
  }
  const chosen=calendar.source==="all"
    ?calendar.sources.slice(0,24)
    :calendar.sources.filter(c=>c.id===calendar.source);
  if(!chosen.length)calendar.source="all";
  const toRead=chosen.length?chosen:calendar.sources.slice(0,24);
  const settled=await Promise.allSettled(toRead.map(c=>eventsForSource(c,from,until,token)));
  if(req!==calendar.request||calendar.disconnected)return;
  const successes=settled.filter(x=>x.status==="fulfilled");
  if(!successes.length)throw settled.find(x=>x.status==="rejected")?.reason||new Error("No accessible calendars");
  calendar.events=successes.flatMap(x=>x.value).sort((a,b)=>
   eventDate(a.start)-eventDate(b.start));
  calendar.connected=true;calendar.errorType="";calendar.errorDescription="";
  const problems=settled.length-successes.length;
  const accountLabel=calendar.email||translate("Email unavailable — check Google account");
  const count=calendar.events.length;
  const label=count+" "+(count===1?translate("event"):translate("events"))+" "+translate("this week");
  setConnection(accountLabel,problems
   ?label+" · "+problems+" "+translate("calendars could not be read")
   :label+" · "+successes.length+" "+translate("calendars synced"),true);
  rememberConnection(calendar.userId,calendar.email);
  updateCalendarControls();setCalendarSources();renderWeek();
  document.dispatchEvent(new CustomEvent("helloearth:calendar-events",{detail:{
   connected:true,windowStart:from.toISOString(),windowEnd:until.toISOString(),events:calendar.events.map(e=>({
    id:e.id,calendarId:e.calendarId,summary:e.summary,start:e.start,end:e.end,
    calendarName:e.calendarName,recurringEventId:e.recurringEventId||null,
    eventType:e.eventType||"",transparency:e.transparency||"",
    extendedProperties:e.extendedProperties
   }))
  }}));
  // The Overview is independent of the week currently being browsed.
  // Query the next two weeks with the same selected calendars and OAuth access.
  const upcomingFrom=new Date();
  const upcomingUntil=new Date(upcomingFrom.getTime()+14*24*60*60*1000);
  const upcomingReads=await Promise.allSettled(toRead.map(source=>
   eventsForSource(source,upcomingFrom,upcomingUntil,token)));
  if(req!==calendar.request||calendar.disconnected)return;
  const upcoming=upcomingReads.filter(item=>item.status==="fulfilled")
   .flatMap(item=>item.value).sort((a,b)=>eventDate(a.start)-eventDate(b.start));
  document.dispatchEvent(new CustomEvent("helloearth:upcoming-events",{detail:{
   connected:true,events:upcoming.map(e=>({
    id:e.id,calendarId:e.calendarId,summary:e.summary,start:e.start,end:e.end,
    calendarName:e.calendarName,extendedProperties:e.extendedProperties
   }))
  }}));
 }catch(error){
  if(req!==calendar.request||calendar.disconnected)return;
  const status=Number(error?.status||0);
  calendar.connected=false;calendar.events=[];
  calendar.errorType=status===401?"Google Calendar connection expired"
   :status===403?"Calendar permission needed"
   :status===404?"No calendars available":"Calendar unavailable";
  calendar.errorDescription=status===401
   ?"Google Calendar access has expired. Reconnect to authorize the account again."
   :status===403
   ?"Google denied access. Confirm that the Calendar API is enabled, the email is an approved test user, and you granted calendar.readonly permission."
   :status===404
   ?"No readable calendars were found for this Google account. Check which Google email was selected."
   :"Google Calendar could not be loaded. Check your connection and try Refresh or reconnect.";
  // Bad or expired tokens cannot be used again.
  if(status===401||status===403){
   calendar.token=null;calendar.writeAuthorized=false;forgetToken(calendar.userId);
  }
  document.dispatchEvent(new CustomEvent("helloearth:calendar-disconnected"));
  setConnection(calendar.email||"",calendar.errorType);
  updateCalendarControls();renderAgenda();
 }
}
get("calendar-source-select").addEventListener("change",event=>{
 calendar.source=event.target.value;
 if(calendar.token)refreshEvents();
});
function scheduleStatus(message,error=false){
 const feedback=get("schedule-feedback");
 feedback.textContent=message;feedback.classList.toggle("is-error",error);
}
const scheduleUI=window.HelloEarthSchedulingUI;
const localField=date=>{
 const d=new Date(date.getTime()-date.getTimezoneOffset()*60000);
 return d.toISOString().slice(0,16);
};
const scheduleCalendarLimit=24;
let schedulePreviewRequest=0,scheduleMonthRequest=0,scheduleCheckTimer=null;
let scheduleAvailability={checked:false,complete:false,overlaps:[],items:[],rangeKey:""};
const scheduleReadSources=()=>calendar.sources.slice(0,scheduleCalendarLimit);
const activeSchedule=()=>!get("schedule-modal").hidden;
const scheduleKey=range=>range.start.toISOString()+"|"+range.end.toISOString()+"|"+scheduleUI.kind();
function hasSchedulingConnection(){
 return Boolean(calendar.connected&&calendar.token&&scheduleReadSources().length);
}
function formatScheduleEvent(event,overlap){
 const dateStart=eventDate(event.start),dateEnd=eventDate(event.end);
 const linked=event.extendedProperties?.private?.helloearth_student_id||"";
 const student=window.HelloEarthWorkspace?.students?.find(s=>s.id===linked);
 // A linked ID is stronger evidence than a name in the event title. For
 // unlinked events, show the actual Google title without guessing a student.
 const summary=String(event.summary||"Busy").slice(0,130);
 const visibleName=summary.toLocaleLowerCase();
 const candidates=!student?(window.HelloEarthWorkspace?.students||[]).filter(s=>
  s.display_name?.length>=4&&visibleName.includes(s.display_name.toLocaleLowerCase())):[];
 const label=student?"Student booked: "+student.display_name+" · "+summary:
  candidates.length===1?"Possible student booking: "+candidates[0].display_name+" · "+summary:summary;
 const dateLabel=event.start?.date
  ?"All day"
  :dateStart.toLocaleDateString([],{weekday:"short",day:"numeric",month:"short"})+" "+
   dateStart.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})+"–"+
   dateEnd.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
 return {
  title:label,overlap,
  label:dateLabel+(event.calendarName?" · "+event.calendarName:"")
 };
}
function uniqueScheduleEvents(events){
 const byId=new Map();
 for(const event of events){
  const identifier=(event.iCalUID||event.id||event.summary||"")+
   "|"+(event.start?.dateTime||event.start?.date||"")+
   "|"+(event.end?.dateTime||event.end?.date||"");
  const previous=byId.get(identifier);
  // Shared calendars can expose the same booking more than once. Retain
  // the copy with a HelloEarth student link when there is one.
  if(!previous||(!previous.extendedProperties?.private?.helloearth_student_id&&
   event.extendedProperties?.private?.helloearth_student_id))byId.set(identifier,event);
 }
 return Array.from(byId.values());
}
async function readScheduleRange(from,until){
 const sources=scheduleReadSources();
 const token=calendar.token;
 if(!token||!sources.length)throw new Error("Connect a Google Calendar first.");
 const results=await Promise.allSettled(
  sources.map(src=>eventsForSource(src,from,until,token))
 );
 const success=results.filter(r=>r.status==="fulfilled");
 if(!success.length)throw results.find(r=>r.status==="rejected")?.reason||new Error("No calendar data available.");
 const events=uniqueScheduleEvents(success.flatMap(r=>r.value)).sort((a,b)=>eventDate(a.start)-eventDate(b.start));
 const failures=results.length-success.length;
 const truncated=success.some(r=>r.value.incomplete);
 const unverified=sources.length<calendar.sources.length||failures>0||truncated;
 return {events,complete:!unverified,failures,truncated,limited:sources.length<calendar.sources.length};
}
async function refreshScheduleMonth(){
 const request=++scheduleMonthRequest;
 if(!activeSchedule())return;
 const month=scheduleUI.getMonthWindow();
 if(!hasSchedulingConnection()){
  scheduleUI.setMonthData([],false,"Connect Google Calendar to see bookings on these dates.");
  return;
 }
 scheduleUI.setMonthData([],false,"Checking dates across your connected Google calendars…");
 try{
  const result=await readScheduleRange(month.from,month.until);
  if(request!==scheduleMonthRequest||!activeSchedule()||scheduleUI.getMonthWindow().key!==month.key)return;
  scheduleUI.setMonthData(result.events,result.complete,result.complete
   ?result.events.length+" appointment"+(result.events.length===1?"":"s")+" loaded for this month. Dots mark booked dates."
   :"Some calendars could not be checked. Dots show only the available bookings.");
 }catch(error){
  if(request!==scheduleMonthRequest||!activeSchedule())return;
  scheduleUI.setMonthData([],false,"Monthly bookings unavailable. Check the Calendar connection.");
 }
}
function setScheduleButton(){
 const r=scheduleUI.range();
 const invalid=!r.valid||!calendar.connected||!calendar.token||!calendar.writeAuthorized||
  !calendar.sources.some(c=>c.id===get("schedule-calendar").value&&c.writable);
 const overrideNeeded=scheduleAvailability.checked&&
  (scheduleAvailability.overlaps.length>0||!scheduleAvailability.complete);
 const allow=Boolean(r.valid&&!invalid&&scheduleAvailability.checked&&
  scheduleAvailability.rangeKey===scheduleKey(r)&&
  (!overrideNeeded||get("schedule-override").checked));
 get("schedule-submit").disabled=!allow;
}
function notifyScheduleEvents(events,complete,range){
 const all=events.filter(e=>e.transparency!=="transparent"&&e.status!=="cancelled");
 const touching=all.filter(e=>eventDate(e.start)<range.end&&eventDate(e.end)>range.start);
 const formatted=all.slice().sort((a,b)=>Number(touching.includes(b))-Number(touching.includes(a))||
  eventDate(a.start)-eventDate(b.start)).map(e=>formatScheduleEvent(e,touching.includes(e)));
 const key=scheduleKey(range);
 scheduleAvailability={checked:true,complete,overlaps:touching,items:all,rangeKey:key};
 let status,title,description;
 if(touching.length){
  status="conflict";
  title="⚠ "+touching.length+" existing booking"+(touching.length===1?" overlaps":"s overlap")+" this time";
  description="An appointment is already scheduled during this period. Choose another time or tick the confirmation below to proceed intentionally.";
 }else if(!complete){
  status="unverified";
  title="Not all Google calendars could be checked";
  description=all.length
   ?all.length+" visible booking"+(all.length===1?"":"s")+" found, but other calendars could not be verified."
   :"Availability is unverified. Reconnect or check Google Calendar, or explicitly confirm below.";
 }else{
  status=all.length?"busy-day":"free";
  title=all.length?"No overlap · "+all.length+" other booking"+(all.length===1?"":"s")+" on this date":"✓ No existing appointments during this period";
  description=all.length
   ?"The listed bookings do not overlap the selected time. Your event can be scheduled."
   :"Checked your connected calendars for the selected period.";
 }
 if(touching.length&&!complete){
  description+=" Some calendars were not checked, so there may be additional conflicts.";
 }
 scheduleUI.setAvailability({status,title,description,events:formatted});
 setScheduleButton();
}
function checkScheduleAvailability(){
 clearTimeout(scheduleCheckTimer);
 const request=++schedulePreviewRequest;
 scheduleAvailability={checked:false,complete:false,overlaps:[],items:[],rangeKey:""};
 const range=scheduleUI.range();
 if(!range.valid){
  scheduleUI.setAvailability({status:"invalid",title:range.error});
  setScheduleButton();return;
 }
 if(!hasSchedulingConnection()){
  scheduleUI.setAvailability({status:"invalid",title:"Connect your Google Calendar to check bookings."});
  setScheduleButton();return;
 }
 scheduleUI.setAvailability({status:"loading",title:"Checking existing appointments…",
  description:"Looking across your connected Google calendars for this date and time."});
 setScheduleButton();
 scheduleCheckTimer=setTimeout(async()=>{
  const startDay=toDate(range.start);
  const endDay=toDate(range.end),until=new Date(endDay);
  until.setDate(until.getDate()+1);
  try{
   const result=await readScheduleRange(startDay,until);
   if(request!==schedulePreviewRequest||!activeSchedule())return;
   const current=scheduleUI.range();
   if(!current.valid||scheduleKey(range)!==scheduleKey(current))return;
   notifyScheduleEvents(result.events,result.complete,range);
  }catch(error){
   if(request!==schedulePreviewRequest||!activeSchedule())return;
   const reason=Number(error?.status)===401?"Google Calendar access has expired."
    :"Could not read calendar availability. Please check your Google connection.";
   scheduleAvailability={checked:true,complete:false,overlaps:[],items:[],rangeKey:scheduleKey(range)};
   scheduleUI.setAvailability({status:"unverified",title:"Could not verify this date",description:reason});
   setScheduleButton();
  }
 },280);
}
scheduleUI.onChange(checkScheduleAvailability);
scheduleUI.onMonthChange(refreshScheduleMonth);
get("schedule-override").addEventListener("change",setScheduleButton);
function openScheduler(){
 const modal=get("schedule-modal");
 const select=get("schedule-calendar");select.replaceChildren();
 const writable=calendar.sources.filter(src=>src.writable);
 for(const source of writable){
  const option=document.createElement("option");option.value=source.id;option.textContent=source.name;
  select.append(option);
 }
 const previously=calendar.source;
 if(writable.some(c=>c.id===previously))select.value=previously;
 else if(writable.find(c=>c.primary))select.value=writable.find(c=>c.primary).id;
 const next=new Date(calendar.date);
 next.setHours(new Date().getHours()+1,0,0,0);
 if(next<new Date())next.setDate(next.getDate()+1);
 // Clear old validation and reset the picker for the selected calendar day.
 get("schedule-title").value="English lesson";
 get("schedule-student").value="";
 get("schedule-description").value="";
 scheduleStatus("");
 modal.hidden=false;
 scheduleUI.reset(next);
 get("schedule-title").focus();
 if(!calendar.connected||!writable.length)
  scheduleStatus("Connect Google Calendar and choose a writable calendar to schedule.",true);
 else if(!calendar.writeAuthorized)
  scheduleStatus("Select Authorize scheduling in the Calendar page to allow event creation.",true);
}
get("calendar-schedule").addEventListener("click",openScheduler);
// The weekly timetable can preselect a date and time without bypassing validation.
document.addEventListener("helloearth:calendar-slot-select",e=>{
 const detail=e.detail||{};
 const date=new Date(detail.when);
 if(!Number.isFinite(date.getTime()))return;
 calendar.date=toDate(date);
 openScheduler();
 scheduleUI.reset(date);
});

get("schedule-close").addEventListener("click",()=>{
 get("schedule-modal").hidden=true;
 ++schedulePreviewRequest;++scheduleMonthRequest;clearTimeout(scheduleCheckTimer);
});
get("schedule-modal").addEventListener("click",event=>{
 if(event.target===get("schedule-modal"))get("schedule-close").click();
});
get("calendar-request-write").addEventListener("click",()=>connectGoogle(true));
get("schedule-form").addEventListener("submit",async event=>{
 event.preventDefault();
 if(!calendar.token||!calendar.connected){scheduleStatus("Connect Google Calendar and authorize scheduling first.",true);return}
 if(!calendar.writeAuthorized){scheduleStatus("Click Authorize scheduling and approve Google's event-edit permission first.",true);return}
 const selected=get("schedule-calendar").value;
 if(!calendar.sources.some(src=>src.id===selected&&src.writable)){
  scheduleStatus("Choose a Google calendar with write access.",true);return
 }
 const range=scheduleUI.range();
 if(!range.valid){scheduleStatus(range.error||"Choose a valid date and time.",true);return}
 const title=get("schedule-title").value.trim(),description=get("schedule-description").value.trim();
 if(!title||title.length>200){scheduleStatus("Enter a short event title.",true);return}
 const isTimeOff=scheduleUI.kind()==="timeoff";
 const body={summary:title,description,transparency:"opaque"};
 if(range.allDay){
  // Google's all-day end date is EXCLUSIVE; the picker uses inclusive last day.
  body.start={date:range.allDayStart};body.end={date:range.allDayEnd};
 }else{
  body.start={dateTime:range.start.toISOString()};
  body.end={dateTime:range.end.toISOString()};
 }
 const studentId=get("schedule-student").value;
 if(!isTimeOff&&studentId)body.extendedProperties={private:{helloearth_student_id:studentId}};
 const button=get("schedule-submit");button.disabled=true;scheduleStatus("Rechecking Google Calendar just before scheduling…");
 try{
  // Live recheck on submit: don't trust a stale month marker or a previous
  // search. This also catches another lesson added between opening and saving.
  const from=toDate(range.start),until=toDate(range.end);until.setDate(until.getDate()+1);
  let available;
  try{available=await readScheduleRange(from,until)}
  catch(err){available={complete:false,events:[]}}
  // Don't create an event for an old selection if the user changed the date,
  // student, title or Google calendar while the final check was in flight.
  const latest=scheduleUI.range();
  if(!latest.valid||scheduleKey(latest)!==scheduleKey(range)||
   get("schedule-calendar").value!==selected||
   get("schedule-student").value!==studentId||
   get("schedule-title").value.trim()!==title||
   get("schedule-description").value.trim()!==description){
   scheduleStatus("The appointment details changed while checking. Review availability and try again.",true);
   return;
  }
  if(!available.complete||available.events.some(e=>
   e.transparency!=="transparent"&&eventDate(e.start)<range.end&&eventDate(e.end)>range.start)){
   notifyScheduleEvents(available.events,available.complete,range);
   if(!get("schedule-override").checked){
    scheduleStatus("Existing booking or unverified calendar. Choose another slot, or tick the confirmation before scheduling.",true);
    return;
   }
  }
  const url="https://www.googleapis.com/calendar/v3/calendars/"+encodeURIComponent(selected)+"/events";
  scheduleStatus("Creating "+(isTimeOff?"time off":"lesson")+" in Google Calendar…");
  const response=await fetch(url,{method:"POST",headers:{
   Authorization:"Bearer "+calendar.token,"Content-Type":"application/json"
  },body:JSON.stringify(body)});
  if(!response.ok){
   let problem={};try{problem=await response.json()}catch{}
   const error=new Error(response.status===403
    ?"Google has not granted event editing. Choose Authorize scheduling and approve the additional events permission."
    :response.status===401?"Google access expired. Reconnect Calendar and retry."
    :problem.error?.message||"Google rejected the event ("+response.status+").");
   throw error;
  }
  get("schedule-modal").hidden=true;
  ++schedulePreviewRequest;++scheduleMonthRequest;clearTimeout(scheduleCheckTimer);
  calendar.date=new Date(range.start.getFullYear(),range.start.getMonth(),range.start.getDate());
  calendar.week=monday(calendar.date);
  await refreshEvents();
  get("calendar-tab").click();
  const heading=get("calendar-day-title");
  heading.textContent=heading.textContent+(isTimeOff?" · Time off scheduled":" · Lesson scheduled");
 }catch(error){scheduleStatus(error.message||"Unable to schedule the appointment.",true)}
 finally{button.disabled=false;setScheduleButton()}
});

/* Explicit Google Calendar editing: a desktop drag or a mobile date picker.
   No event is moved without fresh checks and user confirmation. */
let draggedCalendarEvent=null;
const googleEventURL=(calendarId,eventId)=>
 "https://www.googleapis.com/calendar/v3/calendars/"+encodeURIComponent(calendarId)+"/events/"+encodeURIComponent(eventId);
const googlePatch=async(calendarId,eventId,body)=>{
 const response=await fetch(googleEventURL(calendarId,eventId),{
  method:"PATCH",headers:{Authorization:"Bearer "+calendar.token,"Content-Type":"application/json"},
  body:JSON.stringify(body)
 });
 if(!response.ok){
  let detail={};try{detail=await response.json()}catch{}
  throw Error(detail.error?.message||"Google Calendar update failed ("+response.status+").");
 }
 return response.json();
};
function localParts(time,timezone){
 const parts=new Intl.DateTimeFormat("en-GB",{
  timeZone:timezone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",
  minute:"2-digit",hourCycle:"h23"
 }).formatToParts(time);
 return Object.fromEntries(parts.map(part=>[part.type,part.value]));
}
const timezoneValid=zone=>{
 try{new Intl.DateTimeFormat("en",{timeZone:zone});return true}catch{return false}
};
function wallTimeMove(event,newDate,newTime){
 const start=eventDate(event.start),end=eventDate(event.end);
 if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||end<=start)throw Error("Invalid event times");
 const duration=end-start;
 const exact=/^\d{4}-\d{2}-\d{2}$/.test(newDate);
 if(!exact)throw Error("Choose a valid new date");
 if(event.start.date){
  const days=Math.round(duration/86400000);
  const targetEnd=new Date(newDate+"T12:00:00Z");targetEnd.setUTCDate(targetEnd.getUTCDate()+days);
  return {start:{date:newDate},end:{date:targetEnd.toISOString().slice(0,10)}};
 }
 if(newTime){
  if(!/^[0-9]{2}:[0-9]{2}$/.test(newTime))throw Error("Choose a valid start time.");
  const localStart=new Date(newDate+"T"+newTime+":00");
  if(!Number.isFinite(localStart.getTime()))throw Error("Invalid date or time.");
  return {start:{dateTime:localStart.toISOString()},end:{dateTime:new Date(localStart.getTime()+duration).toISOString()}};
 }
 const zone=timezoneValid(event.start.timeZone)?event.start.timeZone:
  Intl.DateTimeFormat().resolvedOptions().timeZone;
 const parts=localParts(start,zone);
 const localStart=newDate+"T"+parts.hour+":"+parts.minute+":00";
 const wallEnd=new Date(Date.parse(localStart+"Z")+duration).toISOString().slice(0,19);
 return {start:{dateTime:localStart,timeZone:zone},
  end:{dateTime:wallEnd,timeZone:zone}};
}
async function moveGoogleEvent(event,newDate,newTime){
 if(!event?.id||!event.calendarId)return;
 if(!calendar.connected||!calendar.writeAuthorized||!calendar.token){
  alert("Authorize Google Calendar scheduling before moving appointments.");return;
 }
 if(!calendar.sources.some(src=>src.id===event.calendarId&&src.writable)){
  alert("This calendar is read-only. You cannot move appointments in it.");return;
 }
 const oldStart=eventDate(event.start);
 const oldDay=localField(oldStart).slice(0,10);
 const oldTime=String(oldStart.getHours()).padStart(2,"0")+":"+String(oldStart.getMinutes()).padStart(2,"0");
 if(newDate===oldDay&&(!newTime||newTime===oldTime))return;
 if(!confirm("Reschedule "+(event.summary||"this event")+" to "+newDate+(newTime?" at "+newTime:"")+"? This changes Google Calendar."))return;
 try{
  const times=wallTimeMove(event,newDate,newTime);
  const from=new Date(newDate+"T00:00:00");
  from.setDate(from.getDate()-1);
  const until=new Date(newDate+"T00:00:00");until.setDate(until.getDate()+3);
  let checked=null;
  try{checked=await readScheduleRange(from,until)}catch{}
  const proposedStart=eventDate(times.start),proposedEnd=eventDate(times.end);
  const other=checked?.events?.filter(e=>
   !(e.id===event.id&&e.calendarId===event.calendarId)&&
   eventDate(e.start)<proposedEnd&&eventDate(e.end)>proposedStart)||[];
  if(!checked?.complete){
   if(!confirm("Some Google calendars could not be checked. Move the event anyway?"))return;
  }else if(other.length){
   if(!confirm(other.length+" other Google appointment(s) are near the new date. Have you checked for overlaps and still want to move it?"))return;
  }
  await googlePatch(event.calendarId,event.id,times);
  calendar.date=new Date(newDate+"T12:00:00");
  calendar.week=monday(calendar.date);
  await refreshEvents();
  get("calendar-day-title").textContent+=" · Appointment moved";
 }catch(error){alert("Could not move Google Calendar appointment: "+(error.message||"Unknown error"))}
}
// Reuse the existing permission checks, conflict checks, and explicit confirmation
// when a user selects a new date from the weekly timetable reschedule dialog.
document.addEventListener("helloearth:calendar-reschedule",e=>{
 const d=e.detail||{};
 const selected=calendar.events.find(item=>item.id===d.id&&item.calendarId===d.calendarId);
 if(!selected||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(d.newDate||""))return;
 moveGoogleEvent(selected,d.newDate,d.newTime);
});
get("calendar-agenda").addEventListener("dragstart",e=>{
 const item=e.target.closest(".ws-event[data-event-index]");
 draggedCalendarEvent=item?calendar.events[Number(item.dataset.eventIndex)]:null;
 if(draggedCalendarEvent&&e.dataTransfer){
  e.dataTransfer.effectAllowed="move";
  e.dataTransfer.setData("text/plain","helloearth-calendar-event");
 }
});
get("calendar-agenda").addEventListener("dragend",()=>{
 draggedCalendarEvent=null;
 get("calendar-days").querySelectorAll(".ws-day").forEach(button=>button.classList.remove("is-drop-target"));
});
get("calendar-days").addEventListener("dragover",e=>{
 const target=e.target.closest(".ws-day[data-day]");
 if(!target||!draggedCalendarEvent)return;
 e.preventDefault();target.classList.add("is-drop-target");
 if(e.dataTransfer)e.dataTransfer.dropEffect="move";
});
get("calendar-days").addEventListener("dragleave",e=>{
 e.target.closest(".ws-day")?.classList.remove("is-drop-target");
});
get("calendar-days").addEventListener("drop",e=>{
 const target=e.target.closest(".ws-day[data-day]");
 if(!draggedCalendarEvent||!target)return;
 e.preventDefault();target.classList.remove("is-drop-target");
 const original=draggedCalendarEvent;draggedCalendarEvent=null;
 moveGoogleEvent(original,target.dataset.day);
});
get("calendar-agenda").addEventListener("click",e=>{
 const button=e.target.closest("[data-move-event-index]");if(!button)return;
 const index=Number(button.dataset.moveEventIndex);
 const event=calendar.events[index];
 const date=button.parentElement.querySelector('input[type="date"]')?.value;
 if(event&&date)moveGoogleEvent(event,date);
});
document.addEventListener("helloearth:link-google-event",async e=>{
 const d=e.detail||{},student=window.HelloEarthWorkspace?.students?.find(s=>s.id===d.studentId);
 const event=calendar.events.find(v=>v.id===d.eventId&&v.calendarId===d.calendarId);
 if(!student||!event)return;
 if(!calendar.writeAuthorized||!calendar.token||
  !calendar.sources.some(c=>c.id===event.calendarId&&c.writable)){
  alert("Authorize scheduling and choose a writable calendar to link students.");return;
 }
 try{
  const previous=event.extendedProperties?.private||{};
  await googlePatch(event.calendarId,event.id,{extendedProperties:{private:{
   ...previous,helloearth_student_id:student.id
  }}});
  await refreshEvents();
  alert("Google Calendar appointment linked to "+student.display_name+".");
 }catch(error){alert("Student link failed: "+error.message)}
});
document.addEventListener("helloearth:create-recurring",async e=>{
 const rule=e.detail?.rule,student=e.detail?.student;
 const outcome=(success,message)=>document.dispatchEvent(new CustomEvent("helloearth:recurring-result",{detail:{success,message}}));
 if(!rule||!student||rule.google_event_id){
  outcome(false,"This recurring lesson is missing a student or has already been added to Google Calendar.");return;
 }
 if(!calendar.connected||!calendar.writeAuthorized||!calendar.token){
  outcome(false,"Connect Google Calendar and select Authorize scheduling first.");return;
 }
 const target=calendar.sources.find(c=>c.primary&&c.writable)||calendar.sources.find(c=>c.writable);
 if(!target){outcome(false,"No Google Calendar with permission to create lessons was found.");return}
 if(!timezoneValid(rule.timezone)){outcome(false,"The recurring rule has an invalid timezone.");return}
 const weekDays=["SU","MO","TU","WE","TH","FR","SA"];
 const dayNames=weekDays[Number(rule.weekday)];
 if(!dayNames){outcome(false,"Invalid recurring weekday");return}
 const initial=new Date(rule.starts_on+"T12:00:00");
 if(Number.isNaN(initial.getTime())){outcome(false,"Invalid first recurrence date");return}
 while(initial.getDay()!==Number(rule.weekday))initial.setDate(initial.getDate()+1);
 const first=localField(initial).slice(0,10);
 let count=26;
 if(rule.ends_on){
  const end=new Date(rule.ends_on+"T12:00:00");
  count=Math.min(26,Math.floor((end-initial)/(7*86400000))+1);
 }
 if(count<=0){outcome(false,"No recurring lessons fit within the specified dates.");return}
 const parts=String(rule.local_start).split(":").map(Number);
 const startWall=first+"T"+String(parts[0]).padStart(2,"0")+":"+String(parts[1]).padStart(2,"0")+":00";
 const endWall=new Date(Date.parse(startWall+"Z")+Number(rule.duration_minutes)*60000).toISOString().slice(0,19);
 const body={
  summary:"English lesson · "+student.display_name,
  description:"Recurring student lesson created in Hello Earth.",
  start:{dateTime:startWall,timeZone:rule.timezone},
  end:{dateTime:endWall,timeZone:rule.timezone},
  recurrence:["RRULE:FREQ=WEEKLY;COUNT="+count+";BYDAY="+dayNames],
  extendedProperties:{private:{helloearth_student_id:student.id}}
 };
 try{
  const url="https://www.googleapis.com/calendar/v3/calendars/"+encodeURIComponent(target.id)+"/events";
  const response=await fetch(url,{
   method:"POST",headers:{Authorization:"Bearer "+calendar.token,"Content-Type":"application/json"},
   body:JSON.stringify(body)
  });
  if(!response.ok){let data={};try{data=await response.json()}catch{}
   throw Error(data.error?.message||"Google Calendar rejected the recurring series.");}
  const saved=await response.json();
  const userId=window.HelloEarthWorkspace?.userId;
  const {error}=await db.from("he_recurring_rules").update({google_event_id:saved.id||null}).eq("tutor_id",userId).eq("id",rule.id);
  if(error){outcome(false,"Google series created, but Hello Earth could not save its reference. Review Google Calendar before retrying.");return}
  outcome(true,"Added "+count+" weekly lessons to "+target.name+". Future occurrences may conflict with existing Google appointments; review the series.");
  await refreshEvents();
 }catch(error){outcome(false,"Recurring Google Calendar event failed: "+error.message)}
});


document.addEventListener("helloearth:create-approved-booking",async e=>{
 const booking=e.detail?.booking;
 const result=(success,message)=>document.dispatchEvent(new CustomEvent("helloearth:approved-booking-result",{detail:{success,message}}));
 if(!booking||booking.status!=="confirmed"||booking.google_event_id){
  result(false,"Only approved bookings that have not been added to Google Calendar can be created.");return;
 }
 if(!calendar.connected||!calendar.writeAuthorized||!calendar.token){
  result(false,"Connect Google Calendar and authorize scheduling first.");return;
 }
 const target=calendar.sources.find(s=>s.primary&&s.writable)||calendar.sources.find(s=>s.writable);
 if(!target){result(false,"No writable Google Calendar is available.");return}
 const student=window.HelloEarthWorkspace?.students?.find(s=>s.id===booking.student_id);
 const body={
  summary:student?"English lesson · "+student.display_name:"English lesson · "+booking.requester_name,
  description:"Approved HelloEarth booking request. Verify any recurring or unrelated calendar conflicts.",
  start:{dateTime:booking.starts_at},end:{dateTime:booking.ends_at}
 };
 if(student)body.extendedProperties={private:{helloearth_student_id:student.id}};
 try{
  // Check the actual Google calendars again, not just the local pending-request
  // table. A failed/incomplete check requires explicit confirmation.
  let checked=null;
  try{
   const first=new Date(booking.starts_at),last=new Date(booking.ends_at);
   const from=toDate(first),until=toDate(last);until.setDate(until.getDate()+1);
   checked=await readScheduleRange(from,until);
  }catch{/* Google calendar cannot be verified. */}
  if(!checked?.complete){
   if(!confirm("Some Google calendars could not be checked for this booking. Open Google Calendar to verify there is no clash. Continue anyway?")){
    result(false,"Google Calendar appointment was not created. Please verify availability first.");return;
   }
  }
  const overlaps=(checked?.events||[]).filter(x=>
   x.transparency!=="transparent"&&
   eventDate(x.start)<new Date(booking.ends_at)&&eventDate(x.end)>new Date(booking.starts_at));
  if(overlaps.length){
   if(!confirm(overlaps.length+" existing Google Calendar appointment(s) overlap this approved request. Create the lesson anyway?")){
    result(false,"Google Calendar appointment not created because the requested time overlaps an existing event.");return;
   }
  }
  const url="https://www.googleapis.com/calendar/v3/calendars/"+encodeURIComponent(target.id)+"/events";
  const response=await fetch(url,{method:"POST",headers:{
   Authorization:"Bearer "+calendar.token,"Content-Type":"application/json"
  },body:JSON.stringify(body)});
  if(!response.ok){let data={};try{data=await response.json()}catch{}
   throw Error(data.error?.message||"Google Calendar rejected the lesson.");}
  const created=await response.json();
  const {error}=await db.from("he_booking_requests").update({
   google_event_id:created.id||null,google_calendar_id:target.id,updated_at:new Date().toISOString()
  }).eq("id",booking.id).eq("tutor_id",window.HelloEarthWorkspace?.userId);
  if(error){result(false,"Google event created, but its HelloEarth reference could not be saved. Check your Google Calendar to avoid duplicates.");return}
  result(true,"Approved lesson added to "+target.name+(student?" and linked to "+student.display_name:"")+".");
  calendar.date=new Date(booking.starts_at);calendar.week=monday(calendar.date);
  await refreshEvents();
 }catch(error){result(false,"Could not create the approved Google Calendar event: "+error.message)}
});

function disconnectGoogle(){
 // This stops access from the dashboard; it does NOT revoke Google's OAuth grant.
 // Google access permission can separately be revoked in the Google Account settings.
 calendar.request++; // Cancel stale in-flight fetch results.
 calendar.disconnected=true;
 setCalendarOff(calendar.userId,true);
 forgetToken(calendar.userId);
 forgetConnection(calendar.userId);
 calendar.token=null;calendar.pendingToken=null;
 calendar.events=[];calendar.sources=[];calendar.source="all";calendar.email="";
 calendar.connected=false;calendar.errorType="";calendar.writeAuthorized=false;
 try{sessionStorage.removeItem("helloearth-calendar-write:"+calendar.userId)}catch{}
 document.dispatchEvent(new CustomEvent("helloearth:calendar-disconnected"));
 sessionStorage.removeItem("helloearth-calendar-expected-user");
 setConnection("",translate("Disconnected — HelloEarth remains signed in"));
 get("calendar-source-row").hidden=true;
 updateCalendarControls();
 renderAgenda();
}
get("calendar-disconnect").addEventListener("click",disconnectGoogle);
async function connectGoogle(writeAccess=false){
 const button=get("calendar-connect");if(button)button.disabled=true;
 try{
  const {data:{user},error}=await db.auth.getUser();if(error||!user)throw new Error("Please log in again.");
  calendar.userId=user.id;
  const {data:{session}}=await db.auth.getSession();const hasGoogle=user.identities?.some(identity=>identity.provider==="google");
  const options={redirectTo:new URL("dashboard.html?calendar=connected",location.href).href,
   scopes:writeAccess
    ?"https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events"
    :"https://www.googleapis.com/auth/calendar.readonly",
   queryParams:{prompt:"select_account consent"}};
  sessionStorage.setItem("helloearth-calendar-expected-user",user.id);
  if(writeAccess)sessionStorage.setItem("helloearth-calendar-write-intent",user.id);
  else sessionStorage.removeItem("helloearth-calendar-write-intent");
  const result=hasGoogle
   ?await db.auth.signInWithOAuth({provider:"google",options})
   :await db.auth.linkIdentity({provider:"google",options});
  if(result.error)throw result.error;
  if(result.data?.url)window.location.assign(result.data.url);
  else if(!session)throw new Error("Unable to start Google authorization.");
 }catch(error){
  calendar.errorType="Google Calendar connection could not start";
  calendar.errorDescription=error.message||"Please try again.";
  setConnection(calendar.email||"",translate("Calendar connection failed"));
  renderAgenda();
 }
}
get("calendar-prev").addEventListener("click",()=>{calendar.week.setDate(calendar.week.getDate()-7);calendar.date=new Date(calendar.week);renderWeek();if(calendar.token)refreshEvents()});
get("calendar-next").addEventListener("click",()=>{calendar.week.setDate(calendar.week.getDate()+7);calendar.date=new Date(calendar.week);renderWeek();if(calendar.token)refreshEvents()});
get("calendar-today").addEventListener("click",()=>{calendar.date=toDate(new Date());calendar.week=monday(calendar.date);renderWeek();if(calendar.token)refreshEvents()});
get("calendar-refresh").addEventListener("click",refreshEvents);
get("calendar-connect")?.addEventListener("click",()=>connectGoogle(false));
document.addEventListener("helloearth:calendar-connect-request",()=>connectGoogle(false));
document.addEventListener("helloearth:calendar-refresh-request",()=>refreshEvents());
db.auth.onAuthStateChange((event,session)=>{
 // A normal HelloEarth Google login token might not include Calendar permission.
 // Only capture a fresh provider token when OUR Calendar OAuth flow is in progress.
 const intent=storageRead(sessionStorage,"helloearth-calendar-expected-user");
 if(session?.provider_token && intent && session.user?.id===intent){
  calendar.pendingToken=session.provider_token;
  // Late OAuth callbacks can arrive after initial dashboard restoration.
  if(calendar.restored && calendar.userId===intent){
   const write=storageRead(sessionStorage,"helloearth-calendar-write-intent")===intent;
   storageRemove(sessionStorage,"helloearth-calendar-expected-user");
   storageRemove(sessionStorage,"helloearth-calendar-write-intent");
   calendar.disconnected=false;setCalendarOff(intent,false);
   calendar.token=session.provider_token;
   calendar.writeAuthorized=write;
   rememberToken(intent,calendar.token,write);
   Promise.resolve().then(()=>refreshEvents());
  }
 }
 if(event==="SIGNED_OUT"){
  const owner=calendar.userId||window.HelloEarthWorkspace?.userId;
  forgetToken(owner);
  forgetConnection(owner);
  calendar.token=null;calendar.pendingToken=null;calendar.connected=false;calendar.writeAuthorized=false;
  calendar.email="";calendar.events=[];calendar.sources=[];
  document.dispatchEvent(new CustomEvent("helloearth:calendar-disconnected"));
  updateCalendarControls();setConnection("",translate("Not connected"));renderAgenda();
 }
});
document.addEventListener("helloearth:languagechanged",()=>renderWeek());
document.addEventListener("helloearth:time-format-changed",()=>renderAgenda());
async function restore(){
 const expected=storageRead(sessionStorage,"helloearth-calendar-expected-user");
 const writeExpected=storageRead(sessionStorage,"helloearth-calendar-write-intent");
 const {data:{user},error:userError}=await db.auth.getUser();
 if(userError||!user)throw new Error("Sign in to restore Google Calendar.");
 calendar.userId=user.id;
 calendar.disconnected=isCalendarOff(user.id);
 if(expected && expected!==user.id){
  storageRemove(sessionStorage,"helloearth-calendar-expected-user");
  storageRemove(sessionStorage,"helloearth-calendar-write-intent");
  calendar.disconnected=true;
  calendar.errorType="Calendar account mismatch";
  calendar.errorDescription="The Google account changed your HelloEarth login. Sign back into your original HelloEarth account before reconnecting Calendar.";
  calendar.restored=true;
  updateCalendarControls();
  setConnection("",translate("Google account mismatch"));
  renderAgenda();
  return;
 }
 // Only a callback started by our Connect button may introduce a new Google token.
 // On all ordinary reloads, prefer our last verified Calendar token, not the
 // current Supabase provider_token (which may be for login without Calendar scopes).
 const {data:{session}}=await db.auth.getSession();
 const stored=readStoredToken(user.id);
 const callback=Boolean(expected&&expected===user.id);
 const freshToken=callback ? (calendar.pendingToken||session?.provider_token||null) : null;
 const token=freshToken||(stored&&!calendar.disconnected?stored.token:null);
 if(callback){
  storageRemove(sessionStorage,"helloearth-calendar-expected-user");
  storageRemove(sessionStorage,"helloearth-calendar-write-intent");
 }
 if(callback&&token){
  calendar.disconnected=false;
  setCalendarOff(user.id,false);
 }
 calendar.restored=true;
 calendar.writeAuthorized=Boolean(!calendar.disconnected&&token&&
  (freshToken ? writeExpected===user.id : stored?.canWrite));
 if(freshToken)rememberToken(user.id,freshToken,calendar.writeAuthorized);
 if(!calendar.disconnected&&token){
  calendar.token=token;
  calendar.email=connectionLabel(user.id);
  await refreshEvents();
 }else{
  calendar.token=null;calendar.events=[];calendar.sources=[];calendar.connected=false;
  calendar.email=calendar.disconnected?"":connectionLabel(user.id);
  if(callback&&!token){
   calendar.errorType="Calendar authorization incomplete";
   calendar.errorDescription="Google Calendar did not return an access token. Please connect again and approve the requested permissions.";
  }else if(!calendar.disconnected&&calendar.email){
   calendar.errorType="Google Calendar authorization expired";
   calendar.errorDescription="The connected Google Calendar needs permission again. Select Connect Google Calendar to renew access; your HelloEarth account and students are unchanged.";
  }
  document.dispatchEvent(new CustomEvent("helloearth:calendar-disconnected"));
  setConnection(calendar.email,calendar.disconnected
   ?translate("Disconnected — HelloEarth remains signed in")
   :calendar.errorType||translate("Connect to see your lessons"));
  updateCalendarControls();
  renderAgenda();
 }
}
function renderProgress(levels,total){
 const root=get("progress-level-bars");
 if(!root)return;
 root.replaceChildren();
 const order=["A1","A2","B1","B2","C1","C2","UNASSESSED"];
 for(const level of order){
  const count=Number(levels?.[level]||0);
  const row=document.createElement("div");row.className="ws-level-row";
  const label=document.createElement("span");label.textContent=level==="UNASSESSED"?"Not assessed":level;
  const track=document.createElement("span");track.className="ws-level-track";
  const fill=document.createElement("span");fill.className="ws-level-fill";
  fill.style.width=(total?100*count/total:0)+"%";
  track.append(fill);
  const number=document.createElement("strong");number.textContent=String(count);
  row.append(label,track,number);root.append(row);
 }
}
document.addEventListener("helloearth:studentsloaded",event=>renderProgress(event.detail.levels,event.detail.total));
if(window.HelloEarthDashboardSummary)renderProgress(window.HelloEarthDashboardSummary.levels,window.HelloEarthDashboardSummary.total);
const startView=location.hash.slice(1)==="atlas"?"lessons":location.hash.slice(1);
const justAuthorized=new URLSearchParams(location.search).get("calendar")==="connected";
setView(views.includes(startView)?startView:justAuthorized?"calendar":"overview");
renderWeek();restore().catch(()=>{calendar.restored=true;updateCalendarControls()});

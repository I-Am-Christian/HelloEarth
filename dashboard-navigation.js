import { db } from "./supabase-client.js";

const get = id => document.getElementById(id);
const translate = key => window.HelloEarthI18n?.t(key) ?? key;
const views = ["overview","calendar","students","progress","atlas"];
const monday = date => {
 const day = new Date(date.getFullYear(),date.getMonth(),date.getDate());
 day.setDate(day.getDate() - ((day.getDay()+6)%7));return day;
};
const sameDay = (a,b) => a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate();
const toDate = date => new Date(date.getFullYear(),date.getMonth(),date.getDate());
const calendar = {view:"overview",date:toDate(new Date()),week:monday(new Date()),
 token:null,pendingToken:null,connected:false,events:[],sources:[],source:"all",email:"",
 request:0,userId:null,disconnected:false,restored:false,errorType:"",errorDescription:""};
// A temporary token is retained in this browser tab only; never store a Google refresh token.
const tokenKey = id => "helloearth-calendar-session:" + id;
function rememberToken(id,token){
 if(!id||!token)return;
 try{sessionStorage.setItem(tokenKey(id),JSON.stringify({token,expires:Date.now()+45*60*1000}))}catch{}
}
function recalledToken(id){
 if(!id)return null;
 try{
  const raw=sessionStorage.getItem(tokenKey(id));if(!raw)return null;
  const saved=JSON.parse(raw);
  if(saved.expires>Date.now()&&typeof saved.token==="string")return saved.token;
  sessionStorage.removeItem(tokenKey(id));
 }catch{}
 return null;
}
function forgetToken(id){if(!id)return;try{sessionStorage.removeItem(tokenKey(id))}catch{}}
function setConnection(email,status,active=false){
 const emailNode=get("calendar-account-email");
 const statusNode=get("calendar-sync-status");
 emailNode.textContent=email||translate("Not connected");
 statusNode.textContent=status;
 get("calendar-connection-indicator").classList.toggle("is-connected",active);
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
 get("calendar-disconnect").hidden=!calendar.token||calendar.disconnected;
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
let touchStart=null;
const main=document.querySelector(".ws-main");
main.addEventListener("touchstart",event=>{
 if(event.touches.length!==1||!get("student-modal").hidden||!get("note-modal").hidden||event.target.closest("input,textarea,select,[contenteditable],.ws-calendar-days")){touchStart=null;return}
 touchStart={x:event.touches[0].clientX,y:event.touches[0].clientY};
},{passive:true});
main.addEventListener("touchend",event=>{
 if(!touchStart||!event.changedTouches.length)return;
 const dx=event.changedTouches[0].clientX-touchStart.x,dy=event.changedTouches[0].clientY-touchStart.y;
 touchStart=null;
 if(Math.abs(dx)<75||Math.abs(dx)<Math.abs(dy)*1.5)return;
 const index=views.indexOf(calendar.view);
 if(dx>0&&index>0)setView(views[index-1]);
 if(dx<0&&index<views.length-1)setView(views[index+1]);
},{passive:true});
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
  connect.addEventListener("click",connectGoogle);
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
  const at=document.createElement("span");at.className="ws-event-time";
  at.textContent=event.start?.dateTime?localized(new Date(event.start.dateTime),{hour:"2-digit",minute:"2-digit"}):translate("All day");
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
  id:c.id,name:c.summaryOverride||c.summary||c.id,primary:Boolean(c.primary)
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
   events.push({...event,calendarName:source.name});
  }
  page=data.nextPageToken;
  if(!page)break;
 }
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
  updateCalendarControls();setCalendarSources();renderWeek();
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
  if(status===401){calendar.token=null;forgetToken(calendar.userId)}
  setConnection(calendar.email||"",calendar.errorType);
  updateCalendarControls();renderAgenda();
 }
}
get("calendar-source-select").addEventListener("change",event=>{
 calendar.source=event.target.value;
 if(calendar.token)refreshEvents();
});
function disconnectGoogle(){
 // This stops access from the dashboard; it does NOT revoke Google's OAuth grant.
 // Google access permission can separately be revoked in the Google Account settings.
 calendar.request++; // Cancel stale in-flight fetch results.
 calendar.disconnected=true;
 setCalendarOff(calendar.userId,true);
 forgetToken(calendar.userId);
 calendar.token=null;calendar.pendingToken=null;
 calendar.events=[];calendar.sources=[];calendar.source="all";calendar.email="";
 calendar.connected=false;calendar.errorType="";
 sessionStorage.removeItem("helloearth-calendar-expected-user");
 setConnection("",translate("Disconnected — HelloEarth remains signed in"));
 get("calendar-source-row").hidden=true;
 updateCalendarControls();
 renderAgenda();
}
get("calendar-disconnect").addEventListener("click",disconnectGoogle);
async function connectGoogle(){
 const button=get("calendar-connect");if(button)button.disabled=true;
 try{
  const {data:{user},error}=await db.auth.getUser();if(error||!user)throw new Error("Please log in again.");
  calendar.userId=user.id;
  const {data:{session}}=await db.auth.getSession();const hasGoogle=user.identities?.some(identity=>identity.provider==="google");
  const options={redirectTo:new URL("dashboard.html?calendar=connected",location.href).href,scopes:"https://www.googleapis.com/auth/calendar.readonly",queryParams:{prompt:"select_account consent"}};
  sessionStorage.setItem("helloearth-calendar-expected-user",user.id);
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
get("calendar-connect")?.addEventListener("click",connectGoogle);
db.auth.onAuthStateChange((event,session)=>{
 // Capture provider tokens even if OAuth returns before getUser() has finished.
 if(session?.provider_token){
  calendar.pendingToken=session.provider_token;
  if(calendar.restored&&!calendar.disconnected&&!calendar.token){
   calendar.token=session.provider_token;
   rememberToken(calendar.userId,calendar.token);
   Promise.resolve().then(()=>refreshEvents());
  }
 }
 if(event==="SIGNED_OUT"){
  forgetToken(calendar.userId);
  calendar.token=null;calendar.pendingToken=null;calendar.connected=false;
  calendar.email="";calendar.events=[];calendar.sources=[];
  updateCalendarControls();setConnection("",translate("Not connected"));renderAgenda();
 }
});
document.addEventListener("helloearth:languagechanged",()=>renderWeek());
async function restore(){
 const expected=sessionStorage.getItem("helloearth-calendar-expected-user");
 const {data:{user}}=await db.auth.getUser();
 calendar.userId=user?.id||null;
 calendar.disconnected=isCalendarOff(calendar.userId);
 if(expected){
  sessionStorage.removeItem("helloearth-calendar-expected-user");
  if(user?.id!==expected){
   calendar.disconnected=true;
   calendar.errorType="Calendar account mismatch";
   calendar.errorDescription="The Google account changed your HelloEarth login. Sign back into your original HelloEarth account before reconnecting Calendar.";
   calendar.restored=true;
   updateCalendarControls();
   setConnection("",translate("Google account mismatch"));
   renderAgenda();
   return;
  }
 }
 const {data:{session}}=await db.auth.getSession();
 const token=session?.provider_token||calendar.pendingToken||(!calendar.disconnected?recalledToken(calendar.userId):null);
 if(expected && token){
  calendar.disconnected=false;
  setCalendarOff(calendar.userId,false);
 }
 calendar.restored=true;
 if(!calendar.disconnected&&token){
  calendar.token=token;
  rememberToken(calendar.userId,token);
  await refreshEvents();
 }else{
  calendar.token=null;calendar.events=[];calendar.sources=[];calendar.connected=false;
  if(expected&&!token){
   calendar.errorType="Calendar authorization incomplete";
   calendar.errorDescription="Google Calendar did not return an access token. Please connect again and approve read-only Calendar access.";
  }
  setConnection("",calendar.disconnected
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
const startView=location.hash.slice(1);
const justAuthorized=new URLSearchParams(location.search).get("calendar")==="connected";
setView(views.includes(startView)?startView:justAuthorized?"calendar":"overview");
renderWeek();restore().catch(()=>{calendar.restored=true;updateCalendarControls()});

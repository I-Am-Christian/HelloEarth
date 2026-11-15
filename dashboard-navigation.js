import { db } from "./supabase-client.js";

const get = id => document.getElementById(id);
const translate = key => window.HelloEarthI18n?.t(key) ?? key;
const views = ["calendar","students"];
const monday = date => {
 const day = new Date(date.getFullYear(),date.getMonth(),date.getDate());
 day.setDate(day.getDate() - ((day.getDay()+6)%7));return day;
};
const sameDay = (a,b) => a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate();
const toDate = date => new Date(date.getFullYear(),date.getMonth(),date.getDate());
const calendar = {view:"calendar",date:toDate(new Date()),week:monday(new Date()),token:null,connected:false,events:[],request:0};
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
 if(focus)get(view+"-tab").focus({preventScroll:true});
 history.replaceState(null,"",location.pathname+location.search+(view==="students"?"#students":"#calendar"));
}
for(const name of views)get(name+"-tab").addEventListener("click",()=>setView(name));
document.querySelector(".ws-view-switch").addEventListener("keydown",event=>{
 if(event.key!=="ArrowLeft"&&event.key!=="ArrowRight")return;
 event.preventDefault();setView(event.key==="ArrowRight"?"students":"calendar",true);
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
 if(dx>0&&calendar.view==="calendar")setView("students");
 if(dx<0&&calendar.view==="students")setView("calendar");
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
  button.append(weekday,number);
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
 root.append(empty);
}
function renderAgenda(){
 get("calendar-day-title").textContent=localized(calendar.date,{weekday:"long",day:"numeric",month:"long"});
 if(!calendar.connected){
  simpleStatus("Connect your Google Calendar","View your lessons and appointments here with read-only access. Your calendar events are not saved to HelloEarth.",true);
  return;
 }
 const start=toDate(calendar.date);const end=new Date(start);end.setDate(end.getDate()+1);
 const events=calendar.events.filter(event=>{
  const st=new Date(event.start?.dateTime||event.start?.date);
  const en=new Date(event.end?.dateTime||event.end?.date||event.start?.dateTime||event.start?.date);
  return st<end&&en>start;
 });
 const root=get("calendar-agenda");root.replaceChildren();
 if(!events.length){
  simpleStatus("No events on this day","Your connected Google Calendar has no scheduled events for this date.");return;
 }
 for(const event of events){
  const item=document.createElement("article");item.className="ws-event";
  const at=document.createElement("span");at.className="ws-event-time";
  at.textContent=event.start?.dateTime?localized(new Date(event.start.dateTime),{hour:"2-digit",minute:"2-digit"}):translate("All day");
  const body=document.createElement("div");const title=document.createElement("strong");
  title.textContent=event.summary||translate("Busy");if(event.summary)title.classList.add("i18n-user-content");
  body.append(title);
  if(event.location){const loc=document.createElement("small");loc.textContent=event.location;loc.classList.add("i18n-user-content");body.append(loc)}
  if(event.htmlLink){
   try{const url=new URL(event.htmlLink);if(url.protocol==="https:"&&(url.hostname==="calendar.google.com"||url.hostname.endsWith(".google.com"))){const link=document.createElement("a");link.href=url.href;link.target="_blank";link.rel="noopener noreferrer";link.textContent=translate("View in Google Calendar");body.append(link)}}catch{}
  }
  item.append(at,body);root.append(item);
 }
}
async function refreshEvents(){
 if(!calendar.token){calendar.connected=false;renderAgenda();return}
 const req=++calendar.request,from=calendar.week,until=new Date(from);until.setDate(until.getDate()+7);
 get("calendar-refresh").hidden=false;
 simpleStatus("Loading calendar","Reading your upcoming events from Google Calendar.");
 try{
  const url=new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
  url.searchParams.set("timeMin",from.toISOString());
  url.searchParams.set("timeMax",until.toISOString());
  url.searchParams.set("singleEvents","true");url.searchParams.set("orderBy","startTime");url.searchParams.set("maxResults","150");
  const response=await fetch(url,{headers:{Authorization:"Bearer "+calendar.token},cache:"no-store"});
  if(!response.ok)throw new Error(response.status===401?"expired":response.status===403?"permission":"unavailable");
  const payload=await response.json();
  if(req!==calendar.request)return;
  calendar.events=Array.isArray(payload.items)?payload.items:[];calendar.connected=true;
  get("calendar-refresh").hidden=false;renderAgenda();
 }catch(error){
  if(req!==calendar.request)return;
  calendar.connected=false;calendar.token=null;get("calendar-refresh").hidden=true;
  simpleStatus(error.message==="permission"?"Calendar permission needed":error.message==="expired"?"Calendar connection expired":"Calendar unavailable",
   error.message==="permission"?"Grant read-only Calendar access to view your events. Google Cloud configuration or verification may be required.":error.message==="expired"?"Reconnect Google Calendar to refresh your permission.":"Unable to load events. Check the Google Calendar API and your connection.",true);
 }
}
async function connectGoogle(){
 const button=get("calendar-connect");if(button)button.disabled=true;
 try{
  const {data:{user},error}=await db.auth.getUser();if(error||!user)throw new Error("Please log in again.");
  const {data:{session}}=await db.auth.getSession();const hasGoogle=user.identities?.some(identity=>identity.provider==="google");
  const options={redirectTo:new URL("dashboard.html?calendar=connected",location.href).href,scopes:"https://www.googleapis.com/auth/calendar.readonly",queryParams:{prompt:"consent"}};
  sessionStorage.setItem("helloearth-calendar-expected-user",user.id);
  const result=hasGoogle
   ?await db.auth.signInWithOAuth({provider:"google",options})
   :await db.auth.linkIdentity({provider:"google",options});
  if(result.error)throw result.error;
  if(result.data?.url)window.location.assign(result.data.url);
  else if(!session)throw new Error("Unable to start Google authorization.");
 }catch(error){
  simpleStatus("Google Calendar connection could not start",error.message||"Please try again.",true);
 }
}
get("calendar-prev").addEventListener("click",()=>{calendar.week.setDate(calendar.week.getDate()-7);calendar.date=new Date(calendar.week);renderWeek();if(calendar.token)refreshEvents()});
get("calendar-next").addEventListener("click",()=>{calendar.week.setDate(calendar.week.getDate()+7);calendar.date=new Date(calendar.week);renderWeek();if(calendar.token)refreshEvents()});
get("calendar-today").addEventListener("click",()=>{calendar.date=toDate(new Date());calendar.week=monday(calendar.date);renderWeek();if(calendar.token)refreshEvents()});
get("calendar-refresh").addEventListener("click",refreshEvents);
get("calendar-connect")?.addEventListener("click",connectGoogle);
db.auth.onAuthStateChange((_event,session)=>{
 if(session?.provider_token){
  calendar.token=session.provider_token;
  Promise.resolve().then(()=>refreshEvents());
 }
 if(!session){calendar.token=null;calendar.connected=false}
});
document.addEventListener("helloearth:languagechanged",()=>renderWeek());
async function restore(){
 const expected=sessionStorage.getItem("helloearth-calendar-expected-user");
 const {data:{user}}=await db.auth.getUser();
 if(expected){sessionStorage.removeItem("helloearth-calendar-expected-user");if(user?.id!==expected){simpleStatus("Calendar account mismatch","Your existing HelloEarth account was not confirmed after Google authorization. No student records were changed.",false);return}}
 const {data:{session}}=await db.auth.getSession();
 if(session?.provider_token){calendar.token=session.provider_token;await refreshEvents()}
}
setView(location.hash==="#students"?"students":"calendar");
renderWeek();restore().catch(()=>{});

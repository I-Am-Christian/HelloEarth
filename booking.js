import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./supabase-config.js";
const $=id=>document.getElementById(id);
const slug=new URLSearchParams(location.search).get("t")||"";
let profile=null,chosen=null,lastSlots=[],request=0;
const z=n=>String(n).padStart(2,"0");
function tutorDate(now,zone){
 const parts=Object.fromEntries(new Intl.DateTimeFormat("en-GB",{
  timeZone:zone,year:"numeric",month:"2-digit",day:"2-digit"
 }).formatToParts(now).map(part=>[part.type,part.value]));
 return parts.year+"-"+parts.month+"-"+parts.day;
}
function advance(date,days){
 const [y,m,d]=date.split("-").map(Number);
 return new Date(Date.UTC(y,m-1,d+days,12)).toISOString().slice(0,10);
}
function status(text,error=false,success=false){
 $("booking-status").textContent=text;
 $("booking-status").classList.toggle("is-error",error);
 $("booking-status").classList.toggle("is-good",success);
}
async function api(action,extra){
 const response=await fetch(SUPABASE_URL+"/functions/v1/he-public",{
  method:"POST",cache:"no-store",
  headers:{"Content-Type":"application/json","apikey":SUPABASE_PUBLISHABLE_KEY},
  body:JSON.stringify({action,slug,...extra})
 });
 let data={};try{data=await response.json()}catch{}
 if(!response.ok||data.error)throw Error(data.error||"Booking service unavailable.");
 return data;
}
function showSlots(slots){
 const root=$("booking-slots");
 root.replaceChildren();chosen=null;$("booking-choice").textContent="Choose a slot first.";$("booking-request").disabled=true;
 lastSlots=slots||[];
 if(!slots.length){
  const p=document.createElement("p");p.className="public-warning";
  p.textContent="No request slots for this date. Please try another available day.";
  root.append(p);return;
 }
 for(const slot of slots){
  const button=document.createElement("button");button.type="button";button.className="public-slot";
  button.textContent=slot.label;
  button.setAttribute("aria-pressed","false");
  button.addEventListener("click",()=>{
   chosen=slot;
   for(const other of root.querySelectorAll("button"))other.setAttribute("aria-pressed",String(other===button));
   const date=new Date(slot.start);
   $("booking-choice").textContent=date.toLocaleString(undefined,{
    timeZone:profile.timezone,weekday:"long",year:"numeric",month:"long",day:"numeric",
    hour:"2-digit",minute:"2-digit"})+" ("+profile.timezone+")";
   $("booking-request").disabled=false;
   status("Time selected. Enter your contact details to request this lesson.");
  });
  root.append(button);
 }
}
async function loadDay(){
 if(!profile)return;
 const index=++request;
 showSlots([]);
 status("Checking available request times…");
 try{
  const data=await api("slots",{day:$("booking-day").value});
  if(index!==request)return;
  showSlots(data.slots);
  status(data.slots.length+" available request "+(data.slots.length===1?"time":"times")+" on this date. Final confirmation comes from the tutor.");
 }catch(error){if(index!==request)return;status(error.message,true)}
}
async function setup(){
 if(!/^[a-z0-9][a-z0-9-]{2,31}$/.test(slug)){
  status("This booking link is incomplete. Ask the tutor for their personal Hello Earth booking address.",true);
  $("booking-request").disabled=true;return;
 }
 try{
  profile=await api("profile",{});
  $("booking-title").textContent="Book a lesson with "+profile.name+".";
  $("booking-intro").textContent="Choose a date and send a lesson request. The tutor will review availability before confirming.";
  const chips=$("booking-details");
  for(const text of [profile.timezone,profile.slotMinutes+"-minute lessons","Tutor approval required"]){
   const item=document.createElement("span");item.className="public-chip";item.textContent=text;chips.append(item);
  }
  const today=tutorDate(new Date(),profile.timezone);
  const field=$("booking-day");field.min=today;field.max=advance(today,20);field.value=today;
  await loadDay();
 }catch(error){status(error.message,true)}
}
$("booking-day").addEventListener("change",loadDay);
$("booking-form").addEventListener("submit",async event=>{
 event.preventDefault();
 if(!chosen||!lastSlots.some(slot=>slot.start===chosen.start)){
  status("Choose an available lesson time first.",true);return;
 }
 const form=event.currentTarget,data=new FormData(form),button=$("booking-request");
 button.disabled=true;status("Submitting your booking request…");
 try{
  const result=await api("request",{
   day:$("booking-day").value,start:chosen.start,
   name:String(data.get("name")||"").trim(),email:String(data.get("email")||"").trim(),
   note:String(data.get("note")||"").trim()
  });
  if(!result.pending)throw Error("The request was not confirmed.");
  status("Request received! The tutor must approve it. Please do not treat this as a confirmed lesson.",false,true);
  chosen=null;lastSlots=[];form.reset();await loadDay();
  status("Request received! Your lesson is pending tutor approval; please wait for their reply.",false,true);
 }catch(error){status(error.message,true)}
 finally{button.disabled=!chosen}
});
setup();

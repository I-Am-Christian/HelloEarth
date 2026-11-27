import { db } from "./supabase-client.js";
const overview=document.getElementById("overview-view");
if(overview){
 const intro=document.createElement("section");intro.className="he-home-intro";
 const top=document.createElement("div");top.className="he-home-top";
 const title=document.createElement("div");title.innerHTML='<span class="he-home-chip">YOUR TEACHING HOME</span><h2>Good day, educator 👋</h2><p>Welcome back. Here’s what your teaching day looks like.</p>';
 top.append(title);intro.append(top);
 const hero=document.createElement("section");hero.className="he-next-hero";hero.setAttribute("aria-label","Current or next appointment");
 hero.innerHTML='<div><span class="he-feature-label" id="he-feature-label">CURRENT CLASS</span><h3 id="he-next-title">Your next lesson</h3><span id="he-next-countdown" class="he-countdown" role="status" aria-live="off" hidden></span><p class="he-feature-time" id="he-next-time">Checking your schedule…</p><p class="he-feature-sub" id="he-next-sub">Your calendar at a glance</p><div class="he-feature-actions"><button type="button" id="he-next-calendar">View calendar</button><button type="button" id="he-next-students">My students</button></div></div><div class="he-feature-art" aria-hidden="true"><span class="he-planet"></span><span class="he-ring"></span><span class="he-star">✦</span></div>';
 const upcoming=document.createElement("section");upcoming.className="he-upcoming";upcoming.setAttribute("aria-label","Upcoming appointments");
 upcoming.innerHTML='<div class="he-upcoming-head"><h3>Up next</h3><button type="button" id="he-see-all">See calendar</button></div><div class="he-upcoming-list" id="he-upcoming-list"><p class="he-upcoming-empty">Connect Google Calendar to see your upcoming lessons here.</p></div>';
 const insert=overview.querySelector(".ws-summary");if(insert){overview.insertBefore(upcoming,insert);overview.insertBefore(hero,upcoming);overview.insertBefore(intro,hero)}
 const go=view=>document.getElementById(view+"-tab")?.click();
 const autoCard=document.createElement("section");autoCard.className="he-auto-prep";autoCard.innerHTML='<div class="he-auto-prep-head"><div><small>NOVA · AUTOMATIC PREPARATION</small><h3>Prepare my next lesson</h3></div><label class="he-auto-switch"><input type="checkbox" id="he-auto-prep-toggle" disabled><span aria-hidden="true"></span><span class="he-auto-switch-label">Enable</span></label></div><p>One private lesson draft per matched appointment, beginning 15 minutes before class. Uses the latest consented lesson review and your normal Nova allowance. Includes optional practice; never sends homework automatically.</p><p id="he-auto-prep-status" role="status">Checking setting…</p><div class="he-auto-prep-actions"><button type="button" id="he-auto-open-studio">Lesson Studio</button><a id="he-auto-ready" hidden target="_blank" rel="noopener">Open prepared lesson ↗</a></div>';
 hero.after(autoCard);
 const autoToggle=autoCard.querySelector("#he-auto-prep-toggle"),autoStatus=autoCard.querySelector("#he-auto-prep-status"),autoReady=autoCard.querySelector("#he-auto-ready");
 autoCard.querySelector("#he-auto-open-studio").onclick=()=>go("lessons");
 let autoOwner=null,autoEvents=[],autoComplete=false,autoSynced=false,autoBusy=false,autoAgain=false,autoHasCalendar=false;
 const autoApi=async body=>{const {data,error}=await db.functions.invoke("helloearth-notifications",{body});if(error){let msg=error.message;try{msg=(await error.context.json()).error||msg}catch{}throw Error(msg)}return data};
 async function autoStatusRefresh(){
  if(!autoOwner||!autoToggle.checked||autoBusy)return;
  const {data,error}=await db.from("he_auto_lesson_jobs").select("state,starts_at,generation_id,message").eq("tutor_id",autoOwner).gte("starts_at",new Date(Date.now()-60*60000).toISOString()).order("starts_at").limit(8);
  if(error)return;
  const latest=(data||[]).filter(x=>x.state==="ready"&&x.generation_id).at(0);
  autoReady.hidden=!latest;if(latest)autoReady.href="lesson.html#id="+encodeURIComponent(latest.generation_id);
  const next=(data||[]).find(x=>Date.parse(x.starts_at)>Date.now()&&x.state!=="cancelled")||latest;
  if(next)autoStatus.textContent=(next.state==="pending"?"Queued for "+new Date(Date.parse(next.starts_at)-15*60000).toLocaleString():next.state==="running"?"Nova is preparing your lesson…":next.state==="ready"?"Your lesson is ready for review.":next.message||"Preparation "+next.state)+".";
  else if(autoSynced)autoStatus.textContent="No eligible appointments queued. Link a student, enable personalisation and save a lesson review.";
 }
 const norm=x=>String(x||"").normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu," ").trim();
 async function syncAuto(){
  if(!autoOwner||!autoToggle.checked||!autoHasCalendar)return;
  if(autoBusy){autoAgain=true;return}
  const students=window.HelloEarthWorkspace?.students;if(!Array.isArray(students)||!students.length)return;
  autoBusy=true;
  try{
   const events=[];
   for(const e of autoEvents){
    if(!e.id||!e.calendarId||!e.start?.dateTime||!e.end?.dateTime||e.status==="cancelled"||e.transparency==="transparent")continue;
    const linked=e.extendedProperties?.private?.helloearth_student_id;
    const name=norm(e.summary);const candidates=linked?students.filter(s=>s.id===linked):/\b(lesson|class|tutoring|preply)\b/.test(name)?students.filter(s=>{const n=norm(s.display_name);return n.length>=4&&(" "+name+" ").includes(" "+n+" ")}):[];
    if(candidates.length!==1||candidates[0].ai_context_enabled!==true)continue;
    const start=Date.parse(e.start.dateTime),end=Date.parse(e.end.dateTime);if(start<=Date.now()||!Number.isFinite(end)||end<=start)continue;
    const event_key=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(e.calendarId+"|"+e.id)))).map(n=>n.toString(16).padStart(2,"0")).join("");
    events.push({event_key,student_id:candidates[0].id,starts_at:new Date(start).toISOString(),duration_minutes:Math.max(20,Math.min(120,Math.round((end-start)/60000)))});
   }
   const result=await autoApi({action:"auto-lesson-sync",events:events.slice(0,200),complete:autoComplete&&events.length<=200});
   autoSynced=true;autoStatus.textContent=(result.queued||0)+" eligible appointments synced. Drafts are prepared 15 minutes before class.";
  }catch(e){autoStatus.textContent="Could not sync automatic lessons: "+e.message}
  finally{autoBusy=false;if(autoAgain){autoAgain=false;syncAuto()}else autoStatusRefresh()}
 }
 autoToggle.addEventListener("change",async()=>{const desired=autoToggle.checked;autoToggle.disabled=true;try{await autoApi({action:"auto-lesson-toggle",enabled:desired});autoStatus.textContent=desired?"Enabled. Syncing your calendar…":"Automatic lesson preparation is off.";if(desired)syncAuto();else autoReady.hidden=true}catch(e){autoToggle.checked=!desired;autoStatus.textContent=e.message}finally{autoToggle.disabled=false}});
 document.addEventListener("helloearth:upcoming-events",e=>{autoHasCalendar=Boolean(e.detail?.connected);autoEvents=e.detail?.events||[];autoComplete=e.detail?.complete===true;syncAuto()});
 document.addEventListener("helloearth:studentsloaded",syncAuto);
 document.addEventListener("helloearth:calendar-disconnected",()=>{autoHasCalendar=false;autoEvents=[];autoComplete=false;if(autoToggle.checked){autoApi({action:"auto-lesson-sync",events:[],complete:true}).catch(()=>{});autoStatus.textContent="Calendar disconnected. Connect to queue lessons again."}});
 db.auth.getUser().then(async({data})=>{autoOwner=data?.user?.id;if(!autoOwner)return;const {data:setting,error}=await db.from("he_auto_lesson_settings").select("enabled").eq("tutor_id",autoOwner).maybeSingle();if(error)throw error;autoToggle.checked=setting?.enabled===true;autoToggle.disabled=false;autoStatus.textContent=autoToggle.checked?"Enabled · awaiting calendar sync":"Off · enable to prepare lessons automatically";if(autoToggle.checked){syncAuto();autoStatusRefresh()}}).catch(()=>{autoStatus.textContent="Automatic preparation setting unavailable."});
 setInterval(autoStatusRefresh,30000);

 document.getElementById("he-next-calendar")?.addEventListener("click",()=>go("calendar"));
 document.getElementById("he-next-students")?.addEventListener("click",()=>go("students"));
 document.getElementById("he-see-all")?.addEventListener("click",()=>go("calendar"));
 const set=(id,value)=>{const node=document.getElementById(id);if(node)node.textContent=value};
 const clock=date=>window.HelloEarthTime?.formatTime(date)||date.toLocaleTimeString(undefined,{hour:"2-digit",minute:"2-digit",hour12:false});
 const parsed=raw=>{if(raw?.dateTime)return new Date(raw.dateTime);if(raw?.date)return new Date(raw.date+"T00:00:00");return new Date(raw)};
 const dateLabel=raw=>{const d=parsed(raw);return Number.isFinite(d.getTime())?d.toLocaleDateString(undefined,{weekday:"short",month:"short",day:"numeric"})+" · "+(raw?.date?"All day":clock(d)):"Time unavailable"};
 const timeLabel=raw=>clock(parsed(raw));
 let appointments=[],connected=false,hasUpcoming=false;
 const countdown=document.getElementById("he-next-countdown");
 const render=()=>{
  const now=Date.now();
  const valid=appointments.filter(e=>e&&e.start&&Number.isFinite(parsed(e.start).getTime())&&parsed(e.end||e.start).getTime()>now)
    .sort((a,b)=>{
     const isCurrent=e=>Boolean(e.start?.dateTime&&e.end?.dateTime&&parsed(e.start).getTime()<=now&&parsed(e.end).getTime()>now);
     if(isCurrent(a)!==isCurrent(b))return isCurrent(a)?-1:1;
     return parsed(a.start)-parsed(b.start);
    });
  const list=document.getElementById("he-upcoming-list");if(!list)return;
  list.replaceChildren();
  // Prefer a class in progress over a class that has not started.
  // Ignore all-day events; they cannot establish a live lesson interval.
  const timed=valid.filter(e=>e.start?.dateTime&&e.end?.dateTime);
  const current=timed.filter(e=>parsed(e.start).getTime()<=now && parsed(e.end).getTime()>now)
    .sort((a,b)=>parsed(a.end)-parsed(b.end))[0];
  const next=timed.find(e=>parsed(e.start).getTime()>now);
  const featured=current||next;
  const label=document.getElementById("he-feature-label");
  if(label)label.textContent=current?"CLASS IN PROGRESS":next?"UP NEXT":"SCHEDULE";
  if(featured){
   countdown.hidden=false;
   if(current){
    const remaining=Math.max(0,Math.ceil((parsed(current.end).getTime()-now)/60000));
    countdown.textContent=remaining===1?"Class in progress · 1 minute remaining":"Class in progress · "+remaining+" minutes remaining";
    set("he-next-sub","Your current appointment on Google Calendar");
   }else{
    const mins=Math.max(0,Math.ceil((parsed(next.start).getTime()-now)/60000));
    countdown.textContent=mins===0?"Your next class starts now":mins===1?"1 minute until your next class":mins+" minutes until your next class";
    set("he-next-sub","Coming up on your connected Google Calendar");
   }
   set("he-next-title",featured.summary||"Untitled appointment");
   set("he-next-time",dateLabel(featured.start)+(featured.end?" – "+timeLabel(featured.end):""));
  }else{
   countdown.hidden=true;
   set("he-next-title",connected?"Your schedule is clear":"Your next lesson");
   set("he-next-time",connected?"No current or upcoming timed appointments":"Connect your calendar");
   set("he-next-sub",connected?"No classes are scheduled in the synced two-week window.":"See upcoming lessons and appointments here.");
  }
  if(!valid.length){
   const p=document.createElement("p");p.className="he-upcoming-empty";
   p.textContent=connected?"No upcoming appointments in the synced calendar window.":"Connect Google Calendar in the Calendar tab to see appointments.";
   list.append(p);return;
  }
  valid.slice(0,5).forEach(e=>{
   const item=document.createElement("div");item.className="he-upcoming-item";
   const avatar=document.createElement("span");avatar.className="he-event-avatar";avatar.textContent=(e.summary||"L").trim().slice(0,1).toUpperCase();
   const copy=document.createElement("span");copy.className="he-event-copy";
   const name=document.createElement("strong");name.textContent=e.summary||"Untitled appointment";
   const when=document.createElement("small");when.textContent=dateLabel(e.start)+(e.end&&!e.start?.date?" – "+timeLabel(e.end):"");
   copy.append(name,when);
   const btn=document.createElement("button");btn.className="he-event-action";btn.type="button";btn.textContent="Details";
   btn.addEventListener("click",()=>go("calendar"));item.append(avatar,copy,btn);list.append(item);
  });
 };
 document.addEventListener("helloearth:upcoming-events",event=>{hasUpcoming=true;connected=Boolean(event.detail?.connected);appointments=event.detail?.events||[];render()});
 document.addEventListener("helloearth:calendar-events",event=>{
  if(!hasUpcoming){connected=Boolean(event.detail?.connected);appointments=event.detail?.events||[];render()}
 });
 document.addEventListener("helloearth:calendar-disconnected",()=>{hasUpcoming=false;connected=false;appointments=[];render()});
 document.addEventListener("helloearth:time-format-changed",render);
 // Update the countdown as time advances, including after a hidden tab is reopened.
 window.setInterval(render,15000);
 document.addEventListener("visibilitychange",()=>{if(!document.hidden)render()});
 render();
 db.auth.getUser().then(({data})=>{const user=data?.user;if(!user)return;const name=String(user.user_metadata?.full_name||user.user_metadata?.name||"").trim().split(/\s+/)[0];if(name&&name.length<40){const h=title.querySelector("h2");if(h)h.textContent="Good day, "+name+" 👋"}}).catch(()=>{});
}

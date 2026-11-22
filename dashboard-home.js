import { db } from "./supabase-client.js";
const overview=document.getElementById("overview-view");
if(overview){
 const intro=document.createElement("section");intro.className="he-home-intro";
 const top=document.createElement("div");top.className="he-home-top";
 const title=document.createElement("div");title.innerHTML='<span class="he-home-chip">YOUR TEACHING HOME</span><h2>Good day, educator 👋</h2><p>Welcome back. Here’s what your teaching day looks like.</p>';
 top.append(title);intro.append(top);
 const hero=document.createElement("section");hero.className="he-next-hero";hero.setAttribute("aria-label","Next appointment");
 hero.innerHTML='<div><span class="he-feature-label">UP NEXT</span><h3 id="he-next-title">Your next lesson</h3><span id="he-next-countdown" class="he-countdown" role="status" aria-live="off" hidden></span><p class="he-feature-time" id="he-next-time">Checking your schedule…</p><p class="he-feature-sub" id="he-next-sub">Your calendar at a glance</p><div class="he-feature-actions"><button type="button" id="he-next-calendar">View calendar</button><button type="button" id="he-next-students">My students</button></div></div><div class="he-feature-art" aria-hidden="true"><span class="he-planet"></span><span class="he-ring"></span><span class="he-star">✦</span></div>';
 const upcoming=document.createElement("section");upcoming.className="he-upcoming";upcoming.setAttribute("aria-label","Upcoming appointments");
 upcoming.innerHTML='<div class="he-upcoming-head"><h3>Up next</h3><button type="button" id="he-see-all">See calendar</button></div><div class="he-upcoming-list" id="he-upcoming-list"><p class="he-upcoming-empty">Connect Google Calendar to see your upcoming lessons here.</p></div>';
 const insert=overview.querySelector(".ws-summary");if(insert){overview.insertBefore(upcoming,insert);overview.insertBefore(hero,upcoming);overview.insertBefore(intro,hero)}
 const go=view=>document.getElementById(view+"-tab")?.click();
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
    .sort((a,b)=>parsed(a.start)-parsed(b.start));
  const list=document.getElementById("he-upcoming-list");if(!list)return;
  list.replaceChildren();
  // Only a future timed appointment is a candidate for a start countdown.
  const next=valid.find(e=>e.start?.dateTime&&parsed(e.start).getTime()>=now);
  if(next){
   const mins=Math.max(0,Math.ceil((parsed(next.start).getTime()-now)/60000));
   countdown.hidden=false;
   countdown.textContent=mins===0?"Your next class starts now":mins===1?"1 minute until your next class":mins+" minutes until your next class";
   set("he-next-title",next.summary||"Upcoming appointment");
   set("he-next-time",dateLabel(next.start)+(next.end?" – "+timeLabel(next.end):""));
   set("he-next-sub","Coming up on your connected Google Calendar");
  }else{
   countdown.hidden=true;
   set("he-next-title",connected?"Your schedule is clear":"Your next lesson");
   set("he-next-time",connected?"No future timed appointments":"Connect your calendar");
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

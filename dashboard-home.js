import { db } from "./supabase-client.js";
const overview=document.getElementById("overview-view");
if(overview){
 const intro=document.createElement("section");intro.className="he-home-intro";
 const top=document.createElement("div");top.className="he-home-top";
 const title=document.createElement("div");title.innerHTML='<span class="he-home-chip">YOUR TEACHING HOME</span><h2>Good day, educator 👋</h2><p>Welcome back. Here’s what your teaching day looks like.</p>';
 top.append(title);intro.append(top);
 const hero=document.createElement("section");hero.className="he-next-hero";hero.setAttribute("aria-label","Next appointment");
 hero.innerHTML='<div><span class="he-feature-label">UP NEXT</span><h3 id="he-next-title">Your next lesson</h3><p class="he-feature-time" id="he-next-time">Checking your schedule…</p><p class="he-feature-sub" id="he-next-sub">Your calendar at a glance</p><div class="he-feature-actions"><button type="button" id="he-next-calendar">View calendar</button><button type="button" id="he-next-students">My students</button></div></div><div class="he-feature-art" aria-hidden="true"><span class="he-planet"></span><span class="he-ring"></span><span class="he-star">✦</span></div>';
 const upcoming=document.createElement("section");upcoming.className="he-upcoming";upcoming.setAttribute("aria-label","Upcoming appointments");
 upcoming.innerHTML='<div class="he-upcoming-head"><h3>Up next</h3><button type="button" id="he-see-all">See calendar</button></div><div class="he-upcoming-list" id="he-upcoming-list"><p class="he-upcoming-empty">Connect Google Calendar to see your upcoming lessons here.</p></div>';
 const insert=overview.querySelector(".ws-summary");if(insert){overview.insertBefore(upcoming,insert);overview.insertBefore(hero,upcoming);overview.insertBefore(intro,hero)}
 const go=view=>document.getElementById(view+"-tab")?.click();
 document.getElementById("he-next-calendar")?.addEventListener("click",()=>go("calendar"));
 document.getElementById("he-next-students")?.addEventListener("click",()=>go("students"));
 document.getElementById("he-see-all")?.addEventListener("click",()=>go("calendar"));
 const set=(id,value)=>{const node=document.getElementById(id);if(node)node.textContent=value};
 const dateLabel=(raw,weekday=false)=>{const d=new Date(raw);if(Number.isNaN(d.getTime()))return "Time unavailable";return d.toLocaleDateString(undefined,{weekday:weekday?"short":undefined,month:"short",day:"numeric"})+" · "+d.toLocaleTimeString(undefined,{hour:"2-digit",minute:"2-digit"})};
 const timeLabel=raw=>{const d=new Date(raw);return Number.isNaN(d.getTime())?"":d.toLocaleTimeString(undefined,{hour:"2-digit",minute:"2-digit"})};
 const render=events=>{
  const now=Date.now(), valid=(Array.isArray(events)?events:[]).filter(e=>e&&e.start&&(new Date(e.end||e.start).getTime()>now)).sort((a,b)=>new Date(a.start)-new Date(b.start));
  const list=document.getElementById("he-upcoming-list");if(!list)return;
  list.replaceChildren();
  if(!valid.length){set("he-next-title","Your schedule is clear");set("he-next-time","No upcoming appointments found");set("he-next-sub","You can plan a lesson from your calendar.");const p=document.createElement("p");p.className="he-upcoming-empty";p.textContent="No upcoming appointments in the currently synced calendar week.";list.append(p);return}
  const next=valid[0];set("he-next-title",next.summary||"Untitled appointment");set("he-next-time",dateLabel(next.start,true)+(next.end?" – "+timeLabel(next.end):""));set("he-next-sub","Coming up on your connected Google Calendar");
  valid.slice(0,5).forEach(e=>{const item=document.createElement("div");item.className="he-upcoming-item";const avatar=document.createElement("span");avatar.className="he-event-avatar";avatar.textContent=(e.summary||"L").trim().slice(0,1).toUpperCase();const copy=document.createElement("span");copy.className="he-event-copy";const name=document.createElement("strong");name.textContent=e.summary||"Untitled appointment";const when=document.createElement("small");when.textContent=dateLabel(e.start,true)+(e.end?" – "+timeLabel(e.end):"");copy.append(name,when);const btn=document.createElement("button");btn.className="he-event-action";btn.type="button";btn.textContent="Details";btn.addEventListener("click",()=>go("calendar"));item.append(avatar,copy,btn);list.append(item)});
 };
 document.addEventListener("helloearth:calendar-events",event=>render(event.detail?.events));
 document.addEventListener("helloearth:calendar-disconnected",()=>{set("he-next-title","Your next lesson");set("he-next-time","Connect your calendar");set("he-next-sub","See upcoming lessons and appointments here");const list=document.getElementById("he-upcoming-list");if(list){list.replaceChildren();const p=document.createElement("p");p.className="he-upcoming-empty";p.textContent="Connect Google Calendar in the Calendar tab to see appointments.";list.append(p)}});
 db.auth.getUser().then(({data})=>{const user=data?.user;if(!user)return;const name=String(user.user_metadata?.full_name||user.user_metadata?.name||"").trim().split(/\s+/)[0];if(name&&name.length<40){const h=title.querySelector("h2");if(h)h.textContent="Good day, "+name+" 👋"}}).catch(()=>{});
}

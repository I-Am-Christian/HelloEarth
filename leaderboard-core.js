/* Privacy-first shared leaderboard: only opted-in aliases and aggregate scores. */
import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from "./supabase-config.js";
const sections=[
 {key:"lessons",icon:"🎓",title:"Most lessons",sub:"Completed lessons recorded by tutors."},
 {key:"attendance",icon:"🌟",title:"Best attendance",sub:"Attended / (attended + missed), at least 10 records. Cancelled excluded."},
 {key:"bookings",icon:"📅",title:"Most popular",sub:"Confirmed requests through the Hello Earth booking page."},
 {key:"hours",icon:"⏱",title:"Most teaching hours",sub:"Hours from recorded completed lessons."}
];
const milestones=[0,100,250,500,750,1000];
const element=(tag,cls,content)=>{
 const n=document.createElement(tag);if(cls)n.className=cls;
 if(content!==undefined)n.textContent=String(content);return n;
};
const get=(root,query)=>root.querySelector(query);
const feeFor=count=>Math.round(Math.max(12,20-8*Math.min(1000,Math.max(0,Number(count)||0))/1000)*100)/100;
const pct=n=>Number(n||0).toFixed(2).replace(/\.?0+$/,"")+"%";
const money=(num,currency)=>{
 try{return new Intl.NumberFormat(undefined,{style:"currency",currency,maximumFractionDigits:2}).format(num)}
 catch{return num.toFixed(2)+" "+currency}
};
const value=(r,key)=>key==="attendance"?pct(r.attendanceRate):key==="hours"
 ?Number(r.teachingHours||0).toLocaleString():key==="bookings"
 ?Number(r.bookings||0).toLocaleString():Number(r.recordedLessons||0).toLocaleString();
async function call(action,details={},getToken){
 const headers={"Content-Type":"application/json","apikey":SUPABASE_PUBLISHABLE_KEY};
 if(action!=="list"){
  const token=await getToken?.();
  if(!token)throw Error("Please sign in again to manage your leaderboard settings.");
  headers.Authorization="Bearer "+token;
 }
 const response=await fetch(SUPABASE_URL+"/functions/v1/he-leaderboard",{
  method:"POST",cache:"no-store",headers,body:JSON.stringify({action,...details})
 });
 let body={};try{body=await response.json()}catch{}
 if(!response.ok||body.error)throw Error(body.error||"Unable to load leaderboard.");
 return body;
}
function board(root,data,category){
 const info=sections.find(x=>x.key===category)||sections[0];
 get(root,"[data-board-name]").textContent=info.icon+" "+info.title;
 get(root,"[data-board-method]").textContent=info.sub;
 get(root,"[data-participants]").textContent=(data?.participants||0)+" opted-in tutors";
 const results=data?.boards?.[category]||[];
 root.querySelectorAll("[data-category]").forEach(btn=>{
  const chosen=btn.dataset.category===category;
  btn.setAttribute("aria-selected",String(chosen));btn.classList.toggle("active",chosen);
 });
 const dest=get(root,"[data-standings]");dest.replaceChildren();
 if(!results.length){
  const empty=element("div","hl-empty");
  empty.append(element("span","hl-empty-symbol","✧"),
   element("strong","","No ranked tutors yet"),
   element("p","","This category fills as tutors voluntarily publish their recorded activity."));
  dest.append(empty);return;
 }
 const podium=element("div","hl-podium");
 results.slice(0,3).forEach((t,i)=>{
  const card=element("div","hl-podium-card place-"+(i+1));
  card.append(element("span","hl-medal",["🥇","🥈","🥉"][i]),
   element("span","hl-big-avatar",(t.name||"T").charAt(0).toUpperCase()),
   element("strong","hl-podium-name",t.name),element("strong","hl-podium-value",value(t,category)));
  card.append(element("small","",category==="attendance"?"attendance rate":category==="hours"?"hours":category==="bookings"?"confirmed requests":"recorded lessons"));
  podium.append(card);
 });dest.append(podium);
 const list=element("div","hl-list");
 results.forEach((t,i)=>{
  const row=element("div","hl-item");
  row.append(element("span","hl-rank",String(i+1).padStart(2,"0")),
   element("span","hl-avatar",(t.name||"T").charAt(0).toUpperCase()));
  const main=element("div","hl-item-body");
  main.append(element("strong","",t.name));
  main.append(element("small","",category==="attendance"
   ?t.attendanceSamples+" recorded outcomes"
   :t.recordedLessons+" completed lessons recorded"));
  if(t.badges?.length){
   const awards=element("div","hl-badge-list");
   t.badges.slice(0,2).forEach(x=>awards.append(element("span","hl-badge",x)));
   main.append(awards);
  }
  row.append(main,element("strong","hl-item-score",value(t,category)));
  list.append(row);
 });dest.append(list);
}
function updateCalculator(root,fee){
 const amount=Math.max(0,Number(get(root,"[data-price]")?.value||0));
 const currency=get(root,"[data-currency]")?.value||"ZAR";
 get(root,"[data-fee]").textContent=money(amount*fee/100,currency);
 get(root,"[data-keep]").textContent=money(amount*(1-fee/100),currency);
 get(root,"[data-save]").textContent=money(amount*(20-fee)/100,currency);
}
function privateStats(root,data){
 const s=data.stats||{},r=data.reward||{};
 const fmt=n=>Number(n||0).toLocaleString();
 get(root,"[data-mine-lessons]").textContent=fmt(s.recordedLessons);
 get(root,"[data-mine-attendance]").textContent=s.attendanceRate==null?"Requires 10 records":pct(s.attendanceRate);
 get(root,"[data-mine-bookings]").textContent=fmt(s.bookings);
 get(root,"[data-mine-hours]").textContent=fmt(s.teachingHours);
 get(root,"[data-verified]").textContent=fmt(r.verifiedPaidLessons);
 get(root,"[data-current-fee]").textContent=pct(r.proposedFeePercent);
 get(root,"[data-preview-fee]").textContent=pct(r.basedOnRecordedLessonsPreview);
 get(root,"[data-remaining]").textContent=fmt(r.lessonsToMinimumFee);
 const progress=get(root,"[data-progress]");
 progress.style.width=Math.min(100,Number(r.verifiedPaidLessons||0)/10)+"%";
 progress.setAttribute("aria-valuenow",String(r.verifiedPaidLessons||0));
 const tiers=get(root,"[data-milestones]");tiers.replaceChildren();
 milestones.forEach(n=>{
  const item=element("div","hl-step"+((r.verifiedPaidLessons||0)>=n?" reached":""));
  item.append(element("strong","",n.toLocaleString()+" lessons"),element("small","",pct(feeFor(n))+" fee"));
  tiers.append(item);
 });
 const b=get(root,"[data-my-badges]");b.replaceChildren();
 if(s.badges?.length)s.badges.forEach(n=>b.append(element("span","hl-badge",n)));
 else b.append(element("span","hl-muted","Activity badges unlock as you record milestones."));
 updateCalculator(root,r.proposedFeePercent||20);
}
export function mountLeaderboard(root,{privateMode=false,getToken=null}={}){
 if(!root)return null;root.classList.add("hl-root");
 root.innerHTML=[
 '<div class="hl-hero"><div><span class="hl-eyebrow">HELLO EARTH / TUTOR COMMUNITY</span><h2>',
 privateMode?"Tutor leaderboard & rewards":"Tutor leaderboard",
 '</h2><p>Celebrate teaching consistency, popularity and achievements—without exposing your students.</p><div class="hl-chips"><span>🏆 Community rankings</span><span>✦ Milestone badges</span><span>📉 Proposed loyalty rewards</span></div></div>',
 '<div class="hl-highlight"><small>PROPOSED PLATFORM SERVICE FEE</small><strong>20% <em>→</em> 12%</strong><span>At 1,000 platform-verified paid lessons. Not a government tax discount.</span></div></div>',
 '<section class="hl-section"><div class="hl-heading"><div><span class="hl-eyebrow">THE COMMUNITY</span><h3>Celebrate our tutors.</h3><p>Only voluntarily published aliases and aggregate records appear.</p></div><button type="button" class="hl-refresh" data-refresh>↻ Refresh</button></div>',
 '<div class="hl-tabs" role="tablist" aria-label="Leaderboard category">',
 ...sections.map(s=>'<button role="tab" type="button" data-category="'+s.key+'">'+s.icon+' '+s.title+'</button>'),
 '</div><div class="hl-board-heading"><div><strong data-board-name></strong><p data-board-method></p></div><span data-participants></span></div>',
 '<div data-standings class="hl-standings" aria-live="polite"></div>',
 '<p class="hl-fineprint">These rankings use tutor-entered activity and are provisional, not externally verified. Attendance ranking requires at least ten records; popularity counts confirmed Hello Earth booking requests, not outside bookings. Public rankings cannot change financial fees.</p>',
 '<p data-general-status class="hl-status" aria-live="polite"></p></section>',
 privateMode?[
 '<section class="hl-section hl-my-card"><div class="hl-heading"><div><span class="hl-eyebrow">MY ACHIEVEMENTS</span><h3>Your teaching journey</h3><p>Keep your data private or opt in to be recognised publicly.</p></div></div>',
 '<div class="hl-stat-grid"><div><small>Completed lessons recorded</small><strong data-mine-lessons>—</strong></div><div><small>Attendance</small><strong data-mine-attendance>—</strong></div>',
 '<div><small>Confirmed requests</small><strong data-mine-bookings>—</strong></div><div><small>Hours taught</small><strong data-mine-hours>—</strong></div></div>',
 '<div class="hl-my-badges" data-my-badges></div>',
 '<form data-publish class="hl-publish"><label>Public tutor display name<input type="text" data-name minlength="2" maxlength="65" required placeholder="How would you like to appear?" autocomplete="nickname"></label>',
 '<label class="hl-check"><input type="checkbox" data-optin><span><strong>Show me on the public leaderboard</strong><small>Only my chosen display name and aggregate activity. Never student names, lesson notes, or emails. I can opt out.</small></span></label>',
 '<button type="submit" class="hl-button">Save leaderboard preferences</button><p data-private-status class="hl-status" role="status" aria-live="polite"></p></form></section>',
 '<section class="hl-section hl-rewards"><div class="hl-heading"><div><span class="hl-eyebrow">REWARDS / FUTURE BILLING</span><h3>Less platform fee as you grow.</h3><p>Proposed Hello Earth service fee—not government tax. Only platform-verified paid lessons qualify.</p></div></div>',
 '<div class="hl-reward-grid"><div><small>Verified paid lessons</small><strong data-verified>0</strong><span>Payment verification not yet available</span></div>',
 '<div><small>Proposed fee rate</small><strong data-current-fee>20%</strong><span>Not charged or deducted yet</span></div>',
 '<div><small>More lessons to 12%</small><strong data-remaining>1,000</strong><span>Verified platform-paid lessons</span></div></div>',
 '<div class="hl-track"><div data-progress role="progressbar" aria-label="Verified paid lessons towards 1000" aria-valuemin="0" aria-valuemax="1000" aria-valuenow="0"></div></div>',
 '<div class="hl-milestones" data-milestones></div>',
 '<p class="hl-fineprint">Your self-recorded lessons would correspond to an illustrative <strong data-preview-fee>20%</strong> fee level. Manual records do not qualify for financial discounts.</p>',
 '<div class="hl-calculator"><h4>Lesson fee calculator</h4><p>Preview potential earnings before government tax, VAT, and payment fees.</p>',
 '<div class="hl-input-grid"><label>Lesson price<input type="number" min="0" max="1000000" step=".01" data-price value="200"></label>',
 '<label>Currency<select data-currency><option value="ZAR">ZAR</option><option value="USD">USD</option><option value="EUR">EUR</option><option value="GBP">GBP</option></select></label></div>',
 '<div class="hl-calculation"><div><small>Platform service fee</small><strong data-fee></strong></div><div><small>Tutor receives</small><strong data-keep></strong></div><div><small>Saved vs 20%</small><strong data-save></strong></div></div>',
 '<p class="hl-fineprint">Preview only. Hello Earth does not currently take payments or deduct this service fee. Your legal tax obligations do not change.</p></div></section>'
 ].join(""):[
 '<section class="hl-section hl-join"><h3>Teaching on Hello Earth?</h3><p>Sign in to see personal milestones, earn activity badges and choose whether to appear publicly.</p>',
 '<a class="hl-button" href="dashboard.html">Open my tutor dashboard</a>',
 '<p class="hl-fineprint">The proposed 20% to 12% rewards program is not currently a billing product and does not change government taxes.</p></section>'
 ].join("")
 ].join("");
 let selected="lessons",data=null,myData=null,started=false;
 const status=get(root,"[data-general-status]");
 async function refreshBoard(){
  status.textContent="Loading rankings…";status.classList.remove("is-error");
  try{
   data=await call("list");board(root,data,selected);
   status.textContent=data.participants
    ?"Rankings use current recorded activity and opt-in aliases."
    :"No public entries yet. Opt-in participation is disabled by default.";
  }catch(err){status.textContent=err.message;status.classList.add("is-error")}
 }
 async function refreshMine(){
  if(!privateMode)return;
  const status=get(root,"[data-private-status]");
  try{
   myData=await call("mine",{},getToken);
   get(root,"[data-name]").value=myData.profile.name||"";
   get(root,"[data-optin]").checked=myData.profile.public===true;
   privateStats(root,myData);
   status.textContent=myData.profile.public
    ?"Your public alias and aggregate results can appear in rankings."
    :"Your leaderboard participation is private.";
  }catch(err){status.textContent=err.message;status.classList.add("is-error")}
 }
 root.querySelectorAll("[data-category]").forEach(btn=>btn.addEventListener("click",()=>{
  selected=btn.dataset.category;board(root,data,selected);
 }));
 get(root,"[data-refresh]").addEventListener("click",()=>{refreshBoard();refreshMine()});
 if(privateMode){
  get(root,"[data-publish]").addEventListener("submit",async e=>{
   e.preventDefault();
   const status=get(root,"[data-private-status]");
   const save=e.currentTarget.querySelector("button[type=submit]");
   save.disabled=true;status.textContent="Saving your preferences…";status.classList.remove("is-error");
   try{
    myData=await call("save",{
     name:get(root,"[data-name]").value.trim(),
     isPublic:get(root,"[data-optin]").checked
    },getToken);
    privateStats(root,myData);
    status.textContent=myData.profile.public
     ?"You joined the leaderboard. Only your chosen name and aggregate counts are public."
     :"You opted out of public rankings.";
    await refreshBoard();
   }catch(err){status.textContent=err.message;status.classList.add("is-error")}
   finally{save.disabled=false}
  });
  for(const key of ["[data-price]","[data-currency]"]){
   get(root,key).addEventListener("input",()=>updateCalculator(root,myData?.reward?.proposedFeePercent||20));
  }
  updateCalculator(root,20);
 }
 async function load(){if(started)return;started=true;await refreshBoard();await refreshMine()}
 return {load,refresh:async()=>{await refreshBoard();await refreshMine()}};
}
export {feeFor};

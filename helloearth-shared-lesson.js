import {db} from "./supabase-client.js";
import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from "./supabase-config.js";
import {renderWorkbook} from "./helloearth-workbook-renderer.js";
// One-way tutor presentation. Public guests can view with a signed link,
// follow scrolling, and make LOCAL drawings; only the owner can save/sync.
const el=id=>document.getElementById(id);
const token=decodeURIComponent(location.hash.replace(/^#t=/,""));
const valid=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}\.[a-f0-9-]{36}\.[a-f0-9]{64}$/i;
const ns="http://www.w3.org/2000/svg";
let loaded=false,presenter=false,lesson=null,latestUpdated="",sharedStrokes=[],localStrokes=[],tool="view",active=null;
let dead=false,busyPoll=false,seen=false,syncEnabled=false,canFollow=true,isProgrammatic=false;
let writing=false,pending=null,writeTimer=null,lastWrite=0;
let inkChannel=null,inkReady=false,guestInk=new Map(),textInk=[],remoteText=new Map();const author=crypto.randomUUID();
const paper=el("share-paper"),svg=el("share-annotations"),follow=el("share-follow"),presentSync=el("share-presenter-sync");
function msg(content,error=false){
 const node=el("share-connection");node.textContent=content;
 node.style.color=error?"#ffb8c6":"#c7deee";
}
function failure(text){
 dead=true;loaded=false;if(inkChannel){db.removeChannel(inkChannel);inkReady=false}
 el("share-error").hidden=false;el("share-error").textContent=text;
 el("share-content").replaceChildren();
 el("share-title").textContent="Lesson unavailable";msg(text,true);
 el("share-copy").disabled=true;el("share-download").disabled=true;el("share-print").disabled=true;
}
async function api(action,extra={},authorized=false){
 const headers={"content-type":"application/json","apikey":SUPABASE_PUBLISHABLE_KEY};
 if(authorized){
  const {data:{session},error}=await db.auth.getSession();
  if(error||!session?.access_token)throw Error("Sign in to HelloEarth to present this lesson.");
  headers.authorization="Bearer "+session.access_token;
 }
 const response=await fetch(SUPABASE_URL+"/functions/v1/he-lesson-sharing",{
  method:"POST",headers,cache:"no-store",referrerPolicy:"no-referrer",
  body:JSON.stringify({action,token,...extra})
 });
 const data=await response.json().catch(()=>({}));
 if(!response.ok){const err=new Error(data.error||"Lesson connection unavailable.");err.status=response.status;throw err}
 return data;
}
function remaining(){
 if(!lesson)return;
 const ms=Date.parse(lesson.state.expiresAt)-Date.now();
 if(ms<=0){failure("This lesson link has expired. Ask your tutor for a new share link.");return}
 const days=Math.floor(ms/86400000),hours=Math.floor(ms%86400000/3600000);
 el("share-countdown").textContent="Expires in "+(days?days+"d ":"")+hours+"h";
}
function getRatio(){
 const max=Math.max(1,document.documentElement.scrollHeight-window.innerHeight);
 return Math.max(0,Math.min(1,window.scrollY/max));
}
function scrollToRatio(ratio){
 if(!canFollow||presenter||!syncEnabled||tool!=="view")return;
 const max=Math.max(0,document.documentElement.scrollHeight-window.innerHeight);
 const target=ratio*max;
 if(Math.abs(window.scrollY-target)<8)return;
 isProgrammatic=true;
 window.scrollTo({top:target,behavior:"smooth"});
 setTimeout(()=>{isProgrammatic=false},700);
}
function pathFor(points){
 return points.map((p,i)=>(i?"L":"M")+(p[0]*1000).toFixed(2)+","+(p[1]*1000).toFixed(2)).join(" ");
}
function drawStroke(stroke,local=false){
 const path=document.createElementNS(ns,"path");
 path.setAttribute("d",pathFor(stroke.points));
 path.setAttribute("stroke",stroke.color);
 path.setAttribute("stroke-width",stroke.tool==="highlight"?"25":"3.5");
 path.setAttribute("stroke-opacity",stroke.tool==="highlight"?"0.31":"0.96");
 path.setAttribute("vector-effect","non-scaling-stroke");
 path.setAttribute("data-ink",local?"local":"shared");
 return path;
}
function textNodes(){const walker=document.createTreeWalker(el("share-content"),NodeFilter.SHOW_TEXT);const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);return nodes}
function textOffset(node,offset){const range=document.createRange();range.selectNodeContents(el("share-content"));range.setEnd(node,offset);return range.toString().length}
function textRange(start,end){let a=null,b=null,n=0;for(const node of textNodes()){const next=n+node.length;if(!a&&start<=next)a=[node,Math.max(0,start-n)];if(!b&&end<=next)b=[node,Math.max(0,end-n)];n=next}if(!a||!b)return null;const range=document.createRange();range.setStart(...a);range.setEnd(...b);return range}
function paintText(mark){
 const range=textRange(mark.start,mark.end);if(!range)return;
 const base=svg.getBoundingClientRect();if(!base.width||!base.height)return;
 for(const rect of range.getClientRects()){
  const node=document.createElementNS(ns,"rect");node.setAttribute("x",(rect.left-base.left)/base.width*1000);node.setAttribute("y",(rect.top-base.top)/base.height*1000);node.setAttribute("width",rect.width/base.width*1000);node.setAttribute("height",rect.height/base.height*1000);node.setAttribute("fill",mark.color);node.setAttribute("opacity",".28");svg.append(node);
 }
}
const colors={has:value=>typeof value==="string"&&/^#[0-9a-f]{6}$/i.test(value)};
function validStroke(s){return s&&["pen","highlight"].includes(s.tool)&&colors.has(s.color)&&Array.isArray(s.points)&&s.points.length>=2&&s.points.length<=320&&s.points.every(p=>Array.isArray(p)&&p.length===2&&p.every(n=>typeof n==="number"&&n>=0&&n<=1))}
function validMark(m){return m&&colors.has(m.color)&&Number.isInteger(m.start)&&Number.isInteger(m.end)&&m.start>=0&&m.end>m.start&&m.end<=el("share-content").textContent.length}
function sendInk(){if(!inkReady||dead)return;inkChannel.send({type:"broadcast",event:"ink",payload:{author,strokes:localStrokes.slice(-60),text:textInk.slice(-100)}}).catch(()=>msg("Annotation connection interrupted.",true))}
async function connectInk(){
 const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(token));
 const room=Array.from(new Uint8Array(bytes),n=>n.toString(16).padStart(2,"0")).join("");
 inkChannel=db.channel("he-lesson-ink-"+room,{config:{broadcast:{self:false,ack:true}}});
 inkChannel.on("broadcast",{event:"ink"},({payload:p})=>{
  if(dead||!p||typeof p.author!=="string"||p.author===author||p.author.length>64||(!guestInk.has(p.author)&&guestInk.size>=40))return;
  if(Array.isArray(p.strokes))guestInk.set(p.author,p.strokes.slice(0,60).filter(validStroke));
  if(Array.isArray(p.text))remoteText.set(p.author,p.text.slice(0,100).filter(validMark));
  paintStrokes();
 }).on("broadcast",{event:"request"},()=>sendInk()).subscribe(status=>{
  inkReady=status==="SUBSCRIBED";if(inkReady){sendInk();inkChannel.send({type:"broadcast",event:"request",payload:{}})}
 });
}
function highlightSelection(){
 if(dead||!loaded||tool!=="text")return;
 const selection=window.getSelection();if(!selection||selection.isCollapsed||!selection.rangeCount)return;
 const range=selection.getRangeAt(0),content=el("share-content");
 if(!content.contains(range.startContainer)||!content.contains(range.endContainer))return;
 const start=textOffset(range.startContainer,range.startOffset),end=textOffset(range.endContainer,range.endOffset);
 if(end<=start)return;
 textInk.push({start,end,color:el("share-ink").value});if(textInk.length>100)textInk.shift();
 selection.removeAllRanges();paintStrokes();sendInk();
}
const highlightButton=document.createElement("button");highlightButton.type="button";highlightButton.textContent="Apply text highlight";highlightButton.hidden=true;
highlightButton.addEventListener("pointerdown",e=>e.preventDefault());highlightButton.addEventListener("click",highlightSelection);
document.querySelector(".share-tool-modes").after(highlightButton);
document.addEventListener("keydown",e=>{if(tool==="text"&&e.key==="Enter"&&!["INPUT","SELECT","BUTTON","TEXTAREA"].includes(document.activeElement?.tagName)){highlightSelection()}});
window.addEventListener("resize",()=>paintStrokes());if(window.ResizeObserver)new ResizeObserver(()=>paintStrokes()).observe(paper);
function paintStrokes(){
 svg.replaceChildren();
 for(const stroke of sharedStrokes)svg.append(drawStroke(stroke));
 for(const strokes of guestInk.values())for(const stroke of strokes)svg.append(drawStroke(stroke));
 for(const marks of remoteText.values())for(const mark of marks)paintText(mark);
 for(const mark of textInk)paintText(mark);
 for(const stroke of localStrokes)svg.append(drawStroke(stroke,true));
 if(active)svg.append(drawStroke(active,true));
 const canUndo=textInk.length>0||localStrokes.length>0||(presenter&&sharedStrokes.length>0);
 el("share-undo").disabled=!canUndo;
 el("share-clear").disabled=!canUndo;
}
function setTool(next){
 tool=next;active=null;
 for(const btn of document.querySelectorAll("[data-tool]")){
  const on=btn.dataset.tool===tool;btn.classList.toggle("selected",on);
  btn.setAttribute("aria-pressed",String(on));
 }
 svg.classList.toggle("is-annotating",tool==="pen"||tool==="highlight");
 highlightButton.hidden=tool!=="text";
 el("share-draw-hint").textContent=tool==="text"?"Select words with your mouse or touch, then Apply text highlight.": "Teacher and student annotations are shared live while connected.";
 paintStrokes();
}
function pointFrom(event){
 const rect=svg.getBoundingClientRect();
 return [Math.max(0,Math.min(1,(event.clientX-rect.left)/Math.max(1,rect.width))),
  Math.max(0,Math.min(1,(event.clientY-rect.top)/Math.max(1,rect.height)))];
}
svg.addEventListener("pointerdown",event=>{
 if(dead||tool==="view"||event.button!==0)return;
 event.preventDefault();
 const stroke={tool,color:el("share-ink").value,points:[pointFrom(event)]};
 active=stroke;
 svg.setPointerCapture(event.pointerId);
 paintStrokes();
});
svg.addEventListener("pointermove",event=>{
 if(!active)return;
 const p=pointFrom(event),prev=active.points.at(-1);
 if(Math.hypot((p[0]-prev[0])*svg.clientWidth,(p[1]-prev[1])*svg.clientHeight)<5)return;
 if(active.points.length<320)active.points.push(p);
 paintStrokes();
});
function finish(event){
 if(!active)return;
 const p=pointFrom(event),stroke=active;active=null;
 if(stroke.points.length<2)stroke.points.push([Math.min(1,stroke.points[0][0]+0.001),Math.min(1,stroke.points[0][1]+0.001)]);
 if(presenter&&["#8456d5","#dc6a85","#46a49a","#dba84b","#28385f"].includes(stroke.color)){
  sharedStrokes.push(stroke);
  if(sharedStrokes.length>155)sharedStrokes.shift();
  queue({annotations:sharedStrokes});
 }else{
  localStrokes.push(stroke);
  if(localStrokes.length>60)localStrokes.shift();sendInk();
 }
 paintStrokes();
}
svg.addEventListener("pointerup",finish);
svg.addEventListener("pointercancel",finish);
function queue(change){
 if(!presenter||dead)return;
 pending={...(pending||{}),...change};
 if(!writeTimer)writeTimer=setTimeout(flush,Math.max(120,800-(Date.now()-lastWrite)));
}
async function flush(){
 if(writeTimer){clearTimeout(writeTimer);writeTimer=null}
 if(!pending||writing||dead)return;
 const data=pending;pending=null;writing=true;lastWrite=Date.now();
 try{
  const result=await api("update",data,true);
  latestUpdated=result.state.updatedAt;
 }catch(error){
  if(error.status===429){pending={...data,...(pending||{})}}
  else if(error.status===410){failure("Lesson sharing was ended or expired.")}
  else msg("Presentation update was interrupted. Retry drawing or scrolling.",true);
 }finally{
  writing=false;
  if(pending&&!dead)writeTimer=setTimeout(flush,Math.max(650,850-(Date.now()-lastWrite)));
 }
}
el("share-undo").addEventListener("click",()=>{
 if(tool==="text"&&textInk.length)textInk.pop();
 else if(localStrokes.length)localStrokes.pop();
 else if(presenter&&sharedStrokes.length){sharedStrokes.pop();queue({annotations:sharedStrokes})}
 else textInk.pop();sendInk();
 paintStrokes();
});
el("share-clear").addEventListener("click",()=>{
 if(!confirm("Clear your own annotations for everyone?"))return;
 textInk=[];sendInk();
 if(presenter){sharedStrokes=[];queue({annotations:[]})}
 localStrokes=[];
 sendInk();paintStrokes();
});
for(const btn of document.querySelectorAll("[data-tool]"))btn.addEventListener("click",()=>setTool(btn.dataset.tool));
el("share-follow").addEventListener("change",()=>{
 canFollow=follow.checked;
 msg(canFollow?"Following presenter when syncing is enabled.":"Follow teacher paused. Scroll independently.");
 if(canFollow&&lesson?.state)scrollToRatio(lesson.state.scrollRatio);
});
for(const control of ["wheel","touchstart"])window.addEventListener(control,()=>{
 if(!presenter&&canFollow&&!isProgrammatic&&syncEnabled&&tool==="view"){
  canFollow=false;follow.checked=false;msg("Follow teacher paused. Turn it on to resynchronise.");
 }
},{passive:true});
presentSync.addEventListener("change",()=>{
 syncEnabled=presentSync.checked;
 queue({syncEnabled,scrollRatio:getRatio()});
 msg(syncEnabled?"Presenter scrolling will sync to students with Follow enabled.":"Student scrolling sync is off.");
});
let scrollTimer=null;
window.addEventListener("scroll",()=>{
 if(!presenter||!syncEnabled||tool!=="view"||!loaded||dead)return;
 if(scrollTimer)return;
 scrollTimer=setTimeout(()=>{scrollTimer=null;queue({scrollRatio:getRatio()})},350);
},{passive:true});
function updateState(state){
 if(!state||dead)return;
 if(!lesson)lesson={state};else lesson.state=state;
 const wasSync=syncEnabled;
 syncEnabled=state.syncEnabled===true;
 presentSync.checked=syncEnabled;
 if(state.updatedAt!==latestUpdated){
  latestUpdated=state.updatedAt;
  if(!presenter||(!pending&&!writing)){
   sharedStrokes=Array.isArray(state.annotations)?state.annotations:[];
   paintStrokes();
  }
 }
 if(!presenter&&canFollow&&syncEnabled){
  scrollToRatio(Number(state.scrollRatio)||0);
 }
 if(!presenter&&wasSync!==syncEnabled){
  msg(syncEnabled?"Teacher scrolling is live; Follow teacher is on.":"Teacher scrolling sync is off. You can browse independently.");
 }
}
let requestInFlight=false;
async function poll(){
 if(requestInFlight||dead||!loaded)return;
 requestInFlight=true;
 try{
  const response=await api("state");
  updateState(response.state);
  if(seen){msg(presenter?
   (syncEnabled?"Presenter connected · scrolling is shared":"Presenter connected · scrolling sync is off"):
   (syncEnabled&&canFollow?"Live · following teacher":syncEnabled?"Live · independent scrolling":"Connected · awaiting teacher sync"));
  }
  seen=true;
 }catch(error){
  if(error.status===410)failure("This lesson link expired or was revoked by the tutor.");
  else msg("Connection interrupted — retrying…",true);
 }finally{requestInFlight=false}
}
async function checkPresenter(){
 try{
  const {data:{session}}=await db.auth.getSession();
  if(!session?.access_token)return;
  await db.auth.getUser();
  const result=await api("role",{},true);
  if(!result.presenter)return;
  presenter=true;
  el("share-role").textContent="Teacher · presenter";
  el("share-follow-label").hidden=true;
  el("share-presenter-label").hidden=false;
  el("share-end").hidden=false;
  syncEnabled=result.state.syncEnabled===true;
  presentSync.checked=syncEnabled;
  msg("Presenter mode active. Use Sync students' scrolling when you want learners to follow.");
 }catch{ /* Guests are viewers. Login is never required to read. */ }
}
el("share-end").addEventListener("click",async()=>{
 if(!presenter||!confirm("End this shared lesson for everyone? All viewers will lose access to this link."))return;
 try{await api("revoke",{},true);failure("The lesson link has been ended. Create another share link from Lesson Studio if needed.")}
 catch(error){msg(error.message,true)}
});
el("share-copy").addEventListener("click",async()=>{
 try{await navigator.clipboard.writeText(location.href);msg("Student link copied. Anyone with this link can view until it expires.")}
 catch{msg("Couldn't copy the link automatically. Copy it from the address bar.",true)}
});
el("share-print").addEventListener("click",()=>window.print());
el("share-download").addEventListener("click",()=>{
 if(!lesson?.markdown)return;
 const url=URL.createObjectURL(new Blob([lesson.markdown],{type:"text/markdown;charset=utf-8"}));
 const a=document.createElement("a");a.href=url;a.download="helloearth-shared-lesson.md";
 document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1200);
});
async function open(){
 if(!valid.test(token)){failure("Invalid shared lesson link. Ask your tutor to create a new public share link.");return}
 try{
  const response=await api("open");
  lesson=response;
  renderWorkbook(el("share-content"),response.markdown);
  el("share-title").textContent=response.topic;
  el("share-level").textContent="CEFR "+response.cefrLevel;
  el("share-duration").textContent=response.durationMinutes+" minutes";
  el("share-date").textContent="Shared lesson";
  if(response.kind==="homework")document.querySelector(".paper-identity-tag").textContent="PRACTICE";
  document.title=response.topic+" | HelloEarth live lesson";
  el("share-copy").disabled=false;el("share-download").disabled=false;el("share-print").disabled=false;
  loaded=true;sharedStrokes=Array.isArray(response.state.annotations)?response.state.annotations:[];
  updateState(response.state);paintStrokes();remaining();
  msg("Lesson loaded. Checking if you're the presenter…");
  await checkPresenter();
  connectInk().catch(()=>msg("Live annotation connection unavailable.",true));
  if(!presenter)msg("Ready to read · no login required. Use Follow teacher to sync scrolling.");
  setInterval(()=>{remaining();poll()},1700);
 }catch(error){failure(error.message)}
}
open();
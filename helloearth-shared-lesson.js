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
let roleKnown=false,remoteAnchor=null,anchorReceivedAt=0,anchorAuthor="",anchorRevision=0,remoteAnchorRevision=-1,scrollGuard=null,layoutFollowTimer=null;
let inkChannel=null,inkReady=false,guestInk=new Map(),textInk=[],remoteText=new Map();const author=crypto.randomUUID();
let presenceReady=false,presenceTracked=false,presenceSynced=false;
const paper=el("share-paper"),paperFrame=el("share-paper-frame"),svg=el("share-annotations"),follow=el("share-follow"),presentSync=el("share-presenter-sync");
let paperScale=1,layoutWidth=0,layoutFrameRAF=0;
let zoom=100,teacherZoom=100,zoomSync=false,teacherZoomSync=false,zoomRevision=0,remoteZoomRevision=-1;
const zoomFollow=el("share-zoom-follow"),zoomControl=el("share-zoom-sync");
function applyZoom(value){
 const next=Math.max(75,Math.min(200,Math.round(Number(value)/5)*5));
 if(!Number.isFinite(next)||next===zoom)return;
 const page=paper.closest(".share-page"),rect=paper.getBoundingClientRect(),line=readingLine();
 const anchor=clamp01((line-rect.top)/Math.max(1,rect.height));
 const pageRect=page.getBoundingClientRect(),x=pageRect.left+page.clientWidth/2;
 const horizontal=clamp01((x-rect.left)/Math.max(1,rect.width));
 zoom=next;layoutPaper();
 el("share-zoom-value").textContent=zoom+"%";
 el("share-zoom-out").disabled=zoom<=75;el("share-zoom-in").disabled=zoom>=200;
 const after=paper.getBoundingClientRect();
 if(line>=rect.top&&line<=rect.bottom)window.scrollBy({top:after.top+anchor*after.height-line,behavior:"instant"});
 page.scrollLeft+=after.left+horizontal*after.width-x;
 requestAnimationFrame(()=>{paintStrokes();scheduleFollowLayout()});
}
function sendZoom(){
 if(!presenter||!inkReady||dead)return;
 inkChannel.send({type:"broadcast",event:"zoom",payload:{author,value:zoom,enabled:zoomSync,revision:++zoomRevision}}).catch(()=>msg("Zoom sync connection interrupted.",true));
}
function manualZoom(value){
 if(!loaded||dead)return;
 if(!presenter)zoomFollow.checked=false;
 applyZoom(value);if(presenter&&zoomSync)sendZoom();
}
el("share-zoom-in").addEventListener("click",()=>manualZoom(zoom+10));
el("share-zoom-out").addEventListener("click",()=>manualZoom(zoom-10));
el("share-zoom-reset").addEventListener("click",()=>manualZoom(100));
zoomControl.addEventListener("change",()=>{if(!presenter)return;zoomSync=zoomControl.checked;sendZoom()});
zoomFollow.addEventListener("change",()=>{if(zoomFollow.checked){if(teacherZoomSync)applyZoom(teacherZoom);if(inkReady)inkChannel.send({type:"broadcast",event:"zoom-request",payload:{}})}});

function msg(content,error=false){
 const node=el("share-connection");node.textContent=content;
 node.style.color=error?"#ffb8c6":"#c7deee";
}
function failure(text){
 presenceReady=false;presenceTracked=false;presenceSynced=false;showPresence("offline","Disconnected","Lesson connection ended");
 dead=true;loaded=false;if(inkChannel){db.removeChannel(inkChannel);inkReady=false}chatConnected();
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
const clamp01=n=>Math.max(0,Math.min(1,n));
const round4=n=>Math.round(n*10000)/10000;
function contentBlocks(){return Array.from(el("share-content").children)}
function readingLine(){
 const dock=document.querySelector(".share-top-dock")?.getBoundingClientRect();
 const top=Math.max(0,dock?.bottom||0),bottom=window.innerHeight;
 return top+Math.max(6,Math.min(40,(bottom-top)*.15));
}
function getReadingAnchor(){
 const blocks=contentBlocks(),y=readingLine();
 let index=blocks.findIndex(b=>{const r=b.getBoundingClientRect();return r.height>0&&r.bottom>y});
 if(index<0)for(let i=blocks.length-1;i>=0;i--){if(blocks[i].getBoundingClientRect().height>0){index=i;break}}
 if(index<0)return {ratio:getRatio(),block:-1,fraction:0,offset:null};
 const block=blocks[index],rect=block.getBoundingClientRect();
 let offset=null;
 if(y>=rect.top&&y<=rect.bottom){
  const left=Math.max(0,rect.left),right=Math.min(window.innerWidth,rect.right);
  for(const portion of [.1,.3,.55,.8]){
   if(right<=left)break;
   const x=left+(right-left)*portion;
   const p=document.caretPositionFromPoint?.(x,y),range=!p?document.caretRangeFromPoint?.(x,y):null;
   const node=p?.offsetNode||range?.startContainer,off=p?.offset??range?.startOffset;
   if(node&&block.contains(node)&&Number.isInteger(off)){try{offset=textOffset(node,off);break}catch{}}
  }
 }
 return {block:index,fraction:clamp01((y-rect.top)/Math.max(1,rect.height)),offset,ratio:getRatio()};
}
function scrollAbsolute(target){
 if(!roleKnown||!canFollow||presenter||!syncEnabled||tool!=="view"||dead)return;
 const max=Math.max(0,document.documentElement.scrollHeight-window.innerHeight),clamped=Math.max(0,Math.min(max,target));
 if(Math.abs(window.scrollY-clamped)<4)return;
 isProgrammatic=true;clearTimeout(scrollGuard);window.scrollTo({top:clamped,behavior:"instant"});
 scrollGuard=setTimeout(()=>{isProgrammatic=false},180);
}
function scrollToRatio(ratio){scrollAbsolute(clamp01(Number(ratio)||0)*Math.max(0,document.documentElement.scrollHeight-window.innerHeight))}
function followReadingAnchor(anchor){
 if(!anchor||anchor.block<0){scrollToRatio(anchor?.ratio||0);return}
 const r=contentBlocks()[anchor.block]?.getBoundingClientRect();
 if(!r||r.height<=0){scrollToRatio(anchor.ratio);return}
 let top=r.top+anchor.fraction*r.height;
 if(Number.isInteger(anchor.offset)){
  const total=el("share-content").textContent.length,start=Math.max(0,Math.min(total-1,anchor.offset));
  try{const line=textRange(start,start+1)?.getClientRects()[0];if(line&&line.height>0&&line.top>=r.top-3&&line.top<=r.bottom+3)top=line.top}catch{}
 }
 scrollAbsolute(window.scrollY+top-readingLine());
}
function sendReadingAnchor(){
 if(!presenter||!inkReady||dead||!loaded)return;
 inkChannel.send({type:"broadcast",event:"reading-position",payload:{author,revision:++anchorRevision,enabled:syncEnabled,...getReadingAnchor()}}).catch(()=>{});
}
function receiveReadingAnchor(p){
 if(presenter||dead||!p||typeof p.author!=="string"||p.author.length>64||typeof p.enabled!=="boolean"||!Number.isSafeInteger(p.revision)||!Number.isInteger(p.block)||p.block<-1||p.block>=contentBlocks().length||!Number.isFinite(p.fraction)||p.fraction<0||p.fraction>1||!Number.isFinite(p.ratio)||p.ratio<0||p.ratio>1||(p.offset!==null&&(!Number.isInteger(p.offset)||p.offset<0||p.offset>el("share-content").textContent.length)))return;
 if(anchorAuthor===p.author&&p.revision<=remoteAnchorRevision)return;
 anchorAuthor=p.author;remoteAnchorRevision=p.revision;anchorReceivedAt=Date.now();remoteAnchor=p;syncEnabled=p.enabled;
 if(syncEnabled)followReadingAnchor(p);
}
function freshAnchor(){return inkReady&&remoteAnchor&&Date.now()-anchorReceivedAt<10000}
function requestReadingAnchor(){if(inkReady&&!presenter)inkChannel.send({type:"broadcast",event:"reading-request",payload:{}}).catch(()=>{})}
function resumeReading(){
 if(!roleKnown||!loaded||dead||presenter||!canFollow||tool!=="view")return;
 if(freshAnchor()){if(remoteAnchor.enabled)followReadingAnchor(remoteAnchor)}
 else if(syncEnabled&&lesson?.state)scrollToRatio(lesson.state.scrollRatio);
 requestReadingAnchor();
}
function scheduleFollowLayout(){
 clearTimeout(layoutFollowTimer);layoutFollowTimer=setTimeout(()=>{if(presenter){if(syncEnabled)sendReadingAnchor()}else resumeReading()},180);
}
function layoutPaper(){
 const page=paper.closest(".share-page"),style=getComputedStyle(page);
 const available=Math.max(1,page.clientWidth-parseFloat(style.paddingLeft||0)-parseFloat(style.paddingRight||0));
 const logical=Math.max(280,Math.min(910,document.documentElement.clientWidth-32));
 if(logical!==layoutWidth){layoutWidth=logical;paper.style.width=logical+"px"}
 paper.style.maxWidth="none";paper.style.zoom="1";
 paperScale=Math.min(1,available/layoutWidth)*zoom/100;
 paper.style.transform="scale("+paperScale+")";
 const width=Math.ceil(layoutWidth*paperScale)+"px",height=Math.ceil(paper.offsetHeight*paperScale)+"px";
 if(paperFrame.style.width!==width)paperFrame.style.width=width;
 if(paperFrame.style.height!==height)paperFrame.style.height=height;
}
function schedulePaperLayout(){
 if(layoutFrameRAF)return;
 layoutFrameRAF=requestAnimationFrame(()=>{layoutFrameRAF=0;layoutPaper();paintStrokes();scheduleFollowLayout()});
}
function pointAnchor(x,y){
 const blocks=contentBlocks();
 let index=blocks.findIndex(b=>{const r=b.getBoundingClientRect();return r.height>0&&y>=r.top&&y<=r.bottom&&x>=r.left-6&&x<=r.right+6});
 if(index<0)return null;
 const r=blocks[index].getBoundingClientRect();
 return [index,round4(clamp01((x-r.left)/Math.max(1,r.width))),round4(clamp01((y-r.top)/Math.max(1,r.height)))];
}
function anchorValid(a,blockCount=el("share-content").children.length){return a===null||(Array.isArray(a)&&a.length===3&&Number.isInteger(a[0])&&a[0]>=0&&a[0]<blockCount&&a.slice(1).every(n=>Number.isFinite(n)&&n>=0&&n<=1))}
function resolvePoint(point,anchor,geometry=null){
 const base=geometry?.base||svg.getBoundingClientRect();
 if(anchor){
  const r=geometry?geometry.blocks[anchor[0]]:contentBlocks()[anchor[0]]?.getBoundingClientRect();
  if(r&&r.height>0&&r.width>0)return [(r.left+anchor[1]*r.width-base.left)/Math.max(1,base.width),(r.top+anchor[2]*r.height-base.top)/Math.max(1,base.height)];
 }
 return point;
}
function pathFor(points,anchors,geometry){
 return points.map((p,i)=>{const q=resolvePoint(p,anchors?.[i],geometry);return (i?"L":"M")+(q[0]*1000).toFixed(2)+","+(q[1]*1000).toFixed(2)}).join(" ");
}
function drawStroke(stroke,local=false,geometry=null){
 const path=document.createElementNS(ns,"path");
 path.setAttribute("d",pathFor(stroke.points,stroke.anchors,geometry));
 path.setAttribute("stroke",stroke.color);
 path.setAttribute("stroke-width",String((stroke.tool==="highlight"?25:3.5)*inkThickness(stroke.width)));
 path.setAttribute("stroke-opacity",stroke.tool==="highlight"?String(inkOpacity(stroke.opacity,.31)):"0.96");
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
  const node=document.createElementNS(ns,"rect");node.setAttribute("x",(rect.left-base.left)/base.width*1000);node.setAttribute("y",(rect.top-base.top)/base.height*1000);node.setAttribute("width",rect.width/base.width*1000);node.setAttribute("height",rect.height/base.height*1000);node.setAttribute("fill",mark.color);node.setAttribute("opacity",String(inkOpacity(mark.opacity,.28)));svg.append(node);
 }
}
const colors={has:value=>typeof value==="string"&&/^#[0-9a-f]{6}$/i.test(value)};
const inkPicker=el("share-ink"),opacityPicker=el("share-opacity"),widthPicker=el("share-width");
function inkOpacity(value,fallback=.3){return typeof value==="number"&&Number.isFinite(value)?Math.min(.75,Math.max(.1,value)):fallback}
function inkThickness(value){return typeof value==="number"&&Number.isFinite(value)?Math.min(2,Math.max(.5,value)):1}
function stylePreview(){
 const opacity=Number(opacityPicker.value),width=Number(widthPicker.value);
 el("share-opacity-value").textContent=opacity+"%";
 el("share-width-value").textContent=width+"%";
 const hex=inkPicker.value;el("share-ink-preview").style.backgroundColor=hex+Math.round(opacity*2.55).toString(16).padStart(2,"0");
}
for(const picker of [inkPicker,opacityPicker,widthPicker])picker.addEventListener("input",stylePreview);
el("share-style-reset").addEventListener("click",()=>{opacityPicker.value="30";widthPicker.value="100";inkPicker.value="#8456d5";inkPicker.dispatchEvent(new Event("input"));stylePreview()});
for(const menu of document.querySelectorAll(".share-menu"))menu.addEventListener("toggle",()=>{if(menu.open)for(const other of document.querySelectorAll(".share-menu"))if(other!==menu)other.open=false});
document.addEventListener("pointerdown",e=>{for(const menu of document.querySelectorAll(".share-menu[open]"))if(!menu.contains(e.target))menu.open=false});
document.addEventListener("keydown",e=>{if(e.key==="Escape")for(const menu of document.querySelectorAll(".share-menu[open]"))menu.open=false});
stylePreview();
for(const swatch of document.querySelectorAll("[data-ink-color]"))swatch.addEventListener("click",()=>{inkPicker.value=swatch.dataset.inkColor;inkPicker.dispatchEvent(new Event("input"))});
function updateSwatches(){for(const swatch of document.querySelectorAll("[data-ink-color]"))swatch.setAttribute("aria-pressed",String(swatch.dataset.inkColor===inkPicker.value))}
inkPicker.addEventListener("input",updateSwatches);updateSwatches();

function validStroke(s){return s&&["pen","highlight"].includes(s.tool)&&colors.has(s.color)&&Array.isArray(s.points)&&s.points.length>=2&&s.points.length<=320&&s.points.every(p=>Array.isArray(p)&&p.length===2&&p.every(n=>typeof n==="number"&&n>=0&&n<=1))&&(!s.anchors||(Array.isArray(s.anchors)&&s.anchors.length===s.points.length&&s.anchors.every(a=>anchorValid(a))))}
function validMark(m){return m&&colors.has(m.color)&&Number.isInteger(m.start)&&Number.isInteger(m.end)&&m.start>=0&&m.end>m.start&&m.end<=el("share-content").textContent.length}
let inkRevision=0;
const inkBatches=new Map(),inkSeenRevisions=new Map();
function sendInk(){
 if(!inkReady||dead)return;
 const revision=++inkRevision,total=Math.max(1,Math.ceil(localStrokes.length/6));
 for(let index=0;index<total;index++){
  inkChannel.send({type:"broadcast",event:"ink-batch",payload:{author,revision,index,total,strokes:localStrokes.slice(index*6,index*6+6),text:index===0?textInk.slice():[]}}).then(result=>{if(result!=="ok")msg("Some annotations could not synchronize. Reconnecting may help.",true)}).catch(()=>msg("Annotation connection interrupted.",true));
 }
}
function receiveInkBatch(p){
 if(dead||!p||typeof p.author!=="string"||p.author===author||p.author.length>64||!Number.isSafeInteger(p.revision)||!Number.isInteger(p.index)||!Number.isInteger(p.total)||p.total<1||p.total>10||p.index<0||p.index>=p.total||!Array.isArray(p.strokes)||p.strokes.length>6||!Array.isArray(p.text)||p.text.length>100)return;
 if(!inkBatches.has(p.author)&&!guestInk.has(p.author)&&inkBatches.size+guestInk.size>=40)return;
 if(p.revision<=(inkSeenRevisions.get(p.author)??-1))return;
 let batch=inkBatches.get(p.author);
 if(!batch||p.revision>batch.revision){batch={revision:p.revision,total:p.total,parts:new Map(),text:[]};inkBatches.set(p.author,batch)}
 if(batch.revision!==p.revision||batch.total!==p.total)return;
 batch.parts.set(p.index,p.strokes.filter(validStroke));
 if(p.index===0)batch.text=p.text.filter(validMark);
 if(batch.parts.size!==batch.total)return;
 const strokes=[];for(let i=0;i<batch.total;i++)strokes.push(...batch.parts.get(i));
 guestInk.set(p.author,strokes);remoteText.set(p.author,batch.text);inkSeenRevisions.set(p.author,p.revision);inkBatches.delete(p.author);paintStrokes();
}
let remoteCursor=null,cursorLast=0,cursorTimer=null;
const cursorNode=el("share-remote-cursor"),cursorToggle=el("share-cursor-sync");
function hideRemoteCursor(){remoteCursor=null;cursorNode.hidden=true;clearTimeout(cursorTimer)}
function positionRemoteCursor(){
 if(!remoteCursor||presenter||dead){cursorNode.hidden=true;return}
 const base=svg.getBoundingClientRect(),q=resolvePoint(remoteCursor.point,remoteCursor.anchor),x=base.left+q[0]*base.width,y=base.top+q[1]*base.height;
 const page=paper.closest(".share-page").getBoundingClientRect(),dock=document.querySelector(".share-top-dock").getBoundingClientRect();
 const bottom=window.innerHeight;
 if(x<Math.max(0,page.left)||x>Math.min(window.innerWidth,page.right)||y<dock.bottom||y>bottom){cursorNode.hidden=true;return}
 cursorNode.hidden=false;cursorNode.style.left=x+"px";cursorNode.style.top=y+"px";
}
function receiveCursor(p){
 if(presenter||dead||!p)return;
 if(p.visible===false){hideRemoteCursor();return}
 if(!Array.isArray(p.point)||p.point.length!==2||!p.point.every(n=>Number.isFinite(n)&&n>=0&&n<=1)||!anchorValid(p.anchor))return;
 remoteCursor=p;positionRemoteCursor();clearTimeout(cursorTimer);cursorTimer=setTimeout(hideRemoteCursor,3500);
}
function broadcastCursor(event){
 if(!presenter||!inkReady||dead||!cursorToggle.checked||Date.now()-cursorLast<65)return;
 cursorLast=Date.now();inkChannel.send({type:"broadcast",event:"teacher-cursor",payload:{visible:true,point:pointFrom(event),anchor:pointAnchor(event.clientX,event.clientY)}}).catch(()=>{});
}
function clearCursorBroadcast(){if(presenter&&inkReady)inkChannel.send({type:"broadcast",event:"teacher-cursor",payload:{visible:false}}).catch(()=>{})}
paper.addEventListener("pointermove",broadcastCursor,{passive:true});paper.addEventListener("pointerdown",broadcastCursor,{passive:true});paper.addEventListener("pointerleave",clearCursorBroadcast);
cursorToggle.addEventListener("change",()=>{if(!cursorToggle.checked)clearCursorBroadcast()});
function showPresence(state,label,detail){
 const indicator=el("share-presence");
 indicator.dataset.state=state;el("share-presence-text").textContent=label;
 indicator.title=detail;indicator.setAttribute("aria-label",detail);
}
function updatePresence(){
 if(dead)return;
 if(!presenceReady||!presenceTracked||!presenceSynced||!inkChannel){
  showPresence("waiting","Connecting…","Checking who has joined the lesson");return;
 }
 const state=inkChannel.presenceState();
 const others=Object.entries(state).filter(([key,metas])=>key!==author&&Array.isArray(metas)&&metas.length>0);
 const count=others.length;
 if(!count){showPresence("alone","Only you online","No other connected lesson tabs");return}
 showPresence("online",count+(count===1?" other online":" others online"),count+" other connected lesson "+(count===1?"tab":"tabs")+"; "+(count+1)+" including you");
}
async function trackPresence(){
 try{
  const result=await inkChannel.track({role:presenter?"teacher":"viewer"});
  if(result!=="ok")throw Error("Presence tracking unavailable");
  presenceTracked=true;updatePresence();
 }catch{
  presenceTracked=false;showPresence("offline","Status unavailable","Participant status could not be verified");
 }
}
window.addEventListener("pagehide",()=>{if(inkChannel&&presenceTracked)inkChannel.untrack().catch(()=>{})});
window.addEventListener("pageshow",e=>{if(e.persisted&&inkReady&&!dead)trackPresence()});
const chatPanel=el("share-chat"),chatInput=el("share-chat-input"),chatTarget=el("share-chat-target"),chatSource=el("share-chat-source");
const chatMessages=new Map(),chatTranslations=new Map(),chatJobs=new Set(),chatRequests=new Set();
const chatLanguages=new Set(Array.from(chatTarget.options,o=>o.value));
let chatUnread=0,chatLastSend=0,chatSending=false,chatCloudCalls=0,chatCloudTail=Promise.resolve(),chatEpoch=0;
function chatStatus(text){el("share-chat-status").textContent=text}
function chatConnected(){
 el("share-chat-send").disabled=!inkReady||dead||chatSending;
 chatStatus(inkReady&&!dead?"Live · session only":"Disconnected · messages remain here");
}
const chatSettings=el("share-chat-settings-details");
function syncChatLayout(){
 const dock=document.querySelector(".share-top-dock");
 document.documentElement.style.setProperty("--share-dock-height",Math.ceil(dock?.getBoundingClientRect().height||0)+"px");
 document.documentElement.style.setProperty("--share-chat-height",Math.ceil(chatPanel.getBoundingClientRect().height||0)+"px");scheduleFollowLayout();
}
const classroomLayout=chatPanel.closest(".share-classroom-layout"),chatToggle=el("share-chat-toggle");
function setChatOpen(open,visit=false){
 const before=el("share-content").getBoundingClientRect(),line=readingLine();
 const anchor=loaded&&before.top<=line&&before.bottom>line?getReadingAnchor():null;
 chatPanel.hidden=!open;classroomLayout.classList.toggle("chat-closed",!open);
 chatToggle.setAttribute("aria-expanded",String(open));chatToggle.title=open?"Close classroom chat":"Open classroom chat";
 chatToggle.querySelector(".share-chat-toggle-label").textContent=open?"Close chat":"Chat";
 if(open){chatUnread=0;el("share-chat-unread").hidden=true}
 else chatSettings.open=false;
 layoutPaper();syncChatLayout();
 requestAnimationFrame(()=>{
  paintStrokes();
  if(open&&visit){
   const rect=chatPanel.getBoundingClientRect(),dock=document.querySelector(".share-top-dock").getBoundingClientRect();
   if(window.innerWidth<=760&&(rect.top<dock.bottom||rect.top>=window.innerHeight)){
    if(!presenter&&canFollow&&syncEnabled){canFollow=false;follow.checked=false;msg("Follow teacher paused while you visit chat. Enable Follow scroll to resume.")}
    chatPanel.scrollIntoView({block:"start",behavior:"instant"});
   }
   chatInput.focus({preventScroll:true});el("share-chat-log").scrollTop=el("share-chat-log").scrollHeight;
  }else if(anchor&&anchor.block>=0){
   const rect=contentBlocks()[anchor.block]?.getBoundingClientRect();
   if(rect){let top=rect.top+anchor.fraction*rect.height;
    if(Number.isInteger(anchor.offset)){try{const range=textRange(anchor.offset,anchor.offset+1)?.getClientRects()[0];if(range?.height)top=range.top}catch{}}
    window.scrollBy({top:top-readingLine(),behavior:"instant"});
   }
  }
  scheduleFollowLayout();
 });
 if(!open&&visit)chatToggle.focus({preventScroll:true});
}
chatToggle.onclick=()=>setChatOpen(chatPanel.hidden,true);
el("share-chat-close").onclick=()=>setChatOpen(false,true);
el("share-chat-settings-button").onclick=()=>{chatSettings.open=!chatSettings.open};
chatSettings.addEventListener("toggle",()=>{el("share-chat-settings-button").setAttribute("aria-expanded",String(chatSettings.open));syncChatLayout()});
if(window.ResizeObserver){const layoutObserver=new ResizeObserver(syncChatLayout);layoutObserver.observe(document.querySelector(".share-top-dock"));layoutObserver.observe(chatPanel)}
window.addEventListener("resize",syncChatLayout);
syncChatLayout();
function chatDefaults(){
 const lang=(navigator.language||"en").toLowerCase().split("-")[0];
 chatSource.value=chatTarget.value=presenter?"en":chatLanguages.has(lang)?lang:"en";
 el("share-chat-relay-label").hidden=!presenter;
}
function chatMessageValid(p){
 return p&&typeof p.id==="string"&&/^[a-f0-9-]{36}$/i.test(p.id)&&typeof p.author==="string"&&/^[a-f0-9-]{36}$/i.test(p.author)&&typeof p.text==="string"&&p.text.trim().length>0&&p.text.length<=580&&chatLanguages.has(p.source)&&typeof p.cloud==="boolean"&&["teacher","viewer"].includes(p.role);
}
function chatBroadcast(event,payload){
 if(!inkReady||dead||!inkChannel)return Promise.resolve("error");
 return inkChannel.send({type:"broadcast",event,payload});
}
function chatTranslationKey(id,target){return id+":"+target}
function chatShowTranslation(m,target,text){
 chatTranslations.set(chatTranslationKey(m.id,target),text);
 if(chatTarget.value!==target||!el("share-chat-auto").checked||!chatMessages.has(m.id))return;
 m.translation.textContent="Translation · "+text;m.translation.hidden=false;m.retry.hidden=true;
}
function chatTranslationError(m,target,message){
 if(chatTarget.value!==target||!chatMessages.has(m.id))return;
 m.translation.textContent=message;m.translation.hidden=false;m.retry.hidden=false;
}
async function chatNative(text,from,to){
 if(!window.Translator?.availability||!window.Translator?.create)return null;
 let translator;
 try{
  const pair={sourceLanguage:from,targetLanguage:to};
  if(await window.Translator.availability(pair)!=="available")return null;
  translator=await window.Translator.create(pair);return String(await translator.translate(text)).trim();
 }catch{return null}finally{try{translator?.destroy()}catch{}}
}
function chatCloud(m,target){
 const key=chatTranslationKey(m.id,target);
 if(chatTranslations.has(key))return Promise.resolve(chatTranslations.get(key));
 if(!presenter||!el("share-chat-relay").checked||!m.cloud||!inkReady||dead||chatCloudCalls>=60||chatJobs.size>=8)return Promise.reject(Error("Cloud translation unavailable or limit reached"));
 if(chatJobs.has(key))return chatCloudTail.then(()=>{if(chatTranslations.has(key))return chatTranslations.get(key);throw Error("Translation unavailable")});
 chatJobs.add(key);chatCloudCalls++;
 const task=chatCloudTail.then(async()=>{
  if(dead||!inkReady||!el("share-chat-relay").checked)throw Error("Cloud translation disabled");
  const {data,error}=await db.functions.invoke("he-translate",{body:{text:m.text,source:m.source,target}});
  if(error||typeof data?.translation!=="string"||!data.translation.trim())throw Error("Translation service unavailable");
  const translated=data.translation.slice(0,1800);chatShowTranslation(m,target,translated);return translated;
 });
 chatCloudTail=task.catch(()=>{}).then(()=>new Promise(resolve=>setTimeout(resolve,3800)));
 return task.finally(()=>chatJobs.delete(key));
}
async function chatTranslate(m){
 const target=chatTarget.value;
 if(!el("share-chat-auto").checked||m.source===target||m.author===author){m.translation.hidden=true;m.retry.hidden=true;return}
 const key=chatTranslationKey(m.id,target);
 if(chatTranslations.has(key)){chatShowTranslation(m,target,chatTranslations.get(key));return}
 m.translation.hidden=false;m.translation.textContent="Translating…";m.retry.hidden=true;
 const native=await chatNative(m.text,m.source,target);
 if(!chatMessages.has(m.id)||dead)return;
 if(native){chatShowTranslation(m,target,native);return}
 if(!m.cloud){chatTranslationError(m,target,"Original shown · sender has not enabled cloud translation.");return}
 if(presenter){
  try{chatShowTranslation(m,target,await chatCloud(m,target))}
  catch{chatTranslationError(m,target,"Translation unavailable · check cloud translation settings.")}
 }else{
  chatRequests.add(key);
  try{if(await chatBroadcast("chat-translate-request",{id:m.id,target,requester:author})!=="ok")throw Error("Offline")}
  catch{chatTranslationError(m,target,"Translation unavailable · connection lost.");return}
  setTimeout(()=>{if(chatRequests.delete(key)&&!chatTranslations.has(key))chatTranslationError(m,target,"Translation pending or unavailable · retry when tutor is online.")},25000);
 }
}
function chatAdd(p){
 if(!chatMessageValid(p)||chatMessages.has(p.id)||dead)return;
 const log=el("share-chat-log");log.querySelector(".share-chat-empty")?.remove();
 const row=document.createElement("article");row.className="share-chat-message";row.classList.toggle("own",p.author===author);
 const header=document.createElement("header");header.textContent=(p.author===author?"You":p.role==="teacher"?"Teacher":"Participant")+" · "+new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
 const body=document.createElement("p");body.textContent=p.text;
 const translation=document.createElement("p");translation.className="share-chat-translation";translation.hidden=true;
 const retry=document.createElement("button");retry.type="button";retry.className="share-chat-retry";retry.textContent="Retry translation";retry.hidden=true;
 const m={...p,row,translation,retry};retry.onclick=()=>chatTranslate(m);
 row.append(header,body,translation,retry);log.append(row);chatMessages.set(p.id,m);
 while(chatMessages.size>120){const first=chatMessages.keys().next().value;chatMessages.get(first).row.remove();chatMessages.delete(first);for(const k of chatTranslations.keys())if(k.startsWith(first+":"))chatTranslations.delete(k)}
 log.scrollTop=log.scrollHeight;
 if(chatPanel.hidden&&p.author!==author){chatUnread++;el("share-chat-unread").textContent=String(Math.min(chatUnread,99));el("share-chat-unread").hidden=false}
 chatTranslate(m);
}
async function chatRequest(p){
 if(!presenter||dead||!p||typeof p.id!=="string"||!chatLanguages.has(p.target)||typeof p.requester!=="string"||!inkChannel?.presenceState()?.[p.requester])return;
 const m=chatMessages.get(p.id);if(!m||!m.cloud||m.source===p.target)return;
 try{
  const key=chatTranslationKey(m.id,p.target);
  const translated=chatTranslations.get(key)||await chatNative(m.text,m.source,p.target)||await chatCloud(m,p.target);
  await chatBroadcast("chat-translation",{id:m.id,target:p.target,text:translated});
 }catch{await chatBroadcast("chat-translation-error",{id:m.id,target:p.target})}
}
function chatReceiveTranslation(p,failed=false){
 if(!p||typeof p.id!=="string"||!chatLanguages.has(p.target))return;
 const key=chatTranslationKey(p.id,p.target),m=chatMessages.get(p.id);
 if(!m||!chatRequests.has(key))return;
 chatRequests.delete(key);
 if(failed){chatTranslationError(m,p.target,"Translation unavailable · ask your tutor to enable cloud translation.");return}
 if(typeof p.text==="string"&&p.text.trim()&&p.text.length<=1800)chatShowTranslation(m,p.target,p.text);
}
el("share-chat-form").addEventListener("submit",async e=>{
 e.preventDefault();const text=chatInput.value.trim();
 if(!text||!inkReady||dead||chatSending||Date.now()-chatLastSend<700)return;
 const p={id:crypto.randomUUID(),author,role:presenter?"teacher":"viewer",source:chatSource.value,text:text.slice(0,580),cloud:el("share-chat-cloud").checked};
 chatSending=true;chatLastSend=Date.now();chatConnected();
 try{if(await chatBroadcast("chat-message",p)!=="ok")throw Error("Send failed");chatAdd(p);if(chatInput.value.trim()===text)chatInput.value=""}
 catch{chatStatus("Message not sent · retry")}
 finally{chatSending=false;el("share-chat-send").disabled=!inkReady||dead}
});
chatInput.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey&&!e.isComposing){e.preventDefault();el("share-chat-form").requestSubmit()}});
for(const id of ["share-chat-auto","share-chat-target"])el(id).addEventListener("change",()=>{for(const m of Array.from(chatMessages.values()).slice(-15))chatTranslate(m)});
el("share-chat-export").onclick=()=>{
 const text=Array.from(chatMessages.values()).map(m=>(m.author===author?"You":m.role==="teacher"?"Teacher":"Participant")+" ["+m.source+"]: "+m.text+(chatTranslations.get(chatTranslationKey(m.id,chatTarget.value))?"\nTranslation: "+chatTranslations.get(chatTranslationKey(m.id,chatTarget.value)):"")).join("\n\n");
 const url=URL.createObjectURL(new Blob([text],{type:"text/plain;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download="helloearth-classroom-chat.txt";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
async function connectInk(){
 const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(token));
 const room=Array.from(new Uint8Array(bytes),n=>n.toString(16).padStart(2,"0")).join("");
 inkChannel=db.channel("he-lesson-ink-"+room,{config:{broadcast:{self:false,ack:true},presence:{key:author}}});
 inkChannel.on("presence",{event:"sync"},()=>{presenceSynced=true;updatePresence()})
 .on("broadcast",{event:"ink-batch"},({payload})=>receiveInkBatch(payload))
 .on("broadcast",{event:"ink"},({payload:p})=>{
  if(dead||!p||typeof p.author!=="string"||p.author===author||p.author.length>64||inkSeenRevisions.has(p.author)||(!guestInk.has(p.author)&&guestInk.size>=40))return;
  if(Array.isArray(p.strokes))guestInk.set(p.author,p.strokes.slice(0,60).filter(validStroke));
  if(Array.isArray(p.text))remoteText.set(p.author,p.text.slice(0,100).filter(validMark));
  paintStrokes();
 }).on("broadcast",{event:"zoom"},({payload:p})=>{
  if(presenter||dead||!p||typeof p.value!=="number"||!Number.isFinite(p.value)||p.value<75||p.value>200||typeof p.enabled!=="boolean")return;
  teacherZoom=p.value;teacherZoomSync=p.enabled;
  if(teacherZoomSync&&zoomFollow.checked)applyZoom(teacherZoom);
 }).on("broadcast",{event:"zoom-request"},()=>sendZoom())
 .on("broadcast",{event:"reading-position"},({payload})=>receiveReadingAnchor(payload))
 .on("broadcast",{event:"reading-request"},()=>sendReadingAnchor())
 .on("broadcast",{event:"teacher-cursor"},({payload})=>receiveCursor(payload))
 .on("broadcast",{event:"chat-message"},({payload})=>chatAdd(payload))
 .on("broadcast",{event:"chat-translate-request"},({payload})=>chatRequest(payload))
 .on("broadcast",{event:"chat-translation"},({payload})=>chatReceiveTranslation(payload))
 .on("broadcast",{event:"chat-translation-error"},({payload})=>chatReceiveTranslation(payload,true))
 .on("broadcast",{event:"request"},()=>{sendInk();sendZoom();sendReadingAnchor()}).subscribe(status=>{
  inkReady=status==="SUBSCRIBED";presenceReady=inkReady;presenceTracked=false;chatConnected();
  if(inkReady){updatePresence();trackPresence();sendInk();sendZoom();sendReadingAnchor();requestReadingAnchor();inkChannel.send({type:"broadcast",event:"request",payload:{}})}
  else{presenceSynced=false;remoteAnchor=null;anchorReceivedAt=0;hideRemoteCursor();showPresence("offline","Connection lost","Live connection interrupted; participant status unknown")}
 });
}
let savedSelection=null,selectionTimer=null;
function captureSelection(){
 const selection=window.getSelection(),content=el("share-content");
 if(!selection||selection.isCollapsed||!selection.rangeCount)return null;
 const range=selection.getRangeAt(0).cloneRange();
 if(!content.contains(range.startContainer)||!content.contains(range.endContainer))return null;
 const start=textOffset(range.startContainer,range.startOffset),end=textOffset(range.endContainer,range.endOffset);
 return end>start?{start,end}:null;
}
function highlightSelection(){
 if(dead||!loaded||tool!=="text")return;
 const mark=captureSelection()||savedSelection;
 if(!mark)return;
 savedSelection=null;
 const next={...mark,color:el("share-ink").value,opacity:Number(opacityPicker.value)/100};
 if(!validMark(next))return;
 if(!textInk.some(m=>m.start===next.start&&m.end===next.end&&m.color===next.color)){
  if(textInk.length>=100){msg("Text highlight limit reached. Undo or clear your own marks first.",true);return}
  textInk.push(next);
 }
 window.getSelection()?.removeAllRanges();paintStrokes();sendInk();
}
const highlightButton=document.createElement("button");highlightButton.type="button";highlightButton.textContent="Apply text highlight";highlightButton.hidden=true;
highlightButton.addEventListener("pointerdown",e=>{savedSelection=captureSelection()||savedSelection;e.preventDefault()});
highlightButton.addEventListener("click",highlightSelection);
document.querySelector(".share-tool-modes").after(highlightButton);
document.addEventListener("selectionchange",()=>{if(tool==="text"){const mark=captureSelection();if(mark)savedSelection=mark}});
document.addEventListener("pointerup",e=>{
 if(tool!=="text"||e.pointerType==="touch"||!el("share-content").contains(e.target))return;
 clearTimeout(selectionTimer);selectionTimer=setTimeout(()=>{if(captureSelection())highlightSelection()},0);
});
document.addEventListener("keydown",e=>{if(tool==="text"&&e.key==="Enter"&&!["INPUT","SELECT","BUTTON","TEXTAREA"].includes(document.activeElement?.tagName)){highlightSelection()}});
window.addEventListener("resize",schedulePaperLayout);paper.closest(".share-page").addEventListener("scroll",positionRemoteCursor,{passive:true});if(window.ResizeObserver){const observer=new ResizeObserver(schedulePaperLayout);observer.observe(paper);observer.observe(paper.closest(".share-page"))}
function paintStrokes(){
 const geometry={base:svg.getBoundingClientRect(),blocks:contentBlocks().map(b=>b.getBoundingClientRect())};
 svg.replaceChildren();
 for(const stroke of sharedStrokes)svg.append(drawStroke(stroke,false,geometry));
 for(const strokes of guestInk.values())for(const stroke of strokes)svg.append(drawStroke(stroke,false,geometry));
 for(const marks of remoteText.values())for(const mark of marks)paintText(mark);
 for(const mark of textInk)paintText(mark);
 for(const stroke of localStrokes)svg.append(drawStroke(stroke,true,geometry));
 if(active)svg.append(drawStroke(active,true,geometry));
 positionRemoteCursor();
 const canUndo=textInk.length>0||localStrokes.length>0||(presenter&&sharedStrokes.length>0);
 el("share-undo").disabled=!canUndo;
 el("share-clear").disabled=!canUndo;
}
function setTool(next){
 tool=next;active=null;savedSelection=null;clearTimeout(selectionTimer);
 paper.classList.toggle("is-text-highlighting",tool==="text");
 for(const btn of document.querySelectorAll("[data-tool]")){
  const on=btn.dataset.tool===tool;btn.classList.toggle("selected",on);
  btn.setAttribute("aria-pressed",String(on));
 }
 svg.classList.toggle("is-annotating",tool==="pen"||tool==="highlight");
 highlightButton.hidden=tool!=="text";if(tool==="view")resumeReading();
 el("share-draw-hint").textContent=tool==="text"?"Drag across words to highlight automatically. On touchscreens, select text and tap Apply text highlight.": "Teacher and student annotations are shared live while connected.";
 paintStrokes();
}
function pointFrom(event){
 const rect=svg.getBoundingClientRect();
 return [round4(clamp01((event.clientX-rect.left)/Math.max(1,rect.width))),round4(clamp01((event.clientY-rect.top)/Math.max(1,rect.height)))];
}
svg.addEventListener("pointerdown",event=>{
 if(dead||!["pen","highlight"].includes(tool)||event.button!==0)return;
 if(localStrokes.length>=60){msg("Drawing limit reached. Undo or clear your own annotations before adding more.",true);return}
 event.preventDefault();
 const stroke={tool,color:el("share-ink").value,opacity:Number(opacityPicker.value)/100,width:Number(widthPicker.value)/100,points:[pointFrom(event)],anchors:[pointAnchor(event.clientX,event.clientY)]};
 active=stroke;
 svg.setPointerCapture(event.pointerId);
 paintStrokes();
});
svg.addEventListener("pointermove",event=>{
 if(!active)return;
 const p=pointFrom(event),prev=active.points.at(-1);
 if(Math.hypot((p[0]-prev[0])*svg.clientWidth,(p[1]-prev[1])*svg.clientHeight)<5)return;
 if(active.points.length<320){active.points.push(p);active.anchors.push(pointAnchor(event.clientX,event.clientY))}
 paintStrokes();
});
function finish(event){
 if(!active)return;
 const p=pointFrom(event),stroke=active;active=null;
 if(stroke.points.length<2){stroke.points.push([Math.min(1,stroke.points[0][0]+0.001),Math.min(1,stroke.points[0][1]+0.001)]);stroke.anchors.push(stroke.anchors[0]? [...stroke.anchors[0]]:null)}
 localStrokes.push(stroke);sendInk();
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
 if(canFollow)resumeReading();
});
function pauseFollow(event){
 if(!presenter&&canFollow&&syncEnabled&&tool==="view"&&event.target instanceof Element&&event.target.closest(".share-workbook-column")){
  canFollow=false;follow.checked=false;msg("Follow teacher paused. Turn it on to resynchronise.");
 }
}
window.addEventListener("wheel",event=>{if(Math.abs(event.deltaY)>Math.abs(event.deltaX)&&Math.abs(event.deltaY)>2)pauseFollow(event)},{passive:true});
let touchOrigin=null;
window.addEventListener("touchstart",event=>{touchOrigin=event.touches.length===1?{x:event.touches[0].clientX,y:event.touches[0].clientY}:null},{passive:true});
window.addEventListener("touchmove",event=>{if(touchOrigin&&event.touches.length===1&&Math.abs(event.touches[0].clientY-touchOrigin.y)>12){pauseFollow(event);touchOrigin=null}},{passive:true});
presentSync.addEventListener("change",()=>{
 syncEnabled=presentSync.checked;queue({syncEnabled,scrollRatio:getRatio()});sendReadingAnchor();
 msg(syncEnabled?"Presenter scrolling follows the same lesson text.":"Student scrolling sync is off.");
});
let scrollTimer=null,lastRatioSave=0;
window.addEventListener("scroll",()=>{
 positionRemoteCursor();
 if(!presenter||!syncEnabled||!loaded||dead)return;
 if(scrollTimer)return;
 scrollTimer=setTimeout(()=>{scrollTimer=null;sendReadingAnchor();if(Date.now()-lastRatioSave>850){lastRatioSave=Date.now();queue({scrollRatio:getRatio()})}},120);
},{passive:true});
setInterval(()=>{if(presenter&&loaded&&!dead&&syncEnabled)sendReadingAnchor()},3000);
function updateState(state){
 if(!state||dead)return;
 if(!lesson)lesson={state};else lesson.state=state;
 const wasSync=syncEnabled;
 if((!presenter&&!freshAnchor())||(presenter&&!pending&&!writing))syncEnabled=state.syncEnabled===true;
 presentSync.checked=syncEnabled;
 if(state.updatedAt!==latestUpdated){
  latestUpdated=state.updatedAt;
  if(!presenter||(!pending&&!writing)){
   sharedStrokes=Array.isArray(state.annotations)?state.annotations:[];
   paintStrokes();
  }
 }
 if(!presenter&&canFollow&&syncEnabled&&!freshAnchor())scrollToRatio(Number(state.scrollRatio)||0);
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
  el("share-presenter-label").hidden=false;el("share-cursor-label").hidden=false;
  el("share-zoom-sync-label").hidden=false;el("share-zoom-follow-label").hidden=true;
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
window.addEventListener("afterprint",schedulePaperLayout);
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
  await checkPresenter();roleKnown=true;layoutPaper();chatDefaults();resumeReading();
  connectInk().catch(()=>{msg("Live annotation connection unavailable.",true);showPresence("offline","Status unavailable","Could not connect to the live lesson channel")});
  if(!presenter)msg("Ready to read · no login required. Use Follow teacher to sync scrolling.");
  setInterval(()=>{remaining();poll()},1700);
 }catch(error){failure(error.message)}
}
open();
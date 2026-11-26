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
let presenceReady=false,presenceTracked=false,presenceSynced=false;
const paper=el("share-paper"),svg=el("share-annotations"),follow=el("share-follow"),presentSync=el("share-presenter-sync");
let zoom=100,teacherZoom=100,zoomSync=false,teacherZoomSync=false,zoomRevision=0,remoteZoomRevision=-1;
const zoomFollow=el("share-zoom-follow"),zoomControl=el("share-zoom-sync");
function applyZoom(value){
 const next=Math.max(75,Math.min(200,Math.round(Number(value)/5)*5));
 if(!Number.isFinite(next))return;
 const rect=paper.getBoundingClientRect(),anchor=Math.max(0,Math.min(1,(window.innerHeight/2-rect.top)/Math.max(1,rect.height)));
 const old=zoom;zoom=next;paper.style.zoom=String(zoom/100);
 el("share-zoom-value").textContent=zoom+"%";
 el("share-zoom-out").disabled=zoom<=75;el("share-zoom-in").disabled=zoom>=200;
 if(old!==zoom){const after=paper.getBoundingClientRect();window.scrollBy(0,after.top+anchor*after.height-window.innerHeight/2);requestAnimationFrame(paintStrokes)}
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

function validStroke(s){return s&&["pen","highlight"].includes(s.tool)&&colors.has(s.color)&&Array.isArray(s.points)&&s.points.length>=2&&s.points.length<=320&&s.points.every(p=>Array.isArray(p)&&p.length===2&&p.every(n=>typeof n==="number"&&n>=0&&n<=1))}
function validMark(m){return m&&colors.has(m.color)&&Number.isInteger(m.start)&&Number.isInteger(m.end)&&m.start>=0&&m.end>m.start&&m.end<=el("share-content").textContent.length}
function sendInk(){if(!inkReady||dead)return;inkChannel.send({type:"broadcast",event:"ink",payload:{author,strokes:localStrokes.slice(-60),text:textInk.slice(-100)}}).catch(()=>msg("Annotation connection interrupted.",true))}
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
 document.documentElement.style.setProperty("--share-chat-height",Math.ceil(chatPanel.getBoundingClientRect().height||0)+"px");
}
el("share-chat-toggle").onclick=()=>{chatInput.focus({preventScroll:true});el("share-chat-log").scrollTop=el("share-chat-log").scrollHeight};
el("share-chat-close").onclick=()=>{chatSettings.open=!chatSettings.open};
chatSettings.addEventListener("toggle",()=>{el("share-chat-close").setAttribute("aria-expanded",String(chatSettings.open));syncChatLayout()});
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
 .on("broadcast",{event:"ink"},({payload:p})=>{
  if(dead||!p||typeof p.author!=="string"||p.author===author||p.author.length>64||(!guestInk.has(p.author)&&guestInk.size>=40))return;
  if(Array.isArray(p.strokes))guestInk.set(p.author,p.strokes.slice(0,60).filter(validStroke));
  if(Array.isArray(p.text))remoteText.set(p.author,p.text.slice(0,100).filter(validMark));
  paintStrokes();
 }).on("broadcast",{event:"zoom"},({payload:p})=>{
  if(presenter||dead||!p||typeof p.value!=="number"||!Number.isFinite(p.value)||p.value<75||p.value>200||typeof p.enabled!=="boolean")return;
  teacherZoom=p.value;teacherZoomSync=p.enabled;
  if(teacherZoomSync&&zoomFollow.checked)applyZoom(teacherZoom);
 }).on("broadcast",{event:"zoom-request"},()=>sendZoom())
 .on("broadcast",{event:"chat-message"},({payload})=>chatAdd(payload))
 .on("broadcast",{event:"chat-translate-request"},({payload})=>chatRequest(payload))
 .on("broadcast",{event:"chat-translation"},({payload})=>chatReceiveTranslation(payload))
 .on("broadcast",{event:"chat-translation-error"},({payload})=>chatReceiveTranslation(payload,true))
 .on("broadcast",{event:"request"},()=>{sendInk();sendZoom()}).subscribe(status=>{
  inkReady=status==="SUBSCRIBED";presenceReady=inkReady;presenceTracked=false;chatConnected();
  if(inkReady){updatePresence();trackPresence();sendInk();sendZoom();inkChannel.send({type:"broadcast",event:"request",payload:{}})}
  else{presenceSynced=false;showPresence("offline","Connection lost","Live connection interrupted; participant status unknown")}
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
  textInk.push(next);if(textInk.length>100)textInk.shift();
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
 tool=next;active=null;savedSelection=null;clearTimeout(selectionTimer);
 paper.classList.toggle("is-text-highlighting",tool==="text");
 for(const btn of document.querySelectorAll("[data-tool]")){
  const on=btn.dataset.tool===tool;btn.classList.toggle("selected",on);
  btn.setAttribute("aria-pressed",String(on));
 }
 svg.classList.toggle("is-annotating",tool==="pen"||tool==="highlight");
 highlightButton.hidden=tool!=="text";
 el("share-draw-hint").textContent=tool==="text"?"Drag across words to highlight automatically. On touchscreens, select text and tap Apply text highlight.": "Teacher and student annotations are shared live while connected.";
 paintStrokes();
}
function pointFrom(event){
 const rect=svg.getBoundingClientRect();
 return [Math.max(0,Math.min(1,(event.clientX-rect.left)/Math.max(1,rect.width))),
  Math.max(0,Math.min(1,(event.clientY-rect.top)/Math.max(1,rect.height)))];
}
svg.addEventListener("pointerdown",event=>{
 if(dead||!["pen","highlight"].includes(tool)||event.button!==0)return;
 event.preventDefault();
 const stroke={tool,color:el("share-ink").value,opacity:Number(opacityPicker.value)/100,width:Number(widthPicker.value)/100,points:[pointFrom(event)]};
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
 if(presenter&&stroke.tool==="pen"&&stroke.width===1&&["#8456d5","#dc6a85","#46a49a","#dba84b","#28385f"].includes(stroke.color)){
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
  await checkPresenter();chatDefaults();
  connectInk().catch(()=>{msg("Live annotation connection unavailable.",true);showPresence("offline","Status unavailable","Could not connect to the live lesson channel")});
  if(!presenter)msg("Ready to read · no login required. Use Follow teacher to sync scrolling.");
  setInterval(()=>{remaining();poll()},1700);
 }catch(error){failure(error.message)}
}
open();
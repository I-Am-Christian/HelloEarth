import {db} from "./supabase-client.js";
const wrapper=document.createElement("div");wrapper.innerHTML="<section class=\"he-live-panel he-live-captions\" id=\"he-live-translate-panel\" aria-label=\"Live lesson captions and translations\" hidden>\n <div class=\"he-live-panel-header\"><h2>🎙 Live captions</h2><div>\n <button type=\"button\" id=\"he-live-translate-pin\" title=\"Open an always-on-top window when supported\">⧉</button>\n <button type=\"button\" id=\"he-live-translate-close\" aria-label=\"Close captions\">×</button></div></div>\n <p class=\"he-caption-subheading\">Transcribe first. Show optional translations in class and on a temporary student-view link.</p>\n <div class=\"he-caption-statusline\"><span id=\"he-caption-state\" class=\"he-caption-pill\">Not listening</span>\n <span id=\"he-caption-cloud\" class=\"he-caption-pill\">Checking speech service…</span>\n <span id=\"he-caption-time\">00:00</span></div>\n <div class=\"he-caption-grid\">\n  <label>Class audio source<select id=\"he-caption-source\">\n   <option value=\"mic\">My microphone</option><option value=\"tab\">Class browser tab audio</option>\n   <option value=\"both\">Class tab + my microphone</option>\n  </select></label>\n  <label>Speech recognition<select id=\"he-caption-engine\">\n   <option value=\"auto\" selected>Automatic / fallback</option>\n   <option value=\"device\">On-device (if installed)</option>\n   <option value=\"browser\">Browser speech service</option>\n   <option value=\"cloud\">Cloud captions (if connected)</option>\n  </select></label>\n </div>\n <div class=\"he-caption-grid he-translate-languages\">\n  <label>Spoken language<select id=\"he-translate-source\">\n   <option value=\"en\" selected>English</option><option value=\"pl\">Polish</option>\n   <option value=\"pt\">Portuguese</option><option value=\"es\">Spanish</option>\n   <option value=\"zh\">Chinese</option><option value=\"tr\">Turkish</option>\n   <option value=\"vi\">Vietnamese</option><option value=\"af\">Afrikaans</option>\n   <option value=\"fr\">French</option><option value=\"de\">German</option>\n   <option value=\"ru\">Russian</option><option value=\"ar\">Arabic</option>\n  </select></label>\n  <label>Translate into<select id=\"he-translate-target\">\n   <option value=\"en\">English</option><option value=\"pl\" selected>Polish</option>\n   <option value=\"pt\">Portuguese</option><option value=\"es\">Spanish</option>\n   <option value=\"zh\">Chinese</option><option value=\"tr\">Turkish</option>\n   <option value=\"vi\">Vietnamese</option><option value=\"af\">Afrikaans</option>\n   <option value=\"fr\">French</option><option value=\"de\">German</option>\n   <option value=\"ru\">Russian</option><option value=\"ar\">Arabic</option>\n  </select></label>\n </div>\n <div class=\"he-caption-setting-row\">\n  <label><input type=\"checkbox\" id=\"he-translate-auto\"><span>Translate finished captions automatically</span></label>\n  <button type=\"button\" id=\"he-caption-install\">Install offline speech pack</button>\n </div>\n <label class=\"he-caption-consent\"><input type=\"checkbox\" id=\"he-caption-consent\">\n <span>I have permission from all lesson participants (and a guardian where required) to transcribe this class, share captions if I choose, and use speech services.</span></label>\n <div class=\"he-caption-primary-actions\">\n  <button type=\"button\" id=\"he-translate-mic\" class=\"he-caption-primary\">▶ Start captions</button>\n  <button type=\"button\" id=\"he-caption-stop\" disabled>■ Stop captions</button>\n  <button type=\"button\" id=\"he-caption-share\">Share with student</button>\n </div>\n <div class=\"he-caption-setup\" id=\"he-caption-setup\" hidden></div>\n <p id=\"he-translate-status\" class=\"he-caption-status\" role=\"status\" aria-live=\"polite\">Start with microphone, or choose your lesson tab to capture class audio where the browser permits it.</p>\n <div class=\"he-caption-actions-line\"><strong class=\"he-caption-caption-title\">LIVE TRANSCRIPT</strong><div class=\"he-caption-secondary-actions\">\n  <button type=\"button\" id=\"he-caption-download\">Download</button>\n  <button type=\"button\" id=\"he-caption-report\">Use for report</button>\n  <button type=\"button\" id=\"he-caption-clear\">Clear</button>\n </div></div>\n <div id=\"he-caption-feed\" class=\"he-caption-stream\" aria-label=\"Live transcript\" role=\"log\" aria-live=\"polite\" aria-relevant=\"additions\">\n  <p id=\"he-caption-empty\" class=\"he-caption-activity\">Spoken phrases will appear here during the lesson.</p>\n </div>\n <div id=\"he-translate-interim\" class=\"he-caption-interim\" aria-live=\"polite\"></div>\n <div id=\"he-caption-share-box\" class=\"he-caption-share\" hidden>\n  <strong>Live student viewing link</strong>\n  <p>Only new captions are broadcast for up to 90 minutes. Anyone with the link can join, so share it privately.</p>\n  <div class=\"he-caption-share-line\"><input readonly id=\"he-caption-share-url\" aria-label=\"Student caption link\">\n   <button type=\"button\" id=\"he-caption-copy-url\">Copy link</button>\n   <button type=\"button\" id=\"he-caption-stop-share\">End sharing</button>\n  </div>\n </div>\n <div class=\"he-caption-text-entry\">\n  <textarea id=\"he-translate-input\" maxlength=\"600\" rows=\"2\" placeholder=\"Add a phrase manually or type text to translate…\"></textarea>\n  <button type=\"button\" id=\"he-translate-now\">Add / Translate</button>\n  <button type=\"button\" id=\"he-translate-copy\" title=\"Copy latest caption\">Copy last</button>\n </div>\n <p class=\"he-caption-activity\">For class-tab audio, select the Preply tab and enable “Share tab audio” in the browser prompt. Browser recognition may use external speech services; optional cloud captioning also sends short audio segments to the speech provider. Audio and live captions aren't automatically stored in student records.</p>\n</section>";
const panel=wrapper.firstElementChild;document.body.append(panel);
const launch=document.createElement("button");launch.id="he-live-translate-launch";
launch.type="button";launch.textContent="🎙 Live captions";
launch.title="Live transcription with optional translation";
(document.getElementById("he-live-launchers")||document.body).append(launch);
const el=id=>panel.querySelector("#"+id);
const source=el("he-translate-source"),target=el("he-translate-target");
const input=el("he-translate-input"),feed=el("he-caption-feed");
const locale={en:"en-US",pl:"pl-PL",pt:"pt-BR",es:"es-ES",zh:"zh-CN",tr:"tr-TR",
 vi:"vi-VN",af:"af-ZA",fr:"fr-FR",de:"de-DE",ru:"ru-RU",ar:"ar-SA"};
let listening=false,activeEngine="",audioStream=null,displayStream=null,micStream=null,mixedCtx=null;
let recognition=null,mediaRecorder=null,flushRecorder=null,recordTimer=null,clockTimer=null,sessionStarted=0,sessionRun=0;
let uploadCount=0,lastError="",pip=null,closing=false,cloud={cloudAvailable:false,eligible:false,cloudConfigured:false};
let segments=[],seq=0,interim="",translationQueue=[],translateBusy=false,lastTranslate=0,dirty=false;
let room=null,roomChannel=null,roomKey=null,roomUntil=0,roomReady=false,roomUrl="";
const cap=160000,maxRows=300;
const say=(text,error=false)=>{
 const node=el("he-translate-status");node.textContent=text;node.classList.toggle("he-error",error);
};
const showSetup=text=>{
 const node=el("he-caption-setup");node.hidden=!text;node.textContent=text||"";
};
function updateState(){
 const label=el("he-caption-state");
 label.textContent=listening?"● "+(activeEngine==="cloud"?"Cloud captions":activeEngine==="device"?"On-device captions":"Browser captions"):"Not listening";
 label.classList.toggle("he-recording",listening);
 el("he-translate-mic").disabled=listening;
 el("he-caption-stop").disabled=!listening;
 el("he-caption-install").disabled=listening;
}
function previewMicLanguage(studentId){
 const student=(window.HelloEarthWorkspace?.students||[]).find(x=>x.id===studentId);
 const name=String(student?.translation_language||"").toLowerCase();
 const names={polish:"pl",portuguese:"pt",spanish:"es",chinese:"zh",turkish:"tr",
  vietnamese:"vi",afrikaans:"af",french:"fr",german:"de",russian:"ru",arabic:"ar",english:"en"};
 const code=Object.keys(names).find(x=>name.includes(x));
 if(code)target.value=names[code];
}
document.addEventListener("helloearth:lesson-selected",e=>previewMicLanguage(e.detail?.studentId));
document.getElementById("he-lesson-student")?.addEventListener("change",e=>previewMicLanguage(e.target.value));
function show(){
 document.getElementById("he-live-feedback-panel")?.setAttribute("hidden","");
 panel.hidden=false;
 loadCloudStatus();
 if(!listening)say("Choose a source and press Start. The transcript will appear below.");
}
launch.addEventListener("click",show);
const Recognition=()=>window.SpeechRecognition||window.webkitSpeechRecognition;
function updateCloud(){
 const node=el("he-caption-cloud");
 node.textContent=cloud.cloudAvailable?"Cloud fallback ready":
  !cloud.cloudConfigured?"Cloud speech not connected":"Cloud captions not in your plan";
 node.classList.toggle("he-cloud",cloud.cloudAvailable);
}
async function loadCloudStatus(){
 try{
  const data=new FormData();data.append("action","status");
  const res=await db.functions.invoke("he-live-transcribe",{body:data});
  if(res.error)throw Error(res.error.message||"Status unavailable");
  cloud=res.data||cloud;updateCloud();
  if(!cloud.cloudConfigured)showSetup("Cloud speech-to-text has not been enabled for this workspace. Ask the administrator to connect the optional speech service. You can still try browser captions or install an on-device language pack.");
  else showSetup("");
 }catch{cloud.cloudAvailable=false;updateCloud()}
}
function recordsText(){
 return segments.map(s=>"["+new Date(s.created).toLocaleTimeString()+"] "+s.source+"\n"+s.text+
  (s.translation?"\nTranslation: "+s.translation:"")).join("\n\n");
}
function download(name,text){
 const blob=new Blob([text],{type:"text/plain;charset=utf-8"}),url=URL.createObjectURL(blob);
 const a=document.createElement("a");a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1300);
}
async function copy(value){
 try{await navigator.clipboard.writeText(value);say("Copied to clipboard.")}
 catch{say("Unable to copy automatically. Select the text and copy it instead.",true)}
}
const stamp=t=>new Date(t).toLocaleTimeString(undefined,{hour:"2-digit",minute:"2-digit"});
function makeRow(item){
 el("he-caption-empty")?.remove();
 const row=document.createElement("article");row.className="he-caption-row";
 const header=document.createElement("header");
 const who=document.createElement("span");who.textContent=item.source;
 const at=document.createElement("span");at.textContent=stamp(item.created);
 header.append(who,at);
 const original=document.createElement("p");original.className="he-caption-original";original.textContent=item.text;
 const translated=document.createElement("p");translated.className="he-caption-translated";translated.hidden=true;
 row.append(header,original,translated);feed.append(row);
 item.node=row;item.translationNode=translated;
 // Keep the full transcript for download; prune only old DOM nodes for performance.
 if(segments.length>maxRows)segments[segments.length-maxRows-1]?.node?.remove();
 feed.scrollTop=feed.scrollHeight;
}
const toB64=buf=>btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");
async function broadcast(data){
 if(!roomChannel||!roomReady||Date.now()>roomUntil)return;
 const packet={v:1,room,created:Date.now(),...data};
 try{
  const signature=await crypto.subtle.sign({name:"ECDSA",hash:"SHA-256"},roomKey.privateKey,
   new TextEncoder().encode(JSON.stringify(packet)));
  await roomChannel.send({type:"broadcast",event:"caption",payload:{data:packet,signature:toB64(signature)}});
 }catch{say("Student sharing connection is interrupted. Local captions continue.",true)}
}
function addCaption(raw,who){
 const text=String(raw||"").trim().slice(0,1300);
 if(!text)return;
 const used=recordsText().length;
 if(used+text.length>cap){
  say("Transcript reached the 160,000-character session safety limit. Download it before starting a new session.",true);
  stopListening();return;
 }
 const item={seq:++seq,created:Date.now(),source:who||"Speech",text,translation:""};
 segments.push(item);dirty=true;makeRow(item);
 broadcast({type:"caption",seq:item.seq,source:item.source,text:item.text});
 if(el("he-translate-auto").checked&&source.value!==target.value){
  translationQueue.push(item);processTranslations();
 }
}
let nativeTranslator=null,nativePair="";
async function translateLocal(text){
 if(!window.Translator?.create||!window.Translator?.availability)return null;
 try{
  const params={sourceLanguage:source.value,targetLanguage:target.value};
  const key=source.value+"-"+target.value;
  if(!nativeTranslator||nativePair!==key){
   if(await window.Translator.availability(params)!=="available")return null;
   nativeTranslator=await window.Translator.create(params);nativePair=key;
  }
  return String(await nativeTranslator.translate(text)).trim();
 }catch{return null}
}
async function translationFor(text){
 if(source.value===target.value)return text;
 const local=await translateLocal(text);
 if(local!==null)return local;
 const {data,error}=await db.functions.invoke("he-translate",{
  body:{text:text.slice(0,580),source:source.value,target:target.value}
 });
 if(error){
  let msg=error.message||"Translation service unavailable";
  if(typeof error.context?.json==="function"){
   try{const detail=await error.context.json();if(detail?.error)msg=detail.error}catch{}
  }
  throw Error(msg);
 }
 if(!data?.translation)throw Error("No translation returned.");
 return String(data.translation).slice(0,1300);
}
async function processTranslations(){
 if(translateBusy)return;
 translateBusy=true;
 while(translationQueue.length){
  const item=translationQueue.shift();
  try{
   const elapsed=Date.now()-lastTranslate;
   if(elapsed<3800)await new Promise(resolve=>setTimeout(resolve,3800-elapsed));
   lastTranslate=Date.now();
   const translated=await translationFor(item.text);
   item.translation=translated;
   item.translationNode.textContent=translated;item.translationNode.hidden=false;
   broadcast({type:"translation",seq:item.seq,translation:translated});
  }catch(error){
   say("Captions are working, but translation is currently unavailable: "+error.message,true);
   translationQueue.length=0;
  }
 }
 translateBusy=false;
}
function stopTracks(){
 for(const stream of [audioStream,displayStream,micStream]){
  if(stream)for(const track of stream.getTracks()){try{track.stop()}catch{}}
 }
 audioStream=null;displayStream=null;micStream=null;
 if(mixedCtx){mixedCtx.close().catch(()=>{});mixedCtx=null}
}
function stopListening(flush=false){
 if(flush&&mediaRecorder?.state==="recording")flushRecorder=mediaRecorder;
 listening=false;sessionRun++;
 if(recordTimer){clearTimeout(recordTimer);recordTimer=null}
 if(clockTimer){clearInterval(clockTimer);clockTimer=null}
 if(recognition){const old=recognition;recognition=null;try{old.abort()}catch{}}
 if(mediaRecorder){const m=mediaRecorder;mediaRecorder=null;try{if(m.state==="recording")m.stop()}catch{}}
 stopTracks();el("he-translate-interim").textContent="";
 updateState();updateTime();
}
function updateTime(){
 const ms=listening?Date.now()-sessionStarted:0;
 el("he-caption-time").textContent=String(Math.floor(ms/60000)).padStart(2,"0")+":"+
  String(Math.floor(ms/1000)%60).padStart(2,"0");
 if(listening&&ms>90*60000){
  stopListening();say("This caption session ended after 90 minutes. Download the transcript to retain a copy.");
 }
}
async function obtainAudio(){
 const selected=el("he-caption-source").value;
 if(selected==="mic"){
  micStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});
  audioStream=new MediaStream(micStream.getAudioTracks());
  return;
 }
 displayStream=await navigator.mediaDevices.getDisplayMedia({
  video:true,audio:true,preferCurrentTab:false,systemAudio:"include",surfaceSwitching:"include"
 });
 const tabTracks=displayStream.getAudioTracks();
 if(!tabTracks.length)throw Error("The shared tab did not provide audio. Select the Preply browser tab and enable Share tab audio.");
 displayStream.getVideoTracks().forEach(t=>t.addEventListener("ended",()=>{
  if(listening){stopListening();say("The class-tab screen share ended. Captions stopped.")}
 },{once:true}));
 if(selected==="tab"){audioStream=new MediaStream(tabTracks);return}
 micStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});
 mixedCtx=new (window.AudioContext||window.webkitAudioContext)();
 const dest=mixedCtx.createMediaStreamDestination();
 for(const media of [new MediaStream(tabTracks),micStream]){
  const input=mixedCtx.createMediaStreamSource(media);
  const gain=mixedCtx.createGain();gain.gain.value=media===micStream?0.85:1;
  input.connect(gain).connect(dest);
 }
 await mixedCtx.resume();
 audioStream=dest.stream;
}
async function localAvailability(){
 const Ctor=Recognition();
 if(!Ctor||typeof Ctor.available!=="function")return "unsupported";
 try{return await Ctor.available({langs:[locale[source.value]],processLocally:true})}
 catch{return "unsupported"}
}
async function onDeviceInstall(){
 const Ctor=Recognition(),lang=locale[source.value];
 if(!Ctor?.available||!Ctor?.install){
  say("This browser doesn't offer on-device speech packs. Try desktop Chrome or cloud captions.",true);
  return;
 }
 try{
  const state=await localAvailability();
  if(state==="available"){
   el("he-caption-engine").value="device";say("Offline speech already installed. Select Start captions.");return;
  }
  say("Preparing the on-device language pack…");
  const installed=await Ctor.install({langs:[lang],processLocally:true});
  if(!installed){say("Browser could not install an offline language pack. Use cloud captions instead.",true);return}
  el("he-caption-engine").value="device";say("On-device language pack installed. You can start captions without the browser's remote speech service.");
 }catch(error){say("On-device language pack unavailable: "+error.message,true)}
}
async function startBrowser(device=false){
 const Ctor=Recognition();
 if(!Ctor)throw Error("This browser doesn't provide speech recognition.");
 const engine=new Ctor();
 recognition=engine;activeEngine=device?"device":"browser";
 engine.lang=locale[source.value];engine.continuous=true;engine.interimResults=true;
 if(device)engine.processLocally=true;
 engine.onresult=event=>{
  let final="",pending="";
  for(let i=event.resultIndex;i<event.results.length;i++){
   const result=event.results[i],text=result[0]?.transcript?.trim()||"";
   if(result.isFinal)final+=(final?" ":"")+text;
   else pending+=(pending?" ":"")+text;
  }
  el("he-translate-interim").textContent=pending?"Hearing: "+pending:"";
  if(final)addCaption(final,el("he-caption-source").value==="mic"?"Microphone":
   el("he-caption-source").value==="both"?"Class + microphone":"Class audio");
 };
 engine.onerror=event=>{
  const err=event.error||"unavailable";lastError=err;
  if(err==="network"){
   if(cloud.cloudAvailable&&audioStream){
    say("Browser speech service failed. Switching automatically to secure cloud captions.");
    try{engine.abort()}catch{}
    recognition=null;
    startCloud().catch(error=>{stopListening();say(error.message,true)});
   }else{
    stopListening();
    say("Browser speech service returned a network error. Your microphone may be fine. Use Install offline speech pack, or ask the administrator to enable cloud captions.",true);
   }
  }else if(["not-allowed","service-not-allowed","audio-capture","language-not-supported"].includes(err)){
   stopListening();say("Speech recognition: "+err+". Check microphone permissions or try an available offline language pack.",true);
  }else if(err!=="no-speech"&&err!=="aborted")say("Speech recognition: "+err,true);
 };
 let restarts=0;
 engine.onend=()=>{
  if(!listening||recognition!==engine||activeEngine==="cloud")return;
  if(++restarts>100){stopListening();say("Speech recognition disconnected repeatedly. Restart captions.",true);return}
  setTimeout(()=>{
   if(!listening||recognition!==engine)return;
   try{
    if(el("he-caption-source").value==="mic")engine.start();
    else engine.start(audioStream.getAudioTracks()[0]);
   }catch(e){stopListening();say("Couldn't restart speech recognition: "+e.message,true)}
  },500);
 };
 if(el("he-caption-source").value==="mic"){
  try{engine.start(audioStream.getAudioTracks()[0])}catch{engine.start()}
 }else{
  try{engine.start(audioStream.getAudioTracks()[0])}
  catch{throw Error("This browser cannot recognise shared-tab audio directly. Use the cloud captions option.")}
 }
 say(device?"On-device captions started.": "Browser captions started. If its speech service fails, cloud fallback will be used when configured.");
 updateState();
}
const audioMimes=["audio/webm;codecs=opus","audio/webm","audio/mp4","audio/ogg"];
function chosenMime(){
 return audioMimes.find(m=>window.MediaRecorder?.isTypeSupported(m))||"";
}
function cloudChunk(){
 if(!listening||activeEngine!=="cloud"||!audioStream)return;
 const mime=chosenMime();
 if(!mime)throw Error("This browser cannot record compatible audio. Try desktop Chrome or Edge.");
 const recorder=new MediaRecorder(audioStream,{mimeType:mime,audioBitsPerSecond:48000});
 mediaRecorder=recorder;
 let chunks=[],begin=Date.now(),once=false;
 recorder.ondataavailable=event=>{if(event.data?.size)chunks.push(event.data)};
 recorder.onerror=event=>{
  stopListening();say("Audio encoder error: "+(event.error?.message||"unavailable"),true);
 };
 recorder.onstop=()=>{
  if(once)return;once=true;
  if(recordTimer){clearTimeout(recordTimer);recordTimer=null}
  const seconds=Math.max(0,Math.round((Date.now()-begin)/1000));
  const blob=new Blob(chunks,{type:mime});
  const wasFinal=flushRecorder===recorder;
  if(wasFinal)flushRecorder=null;
  if(listening&&activeEngine==="cloud"){
   try{cloudChunk()}catch(error){stopListening();say(error.message,true)}
  }
  // Stop means stop: do not transmit an unfinished segment after the user stops.
  if((listening&&activeEngine==="cloud"||wasFinal)&&blob.size>=400&&seconds>=3){
   if(uploadCount>=2){say("Speech service is slower than the class. Captions are delayed; skipping a full audio segment.",true)}
   else uploadBlob(blob,seconds,sessionRun,wasFinal).catch(error=>say(error.message,true));
  }
 };
 recorder.start();
 recordTimer=setTimeout(()=>{if(recorder.state==="recording")recorder.stop()},7300);
}
async function uploadBlob(blob,seconds,whichSession,isFinal=false){
 uploadCount++;
 try{
  const form=new FormData();
  form.append("action","transcribe");form.append("confirmedConsent","true");
  form.append("language",source.value);form.append("seconds",String(Math.min(45,Math.max(3,seconds))));
  const extension=blob.type.startsWith("audio/mp4")?"mp4":blob.type.startsWith("audio/ogg")?"ogg":"webm";
  form.append("audio",blob,"lesson."+extension);
  const {data,error}=await db.functions.invoke("he-live-transcribe",{body:form});
  if(error){
   let msg=error.message||"Could not process an audio segment";
   if(typeof error.context?.json==="function"){
    try{const detail=await error.context.json();if(detail?.error)msg=detail.error}catch{}
   }
   throw Error(msg);
  }
  if(data?.text&&((listening&&sessionRun===whichSession)||isFinal))
   addCaption(data.text,el("he-caption-source").value==="mic"?"Microphone":
    el("he-caption-source").value==="both"?"Class + microphone":"Class audio");
  say("Cloud captions active. "+(typeof data?.remainingSeconds==="number"&&data.remainingSeconds<1800?
   Math.round(data.remainingSeconds/60)+" allowance minutes left.":"Live transcription running."));
 }finally{uploadCount--}
}
async function startCloud(){
 if(!cloud.cloudAvailable)throw Error("Cloud speech-to-text is not connected or not included in this plan. Browser or on-device captions may still work.");
 if(!window.MediaRecorder)throw Error("This browser doesn't support MediaRecorder.");
 if(recognition){try{recognition.abort()}catch{}recognition=null}
 activeEngine="cloud";cloudChunk();updateState();
 say("Cloud captions started. Audio will be processed in roughly 10-second segments.");
}
async function startListening(){
 if(listening)return;
 if(!el("he-caption-consent").checked){
  say("Confirm consent from class participants before transcribing audio.",true);return;
 }
 if(!navigator.mediaDevices){say("Microphone capture requires a secure browser and HTTPS.",true);return}
 listening=true;sessionStarted=Date.now();const currentRun=++sessionRun;
 const choice=el("he-caption-engine").value;
 el("he-translate-interim").textContent="";
 updateState();
 try{
  await obtainAudio();
  if(!listening||sessionRun!==currentRun){stopTracks();return}
  const offline=await localAvailability();
  if(!listening||sessionRun!==currentRun){stopTracks();return}
  if(choice==="device"){
   if(offline!=="available")throw Error("On-device language pack isn't installed. Select Install offline speech pack first.");
   await startBrowser(true);
  }else if(choice==="cloud"){
   await startCloud();
  }else if(choice==="browser"){
   await startBrowser(false);
  }else if(offline==="available"){
   try{await startBrowser(true)}catch{
    if(cloud.cloudAvailable)await startCloud();else await startBrowser(false);
   }
  }else if(el("he-caption-source").value!=="mic"&&cloud.cloudAvailable){
   await startCloud();
  }else{
   await startBrowser(false);
  }
  clockTimer=setInterval(updateTime,1000);
 }catch(error){
  stopListening();say(error.message||"Could not start live captions.",true);
 }
}
async function startSharing(){
 if(!el("he-caption-consent").checked){
  say("Confirm participants' consent before sharing their words.",true);return;
 }
 if(!crypto?.subtle){say("A secure browser is required for verified student captions.",true);return}
 if(roomChannel){el("he-caption-share-box").hidden=false;return}
 const bytes=crypto.getRandomValues(new Uint8Array(20));
 room=[...bytes].map(x=>x.toString(16).padStart(2,"0")).join("");
 roomKey=await crypto.subtle.generateKey({name:"ECDSA",namedCurve:"P-256"},true,["sign","verify"]);
 roomUntil=Date.now()+90*60000;
 const key=await crypto.subtle.exportKey("jwk",roomKey.publicKey);
 const b64=toB64(new TextEncoder().encode(JSON.stringify(key)));
 const url=new URL("captions.html",location.href);
 url.hash=new URLSearchParams({r:room,e:String(roomUntil),k:b64}).toString();
 roomUrl=url.href;roomReady=false;
 roomChannel=db.channel("he-live-caption-"+room,{config:{broadcast:{self:false,ack:true}}});
 roomChannel.subscribe(status=>{
  roomReady=status==="SUBSCRIBED";
  if(status==="SUBSCRIBED"){
   el("he-caption-share-box").hidden=false;
   el("he-caption-share-url").value=roomUrl;
   say("Student caption link is ready. Share it privately.");
  }else if(["CHANNEL_ERROR","TIMED_OUT","CLOSED"].includes(status)){
   say("Student sharing could not connect. Captions on your screen still work.",true);
  }
 });
}
function endSharing(){
 if(roomChannel){db.removeChannel(roomChannel);roomChannel=null}
 roomReady=false;room=null;roomKey=null;roomUrl="";
 el("he-caption-share-box").hidden=true;el("he-caption-share-url").value="";
}
el("he-caption-install").addEventListener("click",onDeviceInstall);
el("he-translate-mic").addEventListener("click",startListening);
el("he-caption-stop").addEventListener("click",()=>{stopListening(true);say("Stopped microphone capture. Finishing the final recorded audio segment, if any…")});
el("he-caption-share").addEventListener("click",()=>startSharing().catch(e=>say(e.message,true)));
el("he-caption-stop-share").addEventListener("click",()=>{endSharing();say("Student viewing link stopped receiving captions.")});
el("he-caption-copy-url").addEventListener("click",()=>copy(roomUrl));
el("he-caption-download").addEventListener("click",()=>{
 download("helloearth-class-captions.txt",recordsText());dirty=false;
});
el("he-caption-clear").addEventListener("click",()=>{
 if(listening){say("Stop live captions before clearing the transcript.",true);return}
 if(segments.length&&!confirm("Clear the transcript from this browser tab?"))return;
 segments=[];seq=0;dirty=false;translationQueue.length=0;feed.replaceChildren();
 const p=document.createElement("p");p.id="he-caption-empty";p.className="he-caption-activity";
 p.textContent="Captions cleared. Start a new session whenever you're ready.";feed.append(p);
 say("Transcript cleared from this tab.");
});
el("he-caption-report").addEventListener("click",()=>{
 if(!segments.length){say("Transcribe or type some speech before generating a report.",true);return}
 stopListening();
 const complete=recordsText();
 const transcript=complete.length>35000?complete.slice(-35000):complete;
 if(complete.length>35000)alert("Lesson Reports currently analyses up to 35,000 characters at a time. The final 35,000 characters will be imported; download the full class transcript separately.");
 if(window.HelloEarthLessonReports?.useTranscript){
  window.HelloEarthLessonReports.useTranscript(transcript);
  dirty=false;panel.hidden=true;document.getElementById("reports-tab")?.click();
 }else{
  copy(transcript);say("Transcript copied. Paste it in Lesson Reports.");
 }
});
el("he-translate-now").addEventListener("click",()=>{
 const text=input.value.trim();if(!text){say("Type a phrase first.",true);return}
 addCaption(text,"Typed note");input.value="";
});
el("he-translate-copy").addEventListener("click",()=>copy(segments.at(-1)?.text||""));
for(const id of ["he-caption-source","he-translate-source","he-caption-engine"]){
 el(id).addEventListener("change",()=>{
  if(listening){stopListening();say("Audio settings changed. Restart captions with the new selection.")}
 });
}
el("he-live-translate-close").addEventListener("click",()=>{
 closing=true;stopListening();panel.hidden=true;
 if(pip&&!pip.closed)pip.close();
});
el("he-live-translate-pin").addEventListener("click",async()=>{
 if(!window.documentPictureInPicture?.requestWindow){
  say("Always-on-top windows need supported desktop Chrome. Captions can still float above HelloEarth.",true);return;
 }
 if(pip&&!pip.closed){pip.focus();return}
 closing=false;
 try{
  const win=await window.documentPictureInPicture.requestWindow({width:565,height:720});
  pip=win;win.document.title="HelloEarth · Live captions";
  win.document.body.className="he-pip-body";
  const css=win.document.createElement("link");css.rel="stylesheet";
  css.href=new URL("dashboard-live-tools.css?v=20261126-captions1",location.href).href;
  win.document.head.append(css);win.document.body.append(panel);panel.hidden=false;
  win.addEventListener("pagehide",()=>{
   document.body.append(panel);panel.hidden=closing;pip=null;closing=false;
  },{once:true});
 }catch(error){say("Could not open always-on-top captions: "+error.message,true)}
});
window.HelloEarthLiveCaptions={show,getTranscript:recordsText,stop:stopListening};
window.addEventListener("beforeunload",event=>{
 if(listening||dirty){event.preventDefault();event.returnValue=""}
});
updateState();updateCloud();

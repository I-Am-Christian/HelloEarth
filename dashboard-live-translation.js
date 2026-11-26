import {db} from "./supabase-client.js";
const wrapper=document.createElement("div");
wrapper.innerHTML="<section class=\"he-live-panel\" id=\"he-live-translate-panel\" aria-label=\"Live translation\" hidden>\n <div class=\"he-live-panel-header\"><h2>Live translation</h2><div>\n  <button type=\"button\" id=\"he-live-translate-pin\" title=\"Open always-on-top window if supported\">⧉</button>\n  <button type=\"button\" id=\"he-live-translate-close\" aria-label=\"Close translator\">×</button>\n </div></div>\n <p class=\"he-live-hint\">Translate text or microphone speech. ⧉ opens a window above other applications on supported desktop browsers.</p>\n <div class=\"he-translate-languages\">\n  <label>Source language<select id=\"he-translate-source\">\n   <option value=\"en\" selected>English</option><option value=\"pl\">Polish</option><option value=\"pt\">Portuguese</option>\n   <option value=\"es\">Spanish</option><option value=\"zh\">Chinese</option><option value=\"tr\">Turkish</option>\n   <option value=\"vi\">Vietnamese</option><option value=\"af\">Afrikaans</option><option value=\"fr\">French</option>\n   <option value=\"de\">German</option><option value=\"ru\">Russian</option><option value=\"ar\">Arabic</option>\n  </select></label>\n  <label>Translate into<select id=\"he-translate-target\">\n   <option value=\"en\">English</option><option value=\"pl\" selected>Polish</option><option value=\"pt\">Portuguese</option>\n   <option value=\"es\">Spanish</option><option value=\"zh\">Chinese</option><option value=\"tr\">Turkish</option>\n   <option value=\"vi\">Vietnamese</option><option value=\"af\">Afrikaans</option><option value=\"fr\">French</option>\n   <option value=\"de\">German</option><option value=\"ru\">Russian</option><option value=\"ar\">Arabic</option>\n  </select></label>\n </div>\n <label>Phrase to translate<textarea id=\"he-translate-input\" maxlength=\"600\" rows=\"3\" placeholder=\"Type a phrase or start microphone listening.\"></textarea></label>\n <p id=\"he-translate-interim\" class=\"he-interim\" aria-live=\"polite\"></p>\n <label class=\"he-live-check\"><input type=\"checkbox\" id=\"he-translate-auto\"><span>Auto-translate recognised speech (uses AI credits if local translation unavailable)</span></label>\n <div class=\"he-live-actions\">\n  <button type=\"button\" id=\"he-translate-mic\">🎙 Start listening</button>\n  <button type=\"button\" id=\"he-translate-now\" class=\"primary\">Translate</button>\n  <button type=\"button\" id=\"he-translate-copy\">Copy</button>\n </div>\n <p id=\"he-translate-status\" class=\"he-status\" role=\"status\" aria-live=\"polite\"></p>\n <div id=\"he-translate-output\" class=\"he-translation-output\" aria-live=\"polite\">Your translation will appear here.</div>\n <p class=\"he-live-hint\">Speech recognition depends on browser support and may use your browser vendor's servers. When local translation is unavailable, text is sent to Claude Haiku. HelloEarth does not store transcripts or translations.</p>\n</section>";
const panel=wrapper.firstElementChild;document.body.append(panel);
const launchers=document.getElementById("he-live-launchers");
const launch=document.createElement("button");
launch.id="he-live-translate-launch";launch.type="button";launch.textContent="🌐 Translate";
launch.title="Live translation";(launchers||document.body).append(launch);
const el=id=>panel.querySelector("#"+id);
const source=el("he-translate-source"),target=el("he-translate-target");
const input=el("he-translate-input"),output=el("he-translate-output");
let busy=false,recognition=null,listening=false,pip=null,closing=false;
let translator=null,pair="",autoTimer=null,autoQueue="",lastAuto=0;
const message=(text,error=false)=>{
 const n=el("he-translate-status");n.textContent=text;n.classList.toggle("he-error",error);
};
function show(){
 document.getElementById("he-live-feedback-panel")?.setAttribute("hidden","");
 panel.hidden=false;message("Ready. Type a phrase or start the microphone.");
}
launch.addEventListener("click",show);
function stopMic(){
 listening=false;
 if(autoTimer){clearTimeout(autoTimer);autoTimer=null;autoQueue=""}
 if(recognition){try{recognition.abort()}catch{}recognition=null}
 el("he-translate-mic").textContent="🎙 Start listening";
 el("he-translate-interim").textContent="";
}
el("he-live-translate-close").addEventListener("click",()=>{
 closing=true;stopMic();panel.hidden=true;
 if(pip&&!pip.closed)pip.close();
});
const locale={en:"en-US",pl:"pl-PL",pt:"pt-BR",es:"es-ES",zh:"zh-CN",
 tr:"tr-TR",vi:"vi-VN",af:"af-ZA",fr:"fr-FR",de:"de-DE",ru:"ru-RU",ar:"ar-SA"};
async function locally(text,src,dest){
 const API=window.Translator;
 if(!API||typeof API.create!=="function"||typeof API.availability!=="function")return null;
 try{
  const key=src+"-"+dest;
  if(!translator||pair!==key){
   const args={sourceLanguage:src,targetLanguage:dest};
   if(await API.availability(args)!=="available")return null;
   translator=await API.create(args);pair=key;
  }
  return String(await translator.translate(text));
 }catch{return null}
}
async function translateText(raw){
 const text=String(raw||"").trim(),src=source.value,dest=target.value;
 if(!text){message("Type or speak something first.",true);return}
 if(text.length>600){message("Use at most 600 characters in each translation.",true);return}
 if(busy)return;
 busy=true;el("he-translate-now").disabled=true;message("Translating…");
 try{
  if(src===dest){output.textContent=text;message("Both languages are the same.");return}
  const local=await locally(text,src,dest);
  if(local!==null){output.textContent=local;message("Translated on this device. No API credits used.");return}
  const {data,error}=await db.functions.invoke("he-translate",{body:{text,source:src,target:dest}});
  if(error){
   let msg=error.message||"Translation unavailable.";
   if(typeof error.context?.json==="function"){
    try{const detail=await error.context.json();if(detail?.error)msg=detail.error}catch{}
   }
   throw Error(msg);
  }
  if(!data?.translation)throw Error("No translation returned.");
  output.textContent=data.translation;
  message("Translated with Haiku"+(Number.isFinite(data.remainingToday)?" · "+data.remainingToday+" requests left today.":"."));
 }catch(err){message(err.message,true)}
 finally{busy=false;el("he-translate-now").disabled=false}
}
el("he-translate-now").addEventListener("click",()=>translateText(input.value));
el("he-translate-copy").addEventListener("click",async()=>{
 try{await navigator.clipboard.writeText(output.textContent);message("Translation copied.");}
 catch{message("Unable to copy in this browser.",true)}
});
function autoPhrase(chunk){
 autoQueue=(autoQueue+" "+chunk).trim().slice(-600);
 if(autoTimer)return;
 autoTimer=setTimeout(async()=>{
  autoTimer=null;const next=autoQueue;autoQueue="";lastAuto=Date.now();
  if(listening&&el("he-translate-auto").checked)await translateText(next);
  if(autoQueue&&listening)autoPhrase("");
 },Math.max(0,4200-(Date.now()-lastAuto)));
}
function startMic(){
 const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
 if(!Recognition){message("This browser doesn't support speech recognition. You can still type text.",true);return}
 stopMic();recognition=new Recognition();
 recognition.lang=locale[source.value]||"en-US";
 recognition.continuous=true;recognition.interimResults=true;
 listening=true;el("he-translate-mic").textContent="■ Stop listening";
 recognition.onresult=event=>{
  let interim="",final="";
  for(let i=event.resultIndex;i<event.results.length;i++){
   const result=event.results[i],speech=result[0]?.transcript?.trim()||"";
   if(result.isFinal)final+=(final?" ":"")+speech;
   else interim+=(interim?" ":"")+speech;
  }
  el("he-translate-interim").textContent=interim?"Hearing: "+interim:"";
  if(final){
   input.value=(input.value?input.value+" ":"")+final;
   if(input.value.length>600)input.value=input.value.slice(-600);
   if(el("he-translate-auto").checked)autoPhrase(final);
  }
 };
 recognition.onerror=event=>{
  message("Microphone: "+(event.error||"unavailable"),true);
  if(["not-allowed","service-not-allowed","audio-capture"].includes(event.error))stopMic();
 };
 recognition.onend=()=>{
  if(listening&&recognition){try{recognition.start()}catch{stopMic()}}
 };
 try{recognition.start();message("Listening. Speak into your microphone.");}
 catch(err){stopMic();message("Could not start the microphone: "+err.message,true)}
}
el("he-translate-mic").addEventListener("click",()=>{if(listening)stopMic();else startMic()});
source.addEventListener("change",()=>{if(listening){stopMic();message("Language changed. Restart the microphone.")}});
el("he-live-translate-pin").addEventListener("click",async()=>{
 if(!window.documentPictureInPicture?.requestWindow){
  message("Always-on-top popups aren't supported here. The panel remains above HelloEarth; try desktop Chrome.",true);
  return;
 }
 if(pip&&!pip.closed){pip.focus();return}
 closing=false;
 try{
  const win=await window.documentPictureInPicture.requestWindow({width:485,height:660});
  pip=win;win.document.title="HelloEarth live translator";
  win.document.body.className="he-pip-body";
  const link=win.document.createElement("link");link.rel="stylesheet";
  link.href=new URL("dashboard-live-tools.css?v=20261126-live1",location.href).href;
  win.document.head.append(link);
  win.document.body.append(panel);panel.hidden=false;
  message("Always-on-top window active. Close it to return to HelloEarth.");
  win.addEventListener("pagehide",()=>{
   document.body.append(panel);
   panel.hidden=closing;
   pip=null;
   if(!closing)message("Translator returned to the dashboard.");
   closing=false;
  },{once:true});
 }catch(err){message("Could not open always-on-top window: "+err.message,true)}
});

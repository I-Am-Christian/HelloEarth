import {db} from "./supabase-client.js";
// Premium live speech / pasted-transcript report workspace.
// The transcript remains in the current browser tab; only the final report
// is submitted for persistent storage. Audio isn't recorded or uploaded here.
const el=id=>document.getElementById(id);
const getWorkspace=()=>window.HelloEarthWorkspace||null;
const maxLength=35000;
let userId=null,allowed=false,tier="",monthlyAllowance=0,reports=[],current=null;
let recognition=null,listening=false,startedAt=null,timer=null,voiceUsed=false,typedUsed=false;
let busy=false,selectedLessonStudent="";
const feedback=(message,error=false)=>{
 const p=el("he-report-status");p.textContent=message;p.classList.toggle("is-error",error);
};
const timerLabel=ms=>{
 const whole=Math.max(0,Math.floor(ms/1000)),minutes=Math.floor(whole/60),seconds=whole%60;
 return String(minutes).padStart(2,"0")+":"+String(seconds).padStart(2,"0");
};
const selected=()=>el("he-report-student").value;
const updateCount=()=>{
 const area=el("he-report-transcript");
 el("he-report-count").textContent=area.value.length.toLocaleString()+" / 35,000 characters";
 el("he-report-generate").disabled=!allowed||busy||listening||!el("he-report-consent").checked||!selected()||area.value.trim().length<250;
 el("he-report-stop-generate").disabled=!allowed||busy||!listening||area.value.trim().length<250;
};
const statusLabel=()=>{
 const node=el("he-report-recording-label");
 node.textContent=listening?"● Listening to microphone":"Not recording";
 node.classList.toggle("is-recording",listening);
 el("he-report-start").disabled=!allowed||listening||busy;
 el("he-report-stop").disabled=!listening;
 updateCount();
};
const isFounder=record=>record?.is_internal===true&&record.status==="active";
const paid=record=>Boolean(record?.status==="active"&&
 ["growth","studio"].includes(record?.plan_code)&&record.payment_provider&&
 record.current_period_end&&Date.parse(record.current_period_end)>Date.now());
async function user(){
 const {data:{user},error}=await db.auth.getUser();
 if(error||!user)throw Error("Please sign in to access Lesson Reports.");
 userId=user.id;return user;
}
function populateStudents(hint=""){
 const currentId=hint||selected()||selectedLessonStudent||el("he-lesson-student")?.value||"";
 const students=getWorkspace()?.students||[];
 const element=el("he-report-student");
 element.replaceChildren();
 const blank=document.createElement("option");blank.value="";blank.textContent="Choose a student";
 element.append(blank);
 for(const student of students){
  const opt=document.createElement("option");opt.value=student.id;opt.textContent=student.display_name;
  element.append(opt);
 }
 if([...element.options].some(x=>x.value===currentId))element.value=currentId;
 updateCount();
}
async function loadPlan(){
 const box=el("he-report-entitlement");
 try{
  const active=await user();
  const {data,error}=await db.from("helloearth_subscriptions")
   .select("plan_code,status,is_internal,payment_provider,current_period_end")
   .eq("tutor_id",active.id).maybeSingle();
  if(error)throw error;
  allowed=isFounder(data)||paid(data);
  tier=isFounder(data)?"Founder":data?.plan_code||"free";
  monthlyAllowance=isFounder(data)?300:data?.plan_code==="studio"&&allowed?12:data?.plan_code==="growth"&&allowed?2:0;
  box.classList.toggle("is-locked",!allowed);
  box.replaceChildren();
  const title=document.createElement("strong");
  if(allowed){
   title.textContent="✓ "+(isFounder(data)?"Founder testing access":"Included with "+tier.charAt(0).toUpperCase()+tier.slice(1));
   const p=document.createElement("p");
   p.textContent=monthlyAllowance+" transcript-based reports per calendar month. "+
    (isFounder(data)?"A 40-per-day emergency cap protects API spending.":
      "Growth: 2 monthly · Studio: 12 monthly; all usage is enforced on the server.");
   box.append(title,p);
  }else{
   title.textContent="Premium feature · Growth or Studio";
   const p=document.createElement("p");
   p.textContent="Reports require an active Growth or Studio subscription. "+
    "Paid subscriptions are still being prepared; these prices and limits are launch previews. ";
   const a=document.createElement("a");a.href="pricing.html";a.textContent="Compare plans";
   box.append(title,p,a);
  }
  statusLabel();
 }catch(err){
  allowed=false;box.textContent="Couldn't verify your report entitlement. "+err.message;
  box.classList.add("is-locked");statusLabel();
 }
}
async function refresh(){
 if(!userId)try{await user()}catch(err){feedback(err.message,true);return}
 const root=el("he-report-list");
 root.replaceChildren();
 if(!selected()){
  const p=document.createElement("p");p.className="he-report-empty";
  p.textContent="Select a student to see previous reports.";
  root.append(p);return;
 }
 try{
  const {data,error}=await db.from("he_lesson_reports")
   .select("id,title,transcript_chars,transcription_method,recorded_minutes,created_at,report_markdown")
   .eq("tutor_id",userId).eq("student_id",selected()).order("created_at",{ascending:false}).limit(60);
  if(error)throw error;
  reports=data||[];
  if(!reports.length){
   const p=document.createElement("p");p.className="he-report-empty";
   p.textContent="No reports saved for this student yet.";root.append(p);return;
  }
  const makeButton=(text,func)=>{
   const button=document.createElement("button");button.type="button";
   button.textContent=text;button.addEventListener("click",func);return button;
  };
  for(const item of reports){
   const article=document.createElement("article");article.className="he-report-entry";
   const title=document.createElement("strong");title.textContent=item.title;
   const meta=document.createElement("small");
   meta.textContent=new Date(item.created_at).toLocaleString()+" · "+
    item.transcript_chars.toLocaleString()+" transcript characters · "+
    item.transcription_method;
   const buttons=document.createElement("div");buttons.className="he-report-entry-actions";
   buttons.append(
    makeButton("View report",()=>showReport(item)),
    makeButton("Open printable PDF view",()=>openReport(item.id)),
    makeButton("Delete",async()=>{
     if(!confirm("Delete this lesson report permanently?"))return;
     const {error}=await db.from("he_lesson_reports")
      .delete().eq("tutor_id",userId).eq("id",item.id);
     if(error){feedback("Couldn't delete report: "+error.message,true);return}
     if(current?.id===item.id){current=null;el("he-report-current").hidden=true}
     await refresh();
    })
   );
   article.append(title,meta,buttons);root.append(article);
  }
 }catch(err){feedback("Couldn't load reports: "+err.message,true)}
}
function reportURL(id){return new URL("lesson-report.html#id="+id,location.href).href}
function openReport(id){window.open(reportURL(id),"_blank","noopener")}
function showReport(item){
 current=item;
 el("he-report-current").hidden=false;
 el("he-report-preview-title").textContent=item.title;
 el("he-report-preview").textContent=item.report_markdown;
 el("he-report-current").scrollIntoView({behavior:"smooth",block:"nearest"});
}
function download(name,content,type="text/plain"){
 const url=URL.createObjectURL(new Blob([content],{type:type+";charset=utf-8"}));
 const link=document.createElement("a");link.href=url;link.download=name;
 document.body.append(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1500);
}
function elapsed(){return startedAt?Date.now()-startedAt:0}
function updateClock(){el("he-report-timer").textContent=timerLabel(elapsed())}
function stop(){
 listening=false;
 if(recognition){const old=recognition;recognition=null;try{old.abort()}catch{}}
 if(timer){clearInterval(timer);timer=null}
 el("he-report-interim").textContent="";
 el("he-report-recording-label").textContent="Not recording";
 statusLabel();
}
function onResult(event){
 let final="",interim="";
 for(let i=event.resultIndex;i<event.results.length;i++){
  const item=event.results[i],segment=item[0]?.transcript?.trim()||"";
  if(item.isFinal)final+=(final?" ":"")+segment;
  else interim+=(interim?" ":"")+segment;
 }
 el("he-report-interim").textContent=interim?"Hearing: "+interim:"";
 if(final){
  const area=el("he-report-transcript");
  const timestamp=new Date().toLocaleTimeString(undefined,{hour:"2-digit",minute:"2-digit",second:"2-digit"});
  const addition=(area.value?"\n":"")+"["+timestamp+"] "+final;
  if(area.value.length+addition.length>maxLength){
   area.value=(area.value+addition).slice(0,maxLength);
   stop();feedback("Transcript reached 35,000 characters. Download a copy or generate its report.",true);
  }else area.value+=addition;
  voiceUsed=true;updateCount();
 }
}
function start(){
 if(!allowed){feedback("Growth, Studio or Founder access is required for this feature.",true);return}
 if(!selected()){feedback("Choose a student before starting.",true);return}
 if(!el("he-report-consent").checked){
  feedback("Confirm permission from every participant before starting speech recognition.",true);return;
 }
 if(el("he-report-language").value==="mixed"){
  feedback("Select the microphone's spoken language. For mixed-language transcripts, paste text instead.",true);return;
 }
 const Ctor=window.SpeechRecognition||window.webkitSpeechRecognition;
 if(!Ctor){feedback("This browser doesn't support microphone speech recognition. Paste a transcript instead.",true);return}
 const recognitionInstance=new Ctor();
 const speechCodes={en:"en-US",pl:"pl-PL",pt:"pt-BR",es:"es-ES",zh:"zh-CN",tr:"tr-TR",
  vi:"vi-VN",af:"af-ZA",fr:"fr-FR",de:"de-DE",ru:"ru-RU",ar:"ar-SA"};
 recognitionInstance.lang=speechCodes[el("he-report-language").value]||"en-US";
 recognitionInstance.continuous=true;
 recognitionInstance.interimResults=true;
 recognition=recognitionInstance;listening=true;
 startedAt=new Date();voiceUsed=false;
 recognitionInstance.onresult=onResult;
 recognitionInstance.onerror=event=>{
  const code=event.error||"unavailable";
  feedback("Microphone recognition: "+code+
   ". You can still paste a transcript.",true);
  if(["not-allowed","service-not-allowed","audio-capture"].includes(code))stop();
 };
 recognitionInstance.onend=()=>{
  if(!listening||recognition!==recognitionInstance)return;
  setTimeout(()=>{
   if(!listening||recognition!==recognitionInstance)return;
   try{recognitionInstance.start()}catch{stop()}
  },450);
 };
 try{
  recognitionInstance.start();
  timer=setInterval(updateClock,1000);
  feedback("Microphone transcription is active. Keep this browser tab open. Only microphone input is heard.");
  statusLabel();
 }catch(err){stop();feedback("Couldn't start the microphone: "+err.message,true)}
}
async function generate(){
 if(!allowed){feedback("This feature requires Growth, Studio or Founder access.",true);return}
 if(listening)stop();
 const area=el("he-report-transcript"),transcript=area.value.trim();
 if(!selected()||transcript.length<250){
  feedback("Choose a student and supply at least 250 characters of transcript.",true);return;
 }
 if(!el("he-report-consent").checked){
  feedback("Confirm participant permission before sending a transcript for analysis.",true);return;
 }
 busy=true;statusLabel();feedback("Nova is preparing an evidence-based report. The raw transcript won't be stored in your student database.");
 try{
  const {data,error}=await db.functions.invoke("he-lesson-report",{body:{
   studentId:selected(),transcript,
   method:voiceUsed?(typedUsed?"mixed":"microphone"):"pasted",
   language:el("he-report-language").value,
   recordedMinutes:Math.min(180,Math.max(0,Math.round(elapsed()/60000))),
   confirmedConsent:true
  }});
  if(error){
   let message=error.message||"Could not generate a report.";
   if(typeof error.context?.json==="function"){
    try{const details=await error.context.json();if(details?.error)message=details.error}catch{}
   }
   throw Error(message);
  }
  if(!data?.report||!data?.id)throw Error("The report service returned no saved report.");
  current={id:data.id,report_markdown:data.report,created_at:data.createdAt,
   title:"Lesson report · "+new Date().toISOString().slice(0,10)};
  feedback("Report saved privately. The transcript is still editable in this browser; download it if you want a separate copy.");
  await refresh();showReport(current);
 }catch(err){feedback(err.message,true)}
 finally{busy=false;statusLabel()}
}
const floating=document.createElement("button");
floating.type="button";floating.className="he-report-activity";
floating.textContent="● Transcribing lesson · tap to return";
floating.hidden=true;document.body.append(floating);
floating.addEventListener("click",()=>el("reports-tab")?.click());
document.addEventListener("helloearth:view-changed",event=>{
 floating.hidden=!(listening&&event.detail?.view!=="reports");
 if(event.detail?.view==="reports"){
  populateStudents();loadPlan();refresh();
 }
});
document.addEventListener("helloearth:studentsloaded",()=>populateStudents());
document.addEventListener("helloearth:lesson-selected",event=>{
 selectedLessonStudent=event.detail?.studentId||"";
 populateStudents(selectedLessonStudent);
});
el("he-report-student").addEventListener("change",()=>{refresh();updateCount()});
el("he-report-consent").addEventListener("change",updateCount);
el("he-report-language").addEventListener("change",()=>{if(listening){stop();feedback("Language changed. Restart microphone recognition.")}});
el("he-report-transcript").addEventListener("input",()=>{
 typedUsed=true;updateCount();
});
el("he-report-start").addEventListener("click",start);
el("he-report-stop").addEventListener("click",stop);
el("he-report-generate").addEventListener("click",generate);
el("he-report-stop-generate").addEventListener("click",generate);
el("he-report-download-transcript").addEventListener("click",()=>{
 const transcript=el("he-report-transcript").value;
 if(!transcript.trim()){feedback("There is no transcript to download.",true);return}
 download("helloearth-lesson-transcript.txt",transcript);
});
el("he-report-clear").addEventListener("click",()=>{
 if(listening){feedback("Stop the microphone before clearing the transcript.",true);return}
 if(el("he-report-transcript").value&&!confirm("Clear the unsaved transcript from this tab?"))return;
 el("he-report-transcript").value="";typedUsed=false;voiceUsed=false;startedAt=null;
 updateClock();updateCount();feedback("Transcript cleared from this tab.");
});
el("he-report-refresh").addEventListener("click",refresh);
el("he-report-open-pdf").addEventListener("click",()=>{if(current)openReport(current.id)});
el("he-report-copy").addEventListener("click",async()=>{
 if(!current)return;
 try{await navigator.clipboard.writeText(current.report_markdown);feedback("Report copied to clipboard.")}
 catch{feedback("Unable to copy automatically. Use Download instead.",true)}
});
el("he-report-download").addEventListener("click",()=>{
 if(current)download("helloearth-lesson-report.md",current.report_markdown,"text/markdown");
});
window.addEventListener("beforeunload",e=>{
 if(listening||el("he-report-transcript").value.trim()){
  e.preventDefault();e.returnValue="";
 }
});
window.HelloEarthLessonReports={
 useTranscript(value){
  if(listening){feedback("Stop the report microphone before importing another transcript.",true);return}
  const imported=String(value||"").trim().slice(0,35000);
  if(!imported)return;
  const field=el("he-report-transcript");
  if(field.value.trim()&&field.value.trim()!==imported){
   if(!confirm("Replace the current report transcript with your live captions?"))return;
  }
  field.value=imported;typedUsed=true;voiceUsed=false;
  updateCount();feedback("Live class captions imported. Choose the student and confirm permission before generating the report.");
 },
 openForStudent(id){
  selectedLessonStudent=id;
  el("reports-tab")?.click();
  populateStudents(id);refresh();
 }
};
populateStudents();statusLabel();
if(!el("reports-view").hidden){loadPlan();refresh()}

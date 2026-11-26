import {db} from "./supabase-client.js";
// Nova assistant UI. Server routes allowlisted actions and verifies tutor ownership.
const outer=document.createElement("div");
outer.id="he-nova-root";
outer.innerHTML='<button type="button" id="he-nova-launch" aria-haspopup="dialog" aria-controls="he-nova-panel" aria-expanded="false"><span class="he-nova-symbol">✦</span><span>Ask Nova</span></button>'+
 '<section id="he-nova-panel" aria-label="Nova workspace assistant" role="dialog" aria-modal="false" hidden>'+
 '<header class="he-nova-head"><div class="he-nova-heading"><span class="he-nova-emblem">✦</span><div><strong>Nova</strong><small>Your HelloEarth assistant</small></div></div><button type="button" id="he-nova-close" aria-label="Close Nova">×</button></header>'+
 '<div id="he-nova-messages" class="he-nova-messages" role="log" aria-live="polite" aria-relevant="additions">'+
 '<div class="he-nova-message he-nova-bot">Hello! I can open pages, prepare a lesson or homework editor, and save notes to your students. What shall we do?</div></div>'+
 '<div class="he-nova-examples"><button type="button" data-nova-example="Open calendar">Open calendar</button>'+
 '<button type="button" data-nova-example="Open lesson studio">Lesson Studio</button>'+
 '<button type="button" data-nova-example="Go to students">Students</button></div>'+
 '<form id="he-nova-form" class="he-nova-form"><label for="he-nova-input" class="visually-hidden">Ask Nova</label>'+
 '<textarea id="he-nova-input" rows="2" maxlength="600" placeholder="Try: Make a note for Alex: shy when speaking"></textarea>'+
 '<button id="he-nova-send" type="submit">Send</button><label class="he-nova-deep" style="grid-column:1/-1;font-size:11px;display:flex;gap:6px;align-items:center"><input type="checkbox" id="he-nova-deep"> Detailed AI for complex questions</label></form>'+
 '<p id="he-nova-status" role="status" aria-live="polite"></p>'+
 '<p class="he-nova-disclaimer">Student note commands save only to your account. General AI questions may be processed by our AI service provider; avoid sending unnecessary sensitive details.</p>'+
 '</section>';
document.body.append(outer);
const el=id=>outer.querySelector("#"+id),panel=el("he-nova-panel"),launch=el("he-nova-launch");
let sending=false,previousView="";
function openPanel(){
 panel.hidden=false;launch.setAttribute("aria-expanded","true");
 el("he-nova-input").focus();
}
function closePanel(){
 panel.hidden=true;launch.setAttribute("aria-expanded","false");
}
launch.addEventListener("click",()=>panel.hidden?openPanel():closePanel());
el("he-nova-close").addEventListener("click",closePanel);
document.addEventListener("keydown",event=>{
 if(event.key==="Escape"&&!panel.hidden)closePanel();
});
function bubble(text,fromUser=false){
 const elem=document.createElement("div");
 elem.className="he-nova-message "+(fromUser?"he-nova-user":"he-nova-bot");
 elem.textContent=text;
 el("he-nova-messages").append(elem);
 elem.scrollIntoView({block:"nearest",behavior:"smooth"});
}
function setStatus(message,error=false){
 const node=el("he-nova-status");node.textContent=message;
 node.classList.toggle("he-nova-error",error);
}
function view(id){
 const allowed=["overview","calendar","students","progress","homework","lessons","reports","tools","settings"];
 if(!allowed.includes(id))return false;
 const tab=document.getElementById(id+"-tab");
 if(!tab)return false;
 tab.click();return true;
}
async function follow(action){
 if(!action||!action.type)return;
 if(action.type==="navigate"){view(action.view);return}
 if(action.type==="open_student"){
  if(!view("students"))return;
  if(window.HelloEarthWorkspace?.openStudent){
   await window.HelloEarthWorkspace.openStudent(action.studentId);
  }
  return;
 }
 if(action.type==="prepare"){
  if(!view(action.view))return;
  const id=action.view==="homework"?"he-homework-student":"he-lesson-student";
  const select=document.getElementById(id);
  if(select&&[...select.options].some(x=>x.value===action.studentId)){
   select.value=action.studentId;
   select.dispatchEvent(new Event("change",{bubbles:true}));
  }
  if(action.topic){
   const topicField=document.getElementById(action.view==="homework"?"he-homework-title":"he-lesson-topic");
   if(topicField)topicField.value=action.topic;
  }
  const focus=document.getElementById(action.view==="homework"?"he-homework-content":"he-lesson-topic");
  focus?.focus();
  return;
 }
 if(action.type==="student_saved"){
  await window.HelloEarthWorkspace?.reloadStudents?.();
  if(!view("students"))return;
  await window.HelloEarthWorkspace?.openStudent?.(action.studentId);
  document.dispatchEvent(new CustomEvent("helloearth:nova-student-saved",{detail:{studentId:action.studentId}}));
 }
}
async function send(message){
 const content=String(message||"").trim();
 if(!content||sending)return;
 sending=true;
 el("he-nova-send").disabled=true;
 bubble(content,true);
 el("he-nova-input").value="";
 setStatus(el("he-nova-deep").checked?"Preparing detailed AI response…":"Nova is working…");
 try{
  const {data,error}=await db.functions.invoke("he-nova",{body:{message:content,detailed:el("he-nova-deep").checked}});
  if(error){
   let msg=error.message||"Nova is unavailable.";
   if(typeof error.context?.json==="function"){
    try{const detail=await error.context.json();if(detail?.error)msg=detail.error}catch{}
   }
   throw Error(msg);
  }
  bubble(data?.message||"I couldn't complete that request.");
  if(data?.action)await follow(data.action);
  if(Array.isArray(data?.choices)&&data.choices.length){
   bubble("Please use one of these full names: "+data.choices.join(", "));
  }
  setStatus("");
 }catch(err){bubble("I couldn't complete that: "+err.message);setStatus("Please retry or use the page directly.",true)}
 finally{sending=false;el("he-nova-send").disabled=false}
}
el("he-nova-form").addEventListener("submit",event=>{
 event.preventDefault();send(el("he-nova-input").value);
});
el("he-nova-input").addEventListener("keydown",event=>{
 if(event.key==="Enter"&&!event.shiftKey){event.preventDefault();send(event.currentTarget.value)}
});
outer.querySelectorAll("[data-nova-example]").forEach(button=>{
 button.addEventListener("click",()=>send(button.dataset.novaExample));
});

const byId=id=>document.getElementById(id);
const outline=byId("he-classroom-outline"),content=byId("share-content"),title=byId("share-title"),topic=byId("he-classroom-topic"),focus=byId("he-classroom-focus"),ribbon=byId("he-classroom-ribbon");
const rail=byId("he-guided-rail"),list=byId("he-guided-list"),toggle=byId("he-guided-toggle"),prev=byId("he-guided-prev"),nextButton=byId("he-guided-next"),progress=byId("he-guided-progress");
let sections=[],lastSignature="",active=-1,frame=0,buttons=[];
const locked=()=>document.documentElement.classList.contains("he-teacher-locked");
const dockBottom=()=>document.querySelector(".share-top-dock").getBoundingClientRect().bottom;
function jump(i){
 if(locked()||!sections[i])return;
 window.scrollBy({top:sections[i].getBoundingClientRect().top-dockBottom()-16,behavior:"instant"});
 if(window.innerWidth<1180){document.body.classList.remove("he-guided-open");toggle?.setAttribute("aria-expanded","false")}
}
function updateActive(){
 frame=0;let index=0;
 const line=dockBottom()+52;
 for(let i=0;i<sections.length;i++){if(sections[i].getBoundingClientRect().top<=line)index=i;else break}
 if(!sections.length)index=-1;
 active=index;
 buttons.forEach((b,i)=>{b.disabled=locked();if(i===active)b.setAttribute("aria-current","step");else b.removeAttribute("aria-current")});
 if(progress)progress.textContent=sections.length?"Section "+(active+1)+" of "+sections.length:"Lesson sections";
 if(prev)prev.disabled=locked()||active<=0;
 if(nextButton)nextButton.disabled=locked()||active<0||active>=sections.length-1;
 if(rail)rail.classList.toggle("is-locked",locked());
}
function scheduleActive(){if(!frame)frame=requestAnimationFrame(updateActive)}
function refreshOutline(){
 topic.textContent=title.textContent;
 const headings=[...content.querySelectorAll("h1,h2,h3,h4")];
 sections=headings.filter(h=>h.tagName!=="H1"||headings.length===1);
 if(!sections.length)sections=headings;
 const signature=JSON.stringify(sections.map(n=>[n.tagName,n.textContent]));
 if(signature===lastSignature){scheduleActive();return}lastSignature=signature;
 outline.replaceChildren(new Option("Jump to section",""));list?.replaceChildren();buttons=[];
 sections.forEach((heading,i)=>{
  const text=heading.textContent.trim().slice(0,140)||"Section "+(i+1);
  outline.add(new Option((heading.tagName==="H3"||heading.tagName==="H4"?"  ↳ ":"")+text,String(i)));
  if(list){const b=document.createElement("button"),number=document.createElement("span"),label=document.createElement("span");b.type="button";b.className="he-guided-section";b.classList.toggle("is-subsection",heading.tagName==="H3"||heading.tagName==="H4");number.className="he-guided-number";number.textContent=String(i+1).padStart(2,"0");label.textContent=text;b.append(number,label);b.onclick=()=>jump(i);list.append(b);buttons.push(b)}
 });
 outline.disabled=!sections.length||locked();scheduleActive();
}
new MutationObserver(refreshOutline).observe(content,{subtree:true,childList:true,characterData:true});
new MutationObserver(refreshOutline).observe(title,{subtree:true,childList:true,characterData:true});
new MutationObserver(()=>{outline.disabled=!sections.length||locked();scheduleActive()}).observe(document.documentElement,{attributes:true,attributeFilter:["class"]});
window.addEventListener("scroll",scheduleActive,{passive:true});window.addEventListener("resize",scheduleActive);
outline.addEventListener("change",()=>{if(outline.value!=="")jump(Number(outline.value));outline.value=""});
prev?.addEventListener("click",()=>jump(active-1));nextButton?.addEventListener("click",()=>jump(active+1));
if(toggle){
 const initial=window.innerWidth>=1180;document.body.classList.toggle("he-guided-open",initial);toggle.setAttribute("aria-expanded",String(initial));
 toggle.onclick=()=>{const open=document.body.classList.toggle("he-guided-open");toggle.setAttribute("aria-expanded",String(open));window.dispatchEvent(new Event("resize"))};
}
focus.onclick=()=>{const hide=!ribbon.hidden;ribbon.hidden=hide;focus.textContent=hide?"Show tools":"Hide tools";focus.setAttribute("aria-expanded",String(!hide));window.dispatchEvent(new Event("resize"))};
const extra=byId("he-classroom-extra-tools");function organizeExtra(){const launcher=document.querySelector(".he-translate-launch");if(launcher&&launcher.parentElement!==extra)extra.append(launcher)}
new MutationObserver(organizeExtra).observe(document.body,{childList:true,subtree:true});organizeExtra();refreshOutline();

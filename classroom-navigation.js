const byId=id=>document.getElementById(id);
const outline=byId("he-classroom-outline"),content=byId("share-content"),title=byId("share-title"),topic=byId("he-classroom-topic"),focus=byId("he-classroom-focus"),ribbon=byId("he-classroom-ribbon");
let sections=[],lastSignature="";
function refreshOutline(){
 topic.textContent=title.textContent;
 const next=[...content.querySelectorAll("h1,h2,h3,h4")];
 const signature=JSON.stringify(next.map(n=>[n.tagName,n.textContent]));
 sections=next;
 if(signature===lastSignature)return;lastSignature=signature;
 outline.replaceChildren(new Option("Jump to section",""));
 sections.forEach((heading,i)=>outline.add(new Option((heading.tagName==="H3"||heading.tagName==="H4"?"  ↳ ":"")+heading.textContent.trim().slice(0,100),String(i))));
 outline.disabled=!sections.length;
}
new MutationObserver(refreshOutline).observe(content,{subtree:true,childList:true,characterData:true});
new MutationObserver(refreshOutline).observe(title,{subtree:true,childList:true,characterData:true});refreshOutline();
outline.addEventListener("change",()=>{if(outline.value==="")return;const target=sections[Number(outline.value)];const follow=byId("share-follow");if(follow?.checked)follow.click();if(target){const dock=document.querySelector(".share-top-dock");window.scrollBy({top:target.getBoundingClientRect().top-dock.getBoundingClientRect().bottom-16,behavior:"instant"});}outline.value=""});
focus.onclick=()=>{const hide=!ribbon.hidden;ribbon.hidden=hide;focus.textContent=hide?"Show tools":"Hide tools";focus.setAttribute("aria-expanded",String(!hide));window.dispatchEvent(new Event("resize"))};
const extra=byId("he-classroom-extra-tools");function organizeExtra(){const launcher=document.querySelector(".he-translate-launch");if(launcher&&launcher.parentElement!==extra)extra.append(launcher)}
new MutationObserver(organizeExtra).observe(document.body,{childList:true,subtree:true});organizeExtra();

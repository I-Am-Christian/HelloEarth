/* One fast welcome per browser session, with an explicit replay button.
   The intro cannot block the homepage permanently if a script fails. */
(() => {
 const root=document.documentElement;
 const intro=document.getElementById("he-space-intro");
 if(!intro){root.classList.remove("he-intro-on");return}
 const replay=document.getElementById("he-replay-intro");
 const skip=intro.querySelector(".he-intro-skip");
 const storageKey="helloearth:homepage-welcome:v2";
 const reduced=()=>Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
 let exitTimer=null;
 let closeTimer=null;
 let active=false;

 function clearTimers(){
  if(closeTimer!==null){window.clearTimeout(closeTimer);closeTimer=null}
  if(exitTimer!==null){window.clearTimeout(exitTimer);exitTimer=null}
 }
 function finish(immediate=false){
  if(!active&&!root.classList.contains("he-intro-on"))return;
  clearTimers();
  active=false;
  if(immediate){
   root.classList.remove("he-intro-on");
   intro.classList.remove("is-leaving");
   return;
  }
  intro.classList.add("is-leaving");
  exitTimer=window.setTimeout(()=>{
   root.classList.remove("he-intro-on");
   intro.classList.remove("is-leaving");
   exitTimer=null;
  },235);
 }
 function start(fromReplay=false){
  if(reduced()){
   finish(true);
   if(fromReplay){
    replay?.setAttribute("title","Your device has reduced-motion enabled.");
   }
   return;
  }
  clearTimers();
  active=false;
  root.classList.remove("he-intro-on");
  intro.classList.remove("is-leaving");
  // Restart CSS keyframes if this welcome screen has already been shown.
  void intro.offsetWidth;
  root.classList.add("he-intro-on");
  active=true;
  try{sessionStorage.setItem(storageKey,"1")}catch(_){}
  closeTimer=window.setTimeout(()=>finish(),1150);
  if(fromReplay)skip?.focus({preventScroll:true});
 }
 skip?.addEventListener("click",()=>finish());
 replay?.addEventListener("click",()=>start(true));
 document.addEventListener("keydown",event=>{
  if(event.key==="Escape"&&active)finish();
 });
 document.addEventListener("visibilitychange",()=>{
  if(document.hidden)finish(true);
 });
 window.addEventListener("pagehide",()=>finish(true));
 if(root.classList.contains("he-intro-on"))start();
})();

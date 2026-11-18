/* CSS-first homepage welcome.
   First paint and fade are CSS-driven; JS only remembers the visit and
   handles Skip. Replay uses a normal link and works even if this fails. */
(() => {
 const root=document.documentElement;
 const overlay=document.getElementById("he-space-intro");
 if (!overlay) return;
 if (!root.classList.contains("he-intro-on")) return;
 try { sessionStorage.setItem("helloearth:homepage-welcome:v3","1"); } catch (_) {}
 let finished=false;
 function finish() {
  if (finished) return;
  finished=true;
  root.classList.remove("he-intro-on");
  overlay.setAttribute("aria-hidden","true");
 }
 overlay.querySelector(".he-intro-skip")?.addEventListener("click",finish);
 document.addEventListener("keydown",event => {
  if (event.key==="Escape" && !finished) finish();
 });
 window.setTimeout(finish,1850);
})();

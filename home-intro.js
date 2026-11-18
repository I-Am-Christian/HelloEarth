/* Homepage intro appears once per browser tab/session.
   Does not delay page loading. A CSS fallback hides it even if this fails. */
(() => {
 const root = document.documentElement;
 const intro = document.getElementById("he-space-intro");
 if (!intro || !root.classList.contains("he-intro-on")) return;
 let closed = false;
 const close = () => {
  if (closed) return;
  closed = true;
  intro.classList.add("is-leaving");
  window.setTimeout(() => {
   root.classList.remove("he-intro-on");
   intro.remove();
  }, 235);
 };
 const timer = window.setTimeout(close, 1050);
 intro.querySelector(".he-intro-skip")?.addEventListener("click", () => {
  window.clearTimeout(timer);
  close();
 });
 document.addEventListener("keydown", e => {
  if (e.key === "Escape" && !closed) {
   window.clearTimeout(timer);
   close();
  }
 }, {once:true});
 document.addEventListener("visibilitychange", () => {
  if (document.hidden) close();
 }, {once:true});
})();

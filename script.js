const menu = document.querySelector('.menu-toggle');
const nav = document.querySelector('.nav');
menu.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  menu.setAttribute('aria-expanded', String(open));
});
nav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
  nav.classList.remove('open');
  menu.setAttribute('aria-expanded', 'false');
}));
const launcher = document.querySelector('.chat-launcher');
const panel = document.querySelector('.chat-panel');
const close = document.querySelector('.chat-close');
function toggleChat(open) {
  panel.classList.toggle('open', open);
  panel.setAttribute('aria-hidden', String(!open));
  launcher.setAttribute('aria-expanded', String(open));
  if (open) close.focus(); else launcher.focus();
}
launcher.addEventListener('click', () => toggleChat(!panel.classList.contains('open')));
close.addEventListener('click', () => toggleChat(false));
document.addEventListener('keydown', e => { if (e.key === 'Escape' && panel.classList.contains('open')) toggleChat(false); });
document.getElementById('year').textContent = new Date().getFullYear();

const studentButtons = document.querySelectorAll('.student-select');
studentButtons.forEach(button => button.addEventListener('click', () => {
  studentButtons.forEach(item => {
    const active = item === button;
    item.classList.toggle('selected', active);
    item.setAttribute('aria-pressed', String(active));
  });
  document.getElementById('detail-name').textContent = button.dataset.name;
  document.getElementById('detail-level').textContent = button.dataset.level;
  document.getElementById('detail-goal').textContent = button.dataset.goal;
  document.getElementById('detail-percent').textContent = button.dataset.progress + '%';
  document.getElementById('detail-progress').style.width = button.dataset.progress + '%';
}));
document.addEventListener('click', event => {
  if (!nav.contains(event.target) && !menu.contains(event.target)) {
    nav.classList.remove('open');
    menu.setAttribute('aria-expanded', 'false');
  }
  if (panel.classList.contains('open') && !event.target.closest('.chat-widget')) toggleChat(false);
});

const header = document.querySelector('.site-header');
const updateHeader = () => header.classList.toggle('scrolled', window.scrollY > 12);
window.addEventListener('scroll', updateHeader, {passive:true});
updateHeader();
const navLinks = [...nav.querySelectorAll('a[href^="#"]')];
const observedSections = navLinks.map(link => document.querySelector(link.getAttribute('href'))).filter(Boolean);
if ('IntersectionObserver' in window) {
  const sectionObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      navLinks.forEach(link => {
        const active = link.getAttribute('href') === '#' + entry.target.id;
        link.classList.toggle('active', active);
        if (active) link.setAttribute('aria-current','location');
        else link.removeAttribute('aria-current');
      });
    });
  }, {rootMargin:'-25% 0px -60% 0px'});
  observedSections.forEach(section => sectionObserver.observe(section));
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, {threshold:.08});
    document.querySelectorAll('.feature,.workflow-card,.section-heading,.dashboard,.atlas-layout,.faq-layout').forEach(element => {
      element.classList.add('reveal');
      revealObserver.observe(element);
    });
  }
}

/* Interactive solar system: click Earth to launch, drag to adjust its orbit, click Sun to glow. */
(() => {
 const scene=document.querySelector('.solar-background');
 const orbit=scene?.querySelector('.earth-orbit');
 const earth=scene?.querySelector('.earth-position');
 const sun=scene?.querySelector('.distant-sun');
 if(!scene||!orbit||!earth||!sun)return;
 const duration=173.334;
 let pointerStart=null, dragged=false;
 sun.addEventListener('click',()=>{
  sun.classList.toggle('sun-boost');
  sun.setAttribute('aria-pressed',String(sun.classList.contains('sun-boost')));
 });
 function setPhase(degrees){
  const delay=-(degrees/360*duration)+'s';
  orbit.style.animationDelay=delay;
  earth.style.animationDelay=delay;
 }
 earth.addEventListener('pointerdown',event=>{
  if(event.pointerType==='mouse'&&event.button!==0)return;
  pointerStart={x:event.clientX,y:event.clientY};
  dragged=false;
  earth.setPointerCapture(event.pointerId);
 });
 earth.addEventListener('pointermove',event=>{
  if(!pointerStart)return;
  if(Math.hypot(event.clientX-pointerStart.x,event.clientY-pointerStart.y)>8)dragged=true;
  if(!dragged)return;
  earth.classList.add('dragging');
  orbit.style.animationPlayState='paused';
  earth.style.animationPlayState='paused';
  const rect=orbit.getBoundingClientRect();
  const degrees=(Math.atan2(event.clientY-(rect.top+rect.height/2),event.clientX-(rect.left+rect.width/2))*180/Math.PI+450)%360;
  setPhase(degrees);
 });
 function finish(event,cancelled=false){
  if(!pointerStart)return;
  const launch=!dragged&&!cancelled;
  pointerStart=null;
  earth.classList.remove('dragging');
  orbit.style.animationPlayState='running';
  earth.style.animationPlayState='running';
  if(launch)scene.dispatchEvent(new Event('rocketlaunch'));
 }
 earth.addEventListener('pointerup',event=>finish(event));
 earth.addEventListener('pointercancel',event=>finish(event,true));
 earth.addEventListener('keydown',event=>{
  if(event.key==='Enter'||event.key===' '){event.preventDefault();scene.dispatchEvent(new Event('rocketlaunch'))}
 });
})();

/* Preview carousel: transform-based navigation with touch swipe */
(() => {
 const viewport=document.getElementById('preview-carousel');
 if(!viewport)return;
 const track=viewport.querySelector('.preview-track');
 const slides=Array.from(track?.children||[]).filter(el=>el.classList.contains('preview-slide'));
 const dots=Array.from(document.querySelectorAll('.preview-dot'));
 const prev=document.getElementById('preview-prev');
 const next=document.getElementById('preview-next');
 if(!track||slides.length<2||!prev||!next)return;
 let active=0, startX=null, startY=null;
 function show(index){
   active=(index+slides.length)%slides.length;
   const distance=slides[active].offsetLeft-slides[0].offsetLeft;
   track.style.transform='translate3d('+(-distance)+'px,0,0)';
   dots.forEach((dot,i)=>{
     dot.classList.toggle('active',i===active);
     dot.setAttribute('aria-current',i===active?'true':'false');
   });
   slides.forEach((slide,i)=>slide.setAttribute('aria-hidden',String(i!==active)));
 }
 prev.addEventListener('click',()=>show(active-1));
 next.addEventListener('click',()=>show(active+1));
 dots.forEach((dot,i)=>dot.addEventListener('click',()=>show(i)));
 viewport.addEventListener('touchstart',e=>{
   if(e.touches.length!==1)return;
   startX=e.touches[0].clientX;startY=e.touches[0].clientY;
 },{passive:true});
 viewport.addEventListener('touchend',e=>{
   if(startX===null||!e.changedTouches.length)return;
   const dx=e.changedTouches[0].clientX-startX;
   const dy=e.changedTouches[0].clientY-startY;
   if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)*1.25)show(active+(dx<0?1:-1));
   startX=null;startY=null;
 },{passive:true});
 viewport.addEventListener('keydown',e=>{
   if(e.key==='ArrowRight'||e.key==='ArrowLeft'){
     e.preventDefault();show(active+(e.key==='ArrowRight'?1:-1));
   }
 });
 window.addEventListener('resize',()=>show(active));
 show(0);
})();

/* Public-site translation: local curated strings, automatic browser-language detection. */
(()=>{
const source=["More time to teach.","Less to keep track of.","Take a look","In development","Everything you need.","Nothing you don't.","Student profiles","Lesson notes","Progress tracking","Personalized lesson creation","A clear view of your day.","How it works","Get in touch","Email support","Who is it for?","Is HelloEarth available now?"];
const translations={"es":["Más tiempo para enseñar.","Menos cosas que controlar.","Un vistazo","En desarrollo","Todo lo que necesitas.","Nada que no necesites.","Perfiles de estudiantes","Notas de clase","Seguimiento del progreso","Creación de clases personalizadas","Una visión clara de tu día.","Cómo funciona","Ponte en contacto","Soporte por correo","¿Para quién es?","¿HelloEarth ya está disponible?"],"pt":["Mais tempo para ensinar.","Menos coisas para acompanhar.","Conheça","Em desenvolvimento","Tudo o que precisa.","Nada do que não precisa.","Perfis de alunos","Notas de aula","Acompanhamento do progresso","Criação de aulas personalizadas","Uma visão clara do seu dia.","Como funciona","Entre em contacto","Suporte por e-mail","Para quem é?","O HelloEarth já está disponível?"],"af":["Meer tyd om te onderrig.","Minder om dop te hou.","Kyk gerus","In ontwikkeling","Alles wat jy nodig het.","Niks wat jy nie nodig het nie.","Leerderprofiele","Lesnotas","Vorderingnasporing","Persoonlike lesbeplanning","'n Duidelike oorsig van jou dag.","Hoe dit werk","Kontak ons","E-posondersteuning","Vir wie is dit?","Is HelloEarth al beskikbaar?"],"fr":["Plus de temps pour enseigner.","Moins de choses à suivre.","Découvrir","En développement","Tout ce dont vous avez besoin.","Rien de superflu.","Profils des élèves","Notes de cours","Suivi des progrès","Création de cours personnalisés","Une vue claire de votre journée.","Comment ça marche","Nous contacter","Assistance par e-mail","À qui s'adresse-t-il ?","HelloEarth est-il disponible ?"],"pl":["Więcej czasu na nauczanie.","Mniej rzeczy do śledzenia.","Zobacz","W trakcie tworzenia","Wszystko, czego potrzebujesz.","Nic zbędnego.","Profile uczniów","Notatki z lekcji","Śledzenie postępów","Tworzenie spersonalizowanych lekcji","Przejrzysty plan dnia.","Jak to działa","Skontaktuj się","Wsparcie e-mail","Dla kogo jest HelloEarth?","Czy HelloEarth jest już dostępny?"]};
const picker=document.getElementById('site-language');if(!picker)return;
const nodes=[];const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let node;
while((node=walker.nextNode())){if(node.parentElement?.closest('script,style,select,textarea'))continue;const raw=node.nodeValue;const trimmed=raw.trim();if(source.includes(trimmed))nodes.push({node,raw,index:source.indexOf(trimmed)});}
function setLanguage(lang){const strings=translations[lang];nodes.forEach(({node,raw,index})=>{const replacement=strings?.[index]||source[index];node.nodeValue=raw.replace(raw.trim(),replacement)});document.documentElement.lang=lang;picker.value=lang;try{localStorage.setItem('helloearth-language',lang)}catch(e){}}
let saved;try{saved=localStorage.getItem('helloearth-language')}catch(e){}const browser=(navigator.languages?.[0]||navigator.language||'en').toLowerCase().split('-')[0];setLanguage(translations[saved]?saved:(translations[browser]?browser:'en'));
picker.addEventListener('change',()=>setLanguage(picker.value));
})();

/* Keep the solar animation inside the hero artwork on every screen size. */
(() => {
 const scene=document.querySelector('.solar-background');
 const slot=document.querySelector('.hero-art-spacer');
 if(scene&&slot&&scene.parentElement!==slot)slot.appendChild(scene);
})();

/* The rocket launches only when Earth is clicked, taking 10 seconds to reach the moving Moon. */
(() => {
 const scene=document.querySelector('.solar-background');
 const stage=document.querySelector('.hero-art-spacer');
 const earth=scene?.querySelector('.earth-planet');
 const moonOrbit=scene?.querySelector('.moon-orbit');
 const moon=scene?.querySelector('.moon-body');
 const rocket=scene?.querySelector('.moon-rocket');
 if(!scene||!stage||!earth||!moonOrbit||!moon||!rocket)return;
 const fit=()=>{
  const rect=stage.getBoundingClientRect();
  const diameter=Math.max(100,Math.min(425,Math.floor(Math.min(rect.width,rect.height)-moonOrbit.offsetWidth-moon.offsetWidth-36)));
  stage.style.setProperty('--safe-orbit-size',diameter+'px');
 };
 fit();
 if('ResizeObserver' in window)new ResizeObserver(fit).observe(stage);
 else window.addEventListener('resize',fit,{passive:true});
 let launchedAt=null;
 scene.addEventListener('rocketlaunch',()=>{
  launchedAt=performance.now();
  rocket.classList.remove('landed');
  rocket.style.display='block';
 });
 rocket.style.display='none';
 const center=(element,reference)=>{
  const r=element.getBoundingClientRect();
  return {x:r.left+r.width/2-reference.left,y:r.top+r.height/2-reference.top,size:r.width};
 };
 function animate(now){
  if(launchedAt!==null){
   const rect=stage.getBoundingClientRect();
   if(rect.width&&rect.height){
    const e=center(earth,rect),m=center(moon,rect);
    const dx=m.x-e.x,dy=m.y-e.y,distance=Math.max(1,Math.hypot(dx,dy));
    const ux=dx/distance,uy=dy/distance;
    const p=Math.min(1,(now-launchedAt)/10000);
    const t=p*p*(3-2*p);
    const fromX=e.x+ux*e.size*.47,fromY=e.y+uy*e.size*.47;
    const toX=m.x-ux*m.size*.52,toY=m.y-uy*m.size*.52;
    const arc=Math.sin(Math.PI*t)*Math.min(18,distance*.14);
    const x=fromX+(toX-fromX)*t-uy*arc,y=fromY+(toY-fromY)*t+ux*arc;
    const heading=Math.atan2(dy,dx)*180/Math.PI+45;
    const landed=p>=1;
    rocket.classList.toggle('landed',landed);
    rocket.style.display='block';
    rocket.style.transform='translate3d('+x+'px,'+y+'px,0) translate(-50%,-50%) rotate('+heading+'deg) scale('+(landed?0.7:1)+')';
   }
  }
  requestAnimationFrame(animate);
 }
 requestAnimationFrame(animate);
})();

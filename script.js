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
let lastHeaderState;
const updateHeader = () => {
  const scrolled = window.scrollY > 12;
  if (scrolled === lastHeaderState) return;
  lastHeaderState = scrolled;
  header.classList.toggle('scrolled', scrolled);
};
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

/* A single click or tap on Earth launches the Moon mission. No dragging. */
(() => {
 const scene=document.querySelector('.solar-background');
 const earth=scene?.querySelector('.earth-position');
 const sun=scene?.querySelector('.distant-sun');
 if(!scene||!earth||!sun)return;
 let launched=false;
 const launchOnce=()=>{
  if(launched)return;
  launched=true;
  earth.classList.add('rocket-launched');
  earth.setAttribute('aria-label','Rocket already launched toward the Moon');
  scene.dispatchEvent(new Event('rocketlaunch'));
 };
 earth.addEventListener('click',launchOnce);
 earth.addEventListener('keydown',event=>{
  if(event.key==='Enter'||event.key===' '){
   event.preventDefault();
   launchOnce();
  }
 });
 sun.addEventListener('click',()=>{
  sun.classList.toggle('sun-boost');
  sun.setAttribute('aria-pressed',String(sun.classList.contains('sun-boost')));
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
 let carouselResizeQueued=false;
 window.addEventListener('resize',()=>{
   if(carouselResizeQueued)return;
   carouselResizeQueued=true;
   requestAnimationFrame(()=>{
     carouselResizeQueued=false;
     show(active);
   });
 },{passive:true});
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

/* One-time 5-second lunar flight with a smooth 180-degree braking flip. */
(() => {
 const scene=document.querySelector('.solar-background');
 const stage=document.querySelector('.hero-art-spacer');
 const earth=scene?.querySelector('.earth-planet');
 const earthOrbit=scene?.querySelector('.earth-orbit');
 const earthPosition=scene?.querySelector('.earth-position');
 const moonOrbit=scene?.querySelector('.moon-orbit');
 const moon=scene?.querySelector('.moon-body');
 const rocket=scene?.querySelector('.moon-rocket');
 const hud=scene?.querySelector('.mission-hud');
 const hudLabel=hud?.querySelector('.mission-hud-label');
 const hudProgress=hud?.querySelector('.mission-hud-progress');
 if(!scene||!stage||!earth||!earthOrbit||!earthPosition||!moonOrbit||!moon||!rocket)return;

 let lastOrbitSize=-1;
 const fit=()=>{
  const rect=stage.getBoundingClientRect();
  const safe=Math.max(100,Math.min(425,Math.floor(Math.min(rect.width,rect.height)-moonOrbit.offsetWidth-moon.offsetWidth-36)));
  if(safe===lastOrbitSize)return;
  lastOrbitSize=safe;
  stage.style.setProperty('--safe-orbit-size',safe+'px');
 };
 fit();
 if('ResizeObserver' in window)new ResizeObserver(fit).observe(stage);
 else window.addEventListener('resize',fit,{passive:true});

 const center=(element,reference)=>{
  const rect=element.getBoundingClientRect();
  return {x:rect.left+rect.width/2-reference.left,y:rect.top+rect.height/2-reference.top,size:element.offsetWidth||rect.width};
 };
 const clamp01=value=>Math.max(0,Math.min(1,value));
 const smooth=value=>value*value*(3-2*value);
 const angleOf=element=>{
  const transform=getComputedStyle(element).transform;
  if(!transform||transform==='none')return 0;
  const matrix=new DOMMatrixReadOnly(transform);
  return Math.atan2(matrix.b,matrix.a);
 };
 // The Earth orbit and its counter-rotation cancel; only the Moon's own turn remains.
 const moonRotation=()=>angleOf(moonOrbit);
 const flightDuration=5000;
 let flight=null;
 let attached=null;
 let rocketVisible=false;
 let wasLanded=false;
 let frameQueued=false;
 let stageVisible=!('IntersectionObserver' in window);

 rocket.style.display='none';
 rocket.classList.remove('landed');
 moon.classList.remove('flag-planted');

 const render=(x,y,heading,scale,landed)=>{
  if(!rocketVisible){
   rocketVisible=true;
   rocket.style.display='block';
   rocket.style.left='0px';
   rocket.style.top='0px';
  }
  if(wasLanded!==landed){
   wasLanded=landed;
   rocket.classList.toggle('landed',landed);
  }
  rocket.style.transform='translate3d('+x+'px,'+y+'px,0) translate(-50%,-50%) rotate('+heading+'deg) scale('+scale+')';
 };

 const canAnimate=()=>!document.hidden&&stageVisible&&(flight!==null||attached!==null);
 const scheduleFrame=()=>{
  if(frameQueued||!canAnimate())return;
  frameQueued=true;
  requestAnimationFrame(frame);
 };
 if('IntersectionObserver' in window){
  const observer=new IntersectionObserver(entries=>{
   stageVisible=entries.some(entry=>entry.isIntersecting);
   if(stageVisible)scheduleFrame();
  },{rootMargin:'160px 0px'});
  observer.observe(stage);
 }
 document.addEventListener('visibilitychange',scheduleFrame);
 window.addEventListener('pageshow',scheduleFrame);
 const status=text=>{
  if(hudLabel&&hudLabel.textContent!==text)hudLabel.textContent=text;
 };

 scene.addEventListener('rocketlaunch',()=>{
  if(flight||attached)return;
  const rect=stage.getBoundingClientRect();
  const start=center(earth,rect);
  const moonCenter=center(moon,rect);
  const dx=moonCenter.x-start.x,dy=moonCenter.y-start.y;
  const distance=Math.max(1,Math.hypot(dx,dy));
  const ux=dx/distance,uy=dy/distance;
  flight={
   started:performance.now(),
   fromX:start.x+ux*start.size*.46,
   fromY:start.y+uy*start.size*.46,
   normalX:-ux,
   normalY:-uy,
   heading:Math.atan2(dy,dx)*180/Math.PI+45
  };
  hud?.classList.add('in-flight');
  status('ROCKET EN ROUTE · MOON LANDING');
  render(flight.fromX,flight.fromY,flight.heading,1,false);
  scheduleFrame();
 });

 function frame(now){
  frameQueued=false;
  if(!canAnimate())return;
  if(flight||attached){
   const rect=stage.getBoundingClientRect();
   if(rect.width&&rect.height){
    const moonCenter=center(moon,rect);
    if(attached){
     // Keep the touchdown point and the rocket orientation tied to the Moon's rotation.
     const delta=moonRotation()-attached.rotation;
     const cos=Math.cos(delta),sin=Math.sin(delta);
     const dx=attached.offsetX*moonCenter.size,dy=attached.offsetY*moonCenter.size;
     const x=moonCenter.x+dx*cos-dy*sin;
     const y=moonCenter.y+dx*sin+dy*cos;
     render(x,y,attached.heading+delta*180/Math.PI,.7,true);
    }else{
     // Fixed approach vector: no steering means a predictable, stable touchdown.
     const radius=moonCenter.size*.5+3;
     const targetX=moonCenter.x+flight.normalX*radius;
     const targetY=moonCenter.y+flight.normalY*radius;
     const progress=clamp01((now-flight.started)/flightDuration);
     const travel=smooth(progress);
     const flip=smooth(clamp01((progress-.55)/.45));
     const heading=flight.heading+180*flip;
     const scale=1-.3*travel;
     const curve=Math.sin(Math.PI*travel)*Math.min(8,moonCenter.size*.34);
     const x=flight.fromX+(targetX-flight.fromX)*travel-flight.normalY*curve;
     const y=flight.fromY+(targetY-flight.fromY)*travel+flight.normalX*curve;
     render(x,y,heading,scale,progress>=1);
     if(hudProgress)hudProgress.style.width=Math.round(progress*100)+'%';
     if(progress>=1){
      attached={
       rotation:moonRotation(),
       offsetX:(x-moonCenter.x)/moonCenter.size,
       offsetY:(y-moonCenter.y)/moonCenter.size,
       heading
      };
      flight=null;
      moon.classList.add('flag-planted');
      hud?.classList.remove('in-flight');
      status('TOUCHDOWN · FLAG PLANTED');
     }
    }
   }
  }
  scheduleFrame();
 }
})();

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

/* Solar interactions: fixed orbit speed, draggable Earth and clickable Sun */
(()=>{
 const scene=document.querySelector('.solar-background'),orbit=scene?.querySelector('.earth-orbit'),earth=scene?.querySelector('.earth-position'),sun=scene?.querySelector('.distant-sun');
 if(!orbit||!earth||!sun)return;
 const duration=86.667;let dragging=false;
 sun.addEventListener('click',()=>{sun.classList.toggle('sun-boost');sun.setAttribute('aria-pressed',String(sun.classList.contains('sun-boost')))});
 const phase=()=>{const m=new DOMMatrixReadOnly(getComputedStyle(orbit).transform);return (Math.atan2(m.b,m.a)*180/Math.PI+360)%360};
 function setPhase(a){const delay=-(a/360*duration)+'s';orbit.style.animationDelay=delay;earth.style.animationDelay=delay}
 earth.addEventListener('pointerdown',e=>{if(e.button!==0)return;dragging=true;orbit.style.animationPlayState='paused';earth.style.animationPlayState='paused';earth.classList.add('dragging');earth.setPointerCapture(e.pointerId);e.preventDefault()});
 earth.addEventListener('pointermove',e=>{if(!dragging)return;const rect=orbit.getBoundingClientRect(),cx=rect.left+rect.width/2,cy=rect.top+rect.height/2;setPhase((Math.atan2(e.clientY-cy,e.clientX-cx)*180/Math.PI+450)%360)});
 const endDrag=()=>{if(!dragging)return;dragging=false;earth.classList.remove('dragging');orbit.style.animationPlayState='running';earth.style.animationPlayState='running'};
 earth.addEventListener('pointerup',endDrag);earth.addEventListener('pointercancel',endDrag);
})();

/* Reliable three-slide preview carousel */
(() => {
 const viewport=document.getElementById('preview-carousel');
 if(!viewport)return;
 const slides=Array.from(viewport.querySelectorAll('.preview-slide'));
 const dots=Array.from(document.querySelectorAll('.preview-dot'));
 const prev=document.getElementById('preview-prev');
 const next=document.getElementById('preview-next');
 if(!slides.length||!prev||!next)return;
 let active=0, programmatic=false, unlockTimer;
 const update=()=>{
   dots.forEach((dot,i)=>{
     dot.classList.toggle('active',i===active);
     dot.setAttribute('aria-current',i===active?'true':'false');
   });
 };
 const go=index=>{
   active=(index+slides.length)%slides.length;
   update();
   programmatic=true;
   clearTimeout(unlockTimer);
   viewport.scrollTo({left:active*viewport.clientWidth,behavior:'smooth'});
   unlockTimer=setTimeout(()=>{programmatic=false;},650);
 };
 prev.addEventListener('click',()=>go(active-1));
 next.addEventListener('click',()=>go(active+1));
 dots.forEach((dot,i)=>dot.addEventListener('click',()=>go(i)));
 slides.forEach((slide,i)=>slide.addEventListener('click',e=>{
   if(i!==active&&!e.target.closest('button,a,input,select,textarea'))go(i);
 }));
 let scrollTimer;
 viewport.addEventListener('scroll',()=>{
   if(programmatic)return;
   clearTimeout(scrollTimer);
   scrollTimer=setTimeout(()=>{
     active=Math.max(0,Math.min(slides.length-1,Math.round(viewport.scrollLeft/Math.max(1,viewport.clientWidth))));
     update();
   },100);
 },{passive:true});
 viewport.addEventListener('keydown',e=>{
   if(e.key==='ArrowRight'||e.key==='ArrowLeft'){
     e.preventDefault();
     go(active+(e.key==='ArrowRight'?1:-1));
   }
 });
 update();
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

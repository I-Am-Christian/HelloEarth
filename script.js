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

/* Solar system interaction */
(() => {
 const scene=document.querySelector('.solar-background'), orbit=scene?.querySelector('.earth-orbit'), earth=scene?.querySelector('.earth-position'), sun=scene?.querySelector('.distant-sun');
 const toggle=document.getElementById('orbit-toggle'), slider=document.getElementById('orbit-speed'), value=document.getElementById('orbit-speed-value');
 if(!orbit||!earth||!sun||!toggle||!slider)return;
 let duration=52, paused=false, dragging=false, angle=0, lastTime=performance.now();
 const motion=()=>[orbit,earth];
 const setMotion=()=>{motion().forEach(el=>{el.style.animationDuration=duration+'s';el.style.animationPlayState=paused||dragging?'paused':'running'});toggle.textContent=paused?'Play':'Pause';toggle.setAttribute('aria-pressed',String(paused));};
 const currentAngle=()=>{const matrix=new DOMMatrixReadOnly(getComputedStyle(orbit).transform);return (Math.atan2(matrix.b,matrix.a)*180/Math.PI+360)%360};
 const setPhase=a=>{angle=(a+360)%360;orbit.style.animationDelay=(-angle/360*duration)+'s';earth.style.animationDelay=(-angle/360*duration)+'s';};
 toggle.addEventListener('click',()=>{paused=!paused;setMotion()});
 slider.addEventListener('input',()=>{const phase=currentAngle();duration=Number(slider.value);value.textContent=duration+'s';setPhase(phase);setMotion()});
 sun.addEventListener('click',()=>{sun.classList.toggle('sun-boost');sun.setAttribute('aria-pressed',String(sun.classList.contains('sun-boost')))});
 earth.addEventListener('pointerdown',e=>{if(e.button!==0)return;dragging=true;angle=currentAngle();setMotion();earth.classList.add('dragging');earth.setPointerCapture(e.pointerId);e.preventDefault()});
 earth.addEventListener('pointermove',e=>{if(!dragging)return;const rect=orbit.getBoundingClientRect(),cx=rect.left+rect.width/2,cy=rect.top+rect.height/2;const a=(Math.atan2(e.clientY-cy,e.clientX-cx)*180/Math.PI+90+360)%360;setPhase(a)});
 const endDrag=()=>{if(!dragging)return;dragging=false;earth.classList.remove('dragging');setMotion()};
 earth.addEventListener('pointerup',endDrag);earth.addEventListener('pointercancel',endDrag);
 setMotion();
})();

/* Swipeable dashboard and desktop concept previews */
(() => {
 const viewport=document.getElementById('preview-carousel');
 if(!viewport)return;
 const slides=[...viewport.querySelectorAll('.preview-slide')];
 const dots=[...document.querySelectorAll('.preview-dot')];
 const prev=document.getElementById('preview-prev'),next=document.getElementById('preview-next');
 let active=0;
 function go(index){active=Math.max(0,Math.min(slides.length-1,index));viewport.scrollTo({left:slides[active].offsetLeft-slides[0].offsetLeft,behavior:'smooth'});dots.forEach((dot,i)=>{dot.classList.toggle('active',i===active);dot.setAttribute('aria-current',i===active?'true':'false')})}
 prev.addEventListener('click',()=>go(active===0?slides.length-1:active-1));
 next.addEventListener('click',()=>go((active+1)%slides.length));
 dots.forEach((dot,i)=>dot.addEventListener('click',()=>go(i)));
 let scrollTimer;
 viewport.addEventListener('scroll',()=>{clearTimeout(scrollTimer);scrollTimer=setTimeout(()=>{const left=viewport.scrollLeft;active=slides.reduce((best,slide,i)=>Math.abs(slide.offsetLeft-slides[0].offsetLeft-left)<Math.abs(slides[best].offsetLeft-slides[0].offsetLeft-left)?i:best,0);dots.forEach((dot,i)=>{dot.classList.toggle('active',i===active);dot.setAttribute('aria-current',i===active?'true':'false')})},90)},{passive:true});
 viewport.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();go(active+(e.key==='ArrowRight'?1:-1))}});
})();

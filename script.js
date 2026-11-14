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
  document.getElementById('detail-goal').textContent = document.documentElement.lang==='ru' ? ({'Conversation practice':'Разговорная практика','Grammar & fluency':'Грамматика и беглость речи'}[button.dataset.goal]||button.dataset.goal) : button.dataset.goal;
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

/* Earth launches the mission once by mouse click, keyboard or direct phone tap. */
(() => {
 const scene=document.querySelector('.solar-background');
 const earth=scene?.querySelector('.earth-position');
 const sun=scene?.querySelector('.distant-sun');
 if(!scene||!earth||!sun)return;
 let launched=false;
 let touchStart=null;

 // Only produce audio from a user gesture; never autoplay on page load.
 const playLaunchSound=()=>{
  const AudioClass=window.AudioContext||window.webkitAudioContext;
  if(!AudioClass)return;
  let context;
  try {
   context=new AudioClass();
   const start=()=>{
    const t=context.currentTime+.015, duration=1.35;
    const output=context.createGain();
    output.gain.setValueAtTime(.0001,t);
    output.gain.exponentialRampToValueAtTime(.055,t+.15);
    output.gain.exponentialRampToValueAtTime(.0001,t+duration);
    output.connect(context.destination);

    // A soft low-pitched, rising whoosh rather than an abrupt alert.
    const oscillator=context.createOscillator();
    oscillator.type='sawtooth';
    oscillator.frequency.setValueAtTime(95,t);
    oscillator.frequency.exponentialRampToValueAtTime(225,t+.56);
    oscillator.frequency.exponentialRampToValueAtTime(135,t+duration);
    const filter=context.createBiquadFilter();
    filter.type='lowpass';
    filter.frequency.setValueAtTime(380,t);
    filter.frequency.exponentialRampToValueAtTime(1600,t+.65);
    filter.frequency.exponentialRampToValueAtTime(330,t+duration);
    oscillator.connect(filter);
    filter.connect(output);
    oscillator.start(t);
    oscillator.stop(t+duration+.03);
    oscillator.onended=()=>context.close().catch(()=>{});
   };
   if(context.state==='suspended')context.resume().then(start).catch(()=>{});
   else start();
  } catch(error) {
   if(context)context.close().catch(()=>{});
  }
 };

 const mobileLaunch=document.querySelector('.mobile-launch-control');
 const launchOnce=()=>{
  if(launched)return;
  launched=true;
  earth.classList.add('rocket-launched');
  earth.setAttribute('aria-label','Rocket already launched toward the Moon');
  if(mobileLaunch)mobileLaunch.hidden=true;
  playLaunchSound();
  scene.dispatchEvent(new Event('rocketlaunch'));
 };

 earth.addEventListener('click',launchOnce);
 earth.addEventListener('keydown',event=>{
  if(event.key==='Enter'||event.key===' '){
   event.preventDefault();
   launchOnce();
  }
 });
 // Some mobile browsers miss the synthesized click on a transformed div.
 // A short touch ending over Earth also launches, without launching on scrolling.
 if('PointerEvent' in window){
  earth.addEventListener('pointerdown',event=>{
   if(event.pointerType==='touch'||event.pointerType==='pen')touchStart={x:event.clientX,y:event.clientY,id:event.pointerId};
  },{passive:true});
  earth.addEventListener('pointerup',event=>{
   if(!touchStart||event.pointerId!==touchStart.id)return;
   const distance=Math.hypot(event.clientX-touchStart.x,event.clientY-touchStart.y);
   touchStart=null;
   if(distance<17){
    event.preventDefault();
    launchOnce();
   }
  });
  earth.addEventListener('pointercancel',()=>{touchStart=null});
 }else{
  earth.addEventListener('touchstart',event=>{
   const t=event.changedTouches[0];
   if(t)touchStart={x:t.clientX,y:t.clientY};
  },{passive:true});
  earth.addEventListener('touchend',event=>{
   const t=event.changedTouches[0];
   if(t&&touchStart&&Math.hypot(t.clientX-touchStart.x,t.clientY-touchStart.y)<17)launchOnce();
   touchStart=null;
  },{passive:true});
 }
 // A stationary launch control stays reliably tappable even while Earth moves.
 if(mobileLaunch)mobileLaunch.addEventListener('click',launchOnce);
 // Touch fallback on the solar stage for browsers that miss taps on moving transforms.
 const stage=document.querySelector('.hero-art-spacer');
 if(stage){
  stage.addEventListener('pointerup',event=>{
   if(launched||event.pointerType!=='touch')return;
   const box=earth.getBoundingClientRect();
   const padding=18;
   if(event.clientX>=box.left-padding&&event.clientX<=box.right+padding&&
      event.clientY>=box.top-padding&&event.clientY<=box.bottom+padding){
    launchOnce();
   }
  });
 }
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
translations.ru=["Больше времени для преподавания.","Меньше забот и учёта.","Посмотреть","В разработке","Всё необходимое.","Ничего лишнего.","Профили учеников","Заметки об уроках","Отслеживание прогресса","Создание персональных уроков","Весь ваш день как на ладони.","Как это работает","Связаться с нами","Поддержка по электронной почте","Для кого HelloEarth?","HelloEarth уже доступен?"];
const ruExtras=Object.fromEntries([["FOR TUTORS","ДЛЯ РЕПЕТИТОРОВ"],["Menu","Меню"],["Features","Возможности"],["Dashboard","Панель управления"],["A calmer way to manage your students","Удобнее управлять занятиями и учениками"],["HelloEarth is a simple home for your students, lesson notes, and their progress. Built for tutors who want everything in one place.","HelloEarth — удобное пространство для информации об учениках, заметок к урокам и отслеживания прогресса. Всё необходимое репетитору в одном месте."],["Student","Профили"],["profiles","учеников"],["Lesson","Заметки"],["notes","об уроках"],["Progress","Прогресс"],["tracking","учеников"],["✦ The essentials","✦ Самое важное"],["A focused set of tools to manage lessons, track progress and create better learning experiences for every student.","Продуманный набор инструментов для планирования уроков, отслеживания прогресса и создания более эффективного обучения для каждого ученика."],["Keep goals, levels, and important details together.","Храните цели, уровень и важные сведения об ученике в одном месте."],["Remember what you covered and what's next.","Записывайте, что вы уже прошли и что планируете дальше."],["See how each student is growing over time.","Наблюдайте за развитием каждого ученика."],["Coming soon","Скоро"],["Create lessons tailored to each student’s needs, goals, interests and language level (A1–C1).","Создавайте уроки с учётом потребностей, целей, интересов и языкового уровня каждого ученика (A1–C1)."],["Real-time lesson transcription","Расшифровка уроков в реальном времени"],["Capture conversations live, securely save transcripts to student profiles, identify language gaps, and prepare more personalized lessons.","Расшифровывайте беседы во время урока, безопасно сохраняйте записи в профилях учеников, выявляйте пробелы в знаниях и готовьте более персонализированные занятия."],["◈ With recording consent and privacy controls","◈ С согласия на запись и с настройками конфиденциальности"],["One workspace","Единое пространство"],["Profiles, notes & progress","Профили, заметки и прогресс"],["Made for tutors","Для репетиторов"],["Keep every learner in focus","Уделяйте внимание каждому ученику"],["Every level, every learner","Для любого уровня"],["Learning tailored to each student's progress","Обучение с учётом прогресса каждого ученика"],["A small preview","Небольшой обзор"],["No complicated dashboards. Just the details that matter when you're preparing for your next lesson.","Никаких сложных панелей. Только важная информация для подготовки к следующему уроку."],["Swipe to explore · Illustrative concepts, not live features","Листайте, чтобы посмотреть · Примеры интерфейса, не готовые функции"],["Overview","Обзор"],["Good morning.","Доброе утро."],["Here's where you left off.","Вот на чём вы остановились."],["Students","Ученики"],["Lessons today","Уроков сегодня"],["Notes to review","Заметок к проверке"],["Your students","Ваши ученики"],["Choose a profile ↓","Выберите профиль ↓"],["Conversation practice","Разговорная практика"],["Grammar & fluency","Грамматика и беглость речи"],["Today’s lesson plan","План уроков на сегодня"],["Sample schedule","Пример расписания"],["Speaking · B1","Говорение · B1"],["Grammar review","Повторение грамматики"],["Past tense · A2","Прошедшее время · A2"],["45 min","45 мин"],["50 min","50 мин"],["Sample learning progress ·","Пример учебного прогресса ·"],["YOUR DESKTOP","ВАШ РАБОЧИЙ СТОЛ"],["Planned connection · sample events","Планируемая интеграция · примеры событий"],["Conversation practice · B1","Разговорная практика · B1"],["Grammar review · A2","Повторение грамматики · A2"],["Next lesson","Следующий урок"],["Speaking practice · B2","Разговорная практика · B2"],["HelloEarth Notes","Заметки HelloEarth"],["◆ Always on top","◆ Поверх других окон"],["UP NEXT · 09:00","СКОРО · 09:00"],["Lesson focus","Тема урока"],["Practice expressing opinions and building confidence.","Тренировка выражения своего мнения и развитие уверенности."],["Remember","Напоминание"],["Review last lesson's vocabulary before starting.","Перед началом повторите лексику прошлого урока."],["Next: Sam Taylor · 11:30","Далее: Sam Taylor · 11:30"],["Your students, always within reach","Информация об учениках всегда под рукой"],["Concept preview · Windows floating notepad and calendar sync are planned","Концепт интерфейса · Плавающий блокнот Windows и синхронизация с календарём планируются"],["How it will work","Как это будет работать"],["A little structure.","Немного порядка."],["A lot more clarity.","Гораздо больше ясности."],["From the first lesson to the next milestone, keep the important details close.","От первого урока до новых достижений — вся важная информация под рукой."],["Meet your learner","Познакомьтесь с учеником"],["Save their level, learning goals and the things that help them succeed.","Сохраните уровень, учебные цели и сведения, которые помогут ученику добиться успеха."],["Capture each lesson","Записывайте результаты уроков"],["Keep a short record of topics, wins, challenges and next steps.","Кратко фиксируйте темы, успехи, трудности и следующие шаги."],["See their growth","Наблюдайте за развитием"],["Review progress and prepare a more personal next session.","Оценивайте прогресс и готовьте следующий урок с учётом потребностей ученика."],["Looking ahead","Планы на будущее"],["Meet Atlas AI.","Знакомьтесь: Atlas AI."],["We're exploring ways to make lesson planning and student insights a little easier with Atlas AI, our separate AI project.","Мы изучаем возможности Atlas AI — нашего отдельного проекта искусственного интеллекта, который поможет упростить планирование уроков и анализ успехов учеников."],["AI features are in development","Функции ИИ в разработке"],["✦ Memory-aware assistance","✦ Помощь с учётом контекста"],["✦ Lesson-planning ideas","✦ Идеи для уроков"],["✦ Student insights","✦ Анализ прогресса учеников"],["Planned possibilities, not available features yet.","Планируемые возможности, пока недоступные пользователям."],["What we're exploring","Что мы исследуем"],["Thoughtful assistance for the way tutors teach.","Умная поддержка в работе репетитора."],["Atlas AI is a concept we're developing alongside HelloEarth. The goal is to help tutors spend less time preparing and more time supporting each learner — while keeping the tutor in control.","Atlas AI — концепция, которую мы развиваем параллельно с HelloEarth. Наша цель — сократить время подготовки и уделять больше внимания ученикам, сохраняя за репетитором полный контроль."],["Lesson planning support","Помощь с планированием уроков"],["Ideas for activities, vocabulary practice and follow-up lessons informed by a learner's goals and language level.","Идеи упражнений, лексических заданий и последующих уроков с учётом целей и языкового уровня ученика."],["Context that carries forward","Контекст, который сохраняется"],["Explore ways to bring relevant student notes, interests and past lessons together when planning what comes next.","Мы ищем способы учитывать заметки об ученике, его интересы и предыдущие уроки при планировании следующих занятий."],["Clearer progress insights","Наглядный анализ прогресса"],["Spot recurring strengths, areas to practise and possible next steps, with the tutor reviewing every suggestion.","Выявляйте сильные стороны и темы для повторения, оценивайте возможные следующие шаги и проверяйте каждую рекомендацию."],["Designed with trust in mind","Доверие и безопасность прежде всего"],["Privacy controls, appropriate consent and tutor oversight are priorities as we explore these capabilities. These are plans, not currently available tools.","При разработке этих возможностей мы уделяем особое внимание конфиденциальности, согласию пользователей и контролю со стороны репетитора. Пока это планы, а не готовые инструменты."],["Good to know","Полезно знать"],["A few quick answers.","Ответы на частые вопросы."],["The essentials, without the fine print.","Всё главное — просто и понятно."],["Not yet. We're building the first version of the student management workspace.","Пока нет. Мы создаём первую версию платформы для управления занятиями и учениками."],["Independent tutors who want one place to organize learners, lesson notes and progress.","Для независимых репетиторов, которым нужно единое место для информации об учениках, заметок к урокам и отслеживания прогресса."],["Does Atlas AI work here already?","Atlas AI уже работает здесь?"],["No. Atlas AI is a separate project, and its integration is planned for a future release.","Нет. Atlas AI — отдельный проект. Интеграция планируется в одном из будущих обновлений."],["A note from us","Пара слов от нас"],["Made with tutors","Создано для"],["in mind.","репетиторов."],["Great teaching is personal. The tools around it should feel simple. That's the idea behind HelloEarth.","Хорошее обучение всегда индивидуально. И инструменты для него должны быть простыми. Именно в этом идея HelloEarth."],["✦ Less to manage","✦ Меньше рутины"],["✦ More time to teach","✦ Больше времени на уроки"],["LET'S CONNECT","ДАВАЙТЕ ОБЩАТЬСЯ"],["Have a question or idea?","Есть вопрос или идея?"],["We'd love to hear from you as HelloEarth takes shape.","Мы будем рады вашему сообщению, пока HelloEarth развивается."],["Say hello","Написать нам"],["For questions or support:","Вопросы и поддержка:"],["A calmer space for the work that matters.","Спокойное пространство для по-настоящему важной работы."],["A calmer place to organize students, lessons and progress. Built with tutors in mind.","Удобное пространство для организации уроков, информации об учениках и отслеживания прогресса. Создано для репетиторов."],["✦ Currently in development","✦ Сейчас в разработке"],["Explore","Разделы"],["Dashboard preview","Предпросмотр панели"],["Information","Информация"],["Terms & Conditions","Условия использования"],["Privacy Policy","Политика конфиденциальности"],["FAQs","Частые вопросы"],["Contact","Контакты"],["HelloEarth. All rights reserved.","HelloEarth. Все права защищены."],["Made for the people behind every lesson. 🌍","Для тех, кто делает каждый урок особенным. 🌍"],["Back to top ↑","Наверх ↑"],["HelloEarth assistant","Помощник HelloEarth"],["We're not quite ready yet.","Мы ещё готовимся к запуску."],["Our little assistant is still finding its feet. Check back soon!","Наш помощник пока учится. Загляните сюда позже!"],["Chat is coming soon","Чат скоро появится"],["Chat","Чат"],["soon","скоро"]]);
const picker=document.getElementById('site-language');if(!picker)return;
const nodes=[];const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let node;
const normalize=value=>value.replace(/\s+/g,' ').trim();
while((node=walker.nextNode())){
 if(node.parentElement?.closest('script,style,select,textarea'))continue;
 const raw=node.nodeValue,original=raw.trim(),normalized=normalize(original);
 const index=source.indexOf(normalized);
 if(index!==-1||Object.prototype.hasOwnProperty.call(ruExtras,normalized))nodes.push({node,raw,original,normalized,index});
}
function setLanguage(lang){
 const strings=translations[lang];
 nodes.forEach(({node,raw,original,normalized,index})=>{
  const replacement=lang==='ru'
   ?(ruExtras[normalized]??(index>=0?strings?.[index]:undefined)??original)
   :(index>=0?(strings?.[index]||source[index]):original);
  node.nodeValue=raw.replace(original,replacement);
 });
 document.documentElement.lang=lang;picker.value=lang;
 document.title=lang==='ru'?'Главная | HelloEarth':'Home | HelloEarth';
 try{localStorage.setItem('helloearth-language',lang)}catch(e){}
}
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

 // A sibling overlay avoids mobile Safari hiding the rocket inside the orbit's
 // animated stacking context. The transform coordinates are already stage-relative.
 if(rocket.parentElement!==stage)stage.appendChild(rocket);

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
  // Read matrix values directly, including on mobile Safari versions without DOMMatrixReadOnly.
  const match=transform.match(/^matrix(?:3d)?\(([^)]+)\)$/);
  if(!match)return 0;
  const values=match[1].split(',').map(Number);
  return values.length>=2?Math.atan2(values[1],values[0]):0;
 };
 // The Earth orbit and its counter-rotation cancel; only the Moon's own turn remains.
 const moonRotation=()=>angleOf(moonOrbit);
 const flightDuration=5000;
 let flight=null;
 let attached=null;
 let rocketVisible=false;
 let wasLanded=false;
 let frameQueued=false;

 rocket.style.display='none';
 rocket.classList.remove('landed');
 moon.classList.remove('flag-planted');

 const render=(x,y,heading,scale,landed)=>{
  if(!rocketVisible){
   rocketVisible=true;
   rocket.classList.add('mission-active');
   rocket.style.display='block';
   rocket.style.visibility='visible';
   rocket.style.opacity='1';
   rocket.style.left='0px';
   rocket.style.top='0px';
  }
  if(wasLanded!==landed){
   wasLanded=landed;
   rocket.classList.toggle('landed',landed);
  }
  rocket.style.transform='translate3d('+x+'px,'+y+'px,0) translate(-50%,-50%) rotate('+heading+'deg) scale('+scale+')';
 };

 // Mobile browsers may report the solar stage as offscreen while a user can
 // still see it, or suppress visibility events during their toolbar animation.
 // Once launched, keep one requestAnimationFrame chain alive until touchdown
 // and afterwards to keep the parked rocket rotating with the Moon.
 const canAnimate=()=>flight!==null||attached!==null;
 const scheduleFrame=()=>{
  if(frameQueued||!canAnimate())return;
  frameQueued=true;
  requestAnimationFrame(frame);
 };
 // Re-arm after page restoration (e.g. switching tabs on iOS Safari).
 document.addEventListener('visibilitychange',()=>{
  if(!document.hidden)scheduleFrame();
 });
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
  // Start on the same user interaction, independently of any observer.
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

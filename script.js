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
translations.zh=["更多时间用于教学。","更少琐事需要管理。","了解一下","开发中","您需要的一切。","没有多余的复杂功能。","学生档案","课程笔记","学习进度跟踪","个性化课程设计","清晰掌握每日安排。","运作方式","联系我们","电子邮件支持","适合哪些人？","HelloEarth 现在可以使用了吗？"];
translations.ru=["Больше времени для преподавания.","Меньше забот и учёта.","Посмотреть","В разработке","Всё необходимое.","Ничего лишнего.","Профили учеников","Заметки об уроках","Отслеживание прогресса","Создание персональных уроков","Весь ваш день как на ладони.","Как это работает","Связаться с нами","Поддержка по электронной почте","Для кого HelloEarth?","HelloEarth уже доступен?"];
const ruExtras=Object.fromEntries([["FOR TUTORS","ДЛЯ РЕПЕТИТОРОВ"],["Menu","Меню"],["Features","Возможности"],["Dashboard","Панель управления"],["A calmer way to manage your students","Удобнее управлять занятиями и учениками"],["HelloEarth is a simple home for your students, lesson notes, and their progress. Built for tutors who want everything in one place.","HelloEarth — удобное пространство для информации об учениках, заметок к урокам и отслеживания прогресса. Всё необходимое репетитору в одном месте."],["Student","Профили"],["profiles","учеников"],["Lesson","Заметки"],["notes","об уроках"],["Progress","Прогресс"],["tracking","учеников"],["✦ The essentials","✦ Самое важное"],["A focused set of tools to manage lessons, track progress and create better learning experiences for every student.","Продуманный набор инструментов для планирования уроков, отслеживания прогресса и создания более эффективного обучения для каждого ученика."],["Keep goals, levels, and important details together.","Храните цели, уровень и важные сведения об ученике в одном месте."],["Remember what you covered and what's next.","Записывайте, что вы уже прошли и что планируете дальше."],["See how each student is growing over time.","Наблюдайте за развитием каждого ученика."],["Coming soon","Скоро"],["Create lessons tailored to each student’s needs, goals, interests and language level (A1–C1).","Создавайте уроки с учётом потребностей, целей, интересов и языкового уровня каждого ученика (A1–C1)."],["Real-time lesson transcription","Расшифровка уроков в реальном времени"],["Capture conversations live, securely save transcripts to student profiles, identify language gaps, and prepare more personalized lessons.","Расшифровывайте беседы во время урока, безопасно сохраняйте записи в профилях учеников, выявляйте пробелы в знаниях и готовьте более персонализированные занятия."],["◈ With recording consent and privacy controls","◈ С согласия на запись и с настройками конфиденциальности"],["One workspace","Единое пространство"],["Profiles, notes & progress","Профили, заметки и прогресс"],["Made for tutors","Для репетиторов"],["Keep every learner in focus","Уделяйте внимание каждому ученику"],["Every level, every learner","Для любого уровня"],["Learning tailored to each student's progress","Обучение с учётом прогресса каждого ученика"],["A small preview","Небольшой обзор"],["No complicated dashboards. Just the details that matter when you're preparing for your next lesson.","Никаких сложных панелей. Только важная информация для подготовки к следующему уроку."],["Swipe to explore · Illustrative concepts, not live features","Листайте, чтобы посмотреть · Примеры интерфейса, не готовые функции"],["Overview","Обзор"],["Good morning.","Доброе утро."],["Here's where you left off.","Вот на чём вы остановились."],["Students","Ученики"],["Lessons today","Уроков сегодня"],["Notes to review","Заметок к проверке"],["Your students","Ваши ученики"],["Choose a profile ↓","Выберите профиль ↓"],["Conversation practice","Разговорная практика"],["Grammar & fluency","Грамматика и беглость речи"],["Today’s lesson plan","План уроков на сегодня"],["Sample schedule","Пример расписания"],["Speaking · B1","Говорение · B1"],["Grammar review","Повторение грамматики"],["Past tense · A2","Прошедшее время · A2"],["45 min","45 мин"],["50 min","50 мин"],["Sample learning progress ·","Пример учебного прогресса ·"],["YOUR DESKTOP","ВАШ РАБОЧИЙ СТОЛ"],["Planned connection · sample events","Планируемая интеграция · примеры событий"],["Conversation practice · B1","Разговорная практика · B1"],["Grammar review · A2","Повторение грамматики · A2"],["Next lesson","Следующий урок"],["Speaking practice · B2","Разговорная практика · B2"],["HelloEarth Notes","Заметки HelloEarth"],["◆ Always on top","◆ Поверх других окон"],["UP NEXT · 09:00","СКОРО · 09:00"],["Lesson focus","Тема урока"],["Practice expressing opinions and building confidence.","Тренировка выражения своего мнения и развитие уверенности."],["Remember","Напоминание"],["Review last lesson's vocabulary before starting.","Перед началом повторите лексику прошлого урока."],["Next: Sam Taylor · 11:30","Далее: Sam Taylor · 11:30"],["Your students, always within reach","Информация об учениках всегда под рукой"],["Concept preview · Windows floating notepad and calendar sync are planned","Концепт интерфейса · Плавающий блокнот Windows и синхронизация с календарём планируются"],["How it will work","Как это будет работать"],["A little structure.","Немного порядка."],["A lot more clarity.","Гораздо больше ясности."],["From the first lesson to the next milestone, keep the important details close.","От первого урока до новых достижений — вся важная информация под рукой."],["Meet your learner","Познакомьтесь с учеником"],["Save their level, learning goals and the things that help them succeed.","Сохраните уровень, учебные цели и сведения, которые помогут ученику добиться успеха."],["Capture each lesson","Записывайте результаты уроков"],["Keep a short record of topics, wins, challenges and next steps.","Кратко фиксируйте темы, успехи, трудности и следующие шаги."],["See their growth","Наблюдайте за развитием"],["Review progress and prepare a more personal next session.","Оценивайте прогресс и готовьте следующий урок с учётом потребностей ученика."],["Looking ahead","Планы на будущее"],["Meet Atlas AI.","Знакомьтесь: Atlas AI."],["We're exploring ways to make lesson planning and student insights a little easier with Atlas AI, our separate AI project.","Мы изучаем возможности Atlas AI — нашего отдельного проекта искусственного интеллекта, который поможет упростить планирование уроков и анализ успехов учеников."],["AI features are in development","Функции ИИ в разработке"],["✦ Memory-aware assistance","✦ Помощь с учётом контекста"],["✦ Lesson-planning ideas","✦ Идеи для уроков"],["✦ Student insights","✦ Анализ прогресса учеников"],["Planned possibilities, not available features yet.","Планируемые возможности, пока недоступные пользователям."],["What we're exploring","Что мы исследуем"],["Thoughtful assistance for the way tutors teach.","Умная поддержка в работе репетитора."],["Atlas AI is a concept we're developing alongside HelloEarth. The goal is to help tutors spend less time preparing and more time supporting each learner — while keeping the tutor in control.","Atlas AI — концепция, которую мы развиваем параллельно с HelloEarth. Наша цель — сократить время подготовки и уделять больше внимания ученикам, сохраняя за репетитором полный контроль."],["Lesson planning support","Помощь с планированием уроков"],["Ideas for activities, vocabulary practice and follow-up lessons informed by a learner's goals and language level.","Идеи упражнений, лексических заданий и последующих уроков с учётом целей и языкового уровня ученика."],["Context that carries forward","Контекст, который сохраняется"],["Explore ways to bring relevant student notes, interests and past lessons together when planning what comes next.","Мы ищем способы учитывать заметки об ученике, его интересы и предыдущие уроки при планировании следующих занятий."],["Clearer progress insights","Наглядный анализ прогресса"],["Spot recurring strengths, areas to practise and possible next steps, with the tutor reviewing every suggestion.","Выявляйте сильные стороны и темы для повторения, оценивайте возможные следующие шаги и проверяйте каждую рекомендацию."],["Designed with trust in mind","Доверие и безопасность прежде всего"],["Privacy controls, appropriate consent and tutor oversight are priorities as we explore these capabilities. These are plans, not currently available tools.","При разработке этих возможностей мы уделяем особое внимание конфиденциальности, согласию пользователей и контролю со стороны репетитора. Пока это планы, а не готовые инструменты."],["Good to know","Полезно знать"],["A few quick answers.","Ответы на частые вопросы."],["The essentials, without the fine print.","Всё главное — просто и понятно."],["Not yet. We're building the first version of the student management workspace.","Пока нет. Мы создаём первую версию платформы для управления занятиями и учениками."],["Independent tutors who want one place to organize learners, lesson notes and progress.","Для независимых репетиторов, которым нужно единое место для информации об учениках, заметок к урокам и отслеживания прогресса."],["Does Atlas AI work here already?","Atlas AI уже работает здесь?"],["No. Atlas AI is a separate project, and its integration is planned for a future release.","Нет. Atlas AI — отдельный проект. Интеграция планируется в одном из будущих обновлений."],["A note from us","Пара слов от нас"],["Made with tutors","Создано для"],["in mind.","репетиторов."],["Great teaching is personal. The tools around it should feel simple. That's the idea behind HelloEarth.","Хорошее обучение всегда индивидуально. И инструменты для него должны быть простыми. Именно в этом идея HelloEarth."],["✦ Less to manage","✦ Меньше рутины"],["✦ More time to teach","✦ Больше времени на уроки"],["LET'S CONNECT","ДАВАЙТЕ ОБЩАТЬСЯ"],["Have a question or idea?","Есть вопрос или идея?"],["We'd love to hear from you as HelloEarth takes shape.","Мы будем рады вашему сообщению, пока HelloEarth развивается."],["Say hello","Написать нам"],["For questions or support:","Вопросы и поддержка:"],["A calmer space for the work that matters.","Спокойное пространство для по-настоящему важной работы."],["A calmer place to organize students, lessons and progress. Built with tutors in mind.","Удобное пространство для организации уроков, информации об учениках и отслеживания прогресса. Создано для репетиторов."],["✦ Currently in development","✦ Сейчас в разработке"],["Explore","Разделы"],["Dashboard preview","Предпросмотр панели"],["Information","Информация"],["Terms & Conditions","Условия использования"],["Privacy Policy","Политика конфиденциальности"],["FAQs","Частые вопросы"],["Contact","Контакты"],["HelloEarth. All rights reserved.","HelloEarth. Все права защищены."],["Made for the people behind every lesson. 🌍","Для тех, кто делает каждый урок особенным. 🌍"],["Back to top ↑","Наверх ↑"],["HelloEarth assistant","Помощник HelloEarth"],["We're not quite ready yet.","Мы ещё готовимся к запуску."],["Our little assistant is still finding its feet. Check back soon!","Наш помощник пока учится. Загляните сюда позже!"],["Chat is coming soon","Чат скоро появится"],["Chat","Чат"],["soon","скоро"]]);
const sharedTranslations={"af":{"FOR TUTORS":"VIR TUTORS","Menu":"Kieslys","Features":"Kenmerke","Dashboard":"Paneel","Pricing":"Pryse","Log in":"Meld aan","Get started":"Begin","Atlas AI":"Atlas AI","How it works":"Hoe dit werk","Coming soon":"Binnekort","Free":"Gratis","Starter":"Beginner","Growth":"Groei","Studio":"Studio","Local Atlas AI":"Plaaslike Atlas AI","Cloud Atlas AI":"Wolk-Atlas AI","View all plans":"Sien alle planne","Get in touch":"Kontak ons","Student profiles":"Leerderprofiele","Lesson notes":"Lesnotas","Progress tracking":"Vorderingnasporing"},"es":{"FOR TUTORS":"PARA TUTORES","Menu":"Menú","Features":"Funciones","Dashboard":"Panel","Pricing":"Precios","Log in":"Iniciar sesión","Get started":"Empezar","Atlas AI":"Atlas AI","How it works":"Cómo funciona","Coming soon":"Próximamente","Free":"Gratis","Starter":"Inicial","Growth":"Crecimiento","Studio":"Estudio","Local Atlas AI":"Atlas AI local","Cloud Atlas AI":"Atlas AI en la nube","View all plans":"Ver todos los planes","Get in touch":"Contáctanos","Student profiles":"Perfiles de estudiantes","Lesson notes":"Notas de clase","Progress tracking":"Seguimiento del progreso"},"pt":{"FOR TUTORS":"PARA TUTORES","Menu":"Menu","Features":"Funcionalidades","Dashboard":"Painel","Pricing":"Preços","Log in":"Iniciar sessão","Get started":"Começar","Atlas AI":"Atlas AI","How it works":"Como funciona","Coming soon":"Em breve","Free":"Grátis","Starter":"Inicial","Growth":"Crescimento","Studio":"Estúdio","Local Atlas AI":"Atlas AI local","Cloud Atlas AI":"Atlas AI na nuvem","View all plans":"Ver todos os planos","Get in touch":"Entre em contacto","Student profiles":"Perfis de alunos","Lesson notes":"Notas de aula","Progress tracking":"Acompanhamento do progresso"},"fr":{"FOR TUTORS":"POUR LES PROFESSEURS","Menu":"Menu","Features":"Fonctionnalités","Dashboard":"Tableau de bord","Pricing":"Tarifs","Log in":"Connexion","Get started":"Commencer","Atlas AI":"Atlas AI","How it works":"Comment ça marche","Coming soon":"Bientôt","Free":"Gratuit","Starter":"Débutant","Growth":"Croissance","Studio":"Studio","Local Atlas AI":"Atlas AI local","Cloud Atlas AI":"Atlas AI dans le cloud","View all plans":"Voir toutes les offres","Get in touch":"Contactez-nous","Student profiles":"Profils des élèves","Lesson notes":"Notes de cours","Progress tracking":"Suivi des progrès"},"pl":{"FOR TUTORS":"DLA KOREPETYTORÓW","Menu":"Menu","Features":"Funkcje","Dashboard":"Panel","Pricing":"Cennik","Log in":"Zaloguj się","Get started":"Rozpocznij","Atlas AI":"Atlas AI","How it works":"Jak to działa","Coming soon":"Wkrótce","Free":"Bezpłatny","Starter":"Starter","Growth":"Rozwój","Studio":"Studio","Local Atlas AI":"Lokalny Atlas AI","Cloud Atlas AI":"Atlas AI w chmurze","View all plans":"Zobacz wszystkie plany","Get in touch":"Skontaktuj się","Student profiles":"Profile uczniów","Lesson notes":"Notatki z lekcji","Progress tracking":"Śledzenie postępów"},"ru":{"FOR TUTORS":"ДЛЯ РЕПЕТИТОРОВ","Menu":"Меню","Features":"Возможности","Dashboard":"Панель","Pricing":"Цены","Log in":"Войти","Get started":"Начать","Atlas AI":"Atlas AI","How it works":"Как это работает","Coming soon":"Скоро","Free":"Бесплатно","Starter":"Стартовый","Growth":"Рост","Studio":"Студия","Local Atlas AI":"Локальный Atlas AI","Cloud Atlas AI":"Облачный Atlas AI","View all plans":"Все тарифы","Get in touch":"Связаться с нами","Student profiles":"Профили учеников","Lesson notes":"Заметки об уроках","Progress tracking":"Отслеживание прогресса"}};
sharedTranslations.zh={"FOR TUTORS":"专为教师打造","Menu":"菜单","Features":"功能","Dashboard":"控制面板","Pricing":"价格","Log in":"登录","Get started":"立即开始","Atlas AI":"Atlas AI","How it works":"使用方式","Coming soon":"即将推出","Free":"免费版","Starter":"入门版","Growth":"成长版","Studio":"工作室版","Local Atlas AI":"本地 Atlas AI","Cloud Atlas AI":"云端 Atlas AI","View all plans":"查看所有套餐","Get in touch":"联系我们","Student profiles":"学生档案","Lesson notes":"课程笔记","Progress tracking":"学习进度跟踪"};
Object.assign(sharedTranslations.zh,{"A calmer way to manage your students":"更轻松地管理学生","HelloEarth is a simple home for your students, lesson notes, and their progress. Built for tutors who want everything in one place.":"HelloEarth 为教师提供简洁的学生管理空间，集中管理学生资料、课程笔记和学习进度。","View pricing":"查看价格","Free plan for up to 3 students ·":"免费套餐最多支持 3 名学生 ·","Paid tiers from R99/month are coming soon.":"付费套餐每月 R99 起，即将推出。","Launch rocket":"发射火箭","Student":"学生","profiles":"档案","Lesson":"课程","notes":"笔记","Progress":"进度","tracking":"跟踪","Simple, affordable plans":"简单实惠的套餐","Get started free. Grow when you're ready.":"免费开始，按需升级。","Your tutoring workspace starts at R0 a month. Choose more capacity as your student list grows.":"您的教学工作空间每月 R0 起。随着学生人数增加，可选择更大的容量。","Compare all plans →":"比较所有套餐 →","Available now":"现已开放","Local Atlas · connect your own AI API (planned)":"本地 Atlas · 可连接自己的 AI API（规划中）","Cloud Atlas · connect your own AI API (planned)":"云端 Atlas · 可连接自己的 AI API（规划中）","Get started →":"立即开始 →","See details →":"查看详情 →","Prices in ZAR per tutor per month. Free and Starter are planned with local Atlas; Growth and Studio with cloud Atlas. Every plan is designed to support your own AI API. Paid plans, cloud inference and API connections are not yet live. Cloud allowances and final pricing will be confirmed before launch; third-party API use is billed by your chosen provider.":"价格以南非兰特计，按每位教师每月收费。免费版和入门版计划提供本地 Atlas；成长版和工作室版计划提供云端 Atlas。所有套餐均计划支持连接您自己的 AI API。付费套餐、云端推理和 API 连接尚未上线。云端用量及最终价格将在发布前确认；第三方 API 费用由您选择的服务商收取。","Everything you need.":"您需要的一切。","Nothing you don't.":"没有多余的复杂功能。","A focused set of tools to manage lessons, track progress and create better learning experiences for every student.":"一套专注实用的工具，帮助管理课程、跟踪进度，为每位学生提供更好的学习体验。","Keep goals, levels, and important details together.":"集中保存学习目标、水平和重要信息。","Remember what you covered and what's next.":"记录已学内容和下一步计划。","See how each student is growing over time.":"持续了解每位学生的成长。","Personalized lesson creation":"个性化课程设计","Create lessons tailored to each student’s needs, goals, interests and language level (A1–C1).":"根据学生的需求、目标、兴趣及语言水平（A1–C1）设计课程。","Real-time lesson transcription":"实时课堂转录","Capture conversations live, securely save transcripts to student profiles, identify language gaps, and prepare more personalized lessons.":"实时记录课堂对话，将转录文本安全保存至学生档案，识别语言薄弱环节，并准备更有针对性的课程。","One workspace":"一站式工作空间","Profiles, notes & progress":"档案、笔记与进度","Made for tutors":"专为教师设计","Keep every learner in focus":"关注每位学习者","Every level, every learner":"适合各种水平的学习者","Learning tailored to each student's progress":"根据每位学生的进度调整教学","A small preview":"功能预览","A clear view of your day.":"清晰掌握每日安排。","No complicated dashboards. Just the details that matter when you're preparing for your next lesson.":"无需复杂的控制面板，只呈现备课时真正重要的信息。","Swipe to explore · Illustrative concepts, not live features":"滑动浏览 · 以下为概念示意，非已上线功能","Overview":"概览","Good morning.":"早上好。","Here's where you left off.":"继续上次的进度。","Students":"学生","Lessons today":"今日课程","Notes to review":"待查看笔记","Your students":"您的学生","Choose a profile ↓":"选择档案 ↓","Conversation practice":"口语练习","Grammar & fluency":"语法与流利度","Today’s lesson plan":"今日教学计划","Sample schedule":"示例课表","Speaking · B1":"口语 · B1","Grammar review":"语法复习","Past tense · A2":"过去时 · A2","Sample learning progress ·":"示例学习进度 ·","YOUR DESKTOP":"您的桌面","Planned connection · sample events":"计划中的连接 · 示例日程","Conversation practice · B1":"口语练习 · B1","Grammar review · A2":"语法复习 · A2","Next lesson":"下一节课","Speaking practice · B2":"口语练习 · B2","HelloEarth Notes":"HelloEarth 笔记","UP NEXT · 09:00":"即将开始 · 09:00","Lesson focus":"课程重点","Practice expressing opinions and building confidence.":"练习表达观点并增强自信。","Remember":"提醒","Review last lesson's vocabulary before starting.":"开始前复习上一节课的词汇。","Next: Sam Taylor · 11:30":"下一位：Sam Taylor · 11:30","Your students, always within reach":"随时查看学生信息","Concept preview · Windows floating notepad and calendar sync are planned":"概念预览 · 计划支持 Windows 悬浮笔记和日历同步","How it will work":"使用流程","A little structure.":"更有条理。","A lot more clarity.":"一切更清晰。","From the first lesson to the next milestone, keep the important details close.":"从第一节课到每一个学习里程碑，重要信息始终触手可及。","Meet your learner":"了解学生","Save their level, learning goals and the things that help them succeed.":"记录学生水平、学习目标及有助于进步的信息。","Capture each lesson":"记录每节课","Keep a short record of topics, wins, challenges and next steps.":"简要记录课程主题、成果、困难和下一步计划。","See their growth":"见证成长","Review progress and prepare a more personal next session.":"回顾学习进度，为下一节课做好个性化准备。","Looking ahead":"未来展望","Meet Atlas AI.":"认识 Atlas AI。","Atlas AI is our standalone, local-first AI assistant. It runs on your own computer using Ollama; student records can sync separately through your signed-in HelloEarth account. Direct website integration is still in development.":"Atlas AI 是我们独立运行、优先支持本地部署的 AI 助手。它通过 Ollama 在您的电脑上运行；学生记录可通过已登录的 HelloEarth 账户单独同步。网站直接集成功能仍在开发中。","Local Atlas prototype · website integration coming later":"本地 Atlas 原型 · 网站集成将在后续推出","Atlas is currently a separate local prototype. AI API connections and managed cloud access are future options.":"Atlas 目前是独立的本地原型。AI API 连接和托管云端访问属于未来规划。","What we're exploring":"我们正在探索","Thoughtful assistance for the way tutors teach.":"贴合教师工作方式的智能辅助。","Our plan is simple: Free and Starter run Atlas locally on your computer; Growth and Studio use a managed cloud version. Every tier will also have the choice to connect an external AI API. The local Atlas prototype exists separately today; web AI access, external API integrations and hosted Atlas are planned.":"我们的计划很简单：免费版和入门版在您的电脑上本地运行 Atlas；成长版和工作室版使用托管云端版本。所有套餐也将支持连接外部 AI API。目前本地 Atlas 原型独立运行；网页 AI、外部 API 集成和托管 Atlas 仍在规划中。","Lesson planning support":"课程规划辅助","Ideas for activities, vocabulary practice and follow-up lessons informed by a learner's goals and language level.":"根据学生的目标和语言水平，提供课堂活动、词汇练习及后续课程的建议。","Context that carries forward":"持续保留学习背景","Explore ways to bring relevant student notes, interests and past lessons together when planning what comes next.":"探索在规划后续课程时综合利用学生笔记、兴趣和过往课程信息的方法。","Clearer progress insights":"更清晰的进度分析","Spot recurring strengths, areas to practise and possible next steps, with the tutor reviewing every suggestion.":"识别学生的持续优势、需要练习的领域和可能的下一步，并由教师审核每条建议。","One Atlas, multiple ways to run it":"一个 Atlas，多种运行方式","Local for Free and Starter, managed cloud for Growth and Studio, and bring-your-own AI API on every tier. Cloud access will have clear monthly limits; student context requires appropriate consent. The integrations are still in development.":"免费版和入门版使用本地 Atlas，成长版和工作室版使用托管云端 Atlas；所有套餐都支持自带 AI API。云端访问将设置明确的每月用量限制；使用学生资料需获得适当同意。这些集成功能仍在开发中。","Good to know":"常见问题","A few quick answers.":"快速解答。","The essentials, without the fine print.":"简单明了地了解重点。","Is HelloEarth available now?":"HelloEarth 现在可以使用吗？","Yes, the free student-management workspace is available now. Paid plans, website AI features and hosted Atlas remain in development.":"可以，免费的学生管理工作空间现已开放。付费套餐、网站 AI 功能及托管 Atlas 仍在开发中。","Who is it for?":"适合哪些人？","Independent tutors who want one place to organize learners, lesson notes and progress.":"适合希望在同一平台管理学生、课程笔记和学习进度的独立教师。","Does Atlas AI work here already?":"Atlas AI 已经可以在这里使用了吗？","Atlas AI currently runs as a separate local prototype using Ollama. Our planned tiers are local Atlas on Free and Starter, cloud Atlas on Growth and Studio, with the option to connect your own supported AI API on every plan. These integrations are still in development.":"Atlas AI 目前通过 Ollama 作为独立本地原型运行。我们计划在免费版和入门版提供本地 Atlas，在成长版和工作室版提供云端 Atlas，并允许所有套餐连接受支持的自有 AI API。这些集成功能仍在开发中。","A note from us":"我们的话","Made with tutors":"为教师","in mind.":"用心打造。","Great teaching is personal. The tools around it should feel simple. That's the idea behind HelloEarth.":"优秀的教学因人而异，辅助工具也应简单易用。这正是 HelloEarth 的理念。","LET'S CONNECT":"保持联系","Have a question or idea?":"有问题或建议吗？","We'd love to hear from you as HelloEarth takes shape.":"在 HelloEarth 不断完善的过程中，我们期待听到您的想法。","Say hello":"联系我们","For questions or support:":"如有疑问或需要支持：","A calmer space for the work that matters.":"为重要的教学工作提供更从容的空间。","A calmer place to organize students, lessons and progress. Built with tutors in mind.":"轻松管理学生、课程与学习进度。专为教师设计。","Explore":"探索","Dashboard preview":"控制面板预览","Information":"信息","Pricing & plans":"价格与套餐","Register":"注册","Terms & Conditions":"条款与条件","Privacy Policy":"隐私政策","FAQs":"常见问题","Contact":"联系","HelloEarth. All rights reserved.":"HelloEarth。保留所有权利。","Made for the people behind every lesson. 🌍":"献给每一位用心授课的教师。🌍","Back to top ↑":"返回顶部 ↑","HelloEarth assistant":"HelloEarth 助手","We're not quite ready yet.":"我们还在准备中。","Our little assistant is still finding its feet. Check back soon!":"我们的智能助手仍在成长，敬请期待！","Chat is coming soon":"聊天功能即将推出","Chat":"聊天","soon":"即将推出","✦ The essentials":"✦ 核心功能","✦ Memory-aware assistance":"✦ 结合历史信息的辅助","✦ Lesson-planning ideas":"✦ 课程规划建议","✦ Student insights":"✦ 学生学习分析","✦ Less to manage":"✦ 减少管理负担","✦ More time to teach":"✦ 更多教学时间","✦ Currently in development":"✦ 正在开发","◈ With recording consent and privacy controls":"◈ 需获得录制同意并遵守隐私设置"});
const picker=document.getElementById('site-language');if(!picker)return;
const nodes=[];const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let node;
const normalize=value=>value.replace(/\s+/g,' ').trim();
while((node=walker.nextNode())){
 if(node.parentElement?.closest('script,style,select,textarea'))continue;
 const raw=node.nodeValue,original=raw.trim(),normalized=normalize(original);
 const index=source.indexOf(normalized);
 if(index!==-1||Object.prototype.hasOwnProperty.call(ruExtras,normalized)||Object.values(sharedTranslations).some(dict=>Object.prototype.hasOwnProperty.call(dict,normalized)))nodes.push({node,raw,original,normalized,index});
}
function setLanguage(lang){
 const strings=translations[lang];
 nodes.forEach(({node,raw,original,normalized,index})=>{
  const replacement=lang==='en'?original:(sharedTranslations[lang]?.[normalized]??(lang==='ru'?ruExtras[normalized]:undefined)??(index>=0?strings?.[index]:undefined)??original);
  node.nodeValue=raw.replace(original,replacement);
 });
 document.documentElement.lang=lang;picker.value=lang;
 document.title=lang==='ru'?'Главная | HelloEarth':lang==='zh'?'首页 | HelloEarth':'Home | HelloEarth';
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

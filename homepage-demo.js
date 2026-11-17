/* Interactive HelloEarth homepage sandbox.
   All records are fictional and remain in memory; no auth, API calls or persistence. */
(() => {
  const mini=document.getElementById('mini-dashboard');
  if(!mini)return;
  const clean=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const samples=[
    {id:'alex',name:'Alex Morgan',level:'B1',goal:'Speak confidently about travel and everyday topics',focus:'Expressing opinions',strength:'Conversation',homework:'Practice five opinion sentences',skills:[3.1,3.6,3.2,3.0,3.0],notes:'Practised giving reasons and asking follow-up questions.'},
    {id:'sam',name:'Sam Taylor',level:'A2',goal:'Use simple grammar in everyday conversations',focus:'Past simple and questions',strength:'Listening',homework:'Write six sentences about yesterday',skills:[2.5,3.3,2.6,2.4,2.8],notes:'Reviewed irregular verbs and short answers.'},
    {id:'jordan',name:'Jordan Kim',level:'B2',goal:'Present ideas clearly in business meetings',focus:'Structuring presentations',strength:'Vocabulary',homework:'Prepare a two-minute work update',skills:[4.1,4.0,3.8,4.2,3.9],notes:'Used signposting phrases in a presentation.'},
    {id:'maya',name:'Maya Patel',level:'A1',goal:'Build basic sentences and everyday vocabulary',focus:'Questions and introductions',strength:'Pronunciation',homework:'Learn eight everyday verbs',skills:[1.7,2.1,1.9,1.6,2.0],notes:'Practised greetings, numbers and simple questions.'},
    {id:'sofia',name:'Sofia Reyes',level:'C1',goal:'Sound natural in spontaneous conversations',focus:'Idioms and nuance',strength:'Fluency',homework:'Collect three examples of natural phrasing',skills:[4.6,4.7,4.5,4.3,4.4],notes:'Explored subtle differences in idiomatic expressions.'},
    {id:'oliver',name:'Oliver Chen',level:'B1',goal:'Improve workplace listening and confidence',focus:'Clarifying instructions',strength:'Reading',homework:'Summarise a short workplace article',skills:[3.2,3.0,3.7,3.1,2.9],notes:'Practised checking understanding politely.'}
  ];
  const lessons=[
    {id:1,day:0,time:'10:00',student:'maya',title:'Everyday English',length:50},
    {id:2,day:1,time:'14:00',student:'oliver',title:'Workplace listening',length:50},
    {id:3,day:2,time:'09:00',student:'alex',title:'Conversation practice',length:50},
    {id:4,day:2,time:'11:30',student:'sam',title:'Grammar review',length:50},
    {id:5,day:2,time:'15:00',student:'jordan',title:'Presentation practice',length:50},
    {id:6,day:3,time:'13:00',student:'sofia',title:'Advanced fluency',length:50},
    {id:7,day:4,time:'10:30',student:'oliver',title:'English at work',length:50}
  ];
  const initialNotes=[
    {student:'alex',text:'Practised giving opinions with because and however. Next: short role-play.',stamp:'Sample · Recent'},
    {student:'sam',text:'Irregular past tense needs another review. Use a short story next time.',stamp:'Sample · Recent'},
    {student:'jordan',text:'Clearer presentation openings. Work on transitions and Q&A.',stamp:'Sample · Earlier'}
  ];
  const days=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const sections=[
    {id:'overview',icon:'⌂',label:'Overview'},
    {id:'calendar',icon:'▦',label:'Calendar'},
    {id:'students',icon:'♧',label:'Students'},
    {id:'progress',icon:'▥',label:'Progress'},
    {id:'atlas',icon:'✦',label:'Atlas AI'}
  ];
  let state;
  const initial=()=>({
    view:'overview',day:2,selected:'alex',progressStudent:'alex',noteStudent:'alex',
    search:'',studentForm:false,calendarForm:false,students:samples.map(s=>({...s,skills:[...s.skills]})),
    lessons:lessons.map(l=>({...l})),notes:initialNotes.map(n=>({...n})),
    completed:new Set(),status:'',planDraft:'',savedPlans:[]
  });
  const lookup=id=>state.students.find(s=>s.id===id)||state.students[0];
  const avatar=s=>s.name.split(' ').map(n=>n[0]).slice(0,2).join('').toUpperCase();
  const button=(label,view,extra='')=>'<button type="button" class="he-demo-button" data-demo-go="'+view+'" '+extra+'>'+label+'</button>';
  const level=s=>'<span class="he-mini-level">'+clean(s.level)+'</span>';
  const title=(eyebrow,heading,desc,tag)=>'<div class="he-mini-heading he-demo-section-intro"><div><span class="he-mini-overline">'+eyebrow+'</span><h3>'+heading+'</h3><p>'+desc+'</p></div><span class="he-mini-pill">'+tag+'</span></div>';
  const metric=(name,value,desc)=>'<div><span>'+name+'</span><strong>'+value+'</strong><small>'+desc+'</small></div>';
  const studentOptions=(chosen)=>state.students.map(s=>'<option value="'+clean(s.id)+'" '+(chosen===s.id?'selected':'')+'>'+clean(s.name)+' · '+clean(s.level)+'</option>').join('');
  const lessonRow=l=>{
    const s=lookup(l.student);
    return '<div class="he-mini-lesson"><span class="he-mini-time">'+clean(l.time)+'</span><span class="he-mini-lesson-info"><strong>'+clean(l.title)+'</strong><small>'+clean(s.name)+' · '+clean(s.level)+' · '+l.length+' min</small></span><button type="button" data-demo-student="'+clean(s.id)+'">Profile</button></div>';
  };
  const sampleMessage='<span class="he-demo-sample-note">Sample data only · Changes reset when you refresh</span>';
  function overview(){
    const today=state.lessons.filter(l=>l.day===2).sort((a,b)=>a.time.localeCompare(b.time));
    const pending=state.students.filter(s=>!state.completed.has(s.id));
    const assessed=state.students.filter(s=>s.skills.some(v=>v!==2.5)).length;
    const levels=new Set(state.students.map(s=>s.level)).size;
    const upcoming=state.lessons.filter(l=>l.day>=2).length;
    return [
      title('YOUR WORKSPACE','Good to see you again.','Everything you need to manage your teaching day, all in one place.','Overview'),
      '<section class="he-demo-feature-panel">',
        '<div class="he-demo-feature-title"><div><span class="he-mini-overline">TODAY AT A GLANCE</span><h4>My teaching day</h4><p>Upcoming sample appointments, with quick student access.</p></div>',
          '<button type="button" class="he-demo-button" data-demo-go="calendar">View calendar</button></div>',
        '<div class="he-demo-day-counts">',
          metric('Appointments today',today.length,'Wednesday'),
          metric('Remaining this week',upcoming,'Sample schedule'),
          metric('Next appointment',today[0]?.time||'—','Demo calendar'),
        '</div>',
        '<div class="he-mini-lessons">'+today.slice(0,2).map(lessonRow).join('')+'</div>',
      '</section>',
      '<p class="he-demo-privacy-banner">✧ Your student information is private to your account. This is an interactive preview with fictional records; Atlas AI remains in development.</p>',
      '<div class="he-demo-plan-strip"><div><strong>Free plan · Sample workspace</strong><span>The live free plan includes up to 3 students. The demo has extra fictional learners for exploration.</span></div><a href="pricing.html">See plans →</a></div>',
      '<div class="he-mini-metrics he-demo-summary-metrics">',
        metric('Students',state.students.length,'In demo workspace'),
        metric('Levels tracked',levels,'CEFR categories'),
        metric('Profiles assessed',assessed,'Illustrative observations'),
      '</div>',
      '<div class="he-demo-shortcut-grid">',
        '<button type="button" data-demo-go="calendar"><span aria-hidden="true">▦</span><strong>Your calendar</strong><small>Plan your upcoming lessons</small></button>',
        '<button type="button" data-demo-go="students"><span aria-hidden="true">♧</span><strong>Students</strong><small>Profiles, goals and lesson notes</small></button>',
        '<button type="button" data-demo-go="progress"><span aria-hidden="true">▥</span><strong>Progress</strong><small>See your learners’ levels</small></button>',
        '<button type="button" data-demo-go="atlas"><span aria-hidden="true">✦</span><strong>Atlas AI</strong><small>Explore what is coming next</small></button>',
      '</div>',
      '<div class="he-demo-secondary-panel"><div class="he-mini-section-title"><strong>Homework follow-ups</strong><span>'+pending.length+' pending</span></div><div class="he-demo-tasks">',
        pending.slice(0,3).map(s=>'<button type="button" data-demo-student="'+clean(s.id)+'"><span class="he-demo-task-dot"></span><span><strong>'+clean(s.name)+'</strong><small>'+clean(s.homework)+'</small></span><span>›</span></button>').join(''),
      '</div><div class="he-mini-actions">'+button('Write a lesson note','notes')+'</div></div>',
      sampleMessage
    ].join('');
  }
  function calendar(){
    const chosen=state.lessons.filter(l=>l.day===state.day).sort((a,b)=>a.time.localeCompare(b.time));
    return [
      title('YOUR SCHEDULE','Teaching calendar','See upcoming lessons and appointments in one place.','Sample calendar'),
      '<div class="he-demo-calendar-identity"><span class="he-demo-connection-light"></span><div><small>SAMPLE CALENDAR</small><strong>Fictional tutoring schedule</strong></div><span class="he-demo-calendar-identity-status">Demo only · Not connected</span></div>',
      '<div class="he-demo-scheduling-actions"><button type="button" class="he-demo-primary" data-demo-add-event="true">+ Schedule appointment</button><small>New lessons are added only to this sample workspace.</small></div>',
      state.calendarForm?'<form class="he-demo-form he-demo-inline-form" data-demo-form="event"><label>Student<select name="student" required>'+studentOptions(state.selected)+'</select></label><label>Day<select name="day">'+days.map((d,i)=>'<option value="'+i+'" '+(i===state.day?'selected':'')+'>'+d+'</option>').join('')+'</select></label><label>Time<input name="time" type="time" value="16:00" required></label><label class="he-demo-field-wide">Lesson topic<input name="title" value="Conversation practice" maxlength="65" required></label><div class="he-demo-form-actions"><button type="submit">Add to demo</button><button type="button" data-demo-cancel="true">Cancel</button></div></form>':'',
      '<div class="he-demo-calendar-card"><div class="he-demo-calendar-head"><div><strong>Sample teaching week</strong><p>Choose a day to view its appointments</p></div><button type="button" class="he-demo-button" data-demo-day="2">Today (sample)</button></div>',
      '<div class="he-mini-days he-demo-week">'+days.map((day,i)=>'<button type="button" data-demo-day="'+i+'" class="'+(state.day===i?'active':'')+'" aria-pressed="'+(state.day===i)+'"><span>'+day+'</span><strong>'+state.lessons.filter(l=>l.day===i).length+'</strong></button>').join('')+'</div></div>',
      '<div class="he-demo-agenda-card"><div class="he-demo-agenda-head"><div><h4>'+days[state.day]+' · Upcoming lessons</h4><p>Appointments in the selected sample day.</p></div><span>'+chosen.length+' '+(chosen.length===1?'lesson':'lessons')+'</span></div>',
      '<div class="he-mini-lessons">'+(chosen.length?chosen.map(lessonRow).join(''):'<div class="he-demo-empty">No sample lessons on this day. Try scheduling one.</div>')+'</div></div>',
      sampleMessage
    ].join('');
  }
  const studentList=()=>state.students.filter(s=>(s.name+' '+s.level+' '+s.goal).toLowerCase().includes(state.search.toLowerCase())).map(s=>
    '<button type="button" class="he-demo-student-card '+(state.selected===s.id?'chosen':'')+'" data-demo-student="'+clean(s.id)+'" aria-pressed="'+(state.selected===s.id)+'"><span class="he-demo-card-top"><span class="he-mini-avatar">'+avatar(s)+'</span>'+level(s)+'</span><strong>'+clean(s.name)+'</strong><small>'+clean(s.goal)+'</small><span class="he-demo-card-footer">View student profile →</span></button>'
  ).join('')||'<p class="he-demo-empty">No matching sample students.</p>';
  function students(){
    const s=lookup(state.selected);
    return [
      title('YOUR STUDENTS','Your students','Keep goals, progress and lesson notes together.',state.students.length+' sample profiles'),
      '<div class="he-demo-toolbar"><label class="he-demo-search"><span>⌕</span><input type="search" data-demo-search aria-label="Search fictional students" placeholder="Search by name or goal…" value="'+clean(state.search)+'"></label><button type="button" class="he-demo-button" data-demo-import-open="true">Import CSV demo</button><button type="button" class="he-demo-primary" data-demo-add-student="true">+ Add student</button></div>',
      state.studentForm?'<form class="he-demo-form he-demo-inline-form" data-demo-form="student"><label>Student name<input name="name" required maxlength="55" placeholder="Example Student"></label><label>CEFR level<select name="level"><option>A1</option><option>A2</option><option selected>B1</option><option>B2</option><option>C1</option></select></label><label class="he-demo-field-wide">Learning goal<input name="goal" required maxlength="90" placeholder="Build speaking confidence"></label><div class="he-demo-form-actions"><button type="submit">Add to demo</button><button type="button" data-demo-cancel="true">Cancel</button></div></form>':'',
      '<div class="he-demo-student-grid" id="he-demo-student-list">'+studentList()+'</div>',
      '<section class="he-demo-profile-real"><div class="he-demo-profile-header"><div><span class="he-mini-overline">STUDENT PROFILE</span><h4>'+clean(s.name)+'</h4></div>'+level(s)+'</div>',
      '<div class="he-demo-profile-fields">',
       '<div><small>CEFR level</small><strong>'+clean(s.level)+'</strong></div>',
       '<div><small>Learning goals</small><strong>'+clean(s.goal)+'</strong></div>',
       '<div><small>Strengths</small><strong>'+clean(s.strength)+'</strong></div>',
       '<div><small>Next lesson focus</small><strong>'+clean(s.focus)+'</strong></div>',
       '<div class="he-demo-profile-homework"><small>Current homework</small><strong>'+clean(s.homework)+'</strong></div>',
      '</div>',
      '<div class="he-demo-profile-actions">',
       button('+ Lesson note','notes','data-demo-person="'+clean(s.id)+'"'),
       button('Record assessment','progress','data-demo-person="'+clean(s.id)+'"'),
       '<button type="button" class="he-demo-primary" data-demo-go="plan" data-demo-person="'+clean(s.id)+'">Prepare lesson</button>',
      '</div>',
      '<button type="button" class="he-demo-check '+(state.completed.has(s.id)?'is-checked':'')+'" data-demo-homework="'+clean(s.id)+'" aria-pressed="'+state.completed.has(s.id)+'">'+(state.completed.has(s.id)?'✓ Homework complete (demo)':'○ Mark homework complete')+'</button>',
      '</section>',
      sampleMessage
    ].join('');
  }
  function notes(){
    const s=lookup(state.noteStudent);
    const recent=state.notes.filter(n=>n.student===s.id);
    return [
      title('LESSON RECORDS','Lesson notes','Write a sample note and see it appear in this demo.','Private in real app'),
      '<div class="he-demo-two-blocks"><div class="he-demo-block">',
      '<label class="he-demo-field">Student<select data-demo-note-student>'+studentOptions(s.id)+'</select></label>',
      '<label class="he-demo-field">New lesson note<textarea id="he-demo-note-text" rows="6" maxlength="900" placeholder="What did you practise? What went well? What happens next?"></textarea></label>',
      '<div class="he-mini-actions"><button type="button" class="he-demo-button" data-demo-save-note="true">Save sample note</button>'+button('View student','students','data-demo-person="'+clean(s.id)+'"')+'</div>',
      '</div><div class="he-demo-block">',
      '<div class="he-mini-section-title"><strong>Notes for '+clean(s.name)+'</strong><span>'+recent.length+' entries</span></div>',
      '<div class="he-demo-notes">'+(recent.length?recent.map(n=>'<article><small>'+clean(n.stamp)+'</small><p>'+clean(n.text)+'</p></article>').join(''):'<div class="he-demo-empty">No sample notes for this student yet.</div>')+'</div>',
      '</div></div>',
      sampleMessage
    ].join('');
  }
  function progress(){
    const s=lookup(state.progressStudent);
    const labels=['Speaking','Listening','Reading','Grammar','Confidence'];
    const levels=['A1','A2','B1','B2','C1'];
    const counts=levels.map(level=>state.students.filter(x=>x.level===level).length);
    const max=Math.max(1,...counts);
    return [
      title('LEARNER INSIGHTS','Student progress','A quick picture of the CEFR levels across your students.','Demo insights'),
      '<section class="he-demo-insight-card"><h4>CEFR level distribution</h4>',
        levels.map((label,i)=>'<div class="he-mini-bar"><span>'+label+'</span><i><b style="width:'+Math.round(counts[i]/max*100)+'%"></b></i><strong>'+counts[i]+'</strong></div>').join(''),
        '<p class="he-demo-muted">Based on fictional CEFR levels recorded in the sample profiles, not lesson outcomes.</p>',
      '</section>',
      '<section class="he-demo-feature-panel"><div class="he-demo-feature-title"><div><h4>Skill development history</h4><p>Compare sample tutor-recorded assessments per student.</p></div>'+button('View students','students')+'</div>',
        '<div class="he-demo-toolbar"><label class="he-demo-field he-demo-progress-select">Student<select data-demo-progress-student>'+studentOptions(s.id)+'</select></label><button class="he-demo-primary" type="button" data-demo-progress-step="true">+ Sample check-in</button></div>',
        '<div class="he-demo-skill-panel"><div class="he-mini-section-title"><strong>'+clean(s.name)+' · Recorded skills</strong><span>Scale 1–5</span></div>',
        labels.map((label,i)=>'<div class="he-demo-skill"><span>'+label+'</span><div><i style="width:'+Math.round(s.skills[i]/5*100)+'%"></i></div><strong>'+s.skills[i].toFixed(1)+'</strong></div>').join(''),
        '<p class="he-demo-muted">This is a simplified demonstration of the real app’s skills history, not an automated AI score.</p></div>',
      '</section>',sampleMessage
    ].join('');
  }
  function atlas(){
    return [
      '<div class="he-demo-atlas-hero"><span class="he-mini-atlas-icon">✦</span><span class="he-mini-overline">ATLAS AI</span><h3>Your future teaching companion.</h3>',
      '<p>Atlas AI is in development. Planned tools include lesson suggestions, learner insights and optional transcription features, designed around your existing student workspace.</p>',
      '<span class="he-demo-atlas-status">In development · No AI lesson features are active yet</span>',
      '<div class="he-mini-actions">'+button('Explore students','students')+'<a class="he-demo-plain-link" href="#atlas">Learn about Atlas AI</a></div></div>',
      sampleMessage
    ].join('');
  }
  const makePlan=(student,duration,topic)=>[
    'Lesson plan · '+student.name+' ('+student.level+')',
    'Duration: '+duration+' minutes',
    'Topic: '+topic,
    '',
    '0–5 min · Warm-up: ask about the learner’s week.',
    '5–15 min · Review: revisit '+student.focus.toLowerCase()+'.',
    '15–30 min · Guided activity: practise '+topic.toLowerCase()+' with examples.',
    '30–45 min · Conversation: use new language in realistic situations.',
    '45–50 min · Feedback: one strength, one improvement and a next step.',
    '',
    'Learner goal: '+student.goal,
    'Homework reminder: '+student.homework
  ].join('\n');
  function plan(){
    const s=lookup(state.selected);
    const plans=state.savedPlans.filter(p=>p.student===s.id);
    return [
      title('LESSON PREPARATION','Prepare lesson','Create and edit a template-based lesson draft, just like the current app.','Sample template'),
      '<div class="he-demo-feature-panel"><div class="he-mini-section-title"><strong>'+clean(s.name)+' · '+clean(s.level)+'</strong><span>Editable template · No AI</span></div>',
      '<div class="he-demo-plan-controls"><label>Lesson topic<input id="he-demo-plan-topic" maxlength="85" value="'+clean(s.focus)+'"></label><label>Duration<select id="he-demo-plan-duration"><option value="30">30 minutes</option><option value="50" selected>50 minutes</option><option value="60">60 minutes</option></select></label></div>',
      '<div class="he-mini-actions"><button type="button" class="he-demo-button" data-demo-create-plan="true">Create editable draft</button><button type="button" class="he-demo-primary" data-demo-save-plan="true">Save sample plan</button>'+button('Back to student','students','data-demo-person="'+clean(s.id)+'"')+'</div>',
      '<label class="he-demo-field he-demo-plan-editor">Lesson plan (editable)<textarea id="he-demo-plan-draft" rows="11" maxlength="5000" placeholder="Choose Create editable draft to generate a lesson plan.">'+clean(state.planDraft)+'</textarea></label>',
      '</div><div class="he-demo-secondary-panel"><div class="he-mini-section-title"><strong>Saved lesson plans</strong><span>'+plans.length+' in demo</span></div>',
      plans.length?plans.map((p,i)=>'<div class="he-demo-saved-plan"><strong>Plan '+(i+1)+' · '+clean(s.name)+'</strong><small>'+clean(p.text.slice(0,120))+'</small></div>').join(''):'<p class="he-demo-muted">Saved template plans for this learner will appear here.</p>',
      '</div>',sampleMessage
    ].join('');
  }
  const views={overview,calendar,students,notes,progress,atlas,plan};
  state=initial();
  mini.classList.add('he-demo-app','he-demo-real');
  mini.innerHTML=[
    '<div class="he-mini-shell he-demo-real-shell">',
      '<aside class="he-mini-sidebar he-demo-real-sidebar">',
        '<a class="he-demo-side-brand" href="dashboard.html"><img src="logo.svg" alt="" width="30" height="30">helloearth<span>.</span></a>',
        '<nav class="he-demo-side-nav" aria-label="Preview dashboard sections">',
          sections.map(s=>'<button type="button" class="he-mini-nav" data-demo-go="'+s.id+'" aria-pressed="false"><span aria-hidden="true">'+s.icon+'</span>'+s.label+'</button>').join(''),
        '</nav>',
        '<div class="he-demo-side-foot"><a href="index.html">↗ &nbsp; View website</a><p>Your private teaching space.<br>Fictional student data for this demo.</p></div>',
      '</aside>',
      '<div class="he-demo-main">',
        '<header class="he-demo-workspace-header"><div><span class="he-mini-overline">YOUR TEACHING SPACE</span><h2>My workspace<span>.</span></h2></div>',
          '<div class="he-demo-account"><button type="button" class="he-demo-utility-btn" data-demo-tour-start="true">▶ Guided tour</button><button type="button" class="he-demo-utility-btn" data-demo-companion-open="true">◷ Lesson companion</button><span class="he-demo-account-label">Demo tutor</span><span class="he-mini-account">T</span><button type="button" class="he-demo-reset" data-demo-reset="true" title="Restore the sample data">↻ Reset</button></div>',
        '</header>',
        '<nav class="he-demo-mobile-tabs" aria-label="Sample dashboard mobile tabs">',
          sections.map(s=>'<button type="button" class="he-demo-mobile-tab" data-demo-go="'+s.id+'" aria-pressed="false"><span aria-hidden="true">'+s.icon+'</span>'+s.label+'</button>').join(''),
        '</nav>',
        '<div class="he-mini-content he-demo-scroll" tabindex="0" aria-label="Sample dashboard content"><div id="he-demo-panel"></div><p class="he-demo-feedback" role="status" aria-live="polite"></p></div>',
        '<div class="he-mini-foot"><span><span class="he-mini-foot-dot"></span> Interactive demo · Fictional data, no real account</span><a href="dashboard.html">Open real dashboard ↗</a></div>',
      '</div>',
    '</div>'
  ].join('');
  function render(resetScroll=true){
    for(const btn of mini.querySelectorAll('[data-demo-go]')){
      if(!btn.classList.contains('he-mini-nav')&&!btn.classList.contains('he-demo-mobile-tab'))continue;
      const current=['notes','plan'].includes(state.view)?'students':state.view;
      const active=btn.dataset.demoGo===current;
      btn.classList.toggle('is-active',active);
      btn.setAttribute('aria-pressed',String(active));
    }
    mini.querySelector('#he-demo-panel').innerHTML=views[state.view]();
    mini.querySelector('.he-demo-feedback').textContent=state.status;
    if(resetScroll)mini.querySelector('.he-demo-scroll').scrollTop=0;
    if(typeof CustomEvent==="function")mini.dispatchEvent?.(new CustomEvent("helloearth:demo-render"));
  }
  function go(view,person){
    if(!views[view])return;
    if(person){
      state.selected=person;
      state.noteStudent=person;
      state.progressStudent=person;
    }
    state.view=view;state.status='';state.studentForm=false;state.calendarForm=false;
    if(view==='plan')state.planDraft='';
    render();
  }
  mini.addEventListener('click',event=>{
    const t=event.target.closest('button,a');
    if(!t||!mini.contains(t))return;
    if(t.dataset.demoReset!==undefined){state=initial();render();return}
    if(t.dataset.demoAddEvent!==undefined){state.calendarForm=!state.calendarForm;render(false);return}
    if(t.dataset.demoGo){go(t.dataset.demoGo,t.dataset.demoPerson);return}
    if(t.dataset.demoStudent){
      state.selected=t.dataset.demoStudent;state.status='';go('students',state.selected);
      const scroll=mini.querySelector('.he-demo-scroll');
      const detail=mini.querySelector('.he-demo-profile-real');
      if(scroll&&detail&&scroll.getBoundingClientRect&&detail.getBoundingClientRect){
        const dy=detail.getBoundingClientRect().top-scroll.getBoundingClientRect().top;
        scroll.scrollTop+=Math.max(0,dy-16);
      }
      return;
    }
    if(t.dataset.demoDay!==undefined){state.day=Number(t.dataset.demoDay);render();return}
    if(t.dataset.demoAddStudent!==undefined){state.studentForm=!state.studentForm;render(false);return}
    if(t.dataset.demoCancel!==undefined){state.studentForm=false;state.calendarForm=false;render(false);return}
    if(t.dataset.demoHomework!==undefined){
      const id=t.dataset.demoHomework;
      if(state.completed.has(id))state.completed.delete(id);else state.completed.add(id);
      state.status='Sample homework status updated.';render(false);return;
    }
    if(t.dataset.demoSaveNote!==undefined){
      const text=mini.querySelector('#he-demo-note-text')?.value.trim()||'';
      if(!text){state.status='Write a note before saving.';mini.querySelector('.he-demo-feedback').textContent=state.status;return}
      state.notes.unshift({student:state.noteStudent,text:text.slice(0,900),stamp:'Demo · Just added'});
      state.status='Sample lesson note saved in this page only.';render(false);return;
    }
    if(t.dataset.demoCreatePlan!==undefined){
      const student=lookup(state.selected);
      const topic=mini.querySelector('#he-demo-plan-topic')?.value.trim()||student.focus;
      const duration=Number(mini.querySelector('#he-demo-plan-duration')?.value)||50;
      state.planDraft=makePlan(student,duration,topic).slice(0,5000);
      state.status='Editable sample lesson draft created.';render(false);return;
    }
    if(t.dataset.demoSavePlan!==undefined){
      const value=mini.querySelector('#he-demo-plan-draft')?.value.trim()||'';
      if(!value){state.status='Create or write a lesson draft before saving.';mini.querySelector('.he-demo-feedback').textContent=state.status;return;}
      state.planDraft=value.slice(0,5000);
      state.savedPlans.unshift({student:state.selected,text:state.planDraft});
      state.status='Sample plan saved in the demo only.';render(false);return;
    }
    if(t.dataset.demoProgressStep!==undefined){
      const s=lookup(state.progressStudent);
      s.skills[0]=Math.min(5,Math.round((s.skills[0]+0.2)*10)/10);
      s.skills[4]=Math.min(5,Math.round((s.skills[4]+0.1)*10)/10);
      state.status='Sample speaking and confidence ratings updated.';render(false);return;
    }
  });
  mini.addEventListener('input',event=>{
    if(event.target.matches('[data-demo-search]')){
      state.search=event.target.value;
      mini.querySelector('#he-demo-student-list').innerHTML=studentList();
    }
  });
  mini.addEventListener('change',event=>{
    if(event.target.matches('[data-demo-note-student]')){
      state.noteStudent=event.target.value;render(false);
    }
    if(event.target.matches('[data-demo-progress-student]')){
      state.progressStudent=event.target.value;render(false);
    }
  });
  mini.addEventListener('submit',event=>{
    const form=event.target.closest('[data-demo-form]');
    if(!form)return;
    event.preventDefault();
    const data=new FormData(form);
    if(form.dataset.demoForm==='event'){
      const student=String(data.get('student'));
      const day=Number(data.get('day')),time=String(data.get('time')||'');
      const title=String(data.get('title')||'').trim();
      if(!state.students.some(s=>s.id===student)||day<0||day>6||!time||!title)return;
      state.lessons.push({id:Date.now(),day,time,student,title:title.slice(0,65),length:50});
      state.day=day;state.calendarForm=false;state.status='Sample appointment added (not to Google Calendar).';
    }else if(form.dataset.demoForm==='student'){
      const name=String(data.get('name')||'').trim().slice(0,55);
      const level=String(data.get('level')||'B1');
      const goal=String(data.get('goal')||'').trim().slice(0,90);
      if(!name||!goal||!['A1','A2','B1','B2','C1'].includes(level))return;
      const id='demo-'+Date.now();
      state.students.push({id,name,level,goal,focus:'First lesson and goal setting',strength:'To be assessed',homework:'Not yet assigned',skills:[2.5,2.5,2.5,2.5,2.5],notes:''});
      state.selected=id;state.studentForm=false;state.search='';state.status='Sample student added to this demo only.';
    }
    render();
  });
  window.HelloEarthDemo={get state(){return state},render,go,mini,clean};
  // Horizontal swipes inside the interactive preview should not trigger the
  // outer carousel; leave the carousel arrows/dots operational outside.
  mini.addEventListener('touchstart',e=>e.stopPropagation(),{passive:true});
  mini.addEventListener('touchend',e=>e.stopPropagation(),{passive:true});
  mini.addEventListener('keydown',e=>{
    if(e.key==='ArrowLeft'||e.key==='ArrowRight')e.stopPropagation();
  });
  render();
})();

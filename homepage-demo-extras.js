/* All interactions here use FICTIONAL records in HelloEarthDemo's in-memory state. */
(() => {
 const api=window.HelloEarthDemo;
 if(!api?.mini)return;
 const mini=api.mini,esc=api.clean;
 const $=selector=>mini.querySelector(selector);
 const steps=[
  ["overview","Your teaching day","Check appointments, shortcuts and reminders."],
  ["students","Student profiles","Choose a fictional learner and inspect their history."],
  ["students","Try importing students","Open the CSV simulator; preview columns and duplicates before adding sample profiles."],
  ["calendar","Schedule a practice lesson","Select a weekday and add a fictional appointment."],
  ["progress","Explore progress","Switch students and compare illustrative skill ratings."],
  ["plan","Prepare a lesson","Create and edit a lesson template for a sample student."]
 ];
 let tour=-1,showImport=false,csvText='Name,CEFR,Goal\nJamie Rivers,B1,Build travel confidence\nAlex Morgan,B1,Conversation practise\nPriya Kapoor,A2,Past tense basics';
 let csvRows=[],reviewed=[],mapCols=[0,1,2],timelineType='all',skill='speaking';
 let companionVisible=false,elapsed=0,timerStarted=0,timerOn=false,ticker=null;
 const getStudent=id=>api.state.students.find(s=>s.id===id)||api.state.students[0];

 function drawTour(){
  mini.querySelector('.he-demo-tour')?.remove();
  const active=tour>=0?steps[tour]:null;
  mini.querySelectorAll('.he-mini-nav,.he-demo-mobile-tab').forEach(b=>
   b.classList.toggle('he-demo-tour-highlight',!!active&&b.dataset.demoGo===active[0]));
  if(!active)return;
  const banner=document.createElement('section');banner.className='he-demo-tour';banner.setAttribute('aria-label','Guided tour');
  banner.innerHTML='<div class="he-demo-tour-top"><small>GUIDED TOUR · '+(tour+1)+' OF '+steps.length+'</small><button type="button" data-extra-tour-close aria-label="Exit tour">×</button></div>'+
  '<strong>'+esc(active[1])+'</strong><p>'+esc(active[2])+'</p>'+
  '<div class="he-demo-tour-actions"><button type="button" data-extra-tour-back '+(tour===0?'disabled':'')+'>Back</button><button type="button" data-extra-tour-next>'+(tour===steps.length-1?'Finish':'Next →')+'</button></div>';
  mini.append(banner);
 }
 function tourStep(n){
  if(n<0||n>=steps.length){tour=-1;drawTour();return}
  tour=n;
  if(tour===2)showImport=true;
  api.go(steps[n][0],n===5?api.state.selected:undefined);
  drawExtras();
 }
 function parseCSV(source){
  const rows=[];let current=[],value='',quotes=false;
  for(let i=0;i<source.length;i++){
   const c=source[i];
   if(c==='"'){
    if(quotes&&source[i+1]==='"'){value+='"';i++}else quotes=!quotes;
   }else if(c===','&&!quotes){current.push(value.trim());value=''}
   else if((c==='\n'||c==='\r')&&!quotes){
    if(c==='\r'&&source[i+1]==='\n')i++;
    current.push(value.trim());value='';
    if(current.some(Boolean))rows.push(current);
    current=[];
   }else value+=c;
  }
  if(quotes)throw Error('Unclosed quote in CSV');
  current.push(value.trim());if(current.some(Boolean))rows.push(current);
  return rows.slice(0,101);
 }
 function runReview(){
  const result=$('.he-demo-import-results');
  if(!result)return;
  csvText=$('.he-demo-import-text')?.value||csvText;
  try{
   csvRows=parseCSV(csvText);
   if(csvRows.length<2)throw Error('A header and at least one row are needed');
   const seen=new Set(api.state.students.map(s=>s.name.toLowerCase().trim()));
   reviewed=csvRows.slice(1).map(row=>{
    const name=(row[mapCols[0]]||'').slice(0,55).trim();
    const level=(row[mapCols[1]]||'').trim().toUpperCase();
    const goal=(row[mapCols[2]]||'').slice(0,90).trim();
    let status='Ready';
    if(!name||!goal||!['A1','A2','B1','B2','C1','C2'].includes(level))status='Review';
    else if(seen.has(name.toLowerCase()))status='Duplicate';
    if(status==='Ready')seen.add(name.toLowerCase());
    return {name,level,goal,status};
   });
   const ready=reviewed.filter(r=>r.status==='Ready').length;
   result.innerHTML='<p>'+ready+' ready · '+reviewed.filter(r=>r.status==='Duplicate').length+' duplicate(s) skipped · '+reviewed.filter(r=>r.status==='Review').length+' need review</p>'+
    '<div class="he-demo-import-table"><table><thead><tr><th>Name</th><th>Level</th><th>Goal</th><th>Check</th></tr></thead><tbody>'+
    reviewed.map(r=>'<tr><td>'+esc(r.name||'—')+'</td><td>'+esc(r.level||'—')+'</td><td>'+esc(r.goal||'—')+'</td><td>'+esc(r.status)+'</td></tr>').join('')+
    '</tbody></table></div><button type="button" class="he-demo-primary" data-extra-import-commit '+(ready?'':'disabled')+'>Add '+ready+' sample profiles</button>';
  }catch(error){reviewed=[];result.textContent='CSV check failed: '+String(error.message||error)}
 }
 function drawImport(){
  if(api.state.view!=='students'||!showImport)return;
  const anchor=$('.he-demo-toolbar');if(!anchor)return;
  const panel=document.createElement('section');panel.className='he-demo-import-panel';
  panel.innerHTML='<div class="he-demo-feature-title"><div><h4>Try importing students</h4><p>Local CSV simulation: choose columns, check duplicates and confirm. Nothing is uploaded.</p></div><button type="button" class="he-demo-button" data-extra-import-close>Close</button></div>'+
   '<textarea class="he-demo-import-text" rows="5" maxlength="16000" aria-label="Sample CSV text">'+esc(csvText)+'</textarea>'+
   '<div class="he-demo-import-actions"><label>Choose a CSV<input type="file" accept=".csv,text/csv" data-extra-import-file></label><button type="button" class="he-demo-button" data-extra-import-review>Preview records</button></div>'+
   '<div class="he-demo-import-map">'+['Name','CEFR level','Goal'].map((label,i)=>'<label>'+label+'<select data-extra-import-map="'+i+'">'+
    [0,1,2,3,4,5].map(j=>'<option value="'+j+'" '+(j===mapCols[i]?'selected':'')+'>Column '+(j+1)+'</option>').join('')+'</select></label>').join('')+'</div>'+
   '<div class="he-demo-import-results" role="status"><p>Preview rows to see duplicate and validation results.</p></div>'+
   '<small>This demonstration accepts CSV only; the real dashboard supports both CSV and Excel.</small>';
  anchor.after(panel);
  if(reviewed.length)runReview();
 }
 function drawTimeline(){
  if(api.state.view!=='students')return;
  const anchor=$('.he-demo-profile-real');if(!anchor)return;
  const id=api.state.selected;
  const entries=[
   ...api.state.notes.filter(n=>n.student===id).map(n=>({type:'notes',head:'Lesson note',desc:n.text,date:n.stamp||'Sample'})),
   ...api.state.savedPlans.filter(p=>p.student===id).map(p=>({type:'plans',head:'Lesson plan',desc:p.text.slice(0,180),date:'Sample'})),
   ...api.state.lessons.filter(l=>l.student===id).map(l=>({type:'schedule',head:l.title,desc:l.time+' · '+l.length+' minutes (scheduled)',date:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][l.day]}))
  ];
  if(api.state.completed.has(id))entries.unshift({type:'homework',head:'Homework completed',desc:getStudent(id).homework,date:'Sample'});
  const timeline=document.createElement('section');timeline.className='he-demo-timeline';
  timeline.innerHTML='<div class="he-demo-feature-title"><div><h4>Learning timeline</h4><p>Fictional notes, plans, appointments and homework.</p></div><label>Filter <select data-extra-timeline>'+
    ['all','notes','plans','schedule','homework'].map(x=>'<option value="'+x+'" '+(timelineType===x?'selected':'')+'>'+x[0].toUpperCase()+x.slice(1)+'</option>').join('')+'</select></label></div>'+
    '<div class="he-demo-timeline-events">'+(entries.filter(e=>timelineType==='all'||timelineType===e.type).slice(0,18).map(e=>
     '<article><div><span>'+esc(e.type)+'</span><small>'+esc(e.date)+'</small></div><strong>'+esc(e.head)+'</strong><p>'+esc(e.desc)+'</p></article>').join('')||'<p class="he-demo-muted">No fictional events match this filter.</p>')+'</div>';
  anchor.after(timeline);
 }
 function drawChart(){
  if(api.state.view!=='progress')return;
  const anchor=$('.he-demo-skill-panel');if(!anchor)return;
  const index={speaking:0,listening:1,reading:2,grammar:3,confidence:4}[skill];
  const score=Number(getStudent(api.state.progressStudent).skills[index]);
  // All three points are *illustrative*; not claims of actual observations.
  const values=[Math.max(1,score-.8),Math.max(1,score-.35),score];
  const points=values.map((v,i)=>(41+i*174)+','+(155-(v-1)*32)).join(' ');
  const graph=document.createElement('section');graph.className='he-demo-sample-chart';
  graph.innerHTML='<div class="he-demo-feature-title"><div><h4>Sample progress chart</h4><p>Three illustrative check-ins, not actual assessment history.</p></div><label>Skill <select data-extra-chart-skill>'+
   ['speaking','listening','reading','grammar','confidence'].map(k=>'<option value="'+k+'" '+(k===skill?'selected':'')+'>'+k[0].toUpperCase()+k.slice(1)+'</option>').join('')+'</select></label></div>'+
   '<svg viewBox="0 0 450 190" role="img" aria-label="Illustrative '+esc(skill)+' scores">'+
   [1,2,3,4,5].map(n=>'<line x1="41" x2="430" y1="'+(155-(n-1)*32)+'" y2="'+(155-(n-1)*32)+'" stroke="#8b86a7" stroke-opacity=".3"/><text x="18" y="'+(159-(n-1)*32)+'" fill="#b6bfd9" font-size="11">'+n+'</text>').join('')+
   '<polyline points="'+points+'" fill="none" stroke="#b997ff" stroke-width="3"/>'+
   values.map((v,i)=>'<circle cx="'+(41+i*174)+'" cy="'+(155-(v-1)*32)+'" r="5" fill="#d9c4ff"><title>'+v.toFixed(1)+'/5 · Fictional</title></circle>').join('')+
   '<text x="41" y="182" fill="#b6bfd9" font-size="11">Earlier</text><text x="217" y="182" fill="#b6bfd9" font-size="11">Previous</text><text x="395" y="182" fill="#b6bfd9" font-size="11">Latest</text></svg>';
  anchor.append(graph);
 }
 function displayClock(){
  const el=$('.he-extra-clock');if(!el)return;
  const secs=Math.floor((elapsed+(timerOn?Date.now()-timerStarted:0))/1000);
  el.textContent=String(Math.floor(secs/60)).padStart(2,'0')+':'+String(secs%60).padStart(2,'0');
 }
 function drawCompanion(){
  mini.querySelector('.he-demo-companion')?.remove();
  if(!companionVisible)return;
  const s=getStudent(api.state.selected);
  const panel=document.createElement('section');panel.className='he-demo-companion';panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Demo lesson companion');
  panel.innerHTML='<header><div><small>IN-LESSON ASSISTANT · FICTIONAL</small><strong>Live lesson companion</strong></div><button type="button" data-extra-companion-close aria-label="Close lesson companion">×</button></header>'+
   '<label>Student<select data-extra-companion-student>'+api.state.students.map(x=>'<option value="'+esc(x.id)+'" '+(s.id===x.id?'selected':'')+'>'+esc(x.name)+'</option>').join('')+'</select></label>'+
   '<div class="he-demo-companion-clock"><strong class="he-extra-clock">00:00</strong><button type="button" data-extra-timer-toggle>'+(timerOn?'Pause':'Start')+'</button><button type="button" data-extra-timer-reset>Reset</button></div>'+
   '<details><summary>Example lesson focus</summary><p>'+esc(s.focus)+' · '+esc(s.goal)+'</p></details>'+
   '<label>Quick notes<textarea rows="4" maxlength="900" data-extra-companion-note placeholder="What happened during this fictional lesson?"></textarea></label>'+
   '<button type="button" class="he-demo-primary" data-extra-companion-save>Save to sample student notes</button>'+
   '<p class="he-extra-companion-message">Nothing here is sent to an account or a server.</p>';
  mini.append(panel);displayClock();
 }
 function drawExtras(){
  if(api.state.view==='students'){drawImport();drawTimeline()}
  if(api.state.view==='progress')drawChart();
  drawTour();
 }
 mini.addEventListener('helloearth:demo-render',drawExtras);
 mini.addEventListener('click',e=>{
  const btn=e.target.closest('button');if(!btn||!mini.contains(btn))return;
  const d=btn.dataset;
  if(d.demoTourStart!==undefined){tourStep(0);return}
  if(d.extraTourClose!==undefined){tourStep(-1);return}
  if(d.extraTourBack!==undefined){tourStep(tour-1);return}
  if(d.extraTourNext!==undefined){tourStep(tour+1);return}
  if(d.demoImportOpen!==undefined){showImport=!showImport;api.render(false);return}
  if(d.extraImportClose!==undefined){showImport=false;api.render(false);return}
  if(d.extraImportReview!==undefined){runReview();return}
  if(d.extraImportCommit!==undefined){
   const ready=reviewed.filter(r=>r.status==='Ready');
   for(const r of ready)api.state.students.push({
    id:'import-'+Date.now()+'-'+api.state.students.length,name:r.name,level:r.level,goal:r.goal,
    focus:'First lesson',strength:'To assess',homework:'Not assigned',skills:[2.5,2.5,2.5,2.5,2.5],notes:''
   });
   api.state.status=ready.length+' fictional profiles added. No real records were changed.';
   showImport=false;reviewed=[];csvRows=[];api.render();return;
  }
  if(d.demoCompanionOpen!==undefined){companionVisible=true;drawCompanion();return}
  if(d.extraCompanionClose!==undefined){companionVisible=false;drawCompanion();return}
  if(d.extraTimerToggle!==undefined){
   if(timerOn){elapsed+=Date.now()-timerStarted;timerOn=false;clearInterval(ticker);ticker=null}
   else{timerStarted=Date.now();timerOn=true;ticker=setInterval(displayClock,250)}
   btn.textContent=timerOn?'Pause':'Start';displayClock();return;
  }
  if(d.extraTimerReset!==undefined){elapsed=0;timerStarted=Date.now();displayClock();return}
  if(d.extraCompanionSave!==undefined){
   const note=$('[data-extra-companion-note]')?.value.trim();
   if(!note){$('.he-extra-companion-message').textContent='Write a note first.';return}
   const id=$('[data-extra-companion-student]')?.value||api.state.selected;
   api.state.notes.unshift({student:id,text:note.slice(0,900),stamp:'Demo · Session note'});
   $('[data-extra-companion-note]').value='';
   $('.he-extra-companion-message').textContent='Saved in this fictional preview only.';return;
  }
 });
 mini.addEventListener('change',async e=>{
  const el=e.target;
  if(el.matches('[data-extra-import-map]')){
   mapCols[Number(el.dataset.extraImportMap)]=Number(el.value);
   if(csvRows.length)runReview();
  }
  if(el.matches('[data-extra-import-file]')&&el.files?.length){
   const f=el.files[0];
   if(f.size>100000){$('.he-demo-import-results').textContent='Choose a CSV smaller than 100 KB.';return}
   try{csvText=await f.text();$('.he-demo-import-text').value=csvText;runReview()}
   catch{$('.he-demo-import-results').textContent='Could not read that local CSV.'}
  }
  if(el.matches('[data-extra-timeline]')){timelineType=el.value;api.render(false)}
  if(el.matches('[data-extra-chart-skill]')){skill=el.value;api.render(false)}
  if(el.matches('[data-extra-companion-student]'))api.state.selected=el.value;
 });
 mini.addEventListener('keydown',e=>{
  if(e.key==='Escape'){
   if(companionVisible){companionVisible=false;drawCompanion()}
   else if(tour>=0)tourStep(-1);
  }
 });
 drawExtras();
})();

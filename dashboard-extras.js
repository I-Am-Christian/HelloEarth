import { db } from "./supabase-client.js";

/* Authenticated tutor extensions. Only existing RLS-protected tables are read or
   written. No recordings, student names or lesson content are sent to third parties. */
const $=id=>document.getElementById(id);
const W=()=>window.HelloEarthWorkspace;
const node=(tag,value,cls)=>{
 const n=document.createElement(tag);
 if(value!==undefined&&value!==null)n.textContent=String(value);
 if(cls)n.className=cls;
 return n;
};
const fmt=date=>{
 if(!date)return "Date not recorded";
 const parsed=new Date(/^\d{4}-\d{2}-\d{2}$/.test(String(date))?String(date)+"T12:00:00":date);
 return Number.isNaN(parsed.getTime())?String(date).slice(0,30):parsed.toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric"});
};
const getRecords=async(table,id,column,count)=>{
 const {data,error}=await db.from(table).select("*").eq("tutor_id",W().userId).eq("student_id",id).order(column,{ascending:false}).limit(count);
 if(error)throw error;
 return data||[];
};
const notice=(id,message,isError=false)=>{
 const element=$(id);if(!element)return;
 element.textContent=message;
 element.classList.toggle("is-error",isError);
};

// One merged, date-ordered learner timeline. A lesson is only present after the
// tutor explicitly saved a note or attendance record.
const timeline={selected:null,items:[],filter:"all",generation:0};
function renderTimeline(){
 const target=$("ws-timeline-list");
 if(!target)return;
 target.replaceChildren();
 const filtered=timeline.items.filter(item=>timeline.filter==="all"||item.kind===timeline.filter);
 if(!filtered.length){
  target.append(node("p",timeline.items.length?"No events match this filter.":"No recorded events yet. Save a lesson note, assessment, attendance or plan to start this timeline.","ws-extra-empty"));
  return;
 }
 for(const item of filtered.slice(0,100)){
  const article=node("article",null,"ws-timeline-entry");
  const badge=node("span",item.kind[0].toUpperCase()+item.kind.slice(1),"ws-timeline-kind ws-timeline-"+item.kind);
  const time=node("time",fmt(item.date));
  if(item.date)time.dateTime=String(item.date);
  const head=node("div",null,"ws-timeline-entry-head");
  head.append(badge,time);
  article.append(head,node("strong",item.title),node("p",item.detail||"No additional details saved."));
  target.append(article);
 }
}
async function refreshTimeline(id){
 const userId=W()?.userId;
 if(!id||!userId)return;
 const version=++timeline.generation;
 timeline.selected=id;
 notice("ws-timeline-feedback","Loading recorded history…");
 const specs=[
  ["atlas_lesson_notes","lesson_date",60,"note"],
  ["atlas_skill_assessments","assessed_on",80,"assessment"],
  ["atlas_lesson_attendance","lesson_date",120,"attendance"],
  ["atlas_lesson_plans","created_at",30,"plan"]
 ];
 const results=await Promise.allSettled(specs.map(async([table,column,count,kind])=>({
  kind,rows:await getRecords(table,id,column,count)
 })));
 if(version!==timeline.generation)return;
 const events=[],errors=[];
 for(let i=0;i<results.length;i++){
  const result=results[i];
  if(result.status!=="fulfilled"){errors.push(specs[i][3]);continue}
  const {kind,rows}=result.value;
  for(const row of rows){
   if(kind==="note")events.push({
    kind,date:row.lesson_date,
    title:row.summary||"Lesson note",
    detail:[row.homework?"Homework: "+row.homework:"",Array.isArray(row.next_steps)&&row.next_steps.length?"Next: "+row.next_steps.join(" · "):""].filter(Boolean).join(" | ")
   });
   if(kind==="assessment")events.push({
    kind,date:row.assessed_on,
    title:"Skill assessment recorded",
    detail:["speaking","listening","reading","writing","grammar","confidence"].filter(skill=>row[skill]!=null).map(skill=>skill+": "+row[skill]+"/5").join(" · ")+(row.notes?" | "+row.notes:"")
   });
   if(kind==="attendance")events.push({
    kind,date:row.lesson_date,
    title:"Attendance: "+(row.status||"Recorded"),
    detail:row.note||"Attendance was recorded manually."
   });
   if(kind==="plan")events.push({
    kind,date:row.created_at,
    title:"Saved lesson plan: "+(row.topic||"Untitled"),
    detail:[row.cefr_level||"",row.duration_minutes?row.duration_minutes+" minutes":""].filter(Boolean).join(" · ")
   });
  }
 }
 events.sort((a,b)=>new Date(b.date||0)-new Date(a.date||0));
 timeline.items=events;
 renderTimeline();
 notice("ws-timeline-feedback",errors.length?"Some history sources could not be loaded ("+errors.join(", ")+").":events.length+" recorded events · Most recent first",errors.length>0);
}
$("ws-timeline-filter")?.addEventListener("change",event=>{
 timeline.filter=event.target.value;
 renderTimeline();
});
$("ws-timeline-refresh")?.addEventListener("click",()=>{
 if(timeline.selected)refreshTimeline(timeline.selected);
});
document.addEventListener("helloearth:student-opened",event=>{
 timeline.filter="all";
 if($("ws-timeline-filter"))$("ws-timeline-filter").value="all";
 refreshTimeline(event.detail?.student?.id);
});

// True skill history chart, based on saved dated assessments only. Chart ranges
// change the x-axis data window; no interpolated or fabricated assessments.
const chart={generation:0,student:null,rows:[]};
const chartSkills=["speaking","listening","reading","writing","grammar","confidence"];
function renderChart(){
 const root=$("ws-progress-chart"),summary=$("ws-progress-summary");
 if(!root||!summary)return;
 root.replaceChildren();summary.replaceChildren();
 const skill=$("ws-chart-skill").value;
 const range=$("ws-chart-range").value;
 const now=Date.now();
 const filtered=chart.rows.filter(row=>{
  const date=new Date(row.assessed_on+"T12:00:00").getTime();
  return row[skill]!=null&&Number.isFinite(date)&&
   (range==="all"||now-date<=Number(range)*86400000);
 }).sort((a,b)=>a.assessed_on.localeCompare(b.assessed_on));
 if(!filtered.length){
  root.append(node("p","No recorded "+skill+" ratings in this period. Add a skill assessment to create the chart.","ws-extra-empty"));return;
 }
 const NS="http://www.w3.org/2000/svg";
 const svg=document.createElementNS(NS,"svg");
 svg.setAttribute("viewBox","0 0 620 258");
 svg.setAttribute("role","img");
 svg.setAttribute("aria-label",skill+" assessment scores, from 1 to 5, over recorded dates");
 svg.classList.add("ws-chart-svg");
 const shape=(tag,props={})=>{
  const el=document.createElementNS(NS,tag);
  for(const [name,value]of Object.entries(props))el.setAttribute(name,String(value));
  return el;
 };
 const plot={left:39,right:600,top:21,bottom:209};
 const y=score=>plot.bottom-(Number(score)-1)*(plot.bottom-plot.top)/4;
 const x=index=>plot.left+(filtered.length<2?.5:index/(filtered.length-1))*(plot.right-plot.left);
 for(let tick=1;tick<=5;tick++){
  const yy=y(tick);
  svg.append(shape("line",{x1:plot.left,y1:yy,x2:plot.right,y2:yy,class:"ws-chart-grid-line"}));
  const label=shape("text",{x:25,y:yy+4,class:"ws-chart-axis","text-anchor":"end"});
  label.textContent=String(tick);svg.append(label);
 }
 const path=shape("polyline",{points:filtered.map((r,i)=>x(i)+","+y(r[skill])).join(" "),class:"ws-chart-line"});
 if(filtered.length>1)svg.append(path);
 for(const [i,row]of filtered.entries()){
  const circle=shape("circle",{cx:x(i),cy:y(row[skill]),r:4.7,class:"ws-chart-dot",tabindex:"0"});
  const title=shape("title");title.textContent=fmt(row.assessed_on)+": "+skill+" "+row[skill]+"/5";
  circle.append(title);svg.append(circle);
 }
 const first=shape("text",{x:plot.left,y:239,class:"ws-chart-axis"});first.textContent=fmt(filtered[0].assessed_on);
 const last=shape("text",{x:plot.right,y:239,class:"ws-chart-axis","text-anchor":"end"});last.textContent=fmt(filtered[filtered.length-1].assessed_on);
 svg.append(first);
 if(filtered.length>1)svg.append(last);
 root.append(svg);
 const values=filtered.map(row=>Number(row[skill]));
 const summaryText=filtered.length===1
  ?"One recorded rating: "+values[0]+"/5. A second assessment is needed to show change."
  :filtered.length+" recorded ratings · First "+values[0]+"/5 · Latest "+values.at(-1)+"/5 · Change "+(values.at(-1)-values[0]>0?"+":"")+(values.at(-1)-values[0]).toFixed(1);
 summary.append(node("p",summaryText));
 const table=node("table",null,"ws-chart-data");
 const caption=node("caption","Recorded "+skill+" observations (most recent first)");
 const head=node("thead");const header=node("tr");
 for(const textValue of ["Date","Tutor rating"])header.append(node("th",textValue));
 head.append(header);table.append(caption,head);
 const body=node("tbody");
 for(const row of [...filtered].reverse().slice(0,30)){
  const tr=node("tr");tr.append(node("td",fmt(row.assessed_on)),node("td",row[skill]+"/5"));body.append(tr);
 }
 table.append(body);summary.append(table);
}
async function refreshChart(id){
 if(!id||!W()?.userId)return;
 const version=++chart.generation;
 chart.student=id;
 $("ws-progress-chart").replaceChildren(node("p","Loading assessments…","ws-extra-empty"));
 try{
  const rows=await getRecords("atlas_skill_assessments",id,"assessed_on",160);
  if(version!==chart.generation)return;
  chart.rows=rows;renderChart();
 }catch(error){
  if(version!==chart.generation)return;
  $("ws-progress-chart").replaceChildren(node("p","Unable to load skill history. Please retry.","ws-extra-empty"));
 }
}
$("progress-student-select")?.addEventListener("change",event=>{
 chart.rows=[];chart.student=event.target.value;
 if(chart.student)refreshChart(chart.student);
 else{$("ws-progress-chart").replaceChildren(node("p","Choose a student to view recorded progress.","ws-extra-empty"));$("ws-progress-summary").replaceChildren()}
});
for(const id of ["ws-chart-skill","ws-chart-range"])$(id)?.addEventListener("change",renderChart);
document.addEventListener("helloearth:assessment-saved",event=>{
 if(event.detail?.studentId===chart.student)refreshChart(chart.student);
 if(event.detail?.studentId===timeline.selected)refreshTimeline(timeline.selected);
});
document.addEventListener("helloearth:attendance-saved",event=>{
 if(event.detail?.studentId===timeline.selected)refreshTimeline(timeline.selected);
});
document.addEventListener("helloearth:note-saved",event=>{
 if(event.detail?.studentId===timeline.selected)refreshTimeline(timeline.selected);
});
document.addEventListener("helloearth:plan-saved",event=>{
 if(event.detail?.studentId===timeline.selected)refreshTimeline(timeline.selected);
});

// A companion timer is intentionally local to this open browser tab. Nothing
// is recorded until the tutor explicitly saves a lesson note.
const companion={studentId:"",elapsedMs:0,startedAt:0,running:false,interval:null};
const milliseconds=()=>companion.elapsedMs+(companion.running?Math.max(0,Date.now()-companion.startedAt):0);
const clock=ms=>{
 const sec=Math.floor(ms/1000);
 return [Math.floor(sec/3600),Math.floor(sec%3600/60),sec%60].map(n=>String(n).padStart(2,"0")).join(":");
};
function showTimer(){
 if($("ws-companion-clock"))$("ws-companion-clock").textContent=clock(milliseconds());
 if($("ws-companion-toggle"))$("ws-companion-toggle").textContent=companion.running?"Pause":"Start";
}
function updateCompanionStudents(){
 const select=$("ws-companion-student");
 if(!select)return;
 const old=select.value;
 select.replaceChildren(new Option("Choose student",""));
 for(const s of W()?.students||[])select.append(new Option(s.display_name,s.id));
 if([...select.options].some(option=>option.value===old))select.value=old;
 else if([...select.options].some(option=>option.value===companion.studentId))select.value=companion.studentId;
 companion.studentId=select.value;
}
document.addEventListener("helloearth:workspace-data",updateCompanionStudents);
function updateCompanionVisibility(open){
 const panel=$("ws-companion-panel");
 if(!panel)return;
 panel.hidden=!open;
 $("ws-companion-open")?.setAttribute("aria-expanded",String(open));
 if(open){updateCompanionStudents();$("ws-companion-student").focus();showTimer()}
}
$("ws-companion-open")?.addEventListener("click",()=>updateCompanionVisibility($("ws-companion-panel").hidden));
$("ws-companion-close")?.addEventListener("click",()=>updateCompanionVisibility(false));
$("ws-companion-toggle")?.addEventListener("click",()=>{
 if(companion.running){
  companion.elapsedMs=milliseconds();companion.running=false;clearInterval(companion.interval);companion.interval=null;
 }else{
  companion.startedAt=Date.now();companion.running=true;
  companion.interval=setInterval(showTimer,500);
 }
 showTimer();
});
$("ws-companion-reset")?.addEventListener("click",()=>{
 if(!window.confirm("Reset this session timer? Your quick note will remain."))return;
 companion.elapsedMs=0;
 if(companion.running)companion.startedAt=Date.now();
 showTimer();
});
async function loadCompanionPlan(id){
 const target=$("ws-companion-plan");
 target.textContent=id?"Loading latest saved lesson plan…":"Choose a student to see their latest saved lesson plan.";
 if(!id||!W()?.userId)return;
 try{
  const {data,error}=await db.from("atlas_lesson_plans").select("topic,markdown")
   .eq("tutor_id",W().userId).eq("student_id",id)
   .order("created_at",{ascending:false}).limit(1);
  if(error)throw error;
  if(id!==companion.studentId)return;
  target.textContent=data?.length?data[0].markdown:"No saved lesson plan yet. Prepare one from the student profile.";
 }catch(error){target.textContent="Could not load the saved lesson plan."}
}
$("ws-companion-student")?.addEventListener("change",event=>{
 companion.studentId=event.target.value;
 notice("ws-companion-feedback","");
 loadCompanionPlan(companion.studentId);
});
$("ws-companion-save")?.addEventListener("click",async()=>{
 const id=companion.studentId,user=W()?.userId;
 if(!id||!user){notice("ws-companion-feedback","Choose a student first.",true);return}
 const notes=$("ws-companion-note").value.trim();
 const next=$("ws-companion-next").value.trim();
 if(!notes){notice("ws-companion-feedback","Write a lesson note before saving.",true);return}
 const todayDate=new Date();
 const date=new Date(todayDate.getTime()-todayDate.getTimezoneOffset()*60000).toISOString().slice(0,10);
 const button=$("ws-companion-save");button.disabled=true;
 notice("ws-companion-feedback","Saving private lesson note…");
 try{
  const {error}=await db.from("atlas_lesson_notes").insert({
   id:crypto.randomUUID(),tutor_id:user,student_id:id,lesson_date:date,
   summary:notes.slice(0,4000),topics:[],strengths:[],challenges:[],
   next_steps:next?[next.slice(0,350)]:[],homework:""
  });
  if(error)throw error;
  $("ws-companion-note").value="";
  $("ws-companion-next").value="";
  notice("ws-companion-feedback","Note saved to this student's private lesson history.");
  document.dispatchEvent(new CustomEvent("helloearth:note-saved",{detail:{studentId:id}}));
 }catch(error){notice("ws-companion-feedback","Save failed: "+String(error?.message||error).slice(0,140),true)}
 finally{button.disabled=false}
});
document.addEventListener("helloearth:student-opened",event=>{
 if($("ws-companion-panel")?.hidden)return;
 const s=event.detail?.student;
 if(!s)return;
 $("ws-companion-student").value=s.id;companion.studentId=s.id;
 loadCompanionPlan(s.id);
});
document.addEventListener("keydown",event=>{
 if(event.key==="Escape"&&!$("ws-companion-panel")?.hidden)updateCompanionVisibility(false);
});

import {db,$,W,state,esc,dateOnly,friendlyDate,formData,message,refresh,onRender,nameFor,studentFor,groupCurrency,formatMoney,downloadCSV,downloadFile} from "./dashboard-suite-shared.js";
const summary=(label,value,detail="")=>'<div class="he-suite-metric"><small>'+esc(label)+'</small><strong>'+esc(value)+'</strong><span>'+esc(detail)+'</span></div>';
const duration=rows=>rows.reduce((n,r)=>n+(Number(r.duration_minutes)||0),0);
const hours=min=>(min/60).toFixed(1)+" h";
const weekWindow=(day)=>{
 const d=new Date(day+"T12:00:00");
 if(Number.isNaN(d.getTime()))return null;
 d.setDate(d.getDate()-(d.getDay()+6)%7);
 const end=new Date(d);end.setDate(d.getDate()+6);
 return {start:dateOnly(d),end:dateOnly(end)};
};
const between=(d,start,end)=>String(d||"")>=start&&String(d||"")<=end;
function earnings(){
 const root=$("he-suite-earnings"),month=dateOnly().slice(0,7);
 const completed=state.ledger.filter(r=>r.state==="completed");
 const thisMonth=completed.filter(r=>r.lesson_date?.slice(0,7)===month);
 const gross=groupCurrency(thisMonth),outstanding=groupCurrency(thisMonth.filter(r=>!r.paid));
 root.innerHTML=summary("Completed lessons",thisMonth.length,"This month")+summary("Teaching hours",hours(duration(thisMonth)),"Recorded sessions")+
 Object.entries(gross).map(([currency,sum])=>summary("Earned · "+currency,formatMoney(sum,currency),"Total recorded")).join("")+
 Object.entries(outstanding).map(([currency,sum])=>summary("Unpaid · "+currency,formatMoney(sum,currency),"Requires follow-up")).join("");
 const list=$("he-suite-ledger-list");
 list.innerHTML=state.ledger.length?[...state.ledger].sort((a,b)=>b.lesson_date.localeCompare(a.lesson_date)).slice(0,65).map(r=>
  '<div class="he-suite-row"><div><strong>'+esc(nameFor(r.student_id))+' · '+esc(friendlyDate(r.lesson_date))+'</strong>'+
  '<small>'+r.duration_minutes+' minutes · '+esc(r.state)+'</small><p>'+esc(r.note||"")+'</p></div>'+
  '<div class="he-suite-row-actions"><span>'+esc(formatMoney(r.amount,r.currency))+' · '+(r.paid?"Paid":"Unpaid")+'</span>'+
  '<button type="button" data-ledger-delete="'+esc(r.id)+'">Delete</button></div></div>').join(""):
  '<p class="he-suite-empty">No lesson income records yet. Add one above to track your teaching hours and earnings.</p>';
}
let weeklyText="";
function renderWeek(){
 const date=$("he-suite-week-date")?.value||dateOnly(),window=weekWindow(date);
 if(!window)return;
 const {start,end}=window;
 const records=state.ledger.filter(r=>between(r.lesson_date,start,end));
 const completed=records.filter(r=>r.state==="completed"),cancelled=records.filter(r=>r.state==="cancelled"),
 missed=records.filter(r=>r.state==="no_show");
 const attendance=state.attendance.filter(r=>between(r.lesson_date,start,end));
 const notes=state.notes.filter(r=>between(r.lesson_date,start,end));
 const homework=state.homework.filter(r=>r.status==="assigned"&&r.due_on&&r.due_on<=end);
 const bookingRequests=state.bookings.filter(r=>between(r.starts_at?.slice(0,10),start,end));
 const paid=groupCurrency(completed.filter(r=>r.paid));
 const due=groupCurrency(completed.filter(r=>!r.paid));
 const earned=Object.entries(groupCurrency(completed)).map(([code,sum])=>formatMoney(sum,code)).join(" · ")||"No recorded income";
 weeklyText=[
  "HelloEarth · Weekly tutor review",start+" to "+end,"",
  "Completed lessons: "+completed.length,"Teaching hours: "+hours(duration(completed)),
  "Recorded cancellations: "+cancelled.length,"Recorded no-shows: "+missed.length,
  "Attendance records: "+attendance.length,"New lesson notes: "+notes.length,
  "Outstanding homework due by week end: "+homework.length,
  "Internal booking requests: "+bookingRequests.length,"Income: "+earned,
  "Paid: "+(Object.entries(paid).map(([c,n])=>formatMoney(n,c)).join(" · ")||"None"),
  "Unpaid: "+(Object.entries(due).map(([c,n])=>formatMoney(n,c)).join(" · ")||"None"),
  "",
  "Notes: Only saved records counted. Calendar appointments are not automatically completed lessons."
 ].join("\n");
 $("he-suite-week-summary").innerHTML=summary("Completed",completed.length,"Saved lesson records")+
  summary("Hours worked",hours(duration(completed)),"Recorded minutes")+
  summary("No-shows",missed.length,"Saved ledger rows")+
  summary("Cancelled",cancelled.length,"Saved ledger rows")+
  summary("Lesson notes",notes.length,"Dated notes")+
  summary("Homework due",homework.length,"Still assigned")+
  Object.entries(groupCurrency(completed)).map(([c,n])=>summary("Income · "+c,formatMoney(n,c),"Recorded amount")).join("");
}
function reportData(id){
 const student=studentFor(id);
 if(!student)throw Error("Choose a student first.");
 const notes=state.notes.filter(n=>n.student_id===id).sort((a,b)=>b.lesson_date.localeCompare(a.lesson_date)).slice(0,25);
 const skills=state.assessments.filter(a=>a.student_id===id).sort((a,b)=>b.assessed_on.localeCompare(a.assessed_on)).slice(0,25);
 const attendance=state.attendance.filter(a=>a.student_id===id).sort((a,b)=>b.lesson_date.localeCompare(a.lesson_date)).slice(0,50);
 const homework=state.homework.filter(h=>h.student_id===id).slice(0,30);
 return {student,notes,skills,attendance,homework};
}
function reportHtml({student,notes,skills,attendance,homework}){
 const skillNames=["speaking","listening","reading","writing","grammar","confidence"];
 const table=(heading,head,rows)=>'<section><h2>'+esc(heading)+'</h2><table><thead><tr>'+
  head.map(x=>'<th>'+esc(x)+'</th>').join("")+'</tr></thead><tbody>'+
  (rows.length?rows.map(row=>'<tr>'+row.map(cell=>'<td>'+esc(cell)+'</td>').join("")+'</tr>').join(""):
  '<tr><td colspan="'+head.length+'">No records saved yet.</td></tr>')+'</tbody></table></section>';
 const attendCount=attendance.reduce((a,r)=>(a[r.status]=(a[r.status]||0)+1,a),{});
 const headers=skillNames.map(s=>s[0].toUpperCase()+s.slice(1));
 return '<!doctype html><html><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><title>HelloEarth student progress report</title>'+
  '<style>body{font:12px/1.6 system-ui,Arial,sans-serif;color:#1d253e;max-width:900px;margin:32px auto;padding:20px}h1{font-size:28px}h2{font-size:18px;margin-top:28px;color:#55417f}header{border-bottom:2px solid #b5a1d7;padding-bottom:20px}table{width:100%;border-collapse:collapse;font-size:11px;margin-top:12px}th,td{text-align:left;border-bottom:1px solid #dcdde5;padding:9px 7px;vertical-align:top;overflow-wrap:anywhere}th{background:#f1ecfa}section{break-inside:avoid}small{color:#596278}@media print{body{margin:0;max-width:none}section{break-inside:auto}}</style></head><body>'+
  '<header><small>HELLOEARTH · PRIVATE TUTOR PROGRESS REPORT</small><h1>'+esc(student.display_name)+'</h1>'+
  '<p>CEFR profile: <strong>'+esc(student.cefr_level)+'</strong> · Generated '+esc(friendlyDate(dateOnly()))+'</p>'+
  '<p>Learning goals: '+esc((student.learning_goals||[]).join(" · ")||"Not recorded")+'</p></header>'+
  '<p><strong>Attendance:</strong> '+esc(Object.entries(attendCount).map(([k,v])=>k+" "+v).join(" · ")||"No recorded attendance")+'</p>'+
  table("Tutor-rated skill history",["Date",...headers],skills.map(r=>[friendlyDate(r.assessed_on),...skillNames.map(k=>r[k]??"—")]))+
  table("Recorded lessons",["Lesson date","Summary","Next steps"],notes.map(n=>[
   friendlyDate(n.lesson_date),String(n.summary||"").slice(0,1500),(n.next_steps||[]).join("; ").slice(0,700)]))+
  table("Homework",["Task","Due","Status"],homework.map(h=>[h.title,friendlyDate(h.due_on),h.status]))+
  '<p><small>Scores are tutor observations, not automatic CEFR certifications. Review this report before sharing.</small></p></body></html>';
}
function printReport(){
 const id=$("he-suite-report-student").value;
 try{
  const html=reportHtml(reportData(id));
  const popup=window.open("","_blank");
  if(popup){
   popup.document.open();popup.document.write(html);popup.document.close();
   popup.focus();setTimeout(()=>popup.print(),250);
   message("Report opened. Use your browser print dialog to Save as PDF.");
  }else{
   downloadFile("HelloEarth-student-report.html",html,"text/html;charset=utf-8");
   message("Popup blocked. Downloaded a printable HTML report instead.");
  }
 }catch(error){message(error.message,true)}
}
function reportCSV(){
 try{
  const r=reportData($("he-suite-report-student").value),rows=[["record_type","student","date","field","value"]];
  rows.push(["Profile",r.student.display_name,"","CEFR",r.student.cefr_level]);
  for(const a of r.skills)for(const k of ["speaking","listening","reading","writing","grammar","confidence"]){
   if(a[k]!==null&&a[k]!==undefined)rows.push(["Assessment",r.student.display_name,a.assessed_on,k,a[k]]);
  }
  for(const n of r.notes)rows.push(["Lesson note",r.student.display_name,n.lesson_date,"summary",n.summary]);
  for(const a of r.attendance)rows.push(["Attendance",r.student.display_name,a.lesson_date,a.status,a.note]);
  for(const h of r.homework)rows.push(["Homework",r.student.display_name,h.due_on,h.status,h.title]);
  downloadCSV("HelloEarth-student-progress.csv",rows);message("Student data CSV downloaded.");
 }catch(error){message(error.message,true)}
}
export function setupBusiness(){
 $("he-suite-ledger-form").elements.namedItem("lesson_date").value=dateOnly();
 $("he-suite-week-date").value=dateOnly();
 onRender(()=>{earnings();renderWeek()});
 $("he-suite-ledger-form").addEventListener("submit",async e=>{
  e.preventDefault();const p=formData(e.currentTarget);
  try{
   const record={tutor_id:state.userId,student_id:p.student_id||null,
    lesson_date:p.lesson_date,duration_minutes:Number(p.duration_minutes),amount:Number(p.amount),
    currency:p.currency,state:p.state,paid:Boolean(p.paid),note:String(p.note||"").trim()};
   const {error}=await db.from("he_lesson_ledger").insert(record);
   if(error)throw error;
   await refresh(["ledger"]);message("Lesson and payment record saved.");
  }catch(error){message("Could not save earnings record: "+error.message,true)}
 });
 $("he-suite-ledger-list").addEventListener("click",async e=>{
  const btn=e.target.closest("[data-ledger-delete]");if(!btn)return;
  if(!confirm("Delete this earnings record permanently?"))return;
  try{
   const {error}=await db.from("he_lesson_ledger").delete().eq("tutor_id",state.userId).eq("id",btn.dataset.ledgerDelete);
   if(error)throw error;await refresh(["ledger"]);message("Earnings record deleted.");
  }catch(error){message(error.message,true)}
 });
 $("he-suite-ledger-export").addEventListener("click",()=>{
  downloadCSV("HelloEarth-lesson-ledger.csv",[["student","lesson_date","minutes","amount","currency","state","paid","note"],
   ...state.ledger.map(r=>[nameFor(r.student_id),r.lesson_date,r.duration_minutes,r.amount,r.currency,r.state,r.paid?"yes":"no",r.note])]);
  message("Lesson ledger exported.");
 });
 $("he-suite-week-date").addEventListener("change",renderWeek);
 $("he-suite-review").addEventListener("click",renderWeek);
 $("he-suite-review-export").addEventListener("click",()=>{
  renderWeek();downloadFile("HelloEarth-weekly-review.txt",weeklyText);message("Weekly review downloaded.");
 });
 $("he-suite-report-print").addEventListener("click",printReport);
 $("he-suite-report-csv").addEventListener("click",reportCSV);
}

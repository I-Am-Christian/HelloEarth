import {db} from "./supabase-client.js";
const byId=id=>document.getElementById(id);
const view=id=>byId(id+"-tab")?.click();
const profileLink=byId("he-student-dialogues");
let progressRequest=0;
const progressCard=document.createElement("section");progressCard.className="he-recent-learning";progressCard.hidden=true;progressCard.setAttribute("translate","no");
document.querySelector("#student-detail .ws-action-row")?.after(progressCard);
document.addEventListener("helloearth:student-opened",async e=>{
 const s=e.detail?.student;if(!s?.id)return;profileLink.href="student-dialogues.html?student="+encodeURIComponent(s.id);const request=++progressRequest;
 progressCard.hidden=true;progressCard.replaceChildren();
 const {data:{user}}=await db.auth.getUser();if(!user||request!==progressRequest)return;
 const {data,error}=await db.from("he_lesson_reports").select("id,created_at,progress_data").eq("tutor_id",user.id).eq("student_id",s.id).not("progress_data","is",null).order("created_at",{ascending:false}).limit(3);
 if(request!==progressRequest||error||!data?.length)return;
 const heading=document.createElement("h3");heading.textContent="Recent lesson observations";progressCard.append(heading);
 const hint=document.createElement("small");hint.textContent="AI draft · verify against the original speech. Confirmed CEFR and skill ratings are unchanged.";progressCard.append(hint);
 for(const report of data){const p=report.progress_data||{},row=document.createElement("div");row.className="he-recent-learning-row";const date=document.createElement("strong");date.textContent=new Date(p.lessonStartedAt||report.created_at).toLocaleDateString();const summary=document.createElement("p");summary.textContent=p.summary||"Lesson review";row.append(date,summary);const issues=(p.challenges||[]).map(x=>x.observation).filter(Boolean).slice(0,3);if(issues.length){const heading=document.createElement("strong");heading.textContent="Student issues to review";row.append(heading);const list=document.createElement("ul");for(const issue of issues){const li=document.createElement("li");li.textContent=issue;list.append(li)}row.append(list)}const next=document.createElement("small");next.textContent=(p.nextSteps||[]).length?"Next: "+p.nextSteps.join(" · "):"";row.append(next);progressCard.append(row)}
 const link=document.createElement("a");link.className="ws-mini-btn";link.href=profileLink.href;link.textContent="Review issues, homework & teacher feedback";progressCard.append(link);progressCard.hidden=false
});
const overview=byId("overview-view");
if(overview){
 const section=document.createElement("section");section.className="he-daily-actions";section.setAttribute("aria-label","Quick actions");
 const h=document.createElement("h2");h.textContent="What would you like to do?";section.append(h);
 const actions=document.createElement("div");actions.className="he-daily-action-grid";
 for(const [symbol,title,hint,fn] of [
 ["▦","My calendar","See today's lessons",()=>view("calendar")],
 ["♧","My students","Profiles and learning goals",()=>view("students")],
 ["✎","Prepare a lesson","Create and share a workbook",()=>view("lessons")],
 ["▤","Homework","Assign and review exercises",()=>view("homework")],
 ["▥","Lesson reports","Review student progress",()=>view("reports")],
 ["🎙","Live captions","Start transcription",()=>byId("he-live-translate-launch")?.click()]
 ]){
  const b=document.createElement("button");b.type="button";const icon=document.createElement("span");icon.className="he-daily-icon";icon.textContent=symbol;
  const text=document.createElement("span");const strong=document.createElement("strong");strong.textContent=title;const small=document.createElement("small");small.textContent=hint;text.append(strong,small);b.append(icon,text);b.onclick=fn;actions.append(b)
 }
 section.append(actions);overview.prepend(section);
}
const header=document.querySelector(".ux-header-actions");if(header){const b=document.createElement("button");b.type="button";b.className="he-header-live";b.textContent="🎙 Live translation";b.title="Open live audio transcription and translation";b.onclick=()=>byId("he-live-translate-launch")?.click();header.prepend(b)}

const byId=id=>document.getElementById(id);
const view=id=>byId(id+"-tab")?.click();
const profileLink=byId("he-student-dialogues");
document.addEventListener("helloearth:student-opened",e=>{if(e.detail?.student?.id)profileLink.href="student-dialogues.html?student="+encodeURIComponent(e.detail.student.id)});
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

/* HelloEarth dashboard UX — navigation and accessibility layer.
   Delegates to existing, authenticated features rather than making parallel
   copies of student or calendar data. All user text uses textContent. */
import {state as suite, onRender as onSuiteRender} from "./dashboard-suite-shared.js";

const $=id=>document.getElementById(id);
const pages={
 overview:{title:"Dashboard",eyebrow:"WORKSPACE / HOME",caption:"Your students, schedule and next actions."},
 calendar:{title:"Calendar",eyebrow:"WORKSPACE / SCHEDULE",caption:"Your appointments and availability."},
 students:{title:"Students",eyebrow:"WORKSPACE / LEARNERS",caption:"Profiles, goals and lesson notes."},
 progress:{title:"Progress",eyebrow:"WORKSPACE / INSIGHTS",caption:"Student development and CEFR assessments."},
 tools:{title:"Tools & records",eyebrow:"WORKSPACE / TOOLS",caption:"Scheduling, lessons, reports and templates in one place."},
 atlas:{title:"Atlas AI",eyebrow:"EXPLORE / COMING SOON",caption:"Explore planned teaching assistance."}
};
const commands=[
 {title:"Overview",desc:"Your teaching dashboard",page:"overview",symbol:"⌂",terms:"home today"},
 {title:"Calendar",desc:"Appointments, events and time off",page:"calendar",symbol:"▦",terms:"schedule lessons google"},
 {title:"Students",desc:"Student profiles and lesson notes",page:"students",symbol:"♧",terms:"learner names"},
 {title:"Progress",desc:"Assessments and CEFR development",page:"progress",symbol:"▥",terms:"levels charts report"},
 {title:"Bookings & scheduling",desc:"Booking requests and recurring lessons",tool:"schedule",symbol:"▦",terms:"recurring availability"},
 {title:"Homework & preparation",desc:"Assignments and lesson checklists",tool:"students",symbol:"▤",terms:"student care"},
 {title:"Earnings & reports",desc:"Hours, income and student reports",tool:"business",symbol:"◫",terms:"income money weekly"},
 {title:"Teaching templates",desc:"Reusable lesson material and attendance",tool:"resources",symbol:"✧",terms:"resources attendance cancellation"},
 {title:"Atlas AI",desc:"Planned teaching features",page:"atlas",symbol:"✦",terms:"artificial intelligence"},
 {title:"New student",desc:"Create a learner profile",action:"add-student",symbol:"+",terms:"add student learner create"},
 {title:"Schedule lesson",desc:"Open the Google Calendar scheduler",action:"schedule",symbol:"+",terms:"new lesson book appointment"},
 {title:"Start lesson",desc:"Open the live lesson companion",action:"start-lesson",symbol:"▶",terms:"timer companion notes"}
];
const commandDialog=$("ux-command-dialog"),commandInput=$("ux-command-input");
const moreDialog=$("ux-more-dialog");
const searchResults=$("ux-command-results");
let selectedCommand=-1,visibleCommands=[],mostRecentView="overview";
function page(name){
 if(!pages[name])return false;
 $(""+name+"-tab")?.click();
 return true;
}
function tools(which="schedule"){
 const suiteApi=window.HelloEarthTutorSuite;
 if(suiteApi?.open)suiteApi.open(which);
 else{
  page("tools");
  document.querySelector('[data-suite-tab="'+which+'"]')?.click();
 }
 document.querySelectorAll("[data-ux-tool]").forEach(btn=>
  btn.classList.toggle("ux-active-sub",btn.dataset.uxTool===which));
 return true;
}
function addStudent(){
 page("students");
 $("add-student")?.click();
}
function schedule(){
 page("calendar");
 $("calendar-schedule")?.click();
}
function action(name){
 switch(name){
 case "schedule":schedule();break;
 case "add-student":addStudent();break;
 case "start-lesson":$("ws-companion-open")?.click();break;
 case "notes":page("students");break;
 case "homework":tools("students");break;
 case "reports":tools("business");break;
 case "unassessed":
  page("students");
  if(($("stat-assess")?.textContent||"0")!=="0"){
   const field=$("student-search");
   field.value="UNASSESSED";
   field.dispatchEvent(new Event("input",{bubbles:true}));
  }
  break;
 }
}
function go(entry){
 if(entry.studentId){
  page("students");
  const workspace=window.HelloEarthWorkspace;
  workspace?.openStudent(entry.studentId);
  // The existing openStudent method reveals the profile detail.
  return;
 }
 if(entry.tool){tools(entry.tool);return}
 if(entry.action){action(entry.action);return}
 if(entry.page)page(entry.page);
}
function setPageTitle(view){
 const data=pages[view]||pages.overview;
 $("ux-page-title").textContent=data.title;
 $("ux-page-eyebrow").textContent=data.eyebrow;
 $("ux-page-caption").textContent=data.caption;
 for(const btn of document.querySelectorAll("[data-ux-mobile]")){
  const active=btn.dataset.uxMobile===view;
  btn.classList.toggle("is-current",active);
  if(active)btn.setAttribute("aria-current","page");
  else btn.removeAttribute("aria-current");
 }
 const moreIsCurrent= !["overview","calendar","students","tools"].includes(view);
 $("ux-more-open").classList.toggle("is-current",moreIsCurrent);
 $("ux-more-open").setAttribute("aria-label",moreIsCurrent?"More pages (currently "+data.title+")":"More workspace pages");
 const returnBar=$("ux-return-bar");
 if(returnBar){
  returnBar.hidden=view==="overview";
  const hint=$("ux-return-hint");
  if(hint)hint.textContent=data.caption;
 }
 mostRecentView=view;
}
function announceDate(){
 const node=$("ux-today-date");if(!node)return;
 node.textContent=new Date().toLocaleDateString(undefined,{weekday:"long",day:"numeric",month:"long",year:"numeric"}).toUpperCase();
}
function localDate(){
 const now=new Date();
 const offset=now.getTimezoneOffset()*60_000;
 return new Date(now.getTime()-offset).toISOString().slice(0,10);
}
function updateAttention(){
 const students=window.HelloEarthWorkspace?.students||[];
 const haveStudents=Boolean(window.HelloEarthWorkspace?.userId);
 $("ux-attention-unassessed").textContent=haveStudents?
  students.filter(s=>s.cefr_level==="UNASSESSED").length:"—";
 const ready=Boolean(suite.userId&&suite.loaded);
 const hasError=prefix=>suite.errors.some(e=>e.startsWith(prefix+":"));
 $("ux-attention-notes").textContent=ready&&!hasError("notes")?
  suite.notes.length:"—";
 $("ux-attention-homework").textContent=ready&&!hasError("homework")?
  suite.homework.filter(h=>h.status==="assigned"&&h.due_on&&h.due_on<localDate()).length:"—";
}
function openDialog(dialog){
 if(!dialog)return;
 if(!dialog.open)dialog.showModal();
}
function closeDialog(dialog){if(dialog?.open)dialog.close()}
function closeSearch(){closeDialog(commandDialog)}
function collectCommands(q){
 const query=q.trim().toLocaleLowerCase();
 const max=14;
 const matched=commands.filter(c=>(c.title+" "+c.desc+" "+c.terms).toLocaleLowerCase().includes(query));
 const students=window.HelloEarthWorkspace?.students||[];
 if(query.length>=2){
  const studentMatches=students.filter(student=>
   [student.display_name,student.cefr_level,...(student.learning_goals||[]),...(student.interests||[])]
    .join(" ").toLocaleLowerCase().includes(query));
  const found=studentMatches.slice(0,max).map(student=>({
   title:student.display_name,desc:"Student · "+(student.cefr_level==="UNASSESSED"?"Not assessed":student.cefr_level),
   studentId:student.id,symbol:(student.display_name||"S").slice(0,1).toUpperCase()
  }));
  return [...found,...matched].slice(0,max);
 }
 return matched.slice(0,9);
}
function renderCommands(){
 const list=collectCommands(commandInput.value);
 visibleCommands=list;
 searchResults.replaceChildren();
 const category=document.createElement("div");category.className="ux-command-group";
 category.textContent=commandInput.value.trim()?"MATCHING RESULTS":"QUICK ACCESS";
 searchResults.append(category);
 if(!list.length){
  const msg=document.createElement("p");msg.className="ux-command-empty";
  msg.textContent="No matching pages or students. Try a different name or topic.";
  searchResults.append(msg);selectedCommand=-1;return;
 }
 list.forEach((entry,index)=>{
  const button=document.createElement("button");button.type="button";
  button.className="ux-command-result";
  button.id="ux-result-"+index;button.setAttribute("role","option");
  button.setAttribute("aria-selected",String(index===0));
  if(index===0)button.classList.add("is-selected");
  const symbol=document.createElement("span");symbol.className="ux-result-icon";symbol.textContent=entry.symbol;
  const body=document.createElement("span");body.className="ux-result-content";
  const heading=document.createElement("strong");heading.textContent=entry.title;
  const desc=document.createElement("small");desc.textContent=entry.desc;
  body.append(heading,desc);
  const arrow=document.createElement("span");arrow.textContent="↗";
  button.append(symbol,body,arrow);
  button.addEventListener("click",()=>{closeSearch();go(entry)});
  searchResults.append(button);
 });
 selectedCommand=0;
}
function setCommandSelection(next){
 const buttons=[...searchResults.querySelectorAll(".ux-command-result")];
 if(!buttons.length)return;
 selectedCommand=(next+buttons.length)%buttons.length;
 buttons.forEach((btn,i)=>{
  btn.classList.toggle("is-selected",i===selectedCommand);
  btn.setAttribute("aria-selected",String(i===selectedCommand));
 });
 buttons[selectedCommand].scrollIntoView({block:"nearest"});
}
function openSearch(){
 if(commandDialog.open)return;
 commandInput.value="";
 renderCommands();
 openDialog(commandDialog);
 commandInput.focus();
}
$("ux-command-open").addEventListener("click",openSearch);
$("ux-more-open").addEventListener("click",()=>openDialog(moreDialog));
document.querySelectorAll("[data-ux-close]").forEach(btn=>btn.addEventListener("click",()=>{
 closeDialog(btn.dataset.uxClose==="more"?moreDialog:commandDialog);
}));
commandDialog.addEventListener("click",e=>{if(e.target===commandDialog)closeSearch()});
moreDialog.addEventListener("click",e=>{if(e.target===moreDialog)closeDialog(moreDialog)});
commandInput.addEventListener("input",renderCommands);
commandInput.addEventListener("keydown",e=>{
 if(e.key==="ArrowDown"){e.preventDefault();setCommandSelection(selectedCommand+1)}
 else if(e.key==="ArrowUp"){e.preventDefault();setCommandSelection(selectedCommand-1)}
 else if(e.key==="Enter"){
  e.preventDefault();
  const entry=visibleCommands[selectedCommand];
  if(entry){closeSearch();go(entry)}
 }
});
document.addEventListener("keydown",e=>{
 const shortcut=(e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k";
 if(!shortcut)return;
 if(document.querySelector(".ws-modal:not([hidden])"))return;
 e.preventDefault();
 if(commandDialog.open)closeSearch();else openSearch();
});
$("ux-header-add-student").addEventListener("click",addStudent);
$("ux-overview-search")?.addEventListener("click",openSearch);
document.querySelectorAll("[data-ux-action]").forEach(btn=>btn.addEventListener("click",()=>action(btn.dataset.uxAction)));
document.querySelectorAll("[data-ux-tool]").forEach(btn=>
 btn.addEventListener("click",()=>tools(btn.dataset.uxTool)));
document.querySelectorAll("[data-ux-more-view]").forEach(btn=>btn.addEventListener("click",()=>{
 closeDialog(moreDialog);page(btn.dataset.uxMoreView);
}));
document.querySelectorAll("[data-ux-more-tool]").forEach(btn=>btn.addEventListener("click",()=>{
 closeDialog(moreDialog);tools(btn.dataset.uxMoreTool);
}));
document.querySelectorAll("[data-ux-mobile]").forEach(btn=>btn.addEventListener("click",()=>closeDialog(moreDialog)));
document.addEventListener("helloearth:view-changed",e=>{
 const name=e.detail?.view;
 if(pages[name])setPageTitle(name);
 if(name!=="tools"){
  document.querySelectorAll(".ux-nav-sub").forEach(btn=>btn.classList.remove("ux-active-sub"));
 }
 closeDialog(moreDialog);
});
document.addEventListener("helloearth:studentsloaded",updateAttention);
document.addEventListener("helloearth:workspace-data",updateAttention);
document.addEventListener("helloearth:attendance-saved",updateAttention);
onSuiteRender(updateAttention);
// Refresh if the tab is revisited while another part of the app has updated.
window.addEventListener("focus",updateAttention);
setPageTitle(pages[location.hash.slice(1)]?location.hash.slice(1):"overview");
announceDate();
updateAttention();

import { db } from "./supabase-client.js";

const copy={
 en:{start:"Get started",dashboard:"Dashboard",open:"Open dashboard",plan:"Get started →",planOpen:"Open dashboard →"},
 af:{start:"Begin",dashboard:"Paneel",open:"Maak paneel oop",plan:"Begin →",planOpen:"Maak paneel oop →"},
 es:{start:"Empezar",dashboard:"Panel",open:"Abrir panel",plan:"Empezar →",planOpen:"Abrir panel →"},
 pt:{start:"Começar",dashboard:"Painel",open:"Abrir painel",plan:"Começar →",planOpen:"Abrir painel →"},
 fr:{start:"Commencer",dashboard:"Tableau de bord",open:"Ouvrir le tableau de bord",plan:"Commencer →",planOpen:"Ouvrir le tableau de bord →"},
 pl:{start:"Rozpocznij",dashboard:"Panel",open:"Otwórz panel",plan:"Rozpocznij →",planOpen:"Otwórz panel →"},
 ru:{start:"Начать",dashboard:"Панель управления",open:"Открыть панель",plan:"Начать →",planOpen:"Открыть панель →"},
 zh:{start:"立即开始",dashboard:"控制面板",open:"打开控制面板",plan:"立即开始 →",planOpen:"打开控制面板 →"}
};
let signedIn=false;
const locale=()=>copy[document.documentElement.lang]||copy.en;
function render(){
 const words=locale();
 for(const anchor of document.querySelectorAll("[data-auth-login]"))anchor.hidden=signedIn;
 for(const anchor of document.querySelectorAll("[data-auth-start]")){
  const kind=anchor.dataset.authStart;
  anchor.href=signedIn?"dashboard.html":"register.html";
  const title=kind==="plan"
   ?(signedIn?words.planOpen:words.plan)
   :kind==="hero"&&signedIn?words.open
   :(signedIn?words.dashboard:words.start);
  if(anchor.textContent!==title)anchor.textContent=title;
 }
}
async function refresh(){
 try{
  const {data,error}=await db.auth.getSession();
  if(error)return;
  signedIn=Boolean(data?.session?.user);
  render();
  if(!signedIn)return;
  const {data:verified,error:verificationError}=await db.auth.getUser();
  if(!verificationError){signedIn=Boolean(verified?.user);render()}
 }catch{}
}
db.auth.onAuthStateChange((event,session)=>{
 if(event==="SIGNED_OUT"){signedIn=false;render()}
 else if(session?.user){signedIn=true;render()}
});
document.addEventListener("helloearth:languagechanged",render);
document.addEventListener("helloearth:pricingcardsupdated",render);
window.addEventListener("pageshow",event=>{if(event.persisted)refresh()});
document.addEventListener("visibilitychange",()=>{if(!document.hidden)refresh()});
render();
refresh();

import { db } from "./supabase-client.js";
const login=document.querySelector("[data-auth-login]");
const dashboard=document.querySelector("[data-auth-dashboard]");
const start=document.querySelector(".nav-cta");
const heroStart=document.querySelector(".hero-actions>.button");
const labels={en:["Get started","Dashboard"],af:["Begin","Paneel"],es:["Empezar","Panel"],pt:["Começar","Painel"],fr:["Commencer","Tableau de bord"],pl:["Rozpocznij","Panel"],ru:["Начать","Панель управления"],zh:["立即开始","控制面板"]};
let currentUser=null;
function update(user){
 currentUser=user;
 const lang=document.documentElement.lang||"en";
 const words=labels[lang]||labels.en;
 if(login)login.hidden=Boolean(user);
 if(dashboard)dashboard.hidden=!user;
 if(start){start.href=user?"dashboard.html":"register.html";start.textContent=words[user?1:0]}
 if(heroStart){heroStart.href=user?"dashboard.html":"register.html";heroStart.textContent=words[user?1:0]}
}
async function refresh(){
 try{const {data:{user},error}=await db.auth.getUser();update(error?null:user)}
 catch{update(null)}
}
db.auth.onAuthStateChange(()=>{refresh()});
document.addEventListener("helloearth:languagechanged",()=>update(currentUser));
refresh();

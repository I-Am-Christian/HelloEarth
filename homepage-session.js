import { db } from "./supabase-client.js";
const login=document.querySelector("[data-auth-login]");
const dashboard=document.querySelector("[data-auth-dashboard]");
const start=document.querySelector(".nav-cta");
function update(user){
  if(login)login.hidden=Boolean(user);
  if(dashboard)dashboard.hidden=!user;
  if(start){start.href=user?"dashboard.html":"register.html";start.textContent=user?"Open dashboard":"Get started";}
}
async function refresh(){
  try{const {data:{user},error}=await db.auth.getUser();update(error?null:user)}
  catch{update(null)}
}
db.auth.onAuthStateChange(()=>{refresh()});
refresh();

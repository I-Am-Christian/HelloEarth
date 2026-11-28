import {db} from "./supabase-client.js";
const root=document.getElementById("he-ai-allowance");
if(root){
 const button=root.querySelector("summary"),value=root.querySelector("[data-allowance-value]"),details=root.querySelector("[data-allowance-details]");
 let busy=false,again=false;
 const fmt=n=>Number(n).toLocaleString();
 const row=(label,amount)=>{const x=document.createElement("div"),a=document.createElement("span"),b=document.createElement("strong");a.textContent=label;b.textContent=amount;x.append(a,b);return x};
 async function refresh(){
  if(busy){again=true;return}busy=true;
  try{
   const {data:{session}}=await db.auth.getSession();if(!session){value.textContent="—";return}
   const {data,error}=await db.rpc("he_my_ai_allowance");if(error||!data)throw Error(error?.message||"Unavailable");
   const d=data;value.textContent=d.unlimited?"∞":fmt(Math.min(d.dailyRemaining,d.monthlyRemaining))+" left";
   root.classList.toggle("is-unlimited",d.unlimited===true);
   button.title=d.unlimited?"Internal tester · no normal AI generation quota":"Remaining Nova workbook generations today";
   const heading=document.createElement("strong");heading.textContent=d.unlimited?"Internal tester · unlimited plan":d.plan.charAt(0).toUpperCase()+d.plan.slice(1)+" plan";
   const note=document.createElement("small");note.textContent="Generations and chats have separate quotas. Tracked tokens are usage, not a token balance. Resets at midnight UTC. Provider and emergency safety limits may apply.";
   details.replaceChildren(heading,row("Workbooks today",d.unlimited?"∞":fmt(d.dailyRemaining)+" / "+fmt(d.dailyLimit)),row("Workbooks this month",d.unlimited?"∞":fmt(d.monthlyRemaining)+" / "+fmt(d.monthlyLimit)),row("Nova chats today",d.unlimited?"∞":fmt(d.chatRemaining)+" / "+fmt(d.chatLimit)),row("Tracked tokens this month",fmt(d.trackedTokens)),note);
  }catch{value.textContent="—";details.replaceChildren(row("Allowance","Unavailable"))}
  finally{busy=false;if(again){again=false;refresh()}}
 }
 root.addEventListener("toggle",()=>{if(root.open)refresh()});
 document.addEventListener("click",e=>{if(!root.contains(e.target))root.open=false});
 document.addEventListener("keydown",e=>{if(e.key==="Escape"&&root.open){root.open=false;button.focus({preventScroll:true})}});
 for(const name of ["helloearth:ai-usage-changed","helloearth:workspace-data","helloearth:view-changed","helloearth:studentsloaded"])document.addEventListener(name,refresh);
 db.auth.onAuthStateChange(()=>setTimeout(refresh,0));
 window.addEventListener("focus",refresh);document.addEventListener("visibilitychange",()=>{if(!document.hidden)refresh()});
 setInterval(()=>{if(!document.hidden)refresh()},30000);refresh();
}

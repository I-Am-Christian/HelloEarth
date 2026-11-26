import {db} from "./supabase-client.js";
const el=id=>document.getElementById(id),form=el("he-home-nova-form"),input=el("he-home-nova-input"),log=el("he-home-nova-log"),deep=el("he-home-nova-deep"),send=el("he-home-nova-send");
let busy=false;
function bubble(text,user=false){const p=document.createElement("p");p.className=user?"he-home-nova-user":"he-home-nova-reply";p.textContent=text;log.append(p);while(log.children.length>30)log.firstElementChild.remove();log.scrollTop=log.scrollHeight}
const faq=[
 [/\b(?:price|pricing|cost|subscription|free|plans?)\b/i,"The free workspace supports basic student recordkeeping. See Pricing for current proposed plans and AI allowances."],
 [/\b(?:translate|translation|caption|transcri\w*|recording)\b/i,"Live classroom translation can capture microphone and shared computer audio with permission. The teacher chooses the student's language and starts recording; cloud usage limits apply."],
 [/\b(?:homework|assignment|worksheet)\b/i,"Create homework in the dashboard or generate targeted exercises from a completed lesson review. Review the worksheet and private answer key before sharing."],
 [/\b(?:progress|assessment|rating|feedback|review)\b/i,"Student profiles show notes and confirmed skill ratings. Choose Complete & review in Saved lessons to record difficulties and next steps."],
 [/\b(?:lesson|workbook|classroom|teach)\b/i,"Nova creates CEFR-aligned workbooks with exercises and answer keys. You can save them in student folders, share a classroom link, and edit together during class."],
 [/\b(?:atlas|nova|ai)\b/i,"Nova is HelloEarth's teaching assistant. Atlas is a separate project. Quick questions use keyword help; detailed AI support requires a signed-in account."],
 [/\b(?:student|learner|privacy|private|data)\b/i,"Student records are private to the signed-in educator. Nova can use the selected learner's records for lesson personalisation when permitted."],
 [/\b(?:calendar|schedule|booking)\b/i,"Use the Calendar in your signed-in workspace to organise your teaching schedule."],
 [/^(?:hi|hello|hey|help)[!. ]*$/i,"Hi! Ask about lessons, homework, progress, classroom tools or pricing."]
];
async function ask(value){const text=value.trim().slice(0,600);if(!text||busy)return;busy=true;send.disabled=true;bubble(text,true);input.value="";
 try{if(!deep.checked){bubble(faq.find(([p])=>p.test(text))?.[1]||"I can answer common HelloEarth questions. For a more complex request, select Detailed AI and sign in.");return}
 const {data:{session}}=await db.auth.getSession();if(!session){bubble("Detailed AI is available after signing in. Open the private workspace to continue.");return}
 bubble("Preparing a detailed answer…");const waiting=log.lastElementChild;const {data,error}=await db.functions.invoke("he-nova",{body:{message:text,detailed:true,explainOnly:true}});waiting.remove();if(error){let msg=error.message;try{msg=(await error.context.json()).error||msg}catch{}throw Error(msg)}bubble(data?.message||"No answer returned.");
 }catch(e){bubble("Nova couldn't answer: "+e.message)}finally{busy=false;send.disabled=false}}
form.addEventListener("submit",e=>{e.preventDefault();ask(input.value)});for(const b of document.querySelectorAll("[data-ask]"))b.onclick=()=>ask(b.dataset.ask);

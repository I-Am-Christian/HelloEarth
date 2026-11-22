import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from "./supabase-config.js";
const $=id=>document.getElementById(id);
const token=location.hash.replace(/^#/,"").trim();
const endpoint=SUPABASE_URL+"/functions/v1/he-exercises";
const message=(text,error=false)=>{$("exercise-status").textContent=text;$("exercise-status").classList.toggle("is-error",error)};
let exercise=null;
async function request(action,payload={}){
 const res=await fetch(endpoint,{method:"POST",cache:"no-store",headers:{
   "content-type":"application/json","apikey":SUPABASE_PUBLISHABLE_KEY
 },body:JSON.stringify({action,token,...payload})});
 let data;try{data=await res.json()}catch{throw Error("The service did not respond. Please try again.")}
 if(!res.ok)throw Error(data.error||"Could not load this exercise.");
 return data;
}
function makeQuestion(q){
 const fieldset=document.createElement("fieldset");fieldset.className="exercise-question";
 const legend=document.createElement("legend");legend.textContent=(q.index+1)+". "+q.prompt;
 fieldset.append(legend);
 if(q.type==="choice"){
   q.options.forEach((o,i)=>{
     const label=document.createElement("label");label.className="exercise-option";
     const input=document.createElement("input");input.type="radio";input.name="question-"+q.index;input.value=String(i);input.required=true;
     const text=document.createElement("span");text.textContent=o;label.append(input,text);fieldset.append(label);
   });
 }else{
   const textarea=document.createElement("textarea");textarea.name="question-"+q.index;textarea.maxLength=1000;
   textarea.required=true;textarea.rows=4;textarea.placeholder="Write your answer here…";fieldset.append(textarea);
 }
 return fieldset;
}
async function start(){
 if(!/^[0-9a-f]{64}$/i.test(token)){message("This private link is missing or invalid. Ask your teacher for a new one.",true);return}
 try{
   exercise=await request("open");
   $("exercise-title").textContent=exercise.title;
   $("exercise-instructions").textContent=exercise.instructions||"Answer the questions below and submit when you're finished.";
   if(exercise.submitted){message("Your answers were already submitted. Thank you!");return}
   $("exercise-questions").replaceChildren(...exercise.questions.map(makeQuestion));
   $("exercise-form").hidden=false;
   message("Your teacher will see your answers after you submit.");
 }catch(err){message(err.message,true)}
}
$("exercise-form").addEventListener("submit",async e=>{
 e.preventDefault();if(!exercise)return;
 const answers=[];
 for(let i=0;i<exercise.questions.length;i++){
   const val=new FormData(e.currentTarget).get("question-"+i);
   if(typeof val!=="string"||!val.trim()){message("Please answer every question first.",true);return}
   answers.push(val.trim());
 }
 const button=$("exercise-submit");button.disabled=true;button.textContent="Saving…";
 try{
   await request("submit",{answers});
   $("exercise-form").hidden=true;
   message("All done! Your answers were saved successfully. Your teacher can review them now.");
 }catch(err){message(err.message,true);button.disabled=false;button.textContent="Submit my answers"}
});
start();

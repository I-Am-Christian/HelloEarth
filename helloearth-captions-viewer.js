import {db} from "./supabase-client.js";
// Ephemeral, signed messages are broadcast over a randomly named Realtime channel.
// The tutor signs packets; viewers can verify, but can't forge a tutor's signature.
const el=id=>document.getElementById(id);
const params=new URLSearchParams(location.hash.slice(1));
const room=params.get("r")||"",expires=Number(params.get("e")||0);
const pubEncoded=params.get("k")||"";
const feed=el("he-viewer-feed"),status=el("he-viewer-status"),empty=el("he-viewer-empty");
let channel=null,publicKey=null;
let shown=new Map(),sequence=0;
const encoder=new TextEncoder();
function b64uToBytes(encoded){
 const base=encoded.replace(/-/g,"+").replace(/_/g,"/");
 const binary=atob(base+"=".repeat((4-base.length%4)%4));
 return Uint8Array.from(binary,c=>c.charCodeAt(0));
}
const statusText=(value,ok=false)=>{
 status.textContent=value;status.classList.toggle("connected",ok);
 status.classList.toggle("error",!ok);
};
const stamp=created=>new Date(created).toLocaleTimeString(undefined,{hour:"2-digit",minute:"2-digit"});
function makeRow(packet){
 empty?.remove();
 const row=document.createElement("article");row.className="caption";
 const header=document.createElement("div");header.className="caption-head";
 const who=document.createElement("strong");who.textContent=packet.source||"Live speech";
 const when=document.createElement("span");when.textContent=stamp(packet.created);
 header.append(who,when);
 const original=document.createElement("p");original.className="original";original.textContent=packet.text;
 const translated=document.createElement("p");translated.className="translated";translated.hidden=true;
 row.append(header,original,translated);feed.append(row);
 const record={row,original,translated,text:packet.text,source:packet.source,created:packet.created,translation:""};
 shown.set(packet.seq,record);
 while(shown.size>180){
  const first=shown.keys().next().value;shown.get(first).row.remove();shown.delete(first);
 }
 el("he-viewer-copy").disabled=false;el("he-viewer-download").disabled=false;
 row.scrollIntoView({block:"end",behavior:"smooth"});
}
async function onCaption(message){
 const envelope=message?.payload;
 if(!envelope||typeof envelope!=="object"||typeof envelope.signature!=="string")return;
 const packet=envelope.data;
 if(!packet||packet.v!==1||packet.room!==room||!Number.isInteger(packet.seq)||
   !Number.isFinite(packet.created)||packet.created>expires||
   Math.abs(Date.now()-packet.created)>150000||Date.now()>expires)return;
 if(!["caption","translation"].includes(packet.type))return;
 const signed=encoder.encode(JSON.stringify(packet));
 const signature=b64uToBytes(envelope.signature);
 if(!await crypto.subtle.verify({name:"ECDSA",hash:"SHA-256"},publicKey,signature,signed))return;
 if(packet.type==="caption"){
  if(packet.seq<=sequence||typeof packet.text!=="string"||packet.text.length>1500)return;
  sequence=packet.seq;makeRow(packet);
 }else{
  const row=shown.get(packet.seq);
  if(!row||typeof packet.translation!=="string"||packet.translation.length>1500)return;
  row.translation=packet.translation;row.translated.textContent=packet.translation;
  row.translated.hidden=false;
 }
}
function end(reason){
 if(channel){db.removeChannel(channel);channel=null}
 statusText(reason);
}
async function connect(){
 if(!/^[a-f0-9]{32,64}$/i.test(room)||!Number.isFinite(expires)||
   Date.now()>expires||expires>Date.now()+2*60*60*1000||pubEncoded.length>1100){
  statusText("Invalid or expired session link");return;
 }
 if(!crypto?.subtle){statusText("Secure browser required for caption verification");return}
 try{
  const jwk=JSON.parse(new TextDecoder().decode(b64uToBytes(pubEncoded)));
  if(jwk.kty!=="EC"||jwk.crv!=="P-256"||jwk.d)throw Error("invalid");
  publicKey=await crypto.subtle.importKey("jwk",jwk,{name:"ECDSA",namedCurve:"P-256"},false,["verify"]);
  channel=db.channel("he-live-caption-"+room,{config:{broadcast:{self:false}}});
  channel.on("broadcast",{event:"caption"},e=>{onCaption(e).catch(()=>{})});
  channel.subscribe(state=>{
   if(state==="SUBSCRIBED")statusText("Connected · live",true);
   else if(["CHANNEL_ERROR","TIMED_OUT","CLOSED"].includes(state))statusText("Connection interrupted");
  });
  statusText("Connecting to tutor…");
  const timer=setInterval(()=>{
   if(Date.now()>=expires){clearInterval(timer);end("Session expired")}
   else{
    const left=Math.ceil((expires-Date.now())/60000);
    el("he-viewer-expires").textContent=left+" min remaining";
   }
  },15000);
 }catch{statusText("This caption link couldn't be verified")}
}
function seenText(){
 return [...shown.values()].map(row=>
  "["+stamp(row.created)+"] "+row.source+"\n"+row.text+
  (row.translation?"\nTranslation: "+row.translation:"")).join("\n\n");
}
el("he-viewer-copy").addEventListener("click",async()=>{
 try{await navigator.clipboard.writeText(seenText());statusText("Copied · live",true)}
 catch{statusText("Unable to copy automatically")}
});
el("he-viewer-download").addEventListener("click",()=>{
 const blob=new Blob([seenText()],{type:"text/plain;charset=utf-8"});
 const url=URL.createObjectURL(blob),a=document.createElement("a");
 a.download="helloearth-class-captions.txt";a.href=url;document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
});
connect();

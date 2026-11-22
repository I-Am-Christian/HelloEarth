/* Browser-only display preference. No calendar credentials or student data stored. */
const storageKey="helloearth:time-format";
const valid=value=>value==="12h"?"12h":"24h";
let format=valid((()=>{try{return localStorage.getItem(storageKey)}catch{return null}})());
const options={hour:"2-digit",minute:"2-digit"};
function formatTime(value){
 const d=value instanceof Date?value:new Date(value);
 if(!Number.isFinite(d.getTime()))return "";
 return d.toLocaleTimeString(undefined,{...options,hour12:format==="12h"});
}
window.HelloEarthTime={
 get format(){return format},
 formatTime,
};
const settings=document.getElementById("he-time-format");
function update(){
 if(settings)settings.value=format;
 const label=document.getElementById("he-time-example");
 if(label)label.textContent=format==="24h"?"Example: 14:30":"Example: 2:30 PM";
}
settings?.addEventListener("change",()=>{
 format=valid(settings.value);
 try{localStorage.setItem(storageKey,format)}catch{}
 update();
 document.dispatchEvent(new CustomEvent("helloearth:time-format-changed",{detail:{format}}));
});
update();

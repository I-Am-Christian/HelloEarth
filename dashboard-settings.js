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

/* Appearance is browser-local and applies before the workspace renders. */
const themeKey="helloearth:appearance";
const appearance=document.getElementById("he-appearance");
const themeDescription=document.getElementById("he-appearance-description");
const validTheme=value=>value==="dark"?"dark":"light";
function applyAppearance(value,persist=false){
 const theme=validTheme(value);
 document.documentElement.dataset.heTheme=theme;
 document.querySelector('meta[name="theme-color"]')?.setAttribute("content",theme==="dark"?"#101727":"#f3f2f7");
 if(appearance)appearance.value=theme;
 if(themeDescription)themeDescription.textContent=theme==="dark"?"Dark mode · the original midnight-purple palette.":"Light mode · soft grey and lavender surfaces.";
 if(persist)try{localStorage.setItem(themeKey,theme)}catch{}
 document.dispatchEvent(new CustomEvent("helloearth:appearance-changed",{detail:{theme}}));
}
applyAppearance(document.documentElement.dataset.heTheme);
appearance?.addEventListener("change",()=>applyAppearance(appearance.value,true));
window.addEventListener("storage",event=>{if(event.key===themeKey)applyAppearance(event.newValue)});

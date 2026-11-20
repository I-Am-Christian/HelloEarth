/* Retired in Hello Earth's database-only repositioning.
   No public tutor data, names, rankings or historical credits are disclosed.
   Existing records are preserved privately for possible account requests.
*/
const origins=new Set([
 "https://helloearth.co.za","https://www.helloearth.co.za",
 "https://i-am-christian.github.io","http://localhost:8000","http://127.0.0.1:8000"
]);
Deno.serve(req=>{
 const origin=req.headers.get("Origin");
 const headers=new Headers({
  "Content-Type":"application/json; charset=utf-8",
  "Cache-Control":"no-store","Vary":"Origin",
  "Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods":"POST, OPTIONS"
 });
 if(origin&&origins.has(origin))headers.set("Access-Control-Allow-Origin",origin);
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers});
 if(req.method!=="POST")return new Response(JSON.stringify({error:"Method not allowed"}),{status:405,headers});
 return new Response(JSON.stringify({
  retired:true,
  boards:{lessons:[],attendance:[],bookings:[],hours:[]},
  participants:0,
  message:"Hello Earth now focuses on private student databases. The leaderboard and financial reward concept are discontinued."
 }),{status:200,headers});
});

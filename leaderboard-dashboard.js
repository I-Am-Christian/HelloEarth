import {db} from "./supabase-client.js";
import {mountLeaderboard} from "./leaderboard-core.js";
const root=document.getElementById("leaderboard-dashboard");
const leaderboard=mountLeaderboard(root,{
 privateMode:true,
 getToken:async()=>{
  const {data,error}=await db.auth.getSession();
  if(error)throw error;
  return data?.session?.access_token||null;
 }
});
function open(){
 if(window.HelloEarthWorkspace?.userId)leaderboard.load();
}
document.getElementById("leaderboard-tab")?.addEventListener("click",open);
document.addEventListener("helloearth:workspace-data",open);
if(window.HelloEarthWorkspace?.userId)open();
